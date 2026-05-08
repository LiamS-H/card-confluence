use datafusion::common::metadata::FieldMetadata;
use datafusion::common::DFSchema;
use datafusion::functions::core::expr_ext::FieldAccessor;
use datafusion::functions::expr_fn::named_struct;
use datafusion::logical_expr::{col, lit, not, Expr as DFExpr, LogicalPlan, LogicalPlanBuilder};
use datafusion::prelude::{JoinType, SessionContext};
use datafusion::scalar::ScalarValue;
use datafusion_functions_aggregate::expr_fn::{array_agg, first_value};
use datafusion_functions_nested::expr_fn::make_array;

use crate::query_parser::parser::ScryfallExpr;
use crate::query_parser::planner::predicates::PredicateField;

pub mod expressions;
pub mod predicates;

#[derive(Debug)]
pub struct PlanError(pub String);

impl std::fmt::Display for PlanError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "Plan error: {}", self.0)
    }
}

impl std::error::Error for PlanError {}

impl From<datafusion::error::DataFusionError> for PlanError {
    fn from(e: datafusion::error::DataFusionError) -> Self {
        PlanError(e.to_string())
    }
}

#[derive(Debug, Default)]
pub struct QueryOptions {
    pub order: Option<String>,
    pub dir: Option<String>,
    pub unique: Option<String>,
    pub prefer: Option<String>,
}

pub fn extract_options(expr: &ScryfallExpr) -> Result<(ScryfallExpr, QueryOptions), PlanError> {
    let mut options = QueryOptions::default();
    let filtered_expr = extract_options_recursive(expr, &mut options, false)?;
    Ok((filtered_expr, options))
}

fn extract_options_recursive(
    expr: &ScryfallExpr,
    options: &mut QueryOptions,
    is_nested: bool,
) -> Result<ScryfallExpr, PlanError> {
    match expr {
        ScryfallExpr::Predicate(p) => {
            let field = PredicateField::try_from(p.field.as_str())?;
            match field {
                PredicateField::Order
                | PredicateField::Dir
                | PredicateField::Unique
                | PredicateField::Prefer => {
                    if is_nested {
                        return Err(PlanError(format!(
                            "Keyword '{}' is not allowed in nested expressions",
                            p.field
                        )));
                    }
                    match field {
                        PredicateField::Order => options.order = Some(p.value.clone()),
                        PredicateField::Dir => options.dir = Some(p.value.clone()),
                        PredicateField::Unique => options.unique = Some(p.value.clone()),
                        PredicateField::Prefer => options.prefer = Some(p.value.clone()),
                        _ => unreachable!(),
                    }
                    Ok(ScryfallExpr::True)
                }
                _ => Ok(expr.clone()),
            }
        }
        ScryfallExpr::And(l, r) => {
            let l_filtered = extract_options_recursive(l, options, is_nested)?;
            let r_filtered = extract_options_recursive(r, options, is_nested)?;
            match (l_filtered, r_filtered) {
                (ScryfallExpr::True, r) => Ok(r),
                (l, ScryfallExpr::True) => Ok(l),
                (l, r) => Ok(ScryfallExpr::And(Box::new(l), Box::new(r))),
            }
        }
        ScryfallExpr::Or(l, r) => {
            let l_filtered = extract_options_recursive(l, options, true)?;
            let r_filtered = extract_options_recursive(r, options, true)?;
            Ok(ScryfallExpr::Or(Box::new(l_filtered), Box::new(r_filtered)))
        }
        ScryfallExpr::Not(inner) => {
            let inner_filtered = extract_options_recursive(inner, options, true)?;
            Ok(ScryfallExpr::Not(Box::new(inner_filtered)))
        }
        ScryfallExpr::True => Ok(ScryfallExpr::True),
    }
}

pub async fn build_query_plan(
    ctx: &SessionContext,
    expr: &ScryfallExpr,
) -> Result<LogicalPlan, PlanError> {
    let (expr, options) = extract_options(expr)?;

    let cards_plan = ctx.table("cards").await?.into_unoptimized_plan();
    let prints_plan = ctx.table("prints").await?.into_unoptimized_plan();

    let mut builder = LogicalPlanBuilder::from(cards_plan);

    builder = builder.join(
        prints_plan,
        JoinType::Inner,
        (vec!["cards.oracle_id"], vec!["prints.oracle_id"]),
        None,
    )?;

    if needs_sets_table(&expr)? {
        let sets_plan = ctx.table("sets").await?.into_unoptimized_plan();
        builder = builder.join(
            sets_plan,
            JoinType::Inner,
            (vec!["prints.set_code"], vec!["sets.code"]),
            None,
        )?;
    }

    let schema = builder.schema().clone();
    builder = builder.filter(expr_to_df_expr(&expr, &schema)?)?;

    let unique = options.unique.as_deref().unwrap_or("cards");
    match unique {
        "cards" => {
            let prefer_expr = if let Some(prefer) = options.prefer {
                let sort_expr = match prefer.as_str() {
                    "oldest" => col("prints.released_at").sort(true, true),
                    "newest" => col("prints.released_at").sort(false, true),
                    "cheapest" => col("prints.prices").field("usd").sort(true, true),
                    other => return Err(PlanError(format!("Unknown prefer mode: {other}"))),
                };
                vec![sort_expr]
            } else {
                vec![]
            };

            builder = builder.aggregate(
                vec![
                    col("cards.oracle_id"),
                    col("cards.name"),
                    col("cards.mana_cost"),
                    col("cards.cmc"),
                ],
                vec![first_value(col("prints.scryfall_id"), prefer_expr).alias("first_print")],
            )?;

            builder = builder.project(vec![
                col("cards.oracle_id"),
                col("cards.name"),
                col("cards.mana_cost"),
                make_array(vec![col("first_print")]).alias("matched_prints"),
            ])?;
        }
        "prints" => {
            builder = builder.project(vec![
                col("cards.oracle_id"),
                col("cards.name"),
                col("cards.mana_cost"),
                make_array(vec![col("prints.scryfall_id")]).alias("matched_prints"),
            ])?;
        }
        other => return Err(PlanError(format!("Unknown unique mode: {other}"))),
    }

    if let Some(order) = options.order {
        let dir = options.dir.as_deref().unwrap_or("asc");
        let ascending = match dir {
            "asc" | "ascending" => true,
            "desc" | "descending" => false,
            other => return Err(PlanError(format!("Unknown direction: {other}"))),
        };

        let order_expr = match order.as_str() {
            "cmc" => col("cards.cmc"),
            "usd" | "eur" | "tix" => col("prints.prices").field(&order),
            other => return Err(PlanError(format!("Unknown order field: {other}"))),
        };

        builder = builder.sort(vec![order_expr.sort(ascending, true)])?;
    }

    Ok(builder.build()?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::query_parser::lexer::tokenize;
    use crate::query_parser::parser::parse;

    fn p(input: &str) -> ScryfallExpr {
        let tokens = tokenize(input).expect("lex");
        parse(tokens).expect("parse")
    }

    #[test]
    fn test_extract_options_simple() {
        let expr = p("t:creature order:cmc");
        let (filtered, options) = extract_options(&expr).unwrap();
        assert_eq!(options.order, Some("cmc".to_string()));
        assert!(matches!(filtered, ScryfallExpr::Predicate(_)));
    }

    #[test]
    fn test_extract_options_multiple() {
        let expr = p("t:creature order:usd dir:desc unique:prints prefer:newest");
        let (filtered, options) = extract_options(&expr).unwrap();
        assert_eq!(options.order, Some("usd".to_string()));
        assert_eq!(options.dir, Some("desc".to_string()));
        assert_eq!(options.unique, Some("prints".to_string()));
        assert_eq!(options.prefer, Some("newest".to_string()));
        assert!(matches!(filtered, ScryfallExpr::Predicate(_)));
    }

    #[test]
    fn test_extract_options_nested_error() {
        let expr = p("t:creature (order:cmc or t:instant)");
        let res = extract_options(&expr);
        assert!(res.is_err());
        assert!(res.unwrap_err().0.contains("not allowed in nested"));

        let expr = p("t:creature (prefer:oldest or t:instant)");
        let res = extract_options(&expr);
        assert!(res.is_err());
        assert!(res.unwrap_err().0.contains("not allowed in nested"));
    }

    #[test]
    fn test_extract_options_overwrite() {
        let expr = p("order:usd order:cmc");
        let (_, options) = extract_options(&expr).unwrap();
        assert_eq!(options.order, Some("cmc".to_string()));
    }
}

fn schema_as_flat_struct(table: &str, schema: &DFSchema) -> DFExpr {
    let kv_pairs: Vec<_> = schema
        .fields()
        .iter()
        .flat_map(|f| {
            let name = f.name();
            [
                DFExpr::Literal(
                    ScalarValue::Utf8(Some(name.clone())),
                    Some(FieldMetadata::from(f.metadata())),
                ),
                col(format!("{table}.{name}")),
            ]
        })
        .collect();

    named_struct(kv_pairs)
}

fn schemas_as_cols(table: &str, schema: &DFSchema) -> Vec<DFExpr> {
    schema
        .fields()
        .iter()
        .map(|f| col(format!("{}.{}", table, f.name())))
        .collect()
}

pub async fn build_cards_detail_plan(
    ctx: &SessionContext,
    ids: Vec<String>,
) -> Result<LogicalPlan, PlanError> {
    let cards_table = ctx.table("cards").await?;
    let cards_schema = cards_table.schema().clone();
    let cards_plan = cards_table.into_unoptimized_plan();

    let prints_table = ctx.table("prints").await?;
    let prints_schema = prints_table.schema().clone();
    let prints_plan = prints_table.into_unoptimized_plan();

    let mut builder = LogicalPlanBuilder::from(cards_plan);

    let id_exprs: Vec<_> = ids.into_iter().map(lit).collect();
    let filter_expr = col("oracle_id").in_list(id_exprs, false);
    builder = builder.filter(filter_expr)?;

    builder = builder.join(
        prints_plan,
        JoinType::Inner,
        (vec!["cards.oracle_id"], vec!["prints.oracle_id"]),
        None,
    )?;

    builder = builder.aggregate(
        schemas_as_cols("cards", &cards_schema),
        vec![array_agg(schema_as_flat_struct("prints", &prints_schema)).alias("prints")],
    )?;

    Ok(builder.build()?)
}

pub async fn build_rulings_plan(
    ctx: &SessionContext,
    ids: Vec<String>,
) -> Result<LogicalPlan, PlanError> {
    let plan = ctx.table("rulings").await?.into_unoptimized_plan();

    let mut builder = LogicalPlanBuilder::from(plan);

    let id_exprs: Vec<_> = ids.into_iter().map(lit).collect();
    let filter_expr = col("oracle_id").in_list(id_exprs, false);

    builder = builder.filter(filter_expr)?;

    Ok(builder.build()?)
}

pub async fn build_sets_plan(
    ctx: &SessionContext,
    codes: Vec<String>,
) -> Result<LogicalPlan, PlanError> {
    let plan = ctx.table("sets").await?.into_unoptimized_plan();

    let mut builder = LogicalPlanBuilder::from(plan);

    if codes.len() > 0 {
        let id_exprs: Vec<_> = codes.into_iter().map(lit).collect();
        let filter_expr = col("oracle_id").in_list(id_exprs, false);

        builder = builder.filter(filter_expr)?;
    }

    Ok(builder.build()?)
}

pub fn needs_prints_table(expr: &ScryfallExpr) -> Result<bool, PlanError> {
    match expr {
        ScryfallExpr::Predicate(p) => {
            Ok(PredicateField::try_from(p.field.as_str())?.needs_print_table(&p.value))
        }
        ScryfallExpr::And(l, r) | ScryfallExpr::Or(l, r) => {
            Ok(needs_prints_table(l)? || needs_prints_table(r)?)
        }
        ScryfallExpr::Not(inner) => needs_prints_table(inner),
        ScryfallExpr::True => Ok(false),
    }
}

pub fn needs_sets_table(expr: &ScryfallExpr) -> Result<bool, PlanError> {
    match expr {
        ScryfallExpr::Predicate(p) => {
            PredicateField::try_from(p.field.as_str()).map(|f| f.needs_set_table(&p.value))
        }
        ScryfallExpr::And(l, r) | ScryfallExpr::Or(l, r) => {
            Ok(needs_sets_table(l)? || needs_sets_table(r)?)
        }
        ScryfallExpr::Not(inner) => needs_sets_table(inner),
        ScryfallExpr::True => Ok(false),
    }
}

pub fn expr_to_df_expr(expr: &ScryfallExpr, schema: &DFSchema) -> Result<DFExpr, PlanError> {
    match expr {
        ScryfallExpr::Predicate(pred) => pred.to_df_expr(),
        ScryfallExpr::And(l, r) => Ok(expr_to_df_expr(l, schema)?.and(expr_to_df_expr(r, schema)?)),
        ScryfallExpr::Or(l, r) => Ok(expr_to_df_expr(l, schema)?.or(expr_to_df_expr(r, schema)?)),
        ScryfallExpr::Not(inner) => Ok(not(expr_to_df_expr(inner, schema)?)),
        ScryfallExpr::True => Ok(lit(true)),
    }
}

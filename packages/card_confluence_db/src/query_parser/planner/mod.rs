use datafusion::common::metadata::FieldMetadata;
use datafusion::common::DFSchema;
use datafusion::functions::expr_fn::named_struct;
use datafusion::logical_expr::{col, lit, not, Expr as DFExpr, LogicalPlan, LogicalPlanBuilder};
use datafusion::prelude::{JoinType, SessionContext};
use datafusion::scalar::ScalarValue;
use datafusion_functions_aggregate::expr_fn::{array_agg, first_value};

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

pub async fn build_query_plan(
    ctx: &SessionContext,
    expr: &ScryfallExpr,
) -> Result<LogicalPlan, PlanError> {
    let cards_plan = ctx.table("cards").await?.into_unoptimized_plan();
    let prints_plan = ctx.table("prints").await?.into_unoptimized_plan();

    let mut builder = LogicalPlanBuilder::from(cards_plan);

    builder = builder.join(
        prints_plan,
        JoinType::Inner,
        (vec!["cards.oracle_id"], vec!["prints.oracle_id"]),
        None,
    )?;

    if needs_sets_table(expr)? {
        let sets_plan = ctx.table("sets").await?.into_unoptimized_plan();
        builder = builder.join(
            sets_plan,
            JoinType::Inner,
            (vec!["prints.set_code"], vec!["sets.code"]),
            None,
        )?;
    }

    let schema = builder.schema().clone();
    builder = builder.filter(expr_to_df_expr(expr, &schema)?)?;

    builder = builder.aggregate(
        vec![
            col("cards.oracle_id"),
            col("cards.name"),
            col("cards.mana_cost"),
        ],
        vec![first_value(col("prints.scryfall_id"), vec![]).alias("matched_prints")],
    )?;

    Ok(builder.build()?)
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
        vec![array_agg(schema_as_flat_struct("prints", &prints_schema)).alias("matched_prints")],
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

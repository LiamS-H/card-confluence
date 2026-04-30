use datafusion::common::metadata::FieldMetadata;
use datafusion::common::DFSchema;
use datafusion::functions::expr_fn::named_struct;
use datafusion::functions_aggregate::expr_fn::{array_agg, max};
use datafusion::logical_expr::{col, lit, not, Expr as DFExpr, LogicalPlan, LogicalPlanBuilder};
use datafusion::logical_expr::{when, Expr};
use datafusion::prelude::{JoinType, SessionContext};
use datafusion::scalar::ScalarValue;
use datafusion_functions_nested::remove::array_remove;

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

pub async fn build_plan(
    ctx: &SessionContext,
    expr: &ScryfallExpr,
) -> Result<LogicalPlan, PlanError> {
    let cards_plan = ctx.table("cards").await?.into_unoptimized_plan();
    let prints_table = ctx.table("prints").await?;
    let prints_schema = prints_table.schema().clone();
    let prints_plan = prints_table.into_unoptimized_plan();

    let (oracle_expr, print_expr) = split_expr(expr)?;

    // 1. Filter Cards (This yields your ~10 rows)
    let filtered_cards_plan = {
        let mut builder = LogicalPlanBuilder::from(cards_plan);
        if let Some(ref of) = oracle_expr {
            let schema = builder.schema().clone();
            builder = builder.filter(expr_to_df_expr(of, &schema)?)?;
        }
        builder.build()?
    };

    // 2. Base Join (Join the 10 cards to their prints)
    let base_joined_plan = {
        let mut builder = LogicalPlanBuilder::from(filtered_cards_plan.clone()).join(
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
        builder.build()?
    };

    // 3. Prepare Single-Pass Expressions
    let print_struct = prints_as_struct(&prints_schema);

    // We create a filter expression, defaulting to 'true' if no print_expr is provided
    let has_match_expr = if let Some(ref pf) = print_expr {
        let schema = base_joined_plan.schema().clone();
        expr_to_df_expr(pf, &schema)?
    } else {
        lit(true)
    };

    // Pack matched prints, or yield NULL if they don't match the print_expr
    let matched_print_expr = when(has_match_expr.clone(), col("prints.oracle_id")) // Adjust to whichever print field you want in the array
        .otherwise(lit(ScalarValue::Null))?;

    // 4. Fast Aggregate: Group ONLY by oracle_id
    let aggregated_prints_plan = LogicalPlanBuilder::from(base_joined_plan)
        .aggregate(
            vec![col("cards.oracle_id").alias("agg_oracle_id")], // ONLY the primary key
            vec![
                array_agg(print_struct).alias("all_prints"),
                array_agg(matched_print_expr).alias("matched_prints_raw"),
                // Creates a 1 if ANY print matched, 0 otherwise
                max(when(has_match_expr, lit(1i32)).otherwise(lit(0i32))?).alias("_has_match"),
            ],
        )?
        // Fix for the test failures: Strip out cards that had 0 matching prints
        .filter(col("_has_match").eq(lit(1i32)))?
        .build()?;

    // 5. Join Back: Attach the 10 aggregated rows back to the 10 full card rows
    let final_plan = LogicalPlanBuilder::from(filtered_cards_plan)
        .join(
            aggregated_prints_plan,
            JoinType::Inner, // Inner join ensures cards dropped in step 4 are dropped here
            (vec!["cards.oracle_id"], vec!["agg_oracle_id"]),
            None,
        )?
        // 6. Clean up: Strip nulls from the matched array and drop the temp columns
        .project(
            oracle_group_cols()
                .into_iter()
                .chain(vec![
                    col("all_prints"),
                    array_remove(col("matched_prints_raw"), lit(ScalarValue::Null))
                        .alias("matched_prints"),
                ])
                .collect::<Vec<_>>(),
        )?
        .build()?;

    Ok(final_plan)
}

fn prints_as_struct(prints_schema: &DFSchema) -> Expr {
    // Build pairs of ("field_name", col("prints.field_name")) for every prints column
    let args: Vec<Expr> = prints_schema
        .fields()
        .iter()
        .flat_map(|f| {
            let name = f.name();
            [
                Expr::Literal(
                    ScalarValue::Utf8(Some(name.clone())),
                    Some(FieldMetadata::from(f.metadata())),
                ),
                col(format!("prints.{}", name)),
            ]
        })
        .collect();

    named_struct(args)
}

pub fn split_expr(
    expr: &ScryfallExpr,
) -> Result<(Option<ScryfallExpr>, Option<ScryfallExpr>), PlanError> {
    match expr {
        ScryfallExpr::Predicate(p) => {
            let is_print = PredicateField::try_from(p.field.as_str())?.needs_print_table(&p.value);

            if is_print {
                Ok((None, Some(expr.clone())))
            } else {
                Ok((Some(expr.clone()), None))
            }
        }

        ScryfallExpr::And(l, r) => {
            let (lo, lp) = split_expr(l)?;
            let (ro, rp) = split_expr(r)?;
            Ok((combine_and(lo, ro), combine_and(lp, rp)))
        }

        // OR crossing scopes: conservatively treat as print-side so the
        // full filter runs in subquery B. The oracle filter in subquery A
        // will just be absent for this subtree, meaning more cards come
        // through A — but B will still filter them correctly.
        ScryfallExpr::Or(l, r) => {
            let either_print = needs_prints_table(r)? || needs_prints_table(l)?;
            if either_print {
                Ok((None, Some(expr.clone())))
            } else {
                Ok((Some(expr.clone()), None))
            }
        }

        ScryfallExpr::Not(inner) => {
            let (o, p) = split_expr(inner)?;
            Ok((
                o.map(|e| ScryfallExpr::Not(Box::new(e))),
                p.map(|e| ScryfallExpr::Not(Box::new(e))),
            ))
        }

        ScryfallExpr::True => Ok((Some(ScryfallExpr::True), None)),
    }
}

fn combine_and(a: Option<ScryfallExpr>, b: Option<ScryfallExpr>) -> Option<ScryfallExpr> {
    match (a, b) {
        (Some(a), Some(b)) => Some(ScryfallExpr::And(Box::new(a), Box::new(b))),
        (Some(a), None) => Some(a),
        (None, Some(b)) => Some(b),
        (None, None) => None,
    }
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

pub fn expr_to_df_expr(expr: &ScryfallExpr, schema: &DFSchema) -> Result<DFExpr, PlanError> {
    match expr {
        ScryfallExpr::Predicate(pred) => pred.to_df_expr(),
        ScryfallExpr::And(l, r) => Ok(expr_to_df_expr(l, schema)?.and(expr_to_df_expr(r, schema)?)),
        ScryfallExpr::Or(l, r) => Ok(expr_to_df_expr(l, schema)?.or(expr_to_df_expr(r, schema)?)),
        ScryfallExpr::Not(inner) => Ok(not(expr_to_df_expr(inner, schema)?)),
        ScryfallExpr::True => Ok(lit(true)),
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

fn oracle_group_cols() -> Vec<DFExpr> {
    [
        "oracle_id",
        "name",
        "layout",
        "cmc",
        "color_identity",
        "color_indicator",
        "colors",
        "game_changer",
        "reserved",
        "otags",
        "edhrec_rank",
        "penny_rank",
        "power",
        "toughness",
        "loyalty",
        "defense",
        "keywords",
        "legalities",
        "mana_cost",
        "oracle_text",
        "produced_mana",
        "type_line",
        "card_types",
        "super_types",
        "sub_types",
        "all_parts",
        "preview",
        "card_faces",
    ]
    .iter()
    .map(|name| col(format!("cards.{name}")))
    .collect()
}

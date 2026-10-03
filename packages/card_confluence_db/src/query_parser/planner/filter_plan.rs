use datafusion::logical_expr::{LogicalPlan, LogicalPlanBuilder, col, lit};
use datafusion::prelude::{JoinType, SessionContext};
use datafusion::scalar::ScalarValue;
use uuid::Uuid;

use crate::query_parser::parser::ScryfallExpr;
use crate::query_parser::planner::expr::{expr_to_df_expr, needs_sets_table};
use crate::query_parser::planner::{PlanError, extract_options};

pub async fn build_filter_plan(
    ctx: &SessionContext,
    ids: Vec<Uuid>,
    expr: &ScryfallExpr,
) -> Result<LogicalPlan, PlanError> {
    let (expr, _options) = extract_options(expr)?;

    let values = ids
        .into_iter()
        .enumerate()
        .map(|(i, id)| {
            vec![
                lit(i as i64),
                lit(ScalarValue::FixedSizeBinary(16, Some(id.into()))),
            ]
        })
        .collect::<Vec<_>>();

    if values.is_empty() {
        return Ok(LogicalPlanBuilder::empty(false).build()?);
    }

    let values_plan = LogicalPlanBuilder::values(values)?
        .project(vec![
            col("column1").alias("index"),
            col("column2").alias("input_id"),
        ])?
        .build()?;

    let cards_plan = ctx.table("cards").await?.into_unoptimized_plan();
    let prints_plan = ctx.table("prints").await?.into_unoptimized_plan();

    let mut query_builder = LogicalPlanBuilder::from(cards_plan);

    query_builder = query_builder.join(
        prints_plan,
        JoinType::Inner,
        (vec!["cards.oracle_id"], vec!["prints.oracle_id"]),
        None,
    )?;

    if needs_sets_table(&expr)? {
        let sets_plan = ctx.table("sets").await?.into_unoptimized_plan();
        query_builder = query_builder.join(
            sets_plan,
            JoinType::Inner,
            (vec!["prints.set_code"], vec!["sets.code"]),
            None,
        )?;
    }

    let schema = query_builder.schema().clone();
    query_builder = query_builder.filter(expr_to_df_expr(&expr, &schema)?)?;

    let query_plan = query_builder
        .project(vec![col("cards.oracle_id").alias("matched_id")])?
        .distinct()?
        .build()?;

    let mut builder = LogicalPlanBuilder::from(values_plan);
    builder = builder.join(
        query_plan,
        JoinType::Left,
        (vec!["input_id"], vec!["matched_id"]),
        None,
    )?;

    builder = builder.sort(vec![col("index").sort(true, true)])?;

    builder = builder.project(vec![col("matched_id").is_not_null().alias("matched")])?;

    Ok(builder.build()?)
}

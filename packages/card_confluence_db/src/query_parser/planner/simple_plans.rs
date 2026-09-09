use datafusion::logical_expr::{LogicalPlan, LogicalPlanBuilder, col, lit};
use datafusion::prelude::SessionContext;

use crate::query_parser::planner::PlanError;

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

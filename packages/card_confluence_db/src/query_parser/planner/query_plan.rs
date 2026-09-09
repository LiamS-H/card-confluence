use datafusion::logical_expr::{LogicalPlan, LogicalPlanBuilder, col};
use datafusion::prelude::{JoinType, SessionContext};

use datafusion::functions::core::expr_ext::FieldAccessor;
use datafusion_functions_aggregate::expr_fn::{first_value, min};
use datafusion_functions_nested::expr_fn::make_array;

use crate::query_parser::parser::ScryfallExpr;
use crate::query_parser::planner::expr::{expr_to_df_expr, needs_sets_table};
use crate::query_parser::planner::{PlanError, QueryOptions, extract_options};

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

    let ascending = resolve_direction(&options)?;
    let order = options.order.unwrap_or("cmc".to_owned());

    let unique = options.unique.as_deref().unwrap_or("cards");
    match unique {
        "cards" => build_unique_cards(builder, order, ascending, options.prefer)?,
        "prints" => build_unique_prints(builder, order, ascending)?,
        other => return Err(PlanError(format!("Unknown unique mode: {other}"))),
    }
    .build()
    .map_err(PlanError::from)
}

fn resolve_direction(options: &QueryOptions) -> Result<Option<bool>, PlanError> {
    match &options.dir {
        Some(dir) => match dir.as_str() {
            "asc" | "ascending" => Ok(Some(true)),
            "desc" | "descending" => Ok(Some(false)),
            other => Err(PlanError(format!("Unknown direction: {other}"))),
        },
        None => Ok(None),
    }
}

fn build_unique_cards(
    mut builder: LogicalPlanBuilder,
    order: String,
    ascending: Option<bool>,
    prefer: Option<String>,
) -> Result<LogicalPlanBuilder, PlanError> {
    let prefer_expr = if let Some(prefer) = prefer {
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

    let mut aggr_exprs =
        vec![first_value(col("prints.scryfall_id"), prefer_expr).alias("first_print")];
    let mut sort_exprs = vec![];

    match order.as_str() {
        "cmc" => {
            sort_exprs.push(col("cards.cmc").sort(ascending.unwrap_or(true), true));
            sort_exprs.push(col("cards.name").sort(true, true));
        }
        "usd" | "eur" | "tix" => {
            let sort_col = format!("sort_{}", order);
            aggr_exprs.push(min(col("prints.prices").field(&order)).alias(&sort_col));
            sort_exprs.push(col(sort_col).sort(ascending.unwrap_or(true), false));
            sort_exprs.push(col("cards.name").sort(true, true));
        }
        "release" | "released" | "date" | "year" => {
            let first_col = "first_release".to_owned();
            aggr_exprs.push(min(col("prints.released_at")).alias(&first_col));
            sort_exprs.push(col(&first_col).sort(ascending.unwrap_or(false), false));
            sort_exprs.push(col("cards.name").sort(true, true));
        }
        other => return Err(PlanError(format!("Unknown order field: {other}"))),
    }

    builder = builder.aggregate(
        vec![
            col("cards.oracle_id"),
            col("cards.name"),
            col("cards.mana_cost"),
            col("cards.cmc"),
        ],
        aggr_exprs,
    )?;

    builder = builder.sort(sort_exprs)?;

    builder = builder.project(vec![
        col("cards.oracle_id"),
        col("cards.name"),
        col("cards.mana_cost"),
        make_array(vec![col("first_print")]).alias("matched_prints"),
    ])?;

    Ok(builder)
}

fn build_unique_prints(
    mut builder: LogicalPlanBuilder,
    order: String,
    ascending: Option<bool>,
) -> Result<LogicalPlanBuilder, PlanError> {
    let mut sort_exprs = vec![];
    match order.as_str() {
        "cmc" => {
            sort_exprs.push(col("cards.cmc").sort(ascending.unwrap_or(true), true));
            sort_exprs.push(col("cards.name").sort(true, true));
            sort_exprs.push(col("prints.released_at").sort(false, true));
        }
        "usd" | "eur" | "tix" => {
            sort_exprs.push(
                col("prints.prices")
                    .field(&order)
                    .sort(ascending.unwrap_or(true), false),
            );
            sort_exprs.push(col("cards.name").sort(true, true));
            sort_exprs.push(col("prints.released_at").sort(false, true));
        }
        other => return Err(PlanError(format!("Unknown order field: {other}"))),
    }

    builder = builder.sort(sort_exprs)?;

    builder = builder.project(vec![
        col("cards.oracle_id"),
        col("cards.name"),
        col("cards.mana_cost"),
        make_array(vec![col("prints.scryfall_id")]).alias("matched_prints"),
    ])?;

    Ok(builder)
}

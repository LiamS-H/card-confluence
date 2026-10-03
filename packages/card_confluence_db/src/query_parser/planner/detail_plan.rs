use datafusion::common::DFSchema;
use datafusion::common::metadata::FieldMetadata;
use datafusion::functions::expr_fn::named_struct;
use datafusion::logical_expr::{Expr as DFExpr, LogicalPlan, LogicalPlanBuilder, col, lit};
use datafusion::prelude::{JoinType, SessionContext};
use datafusion::scalar::ScalarValue;
use datafusion_functions_aggregate::expr_fn::array_agg;
use uuid::Uuid;

use crate::query_parser::planner::PlanError;

fn struct_kv_pairs(table: &str, schema: &DFSchema) -> Vec<DFExpr> {
    schema
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
        .collect()
}

fn schema_as_flat_struct(table: &str, schema: &DFSchema) -> DFExpr {
    named_struct(struct_kv_pairs(table, schema))
}

fn schemas_as_cols(table: &str, schema: &DFSchema) -> Vec<DFExpr> {
    schema
        .fields()
        .iter()
        .map(|f| col(format!("{table}.{}", f.name())))
        .collect()
}

pub async fn build_cards_detail_plan(
    ctx: &SessionContext,
    ids: Vec<Uuid>,
) -> Result<LogicalPlan, PlanError> {
    let cards_table = ctx.table("cards").await?;
    let cards_schema = cards_table.schema().clone();
    let cards_plan = cards_table.into_unoptimized_plan();

    let prints_table = ctx.table("prints").await?;
    let prints_schema = prints_table.schema().clone();
    let prints_plan = prints_table.into_unoptimized_plan();

    let sets_table = ctx.table("sets").await?;
    let sets_schema = sets_table.schema().clone();
    let sets_plan = sets_table.into_unoptimized_plan();

    let rulings_table = ctx.table("rulings").await?;
    let rulings_schema = rulings_table.schema().clone();
    let rulings_plan = rulings_table.into_unoptimized_plan();

    // Build the id-list filter once and reuse it against every table's own
    // oracle_id column. Applying it before each aggregation is what actually
    // keeps this fast — without it, prints_agg/rulings_agg have no way to
    // know they only need one card's worth of rows, and end up scanning and
    // grouping the entire table before the join ever narrows anything down.
    let id_exprs: Vec<_> = ids
        .into_iter()
        .map(|id| lit(ScalarValue::FixedSizeBinary(16, Some(id.into()))))
        .collect();
    let cards_filter = col("oracle_id").in_list(id_exprs.clone(), false);
    let prints_filter = col("prints.oracle_id").in_list(id_exprs.clone(), false);
    let rulings_filter = col("rulings.oracle_id").in_list(id_exprs, false);

    // --- prints (with embedded set), pre-aggregated per oracle_id.
    // Aggregating here, before joining to cards, means a card with N prints
    // never gets multiplied by however many rulings it also has.
    let mut prints_kv = struct_kv_pairs("prints", &prints_schema);
    prints_kv.push(DFExpr::Literal(
        ScalarValue::Utf8(Some("set".to_string())),
        None,
    ));
    prints_kv.push(schema_as_flat_struct("sets", &sets_schema));
    let print_struct = named_struct(prints_kv);

    let prints_agg_plan = LogicalPlanBuilder::from(prints_plan)
        .filter(prints_filter)?
        .join(
            sets_plan,
            JoinType::Inner,
            (vec!["prints.set_code"], vec!["sets.code"]),
            None,
        )?
        .aggregate(
            vec![col("prints.oracle_id")],
            vec![array_agg(print_struct).alias("prints")],
        )?
        .alias("prints_agg")?
        .build()?;

    // --- rulings, pre-aggregated per oracle_id, same reasoning as above.
    let rulings_struct = schema_as_flat_struct("rulings", &rulings_schema);
    let rulings_agg_plan = LogicalPlanBuilder::from(rulings_plan)
        .filter(rulings_filter)?
        .aggregate(
            vec![col("rulings.oracle_id")],
            vec![array_agg(rulings_struct).alias("rulings")],
        )?
        .alias("rulings_agg")?
        .build()?;

    // --- cards, filtered, joined onto the two pre-aggregated relations.
    // prints_agg: INNER, every card is expected to have at least one print.
    // rulings_agg: LEFT, a card with no rulings just gets NULL for "rulings"
    // (rather than [] or a list containing a null struct) since the
    // aggregation already happened before this join.
    let builder = LogicalPlanBuilder::from(cards_plan)
        .filter(cards_filter)?
        .join(
            prints_agg_plan,
            JoinType::Inner,
            (vec!["cards.oracle_id"], vec!["prints_agg.oracle_id"]),
            None,
        )?
        .join(
            rulings_agg_plan,
            JoinType::Left,
            (vec!["cards.oracle_id"], vec!["rulings_agg.oracle_id"]),
            None,
        )?;

    let mut select_exprs = schemas_as_cols("cards", &cards_schema);
    select_exprs.push(col("prints_agg.prints"));
    select_exprs.push(col("rulings_agg.rulings"));

    Ok(builder.project(select_exprs)?.build()?)
}

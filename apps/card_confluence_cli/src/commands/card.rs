use std::sync::Arc;

use anyhow::Result;
use card_confluence_db::query_parser::planner::build_cards_detail_plan;
use card_confluence_db::{
    context::{get_context, get_latest_paths},
    query_parser::parse_query,
};
use datafusion::{arrow::array::Array, logical_expr::col};
use object_store::ObjectStore;

pub async fn exec(parquet_store: Arc<dyn ObjectStore>, text: String) -> Result<()> {
    let paths = get_latest_paths(parquet_store.clone()).await?;
    let ctx = get_context(parquet_store, paths).await?;

    let plan = parse_query(&ctx, &text).await?;
    let df = ctx.execute_logical_plan(plan).await?;

    let df = df.select(vec![col("oracle_id")])?;
    let count = df.clone().count().await?;
    eprintln!("found {} cards", count);

    let batches = df.collect().await?;

    // Use Arrow's native iterators to safely find the first non-null value across all batches
    let id = batches
        .iter()
        .flat_map(|batch| {
            batch
                .column(0)
                .as_any()
                .downcast_ref::<datafusion::arrow::array::StringViewArray>()
                .expect("Expected StringViewArray")
                .iter()
        })
        .flatten()
        .next()
        .unwrap_or("not_found");

    eprintln!("found id:{}", id);

    let plan = build_cards_detail_plan(&ctx, vec![id.to_string()]).await?;

    let df = ctx.execute_logical_plan(plan).await?;
    eprintln!("detailed card fetched {} cards", df.clone().count().await?);
    df.show().await?;
    eprintln!("success");

    Ok(())
}

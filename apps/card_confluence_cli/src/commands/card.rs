use std::fs::File;
use std::io::Write;
use std::sync::Arc;

use anyhow::Context;
use anyhow::Result;

use card_confluence_db::query_parser::planner::build_cards_detail_plan;
use card_confluence_db::{
    context::{get_context, get_latest_paths},
    query_parser::parse_query,
};
use datafusion::arrow::util::pretty::pretty_format_batches;
use datafusion::{arrow::array::Array, logical_expr::col};
use object_store::ObjectStore;
use uuid::Uuid;

pub async fn exec(parquet_store: Arc<dyn ObjectStore>, text: String) -> Result<()> {
    let paths = get_latest_paths(parquet_store.clone()).await?;
    let ctx = get_context(parquet_store, paths).await?;

    let plan = parse_query(&ctx, &text).await?;
    let df = ctx.execute_logical_plan(plan).await?;

    let df = df.select(vec![col("oracle_id")])?;
    let count = df.clone().count().await?;
    eprintln!("found {} cards", count);

    let batches = df.collect().await?;

    let id = batches
        .iter()
        .flat_map(|batch| {
            batch
                .column(0)
                .as_any()
                .downcast_ref::<datafusion::arrow::array::FixedSizeBinaryArray>()
                .expect("Expected StringViewArray")
                .iter()
        })
        .flatten()
        .next()
        .context("Failed to find card")?;

    let uuid: Uuid = Uuid::from_slice(id).context("malformed uuid")?;

    eprintln!("found id:{}", uuid);

    let plan = build_cards_detail_plan(&ctx, vec![uuid]).await?;

    let df = ctx.execute_logical_plan(plan).await?;

    let explain_df = df.clone().explain(false, true)?;
    let explain_batches = explain_df.collect().await?;
    let formatted_string = pretty_format_batches(&explain_batches).unwrap();

    let mut file = File::create("explain_query_plan.txt").unwrap();
    write!(file, "{}", formatted_string).unwrap();
    eprintln!("detailed card fetched {} cards", df.clone().count().await?);
    df.show().await?;
    eprintln!("success");

    Ok(())
}

use anyhow::Result;
use card_confluence_db::seed::{self, SeedMode};
use object_store::ObjectStore;
use std::sync::Arc;

pub async fn exec(
    mode: Option<String>,
    json_store: Arc<dyn ObjectStore>,
    parquet_store: Arc<dyn ObjectStore>,
) -> Result<()> {
    let mode = match mode.as_deref() {
        Some("cached") => SeedMode::LatestCached,
        None | Some("") => SeedMode::Latest,
        Some(id) => SeedMode::Specific(id.into()),
    };
    seed::seed(mode, json_store, parquet_store)
        .await
        .map_err(|e| anyhow::anyhow!("{:?}", e))?;
    Ok(())
}

use std::sync::Arc;

use datafusion::{
    error::DataFusionError,
    prelude::{ParquetReadOptions, SessionContext},
};
use object_store::ObjectStore;
use url::Url;

pub struct TablePaths {
    pub cards: String,
    pub rulings: String,
    pub sets: String,
}

pub async fn get_context<T: ObjectStore>(
    object_store: T,
    paths: TablePaths,
) -> Result<SessionContext, DataFusionError> {
    // Note: The base URL must end in a trailing slash for join()
    // to treat it as a directory/base rather than a filename.
    let base_url = Url::parse("db://data/").unwrap();

    let ctx = SessionContext::new();
    ctx.runtime_env()
        .register_object_store(&base_url, Arc::new(object_store));

    // join() handles the relative paths safely
    let cards_url = base_url
        .join(&paths.cards)
        .map_err(|e| DataFusionError::External(Box::new(e)))?;
    let rulings_url = base_url
        .join(&paths.rulings)
        .map_err(|e| DataFusionError::External(Box::new(e)))?;
    let sets_url = base_url
        .join(&paths.sets)
        .map_err(|e| DataFusionError::External(Box::new(e)))?;

    ctx.register_parquet("cards", cards_url.as_str(), ParquetReadOptions::default())
        .await?;

    ctx.register_parquet(
        "rulings",
        rulings_url.as_str(),
        ParquetReadOptions::default(),
    )
    .await?;

    ctx.register_parquet("sets", sets_url.as_str(), ParquetReadOptions::default())
        .await?;

    Ok(ctx)
}

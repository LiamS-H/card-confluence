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
    let store_url = Url::parse("db://data").unwrap();

    let ctx = SessionContext::new();
    ctx.runtime_env()
        .register_object_store(&store_url, Arc::new(object_store));

    ctx.register_parquet("cards", paths.cards, ParquetReadOptions::default())
        .await?;

    ctx.register_parquet("rulings", paths.rulings, ParquetReadOptions::default())
        .await?;

    ctx.register_parquet("sets", paths.sets, ParquetReadOptions::default())
        .await?;

    Ok(ctx)
}

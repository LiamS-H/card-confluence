use std::sync::Arc;

use datafusion::{
    error::DataFusionError,
    prelude::{ParquetReadOptions, SessionContext},
};
use object_store::ObjectStore;
use url::Url;

pub async fn get_context<T: ObjectStore>(
    object_store: T,
) -> Result<SessionContext, DataFusionError> {
    let store_url = Url::parse("db://data").unwrap();

    let ctx = SessionContext::new();
    ctx.runtime_env()
        .register_object_store(&store_url, Arc::new(object_store));

    ctx.register_parquet("cards", "db://data/cards.parquet", ParquetReadOptions::default())
        .await?;

    ctx.register_parquet(
        "rulings",
        "db://data/rulings.parquet",
        ParquetReadOptions::default(),
    )
    .await?;

    ctx.register_parquet("sets", "db://data/sets.parquet", ParquetReadOptions::default())
        .await?;

    Ok(ctx)
}

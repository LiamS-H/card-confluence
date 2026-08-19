use anyhow::Result;
use card_confluence_db::seed::write::db_store_from_data_store;
use object_store::{path::Path as ObjectPath, ObjectStore};
use std::sync::Arc;

pub async fn exec(
    parquet_store: Arc<dyn ObjectStore>,
    latest_store: Arc<dyn ObjectStore>,
) -> Result<()> {
    db_store_from_data_store(
        parquet_store,
        latest_store,
        ObjectPath::from("metadata.json"),
    )
    .await?;
    println!("Files uploaded.");
    Ok(())
}

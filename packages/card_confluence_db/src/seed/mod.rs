pub mod bulk;
pub mod data;
pub mod keyword;
pub mod set;
pub mod transform;
pub mod write;

use crate::seed::data::fetch_data_cached;
use crate::seed::write::write_parquets;
use std::sync::Arc;

use object_store::{path::Path as ObjectPath, ObjectStore};

#[derive(Debug, PartialEq)]
pub enum SeedMode {
    Latest,
    LatestOldTags,
    LatestCached,
    Specific(String),
}

pub struct SeedResult {
    pub cards_parquet_path: ObjectPath,
    pub prints_parquet_path: ObjectPath,
    pub sets_parquet_path: ObjectPath,
    pub rulings_parquet_path: ObjectPath,
}

pub async fn seed(
    mode: SeedMode,
    json_store: Arc<dyn ObjectStore>,
    parquet_store: Arc<dyn ObjectStore>,
) -> Result<SeedResult, Box<dyn std::error::Error>> {
    println!("Fetching data.");

    let seed_result = fetch_data_cached(mode, &json_store).await?;

    let seed_result = write_parquets(&seed_result, &json_store, &parquet_store).await?;
    Ok(seed_result)
}

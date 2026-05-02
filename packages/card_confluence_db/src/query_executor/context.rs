use std::sync::Arc;

use datafusion::{
    error::DataFusionError,
    prelude::{ParquetReadOptions, SessionContext},
};
use object_store::{path::Path as ObjectPath, ObjectStore};

#[cfg(not(target_arch = "wasm32"))]
use object_store::local::LocalFileSystem;
use object_store::prefix::PrefixStore;

use url::Url;

use crate::utils::get_latest;

pub struct TablePaths {
    pub cards: String,
    pub prints: String,
    pub rulings: String,
    pub sets: String,
}

pub async fn register_paths(
    base_url: Url,
    ctx: &SessionContext,
    paths: TablePaths,
) -> Result<(), DataFusionError> {
    let cards_url = base_url
        .join(&paths.cards)
        .map_err(|e| DataFusionError::External(Box::new(e)))?;
    let prints_url = base_url
        .join(&paths.prints)
        .map_err(|e| DataFusionError::External(Box::new(e)))?;
    let rulings_url = base_url
        .join(&paths.rulings)
        .map_err(|e| DataFusionError::External(Box::new(e)))?;
    let sets_url = base_url
        .join(&paths.sets)
        .map_err(|e| DataFusionError::External(Box::new(e)))?;

    ctx.register_parquet("cards", cards_url.as_str(), ParquetReadOptions::default())
        .await?;

    ctx.register_parquet("prints", prints_url.as_str(), ParquetReadOptions::default())
        .await?;

    ctx.register_parquet(
        "rulings",
        rulings_url.as_str(),
        ParquetReadOptions::default(),
    )
    .await?;

    ctx.register_parquet("sets", sets_url.as_str(), ParquetReadOptions::default())
        .await?;
    Ok(())
}

pub async fn get_context<T: ObjectStore>(
    object_store: T,
    paths: TablePaths,
) -> Result<SessionContext, DataFusionError> {
    // Note: The base URL must end in a trailing slash for join()
    // to treat it as a directory/base rather than a filename.

    let ctx = SessionContext::new();

    let base_url = Url::parse("db://data/").unwrap();
    ctx.runtime_env()
        .register_object_store(&base_url, Arc::new(object_store));

    register_paths(base_url, &ctx, paths).await?;

    Ok(ctx)
}

#[cfg(not(target_arch = "wasm32"))]
pub async fn get_local_context() -> Result<SessionContext, DataFusionError> {
    let mut current_dir = std::env::current_dir().unwrap();
    let mut parquet_path = None;

    for _ in 0..5 {
        let test_path = current_dir.join(".parquet");
        if test_path.exists() {
            parquet_path = Some(test_path);
            break;
        }
        // Also check apps/card_confluence_cli/.parquet
        let cli_path = current_dir.join("apps/card_confluence_cli/.parquet");
        if cli_path.exists() {
            parquet_path = Some(cli_path);
            break;
        }

        if let Some(parent) = current_dir.parent() {
            current_dir = parent.to_path_buf();
        } else {
            break;
        }
    }

    let p_path = parquet_path.ok_or_else(|| {
        DataFusionError::External("Could not find .parquet directory in parent tree".into())
    })?;
    let p_path = p_path.canonicalize().unwrap();

    let local = LocalFileSystem::new_with_prefix(&p_path)?;
    let parquet_store: Arc<dyn ObjectStore> = Arc::new(PrefixStore::new(local, ""));
    let paths = get_latest_paths(parquet_store.clone()).await?;

    return get_context(parquet_store, paths).await;
}

pub async fn get_latest_paths(
    parquet_store: Arc<dyn ObjectStore>,
) -> Result<TablePaths, DataFusionError> {
    let latest_cards = get_latest(&parquet_store, &ObjectPath::from("cards"), "parquet")
        .await
        .ok_or_else(|| DataFusionError::External("Couldn't find cards file".into()))?;

    let latest_prints = get_latest(&parquet_store, &ObjectPath::from("prints"), "parquet")
        .await
        .ok_or_else(|| DataFusionError::External("Couldn't find prints file".into()))?;
    let latest_rulings = get_latest(&parquet_store, &ObjectPath::from("rulings"), "parquet")
        .await
        .ok_or_else(|| DataFusionError::External("Couldn't find rulings file".into()))?;
    let latest_sets = get_latest(&parquet_store, &ObjectPath::from("sets"), "parquet")
        .await
        .ok_or_else(|| DataFusionError::External("Couldn't find sets file".into()))?;

    Ok(TablePaths {
        cards: format!("db://data/{}", latest_cards),
        prints: format!("db://data/{}", latest_prints),
        rulings: format!("db://data/{}", latest_rulings),
        sets: format!("db://data/{}", latest_sets),
    })
}

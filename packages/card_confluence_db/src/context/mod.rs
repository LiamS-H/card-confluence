use futures::StreamExt;
use std::sync::Arc;

use datafusion::{
    error::DataFusionError,
    execution::config::SessionConfig,
    prelude::{ParquetReadOptions, SessionContext},
};
use object_store::{ObjectStore, Result, path::Path as ObjectPath};

#[cfg(not(target_arch = "wasm32"))]
use object_store::local::LocalFileSystem;
use object_store::prefix::PrefixStore;

use url::Url;

use crate::schema::meta_data::MetaData;

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

    let config = SessionConfig::new()
        .set_bool("datafusion.execution.parquet.pushdown_filters", true)
        .set_bool("datafusion.execution.parquet.reorder_filters", true);
    let ctx = SessionContext::new_with_config(config);

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

pub async fn get_http_context(
    db_store: Arc<dyn ObjectStore>,
    metadata_path: ObjectPath,
) -> Result<SessionContext, DataFusionError> {
    let meta_result = db_store.get(&metadata_path).await?;
    let metadata = meta_result.bytes().await?;
    let metadata = serde_json::from_slice(&metadata).map_err(|e| {
        DataFusionError::External(
            format!("Failed to parse metadata from {}.\n{:?}", metadata_path, e).into(),
        )
    })?;
    get_context_from_metadata(db_store, metadata).await
}

pub async fn get_context_from_metadata(
    db_store: Arc<dyn ObjectStore>,
    metadata: MetaData,
) -> Result<SessionContext, DataFusionError> {
    let paths: TablePaths = metadata.try_into()?;

    get_context(db_store, paths).await
}

pub async fn get_latest_paths(
    parquet_store: Arc<dyn ObjectStore>,
) -> Result<TablePaths, DataFusionError> {
    let mut list = parquet_store.list(None);

    let mut latest_cards: Option<ObjectPath> = None;
    let mut latest_prints: Option<ObjectPath> = None;
    let mut latest_rulings: Option<ObjectPath> = None;
    let mut latest_sets: Option<ObjectPath> = None;

    while let Some(item) = list.next().await {
        let meta = item.map_err(|e| DataFusionError::External(Box::new(e)))?;
        let path_str = meta.location.as_ref();

        if path_str.contains('#') || !path_str.ends_with(".parquet") {
            continue;
        }

        if path_str.starts_with("cards") {
            if latest_cards.as_ref().map_or(true, |c| meta.location > *c) {
                latest_cards = Some(meta.location);
            }
        } else if path_str.starts_with("prints") {
            if latest_prints.as_ref().map_or(true, |p| meta.location > *p) {
                latest_prints = Some(meta.location);
            }
        } else if path_str.starts_with("rulings") {
            if latest_rulings.as_ref().map_or(true, |r| meta.location > *r) {
                latest_rulings = Some(meta.location);
            }
        } else if path_str.starts_with("sets") {
            if latest_sets.as_ref().map_or(true, |s| meta.location > *s) {
                latest_sets = Some(meta.location);
            }
        }
    }

    let cards = latest_cards
        .ok_or(DataFusionError::ObjectStore(Box::new(
            object_store::Error::NotFound {
                path: "cards*.parquet".into(),
                source: "failed to find suitable cards*.parquet".into(),
            },
        )))?
        .into();
    let prints = latest_prints
        .ok_or(DataFusionError::ObjectStore(Box::new(
            object_store::Error::NotFound {
                path: "prints*.parquet".into(),
                source: "failed to find suitable prints*.parquet".into(),
            },
        )))?
        .into();

    let rulings = latest_rulings
        .ok_or(DataFusionError::ObjectStore(Box::new(
            object_store::Error::NotFound {
                path: "rulings*.parquet".into(),
                source: "failed to find suitable rulings*.parquet".into(),
            },
        )))?
        .into();

    let sets = latest_sets
        .ok_or(DataFusionError::ObjectStore(Box::new(
            object_store::Error::NotFound {
                path: "sets*.parquet".into(),
                source: "failed to find suitable sets*.parquet".into(),
            },
        )))?
        .into();

    Ok(TablePaths {
        cards,
        prints,
        rulings,
        sets,
    })
}

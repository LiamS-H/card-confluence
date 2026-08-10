use std::sync::Arc;
use futures::StreamExt;

use datafusion::{
    error::DataFusionError,
    prelude::{ParquetReadOptions, SessionContext},
};
use object_store::{path::Path as ObjectPath, ObjectStore, Result};

#[cfg(not(target_arch = "wasm32"))]
use object_store::local::LocalFileSystem;
use object_store::prefix::PrefixStore;

use url::Url;




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

    let format_path = |opt: Option<ObjectPath>, name: &str| -> Result<String, DataFusionError> {
        let path = opt.ok_or_else(|| {
            DataFusionError::External(
                format!("Could not find latest file for path prefix: '{}'", name).into()
            )
        })?;
        Ok(format!("db://data/{}", path))
    };

    Ok(TablePaths {
        cards: format_path(latest_cards, "cards")?,
        prints: format_path(latest_prints, "prints")?,
        rulings: format_path(latest_rulings, "rulings")?,
        sets: format_path(latest_sets, "sets")?,
    })
}

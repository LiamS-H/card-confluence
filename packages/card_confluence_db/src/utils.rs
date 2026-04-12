use std::sync::Arc;
use object_store::{ObjectStore, path::Path};
use futures::stream::StreamExt;

pub async fn get_latest(store: &Arc<dyn ObjectStore>, prefix: &Path, extension: &str) -> Option<Path> {
    let mut list = store.list(Some(prefix));
    let mut latest: Option<Path> = None;

    while let Some(item) = list.next().await {
        if let Ok(meta) = item {
            if meta.location.as_ref().ends_with(extension) {
                if let Some(ref current_latest) = latest {
                    if meta.location > *current_latest {
                        latest = Some(meta.location);
                    }
                } else {
                    latest = Some(meta.location);
                }
            }
        }
    }
    latest
}

use futures::stream::StreamExt;
use object_store::{path::Path, ObjectStore};
use std::sync::Arc;

pub async fn get_latest(
    store: &Arc<dyn ObjectStore>,
    prefix: &Path,
    extension: &str,
) -> Option<Path> {
    let mut list = store.list(Some(prefix));
    let mut latest: Option<Path> = None;

    let ext_suffix = if extension.starts_with('.') {
        extension.to_string()
    } else {
        format!(".{}", extension)
    };

    while let Some(item) = list.next().await {
        if let Ok(meta) = item {
            let path_str = meta.location.as_ref();
            // Ignore temporary upload files (e.g. containing '#')
            if path_str.contains('#') {
                continue;
            }
            // If looking for standard .json files, ignore .prog.json files
            if ext_suffix == ".json" && path_str.ends_with(".prog.json") {
                continue;
            }
            if path_str.ends_with(&ext_suffix) {
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

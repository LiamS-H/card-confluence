use futures::StreamExt;
use object_store::{ObjectStore, Result, path::Path as ObjectPath};
use std::sync::Arc;

pub async fn get_latest_file(
    store: &Arc<dyn ObjectStore>,
    prefix: &ObjectPath,
    extension: &str,
) -> Result<Option<ObjectPath>> {
    let mut list = store.list(None);
    let mut latest: Option<ObjectPath> = None;

    let ext_suffix = if extension.starts_with('.') {
        extension.to_string()
    } else {
        format!(".{}", extension)
    };

    let prefix_str = prefix.as_ref();

    while let Some(item) = list.next().await {
        let meta = item?;
        let path_str = meta.location.as_ref();

        if !path_str.starts_with(prefix_str) {
            continue;
        }

        if path_str.contains('#') {
            continue;
        }
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

    Ok(latest)
}

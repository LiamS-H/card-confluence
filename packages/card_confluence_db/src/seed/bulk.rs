use object_store::{path::Path, ObjectStore};
use scryfall_rust_bindings::client::get_client;
use scryfall_rust_bindings::fetch_bulk;
use scryfall_rust_bindings::types::bulk::ScryfallBulkData;
use std::sync::Arc;

use crate::seed::SeedMode;
use crate::utils::get_latest;
pub async fn fetch_bulk_cached(
    endpoint: String,
    mode: &SeedMode,
    store: &Arc<dyn ObjectStore>,
) -> Result<Path, Box<dyn std::error::Error>> {
    Ok(match mode {
        SeedMode::Latest => {
            let ScryfallBulkData {
                updated_at,
                download_uri,
                ..
            } = fetch_bulk(&endpoint).await.unwrap();
            let path = Path::from(format!("{}/{}.json", endpoint, updated_at));

            if store.head(&path).await.is_err() {
                let bytes = get_client()
                    .get(&download_uri)
                    .send()
                    .await?
                    .bytes()
                    .await?;
                store.put(&path, bytes.into()).await?;
            }
            path
        }
        _ => get_latest(store, &Path::from(endpoint), "json")
            .await
            .ok_or("No cached rulings found")?,
    })
}

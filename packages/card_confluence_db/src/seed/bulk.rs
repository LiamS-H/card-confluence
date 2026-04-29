use futures::StreamExt;
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
        SeedMode::Latest | SeedMode::LatestOldTags => {
            let ScryfallBulkData {
                updated_at,
                download_uri,
                ..
            } = fetch_bulk(&endpoint).await.unwrap();
            let path = Path::from(format!("{}/{}.json", endpoint, updated_at));

            if store.head(&path).await.is_err() {
                println!("Downloading {}...", endpoint);
                let mut stream = get_client()
                    .get(&download_uri)
                    .send()
                    .await?
                    .bytes_stream();

                let mut upload = store.put_multipart(&path).await?;
                let mut buffer = Vec::new();
                const MIN_PART_SIZE: usize = 5 * 1024 * 1024;

                while let Some(chunk) = stream.next().await {
                    let chunk = chunk.map_err(|e| Box::new(e) as Box<dyn std::error::Error>)?;
                    buffer.extend_from_slice(&chunk);
                    if buffer.len() >= MIN_PART_SIZE {
                        upload.put_part(std::mem::take(&mut buffer).into()).await?;
                    }
                }
                if !buffer.is_empty() {
                    upload.put_part(buffer.into()).await?;
                }
                upload.complete().await?;
            }
            path
        }
        _ => get_latest(store, &Path::from(endpoint), "json")
            .await
            .ok_or("No cached bulk data found")?,
    })
}

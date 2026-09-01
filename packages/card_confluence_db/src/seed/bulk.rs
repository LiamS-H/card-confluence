use flate2::read::GzDecoder;
use object_store::{ObjectStore, path::Path};
use scryfall_rust_bindings::client::get_client;
use scryfall_rust_bindings::fetch_bulk;
use scryfall_rust_bindings::types::bulk::ScryfallBulkData;
use std::io::{BufRead, BufReader, Read};
use std::sync::Arc;

use crate::seed::SeedMode;
use crate::seed::json_store::get_latest_file;

fn process_bulk_bytes(raw_bytes: &[u8]) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    if raw_bytes.is_empty() {
        return Err("Empty response received".into());
    }

    let decompressed = if raw_bytes.starts_with(&[0x1f, 0x8b]) {
        let mut decoder = GzDecoder::new(raw_bytes);
        let mut out = Vec::new();
        decoder.read_to_end(&mut out)?;
        out
    } else {
        raw_bytes.to_vec()
    };

    let first_char = decompressed.iter().find(|&&b| !b.is_ascii_whitespace());
    if let Some(&b'[') = first_char {
        Ok(decompressed)
    } else {
        let mut json_array = Vec::with_capacity(decompressed.len() + 2);
        json_array.push(b'[');
        let mut first = true;

        for line in BufReader::new(&decompressed[..]).lines() {
            let line = line?;
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            if !first {
                json_array.push(b',');
            }
            json_array.extend_from_slice(trimmed.as_bytes());
            first = false;
        }
        json_array.push(b']');
        Ok(json_array)
    }
}

pub async fn fetch_bulk_cached(
    endpoint: String,
    mode: &SeedMode,
    store: &Arc<dyn ObjectStore>,
) -> Result<Path, Box<dyn std::error::Error>> {
    let force_latest = matches!(mode, SeedMode::Latest | SeedMode::LatestOldTags);

    if !force_latest {
        let cached_path = get_latest_file(store, &Path::from(endpoint.as_str()), "json").await?;
        if let Some(cached_path) = cached_path {
            return Ok(cached_path);
        } else {
            println!(
                "No cached data found for {}, downloading latest...",
                endpoint
            );
        };
    }

    let ScryfallBulkData {
        updated_at,
        jsonl_download_uri,
        ..
    } = fetch_bulk(&endpoint).await?;

    let clean_timestamp = updated_at.replace(':', "-");
    let path = Path::from(format!("{}/{}.json", endpoint, clean_timestamp));

    if store.head(&path).await.is_err() {
        println!("Downloading and converting {}...", endpoint);
        let raw_bytes = get_client()
            .get(&jsonl_download_uri)
            .send()
            .await?
            .bytes()
            .await?;

        let json_array_bytes = process_bulk_bytes(&raw_bytes)?;
        store.put(&path, json_array_bytes.into()).await?;
    }

    Ok(path)
}

use chrono::Utc;
use object_store::{path::Path, ObjectStore};
use scryfall_rust_bindings::{fetch_all_tags, fetch_sets, TagResult};
use std::sync::Arc;

use crate::seed::bulk::fetch_bulk_cached;
use crate::seed::keyword::{scrape_keyword_incremental, TagProgress};
use crate::seed::SeedMode;
use crate::utils::get_latest;

pub struct SeedFetchResult {
    pub cards_path: Path,
    pub prints_path: Path,
    pub rulings_path: Path,
    pub sets_path: Path,
    pub otags_path: Path,
}

pub async fn fetch_data_cached(
    mode: SeedMode,
    store: &Arc<dyn ObjectStore>,
) -> Result<SeedFetchResult, Box<dyn std::error::Error>> {
    let timestamp = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, false);

    println!("Fetching oracle_cards...");
    let cards_path = fetch_bulk_cached("oracle_cards".into(), &mode, store).await?;

    println!("Fetching card_prints...");
    let prints_path = fetch_bulk_cached("default_cards".into(), &mode, store).await?;

    println!("Fetching rulings...");
    let rulings_path = fetch_bulk_cached("rulings".into(), &mode, store).await?;

    let sets_path = match mode {
        SeedMode::Latest | SeedMode::LatestOldTags => {
            println!("Fetching sets...");
            let bytes = serde_json::to_vec(&fetch_sets().await.unwrap().data)?;
            let path = Path::from(format!("sets/{}.json", timestamp));
            store.put(&path, bytes.into()).await?;
            path
        }
        _ => get_latest(store, &Path::from("sets"), "json")
            .await
            .ok_or("No cached sets found")?,
    };

    let tags_path = match mode {
        SeedMode::Latest => {
            println!("Fetching tags...");
            let bytes = serde_json::to_vec(&fetch_all_tags().await?)?;
            let path = Path::from(format!("tags/{}.json", timestamp));
            store.put(&path, bytes.into()).await?;
            path
        }
        _ => get_latest(store, &Path::from("tags"), "json")
            .await
            .ok_or("No cached tags found")?,
    };

    let otags_path = {
        let keyword = "otag";
        let prefix = Path::from("keywords");
        let final_path = Path::from(format!("keywords/{}/{}.json", keyword, timestamp));
        let progress_path = Path::from(format!("keywords/{}/{}.prog.json", keyword, timestamp));

        let latest_progress = get_latest(store, &prefix, ".prog.json").await;
        let latest_final = get_latest(store, &prefix, ".json").await;

        if mode == SeedMode::Latest || latest_final.is_none() {
            let mut progress = if let Some(path) = latest_progress {
                let res = store.get(&path).await?;
                let bytes = res.bytes().await?;
                serde_json::from_slice::<TagProgress>(&bytes)?
            } else {
                let res = store.get(&tags_path).await?;
                let bytes = res.bytes().await?;
                let tags = serde_json::from_slice::<TagResult>(&bytes)?;
                TagProgress {
                    map: std::collections::HashMap::new(),
                    total: tags.otags.len() as u64,
                    remaining: tags.otags,
                }
            };

            let bytes = scrape_keyword_incremental(
                keyword.to_string(),
                scryfall_rust_bindings::ScryfallSearchSettings::default(),
                &mut progress,
                store,
                &progress_path,
            )
            .await?;
            store.put(&final_path, bytes.into()).await?;

            final_path
        } else {
            latest_final.unwrap()
        }
    };

    Ok(SeedFetchResult {
        prints_path,
        cards_path,
        rulings_path,
        sets_path,
        otags_path,
    })
}

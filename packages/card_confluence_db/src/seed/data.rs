use chrono::Utc;
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use object_store::{path::Path, ObjectStore};
use scryfall_rust_bindings::{fetch_all_tags, fetch_sets, TagResult};
use std::sync::Arc;

use crate::seed::bulk::fetch_bulk_cached;
use crate::seed::keyword::{scrape_keyword_incremental, TagProgress};
use crate::seed::SeedMode;
use crate::utils::get_latest;

pub struct SeedResult {
    pub cards_path: Path,
    pub prints_path: Path,
    pub rulings_path: Path,
    pub sets_path: Path,
    pub otags_path: Path,
}

pub async fn fetch_data_cached(
    multi: &Arc<MultiProgress>,
    mode: SeedMode,
    store: &Arc<dyn ObjectStore>,
) -> Result<SeedResult, Box<dyn std::error::Error>> {
    let timestamp = Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, false);

    let pb = multi.add(ProgressBar::new(5));
    pb.set_style(
        ProgressStyle::default_bar()
            .template("[{elapsed_precise}] {bar:40.cyan/blue} {msg:<60}")
            .unwrap()
            .progress_chars("##-"),
    );
    pb.enable_steady_tick(std::time::Duration::from_millis(100));
    pb.set_message("Fetching oracle_cards");
    let cards_path = fetch_bulk_cached("oracle_cards".into(), &mode, store).await?;
    pb.inc(1);

    pb.set_message("Fetching card_prints");
    let prints_path = fetch_bulk_cached("default_cards".into(), &mode, store).await?;
    pb.inc(1);
    pb.set_message("Fetching rulings");
    let rulings_path = fetch_bulk_cached("rulings".into(), &mode, store).await?;

    pb.inc(1);

    let sets_path = match mode {
        SeedMode::Latest => {
            pb.set_message("Fetching sets");
            let bytes = serde_json::to_vec(&fetch_sets().await.unwrap().data)?;
            let path = Path::from(format!("sets/{}.json", timestamp));
            store.put(&path, bytes.into()).await?;
            path
        }
        _ => get_latest(store, &Path::from("sets"), "json")
            .await
            .ok_or("No cached sets found")?,
    };
    pb.inc(1);

    let tags_path = match mode {
        SeedMode::Latest => {
            pb.set_message("Fetching tags");
            let bytes = serde_json::to_vec(&fetch_all_tags().await?)?;
            let path = Path::from(format!("tags/{}.json", timestamp));
            store.put(&path, bytes.into()).await?;
            path
        }
        _ => get_latest(store, &Path::from("tags"), "json")
            .await
            .ok_or("No cached tags found")?,
    };
    pb.inc(1);

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

            pb.set_message("Scraping otags");

            let bytes = scrape_keyword_incremental(
                multi,
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
    pb.inc(1);

    pb.finish_and_clear();

    Ok(SeedResult {
        prints_path,
        cards_path,
        rulings_path,
        sets_path,
        otags_path,
    })
}

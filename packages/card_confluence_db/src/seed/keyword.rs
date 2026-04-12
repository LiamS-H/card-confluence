use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use object_store::{path::Path, ObjectStore};
use scryfall_rust_bindings::{fetch_search, ScryfallSearchSettings};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, sync::Arc, time::Duration};
use tokio::time::sleep;

const RATE_LIMIT: Duration = Duration::from_millis(1000);

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct TagProgress {
    pub map: HashMap<String, Vec<String>>,
    pub remaining: Vec<String>,
    pub total: u64,
}

pub async fn scrape_keyword_incremental(
    multi: &Arc<MultiProgress>,
    keyword: String,
    settings: ScryfallSearchSettings,
    progress: &mut TagProgress,
    store: &Arc<dyn ObjectStore>,
    progress_path: &Path,
) -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    let total = progress.total;
    let already_done = total - progress.remaining.len() as u64;

    let main_pb = multi.add(ProgressBar::new(total as u64));
    main_pb.set_style(
        ProgressStyle::default_bar()
            .template("[{elapsed_precise}] {bar:40.cyan/blue} {pos:>7}/{len:7} {msg:<60} ({eta})")
            .unwrap()
            .progress_chars("##-"),
    );
    main_pb.enable_steady_tick(Duration::from_millis(100));
    main_pb.set_position(already_done as u64);

    while let Some(value) = progress.remaining.first().cloned() {
        let query = format!("{}:\"{}\"", keyword, value);
        main_pb.set_message(format!("Fetching '{}'", query));

        let results = fetch_keyword_cards(multi, &main_pb, &query, &settings).await?;

        for oracle_id in results {
            progress
                .map
                .entry(oracle_id)
                .or_default()
                .push(value.clone());
        }

        progress.remaining.remove(0);

        main_pb.inc(1);
        main_pb.set_message(format!("cooldown"));

        let prog_bytes = serde_json::to_vec(&progress)?;
        store.put(progress_path, prog_bytes.into()).await?;

        sleep(RATE_LIMIT).await;
    }

    main_pb.finish_and_clear();
    Ok(serde_json::to_vec(&progress.map)?)
}

pub fn get_progress_bytes(progress: &TagProgress) -> Result<Vec<u8>, serde_json::Error> {
    serde_json::to_vec(progress)
}

async fn fetch_keyword_cards(
    multi: &Arc<MultiProgress>,
    main_pb: &ProgressBar,
    query: &str,
    settings: &ScryfallSearchSettings,
) -> Result<Vec<String>, Box<dyn std::error::Error>> {
    let sub_pb = multi.insert_after(main_pb, ProgressBar::new(1));
    sub_pb.enable_steady_tick(Duration::from_millis(100));

    let success_style = ProgressStyle::default_bar()
        .template("[{elapsed_precise}] {bar:40.cyan/blue} {pos:>7}/{len:7} {msg}")
        .unwrap()
        .progress_chars("##-");

    let error_style = ProgressStyle::default_bar()
        .template("[{elapsed_precise}] {bar:40.red/orange} {pos:>7}/{len:7} {msg}")
        .unwrap()
        .progress_chars("##-");

    sub_pb.set_style(success_style.clone());

    let mut ids = Vec::new();
    let mut page = 1;
    let all_prints = settings.unique == Some("prints".into());
    let mut backoff_ms: u64 = 1000;

    loop {
        let mut paged_settings = settings.clone();
        paged_settings.page = Some(page);

        sub_pb.set_message(format!("awaiting page {}", page));

        let unified_result = match fetch_search(query, Some(paged_settings)).await {
            Ok(scryfall_rust_bindings::ScryfallSearchResponse::List(list)) => Ok(list),

            Ok(scryfall_rust_bindings::ScryfallSearchResponse::Error(error)) => {
                if error.status == 404
                    && error.code == "not_found"
                    && error
                        .details
                        .starts_with("Your query didn’t match any cards.")
                {
                    return Ok(ids);
                }
                if error.status == 429 {
                    backoff_ms = 61 * 1000;
                }

                Err(format!(
                    "API Error {:?} {}: {}",
                    error.status, error.code, error.details
                ))
            }

            Err(e) => Err(e.to_string()),
        };

        let list = match unified_result {
            Ok(list) => list,
            Err(e_msg) => {
                sub_pb.set_style(error_style.clone());
                sub_pb.set_length(backoff_ms);
                sub_pb.set_position(0);
                sub_pb.set_message(format!(
                    "Error: {}. Retrying in {}s",
                    e_msg,
                    backoff_ms / 1000
                ));

                let step = 100u64;
                let mut elapsed = 0u64;
                while elapsed < backoff_ms {
                    elapsed += step;
                    sub_pb.set_position(elapsed);
                    sleep(Duration::from_millis(step)).await;
                }

                sub_pb.set_style(success_style.clone());
                backoff_ms *= 2;
                continue;
            }
        };

        backoff_ms = 1000;
        sub_pb.set_length(list.total_cards as u64);

        for card in list.data {
            if all_prints {
                ids.push(card.id);
            } else if let Some(oid) = card.oracle_id {
                ids.push(oid);
            }
        }

        sub_pb.set_position(ids.len() as u64);
        sub_pb.set_message("cooldown");

        if list.has_more {
            page += 1;
            sleep(RATE_LIMIT).await;
        } else {
            break;
        }
    }

    sub_pb.finish_and_clear();

    ids.sort();
    ids.dedup();

    Ok(ids)
}

use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use scryfall_rust_bindings::{
    client::get_client, fetch_all_tags, fetch_bulk, fetch_search, fetch_sets,
    ScryfallSearchSettings, TagResult,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    fs::{self, File},
    io::Read,
    path::{Path, PathBuf},
    sync::Arc,
    time::Duration,
};
use tokio::time::sleep;

use crate::seed::SeedMode;

const RATE_LIMIT: std::time::Duration = Duration::from_millis(1000);

#[derive(Debug, Serialize, Deserialize, Default)]
struct TagProgress {
    pub map: HashMap<String, Vec<String>>,
    pub remaining: Vec<String>,
    pub total: u64,
}

#[derive(Debug, Serialize, Deserialize, Default)]
pub struct ScryfallBulkMetadata {
    pub cards_id: String,
    pub created_at: String,
    pub cards_uri: String,
    pub rulings_uri: String,
}

impl ScryfallBulkMetadata {
    pub fn to_path(&self) -> PathBuf {
        PathBuf::from(format!("{}_{}", self.created_at, self.cards_id))
    }
}

pub async fn fetch_data_cached(
    multi: &Arc<MultiProgress>,
    mode: SeedMode,
) -> Result<ScryfallBulkMetadata, Box<dyn std::error::Error>> {
    let pb = multi.add(ProgressBar::new(6));
    pb.set_style(
        ProgressStyle::default_bar()
            .template("[{elapsed_precise}] {bar:40.cyan/blue} {msg:<60}")
            .unwrap()
            .progress_chars("##-"),
    );
    pb.enable_steady_tick(Duration::from_millis(100));

    let mut metadata = match mode {
        SeedMode::Latest => {
            pb.set_message("Getting Latest Data");
            let cards_bulk = fetch_bulk("cards").await?;
            ScryfallBulkMetadata {
                cards_id: cards_bulk.id,
                created_at: cards_bulk.updated_at,
                cards_uri: cards_bulk.download_uri,
                ..Default::default()
            }
        }
        SeedMode::LatestCached => {
            let entries = fs::read_dir(".scryfall")?;

            let latest_folder = entries
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
                .filter_map(|e| e.file_name().into_string().ok())
                .max();

            let Some(name) = latest_folder else {
                return Err("No cached folders found".into());
            };

            let path = Path::new(".scryfall").join(&name).join("bulk.json");
            if !path.exists() {
                return Err(format!("Failed to load {:?}", path).into());
            }

            let mut file = File::open(path)?;
            let mut buffer = Vec::new();
            file.read_to_end(&mut buffer)?;
            serde_json::from_slice::<ScryfallBulkMetadata>(&buffer)?
        }
        SeedMode::Specific(_name) => todo!(),
    };
    pb.inc(1);

    let cache_dir = Path::new(".scryfall");
    let data_cache_dir = cache_dir.join(metadata.to_path());
    let metadata_path = data_cache_dir.join("bulk.json");

    let cached_metadata = if metadata_path.exists() {
        let mut file = File::open(&metadata_path)?;
        let mut buffer = Vec::new();
        file.read_to_end(&mut buffer)?;
        serde_json::from_slice::<ScryfallBulkMetadata>(&buffer).ok()
    } else {
        None
    };

    let metadata = if cached_metadata.is_none() {
        if !data_cache_dir.exists() {
            std::fs::create_dir_all(&data_cache_dir)?;
        }
        let rulings_bulk = fetch_bulk("rulings").await?;
        metadata.rulings_uri = rulings_bulk.download_uri;
        let _ = std::fs::write(&metadata_path, serde_json::to_vec(&metadata)?);
        metadata
    } else {
        cached_metadata.unwrap()
    };

    let rulings_path = data_cache_dir.join("rulings.json");
    if !rulings_path.exists() {
        pb.set_message("Fetching rulings.");
        let response = get_client().get(&metadata.rulings_uri).send().await?;
        let bytes = response.bytes().await?.to_vec();
        std::fs::write(&rulings_path, &bytes)?;
        pb.set_message("");
    }
    pb.inc(1);

    let cards_path = data_cache_dir.join("cards.json");
    if !cards_path.exists() {
        pb.set_message("Fetching cards.");
        let response = get_client().get(&metadata.cards_uri).send().await?;
        let bytes = response.bytes().await?.to_vec();
        std::fs::write(&cards_path, &bytes)?;
        pb.set_message("");
    }
    pb.inc(1);

    let sets_path = data_cache_dir.join("sets.json");
    if !sets_path.exists() {
        pb.set_message("Fetching sets.");
        let sets = fetch_sets().await?;
        std::fs::write(&sets_path, serde_json::to_vec(&sets.data)?)?;
    }
    pb.inc(1);

    let tags_path = data_cache_dir.join("tags.json");
    let tags = match std::fs::read(&tags_path)
        .ok()
        .and_then(|buf| serde_json::from_slice::<TagResult>(&buf).ok())
    {
        Some(val) => val,
        None => {
            let tags = fetch_all_tags().await?;
            std::fs::write(&tags_path, serde_json::to_vec(&tags)?)?;
            tags
        }
    };
    pb.inc(1);

    let otags_path = data_cache_dir.join("otags.json");
    if !otags_path.exists() {
        let progress_path = data_cache_dir.join("otags_progress.json");
        let mut otags_progress = match std::fs::read(&progress_path)
            .ok()
            .and_then(|buf| serde_json::from_slice::<TagProgress>(&buf).ok())
        {
            Some(val) => val,
            None => TagProgress {
                map: HashMap::new(),
                total: tags.otags.len() as u64,
                remaining: tags.otags,
            },
        };

        pb.set_message("Scraping otags.");
        scrape_keyword_incremental(
            multi,
            "otag".into(),
            ScryfallSearchSettings::default(),
            &mut otags_progress,
            &progress_path,
        )
        .await?;

        std::fs::write(&otags_path, serde_json::to_vec(&otags_progress.map)?)?;
    }
    pb.finish_and_clear();

    Ok(metadata)
}

async fn scrape_keyword_incremental(
    multi: &Arc<MultiProgress>,
    keyword: String,
    settings: ScryfallSearchSettings,
    progress: &mut TagProgress,
    progress_file: &Path,
) -> Result<(), Box<dyn std::error::Error>> {
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
        main_pb.set_message(format!("cooldown",));

        std::fs::write(&progress_file, serde_json::to_vec(&progress)?)?;

        sleep(RATE_LIMIT).await;
    }

    main_pb.finish_and_clear();
    Ok(())
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

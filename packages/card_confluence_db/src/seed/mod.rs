pub mod data;
pub mod transform;

use crate::schema::{card::card::Card, ruling::Ruling, set::Set};
use crate::seed::data::fetch_data_cached;
use arrow_array::RecordBatch;
use arrow_convert::serialize::TryIntoArrow;
use indicatif::{MultiProgress, ProgressBar, ProgressStyle};
use parquet::arrow::arrow_writer::ArrowWriter;
use scryfall_rust_bindings::types::{card::ScryfallCard, ruling::ScryfallRuling, set::ScryfallSet};
use std::{
    collections::HashMap,
    fs::{self, File},
    path::Path,
    sync::Arc,
    time::Duration,
};

#[derive(Debug)]
pub enum SeedMode {
    Latest,
    LatestCached,
    Specific(String),
}

fn write_parquet<T>(path: &Path, data: Vec<T>) -> Result<(), Box<dyn std::error::Error>>
where
    T: arrow_convert::serialize::ArrowSerialize
        + arrow_convert::field::ArrowField<Type = T>
        + 'static,
{
    let array: Arc<dyn arrow_array::Array> = data.try_into_arrow()?;
    let struct_array = array
        .as_any()
        .downcast_ref::<arrow_array::StructArray>()
        .ok_or("Failed to downcast to StructArray")?;
    let batch = RecordBatch::from(struct_array);

    let file = File::create(path)?;
    let mut writer = ArrowWriter::try_new(file, batch.schema(), None)?;
    writer.write(&batch)?;
    writer.close()?;
    Ok(())
}

pub async fn seed(mode: SeedMode) -> Result<(), Box<dyn std::error::Error>> {
    let multi = Arc::new(MultiProgress::new());

    let spinner = multi.add(ProgressBar::new_spinner());
    spinner.set_style(
        ProgressStyle::default_spinner()
            .template("{spinner:.green} [{elapsed_precise}] DB_SEED: {msg}")
            .unwrap(),
    );
    spinner.enable_steady_tick(Duration::from_millis(100));
    spinner.set_message("Fetching data.");

    let metadata = fetch_data_cached(&multi, mode).await?;
    spinner.set_message(format!(
        "Using {} {}",
        metadata.created_at, metadata.oracle_cards_id
    ));

    let data_dir = Path::new(".scryfall").join(metadata.to_path());
    let seed_dir = Path::new(".parquet").join(metadata.to_path());

    if !seed_dir.exists() {
        fs::create_dir_all(&seed_dir)?;
    }

    spinner.set_message("Packaging sets...");
    let sets_json = fs::read(data_dir.join("sets.json"))?;
    let sets: Vec<ScryfallSet> = serde_json::from_slice(&sets_json)?;
    let transformed_sets: Vec<Set> = sets.into_iter().map(Into::into).collect();
    write_parquet(&seed_dir.join("sets.parquet"), transformed_sets)?;

    spinner.set_message("Packaging rulings...");
    let rulings_json = fs::read(data_dir.join("rulings.json"))?;
    let rulings: Vec<ScryfallRuling> = serde_json::from_slice(&rulings_json)?;
    let transformed_rulings: Vec<Ruling> = rulings.into_iter().map(Into::into).collect();
    write_parquet(&seed_dir.join("rulings.parquet"), transformed_rulings)?;

    spinner.set_message("Reading otags...");
    let otags_json = fs::read(data_dir.join("otags.json"))?;
    let otags: HashMap<String, Vec<String>> = serde_json::from_slice(&otags_json)?;

    spinner.set_message("Reading cards...");
    let cards_json = fs::read(data_dir.join("cards.json"))?;
    let cards: Vec<ScryfallCard> = serde_json::from_slice(&cards_json)?;
    spinner.set_message("Packaging cards...");
    let transformed_cards: Vec<Card> = cards
        .into_iter()
        .map(|c| {
            let mut card: Card = c.into();
            if let Some(oid) = &card.oracle_id {
                if let Some(tags) = otags.get(oid) {
                    card.otags = tags.clone();
                }
            }
            card
        })
        .collect();
    write_parquet(&seed_dir.join("cards.parquet"), transformed_cards)?;

    spinner.finish_with_message("Done.");
    Ok(())
}

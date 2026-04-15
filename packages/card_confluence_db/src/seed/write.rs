use crate::schema::card::print::Print;
use crate::schema::{card::card::Card, ruling::Ruling, set::Set};
use crate::seed::data::SeedFetchResult;
use crate::seed::SeedResult;
use arrow_array::RecordBatch;
use arrow_convert::serialize::TryIntoArrow;
use chrono::Utc;
use object_store::{path::Path as ObjectPath, ObjectStore};
use parquet::arrow::arrow_writer::ArrowWriter;
use scryfall_rust_bindings::types::{card::ScryfallCard, ruling::ScryfallRuling, set::ScryfallSet};
use std::{collections::HashMap, sync::Arc};

pub async fn write_parquets(
    seed_result: &SeedFetchResult,
    json_store: &Arc<dyn ObjectStore>,
    parquet_store: &Arc<dyn ObjectStore>,
) -> Result<SeedResult, Box<dyn std::error::Error>> {
    let timestamp = Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string();
    println!("Packaging sets...");
    let sets_json = json_store
        .get(&seed_result.sets_path)
        .await?
        .bytes()
        .await?;
    let sets: Vec<ScryfallSet> = serde_json::from_slice(&sets_json)?;
    let transformed_sets: Vec<Set> = sets.into_iter().map(Into::into).collect();
    let sets_parquet = write_parquet(transformed_sets)?;
    let sets_parquet_path = ObjectPath::from(format!("sets/{}.parquet", timestamp));
    parquet_store
        .put(&sets_parquet_path, sets_parquet.into())
        .await?;

    println!("Packaging rulings...");
    let rulings_json = json_store
        .get(&seed_result.rulings_path)
        .await?
        .bytes()
        .await?;
    let rulings: Vec<ScryfallRuling> = serde_json::from_slice(&rulings_json)?;
    let transformed_rulings: Vec<Ruling> = rulings.into_iter().map(Into::into).collect();
    let rulings_parquet = write_parquet(transformed_rulings)?;
    let rulings_parquet_path = ObjectPath::from(format!("rulings/{}.parquet", timestamp));
    parquet_store
        .put(&rulings_parquet_path, rulings_parquet.into())
        .await?;

    println!("Reading otags...");
    let otags_json = json_store
        .get(&seed_result.otags_path)
        .await?
        .bytes()
        .await?;
    let otags: HashMap<String, Vec<String>> = serde_json::from_slice(&otags_json)?;

    println!("Reading cards...");
    let cards_json = json_store
        .get(&seed_result.cards_path)
        .await?
        .bytes()
        .await?;
    let cards: Vec<ScryfallCard> = serde_json::from_slice(&cards_json)?;
    println!("Reading prints...");
    let print_json = json_store
        .get(&seed_result.prints_path)
        .await?
        .bytes()
        .await?;
    let prints: Vec<ScryfallCard> = serde_json::from_slice(&print_json)?;
    let prints = {
        let mut map: HashMap<String, Print> = HashMap::new();
        for print in prints {
            let card: Card = print.clone().into();
            map.insert(card.oracle_id, print.into());
        }
        map
    };
    println!("Packaging cards...");
    let transformed_cards: Vec<Card> = cards
        .into_iter()
        .map(|c| {
            let mut card: Card = c.into();
            let oid = &card.oracle_id;
            if let Some(tags) = otags.get(oid) {
                card.otags = tags.clone();
            }
            if let Some(print) = prints.get(oid) {
                card.prints.push(print.clone());
            }
            card
        })
        .collect();

    let cards_parquet = write_parquet(transformed_cards)?;
    let cards_parquet_path = ObjectPath::from(format!("cards/{}.parquet", timestamp));
    parquet_store
        .put(&cards_parquet_path, cards_parquet.into())
        .await?;

    println!("Done.");
    Ok(SeedResult {
        cards_parquet_path,
        sets_parquet_path,
        rulings_parquet_path,
    })
}

fn write_parquet<T>(data: Vec<T>) -> Result<Vec<u8>, Box<dyn std::error::Error>>
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

    let mut buffer = Vec::new();
    {
        let mut writer = ArrowWriter::try_new(&mut buffer, batch.schema(), None)?;
        writer.write(&batch)?;
        writer.close()?;
    }
    Ok(buffer)
}

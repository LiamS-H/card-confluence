use crate::schema::card::print::Print;
use crate::schema::{card::card::Card, ruling::Ruling, set::Set};
use crate::seed::data::SeedFetchResult;
use crate::seed::SeedResult;
use arrow_array::RecordBatch;
use arrow_convert::field::ArrowField;
use arrow_convert::serialize::TryIntoArrow;
use chrono::Utc;
use object_store::{path::Path as ObjectPath, ObjectStore};
use parquet::arrow::arrow_writer::ArrowWriter;
use parquet::file::properties::{EnabledStatistics, WriterProperties};
use scryfall_rust_bindings::types::{card::ScryfallCard, ruling::ScryfallRuling, set::ScryfallSet};
use std::{collections::HashMap, sync::Arc};

pub async fn write_parquets(
    seed_result: &SeedFetchResult,
    json_store: &Arc<dyn ObjectStore>,
    parquet_store: &Arc<dyn ObjectStore>,
) -> Result<SeedResult, Box<dyn std::error::Error>> {
    let timestamp = Utc::now().format("%Y-%m-%dT%H:%M:%S").to_string();

    println!("Packaging sets...");
    let sets: Vec<Set> = {
        let sets_json = json_store
            .get(&seed_result.sets_path)
            .await?
            .bytes()
            .await?;
        let sets: Vec<ScryfallSet> = serde_json::from_slice(&sets_json)?;
        sets.into_iter().map(Into::into).collect()
    };
    println!("Writing sets...");
    let props = WriterProperties::builder()
        // .set_statistics_enabled(EnabledStatistics::Page)
        // .set_bloom_filter_enabled(false)
        // .set_column_bloom_filter_enabled("code".into(), true)
        // .set_column_bloom_filter_ndv("code".into(), 40_000)
        // .set_column_bloom_filter_fpp("code".into(), 0.01)
        .build();
    let sets_parquet = write_parquet_chunked(sets, Some(props))?;
    let sets_parquet_path = ObjectPath::from(format!("sets/{}.parquet", timestamp));
    parquet_store
        .put(&sets_parquet_path, sets_parquet.into())
        .await?;

    println!("Packaging rulings...");
    let rulings: Vec<Ruling> = {
        let rulings_json = json_store
            .get(&seed_result.rulings_path)
            .await?
            .bytes()
            .await?;
        let rulings: Vec<ScryfallRuling> = serde_json::from_slice(&rulings_json)?;
        rulings.into_iter().map(Into::into).collect()
    };
    println!("Writing rulings...");
    let props = WriterProperties::builder()
        .set_statistics_enabled(EnabledStatistics::Page)
        .set_bloom_filter_enabled(false)
        .set_column_bloom_filter_enabled("oracle_id".into(), true)
        .set_column_bloom_filter_ndv("oracle_id".into(), 40_000)
        .set_column_bloom_filter_fpp("oracle_id".into(), 0.01)
        .build();
    let rulings_parquet = write_parquet_chunked(rulings, Some(props))?;
    let rulings_parquet_path = ObjectPath::from(format!("rulings/{}.parquet", timestamp));
    parquet_store
        .put(&rulings_parquet_path, rulings_parquet.into())
        .await?;

    println!("Reading otags...");
    let otags: HashMap<String, Vec<String>> = {
        let otags_json = json_store
            .get(&seed_result.otags_path)
            .await?
            .bytes()
            .await?;
        serde_json::from_slice(&otags_json)?
    };

    println!("Reading cards...");
    let transformed_cards: Vec<Card> = {
        let cards_json = json_store
            .get(&seed_result.cards_path)
            .await?
            .bytes()
            .await?;
        let cards: Vec<ScryfallCard> = serde_json::from_slice(&cards_json)?;
        println!("Packaging cards...");
        cards
            .into_iter()
            .filter_map(|c| {
                let mut card: Card = c.into();
                if card.layout == "art_series" {
                    return None;
                }
                let oid = &card.oracle_id;
                if let Some(tags) = otags.get(oid) {
                    card.otags = tags.clone();
                }
                Some(card)
            })
            .collect()
    };

    println!("Writing cards...");
    let props = WriterProperties::builder()
        .set_statistics_enabled(EnabledStatistics::Page)
        .set_bloom_filter_enabled(false)
        .set_column_bloom_filter_enabled("oracle_id".into(), true)
        .set_column_bloom_filter_ndv("oracle_id".into(), 40_000)
        .set_column_bloom_filter_fpp("oracle_id".into(), 0.01)
        .build();
    let cards_parquet = write_parquet_chunked(transformed_cards, Some(props))?;
    let cards_parquet_path = ObjectPath::from(format!("cards/{}.parquet", timestamp));
    parquet_store
        .put(&cards_parquet_path, cards_parquet.into())
        .await?;

    println!("Reading prints...");
    let mut prints: Vec<Print> = {
        let print_json = json_store
            .get(&seed_result.prints_path)
            .await?
            .bytes()
            .await?;
        let scryfall_prints: Vec<ScryfallCard> = serde_json::from_slice(&print_json)?;
        println!("Transforming {} prints...", scryfall_prints.len());
        scryfall_prints.into_iter().map(Into::into).collect()
    };
    prints.sort_by(|a, b| {
        a.oracle_id
            .cmp(&b.oracle_id)
            .then(a.set_code.cmp(&b.set_code))
            .then(a.collector_number.cmp(&b.collector_number))
    });

    println!("Writing {} prints...", prints.len());
    let props = WriterProperties::builder()
        .set_statistics_enabled(EnabledStatistics::Page)
        .set_bloom_filter_enabled(false)
        .set_column_bloom_filter_enabled("oracle_id".into(), true)
        .set_column_bloom_filter_ndv("oracle_id".into(), 40_000)
        .set_column_bloom_filter_fpp("oracle_id".into(), 0.01)
        .build();
    let prints_parquet = write_parquet_chunked(prints, Some(props))?;
    let prints_parquet_path = ObjectPath::from(format!("prints/{}.parquet", timestamp));
    parquet_store
        .put(&prints_parquet_path, prints_parquet.into())
        .await?;

    println!("Done.");
    Ok(SeedResult {
        cards_parquet_path,
        prints_parquet_path,
        sets_parquet_path,
        rulings_parquet_path,
    })
}

fn write_parquet_chunked<T>(
    data: Vec<T>,
    props: Option<WriterProperties>,
) -> Result<Vec<u8>, Box<dyn std::error::Error>>
where
    T: arrow_convert::serialize::ArrowSerialize
        + arrow_convert::field::ArrowField<Type = T>
        + Clone
        + 'static,
{
    if data.is_empty() {
        return Err("No data to write".into());
    }

    let field = <T as ArrowField>::field("");
    let schema = match field.data_type() {
        arrow_schema::DataType::Struct(fields) => {
            Arc::new(arrow_schema::Schema::new(fields.clone()))
        }
        _ => return Err("T must be a struct for write_parquet_chunked".into()),
    };

    let mut buffer = Vec::new();
    {
        let mut writer = ArrowWriter::try_new(&mut buffer, schema, props)?;

        // Use a chunk size of 5000 to balance memory usage and performance
        for chunk in data.chunks(5000) {
            let chunk_vec = chunk.to_vec();
            let array: Arc<dyn arrow_array::Array> = chunk_vec.try_into_arrow()?;
            let struct_array = array
                .as_any()
                .downcast_ref::<arrow_array::StructArray>()
                .ok_or("Failed to downcast to StructArray")?;
            let batch = RecordBatch::from(struct_array);
            writer.write(&batch)?;
        }
        writer.close()?;
    }
    Ok(buffer)
}

use crate::schema::card::print::Print;
use crate::schema::{card::card::Card, ruling::Ruling, set::Set};
use crate::seed::SeedResult;
use crate::seed::data::SeedFetchResult;
use arrow_array::RecordBatch;
use arrow_convert::field::ArrowField;
use arrow_convert::serialize::TryIntoArrow;
use chrono::Utc;
use futures::StreamExt;
use object_store::{ObjectStore, path::Path as ObjectPath};
use parquet::arrow::arrow_writer::ArrowWriter;
use parquet::file::properties::{EnabledStatistics, WriterProperties};
use scryfall_rust_bindings::types::{card::ScryfallCard, ruling::ScryfallRuling, set::ScryfallSet};
use std::{collections::HashMap, sync::Arc};
use uuid::Uuid;

use crate::context::get_latest_paths;
use crate::schema::meta_data::{self, MetaDataSource};
use datafusion::error::DataFusionError;

pub async fn json_to_parquet(
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
    let mut rulings: Vec<Ruling> = {
        let rulings_json = json_store
            .get(&seed_result.rulings_path)
            .await?
            .bytes()
            .await?;
        let rulings: Vec<ScryfallRuling> = serde_json::from_slice(&rulings_json)?;
        rulings.into_iter().map(Into::into).collect()
    };
    rulings.sort_by(|a, b| a.oracle_id.cmp(&b.oracle_id));
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
    let otags: HashMap<Uuid, Vec<String>> = {
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
        let mut cards: Vec<ScryfallCard> = serde_json::from_slice(&cards_json)?;
        println!("Packaging cards...");
        cards.sort_by(|a, b| a.oracle_id.cmp(&b.oracle_id));
        cards.sort_by(|a, b| {
            a.cmc
                .unwrap_or_default()
                .total_cmp(&b.cmc.unwrap_or_default())
        });
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
        .set_max_row_group_size(5_000)
        .set_data_page_row_count_limit(1_000)
        .set_statistics_enabled(EnabledStatistics::Page)
        .set_bloom_filter_enabled(false)
        .set_column_bloom_filter_enabled("oracle_id".into(), true)
        .set_column_bloom_filter_ndv("oracle_id".into(), 5000)
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
        .set_max_row_group_size(10_000)
        .set_data_page_row_count_limit(1_000)
        .set_statistics_enabled(EnabledStatistics::Page)
        .set_bloom_filter_enabled(false)
        // this might not be necessary since they are already sorted
        .set_column_bloom_filter_enabled("oracle_id".into(), true)
        // roughly 3 oracled_ids per group, 10_000 / 3 ~= 3_500
        .set_column_bloom_filter_ndv("oracle_id".into(), 3_500)
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

async fn copy_parquet(
    src_store: Arc<dyn ObjectStore>,
    src_path: ObjectPath,
    dest_store: Arc<dyn ObjectStore>,
    dest_path: ObjectPath,
) -> Result<(), DataFusionError> {
    let get_res = src_store.get(&src_path).await?;
    let mut stream = get_res.into_stream();
    let mut upload = dest_store.put_multipart(&dest_path).await?;

    let mut buffer = Vec::new();
    const MIN_PART_SIZE: usize = 5 * 1024 * 1024;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        buffer.extend_from_slice(&chunk);
        if buffer.len() >= MIN_PART_SIZE {
            upload.put_part(std::mem::take(&mut buffer).into()).await?;
        }
    }
    if !buffer.is_empty() {
        upload.put_part(buffer.into()).await?;
    }
    upload.complete().await?;
    Ok(())
}

async fn process_and_copy_file(
    data_store: Arc<dyn ObjectStore>,
    db_store: Arc<dyn ObjectStore>,
    raw_source_path: &str,
    file_prefix: &str,
) -> Result<MetaDataSource, DataFusionError> {
    let source_path = ObjectPath::from(raw_source_path.to_string());

    let Some(extension) = source_path.extension() else {
        // get_latest won't send invalid paths
        unreachable!();
    };
    let Some(filename) = source_path.filename() else {
        // get_latest won't send empty file names
        unreachable!();
    };

    let iso = &filename[..filename.len() - extension.len() - 1];
    let dest_path = ObjectPath::from(format!("{}.parquet", file_prefix));

    copy_parquet(data_store, source_path.clone(), db_store, dest_path.clone()).await?;

    Ok(MetaDataSource {
        table: file_prefix.into(),
        iso: iso.into(),
        path: dest_path.clone().into(),
    })
}

pub async fn db_store_from_data_store(
    data_store: Arc<dyn ObjectStore>,
    db_store: Arc<dyn ObjectStore>,
    metadata_path: ObjectPath,
) -> Result<(), DataFusionError> {
    let mut metadata = meta_data::MetaData::default();
    let paths = get_latest_paths(data_store.clone()).await?;

    let source =
        process_and_copy_file(data_store.clone(), db_store.clone(), &paths.cards, "cards").await?;
    metadata.sources.push(source);

    let source = process_and_copy_file(
        data_store.clone(),
        db_store.clone(),
        &paths.prints,
        "prints",
    )
    .await?;
    metadata.sources.push(source);

    let source = process_and_copy_file(
        data_store.clone(),
        db_store.clone(),
        &paths.rulings,
        "rulings",
    )
    .await?;
    metadata.sources.push(source);

    let source =
        process_and_copy_file(data_store.clone(), db_store.clone(), &paths.sets, "sets").await?;
    metadata.sources.push(source);

    let json_bytes =
        serde_json::to_vec(&metadata).map_err(|e| DataFusionError::External(e.into()))?;

    db_store.put(&metadata_path, json_bytes.into()).await?;
    Ok(())
}

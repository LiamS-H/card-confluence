use card_confluence_db::seed::data::SeedFetchResult;
use card_confluence_db::seed::write::write_parquets;
// use card_confluence_db::seed::{self, SeedMode};
// use chrono::Utc;
use cloudflare_utils::r2_worker_store::R2WorkerStore;
use object_store::prefix::PrefixStore;
use object_store::{path::Path as ObjectPath, ObjectStore};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tsify::Tsify;
use wasm_bindgen::prelude::wasm_bindgen;
use wasm_bindgen::JsValue;
use worker::*;

#[derive(Tsify, Serialize, Deserialize)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct SeedFetchPaths {
    pub cards_path: String,
    pub prints_path: String,
    pub rulings_path: String,
    pub sets_path: String,
    pub otags_path: String,
}

#[derive(Tsify, Serialize, Deserialize)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct SeedFinalPaths {
    pub cards_path: String,
    pub prints_path: String,
    pub sets_path: String,
    pub rulings_path: String,
}

#[wasm_bindgen]
pub async fn parquets_from_json(
    env: Env,
    paths: SeedFetchPaths,
) -> Result<SeedFinalPaths, JsValue> {
    let Ok(history_bucket) = env.bucket("cc_parquet_history") else {
        return Err(JsValue::from_str(
            "Error: Could not find cc_parquet_history R2 binding",
        ));
    };
    // let Ok(latest_bucket) = env.bucket("cc_parquet_latest") else {
    //     return Err(JsValue::from_str(
    //         "Error: Could not find cc_parquet_latest R2 binding",
    //     ));
    // };

    let history_store: Arc<dyn ObjectStore> = Arc::new(R2WorkerStore::new(history_bucket));

    let history_json_store: Arc<dyn ObjectStore> =
        Arc::new(PrefixStore::new(history_store.clone(), ".scryfall"));
    let history_parquet_store: Arc<dyn ObjectStore> =
        Arc::new(PrefixStore::new(history_store.clone(), ".parquet"));

    // let latest_store: Arc<dyn ObjectStore> = Arc::new(R2WorkerStore::new(latest_bucket));

    let data_paths = SeedFetchResult {
        cards_path: ObjectPath::from(paths.cards_path),
        prints_path: ObjectPath::from(paths.prints_path),
        rulings_path: ObjectPath::from(paths.rulings_path),
        sets_path: ObjectPath::from(paths.sets_path),
        otags_path: ObjectPath::from(paths.otags_path),
    };

    let parquet_paths = write_parquets(&data_paths, &history_json_store, &history_parquet_store)
        .await
        .map_err(|u| JsValue::from(format!("{:#?}", u)))?;
    return Ok(SeedFinalPaths {
        cards_path: parquet_paths.cards_parquet_path.to_string(),
        prints_path: parquet_paths.prints_parquet_path.to_string(),
        sets_path: parquet_paths.sets_parquet_path.to_string(),
        rulings_path: parquet_paths.rulings_parquet_path.to_string(),
    });
}

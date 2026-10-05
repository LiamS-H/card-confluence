use arrow_array::{FixedSizeBinaryArray, ListArray};
use arrow_ipc::writer::StreamWriter;
use card_confluence_db::{
    autocompletion::{Completion, CompletionResponse, completion_from_query},
    context::get_context_from_metadata,
    query_parser::{hash::canonicalize_for_cache, parse_query, planner::build_cards_detail_plan},
    schema::meta_data::MetaData,
};
use datafusion::{
    error::DataFusionError,
    logical_expr::{LogicalPlan, LogicalPlanBuilder, col},
    object_store::ObjectStore,
    prelude::SessionContext,
};
use datafusion_proto::bytes::{logical_plan_from_bytes, logical_plan_to_bytes};
use rapidhash::fast::RapidHasher;
use std::{
    hash::{Hash, Hasher},
    sync::Arc,
};
use url::Url;
use uuid::Uuid;
use wasm_bindgen::{JsValue, prelude::wasm_bindgen};

use crate::http_binding::PublicHTTPReadonlyStore;
use crate::opfs_binding::OpfsReadonlyStore;

pub mod compact;
pub mod http_binding;
pub mod opfs_binding;

use serde::{Deserialize, Serialize};
use tsify::Tsify;

#[derive(Debug, Clone, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct CompletionPlan {
    #[tsify(type = "Uint8Array")]
    #[serde(with = "serde_bytes")]
    plan: Vec<u8>,
    completion: Completion,
}

/// New struct that carries both the logical‑plan bytes *and* a hash that can be used as a cache key.
/// For now the hash is simply the plan bytes themselves, but the struct allows us to change the
/// hashing strategy later without touching the public API.
#[derive(Debug, Clone, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct HashedPlan {
    /// The hash of the (optimized) logical plan.
    #[tsify(type = "Uint8Array")]
    #[serde(with = "serde_bytes")]
    pub hash: Vec<u8>,
    /// The serialized optimized logical plan.
    #[tsify(type = "Uint8Array")]
    #[serde(with = "serde_bytes")]
    pub plan: Vec<u8>,
}

#[wasm_bindgen]
pub struct CardConfluenceBrowser {
    context: SessionContext,
    store: Arc<dyn ObjectStore>,
}

fn error_map<E: std::fmt::Debug>(u: E) -> JsValue {
    JsValue::from_str(format!("{:?}", u).as_str())
}

#[wasm_bindgen]
impl CardConfluenceBrowser {
    pub async fn new_opfs(metadata: MetaData) -> Result<Self, JsValue> {
        let store = Arc::new(OpfsReadonlyStore::new());
        store
            .register_paths(metadata.sources.iter().map(|s| s.path.clone()).collect())
            .await?;

        let context = get_context_from_metadata(store.clone(), metadata)
            .await
            .map_err(error_map)?;

        let new_self = Self {
            context,
            store: store.clone(),
        };

        Ok(new_self)
    }

    /// Like [`new_opfs`], but eagerly reads all OPFS files into an in-memory store before
    /// building the session context.
    pub async fn new_opfs_in_memory(metadata: MetaData) -> Result<Self, JsValue> {
        let opfs_store = OpfsReadonlyStore::new();
        opfs_store
            .register_paths(metadata.sources.iter().map(|s| s.path.clone()).collect())
            .await?;

        let mem_store: Arc<dyn ObjectStore> =
            Arc::new(opfs_store.load_into_memory().await.map_err(error_map)?);

        let context = get_context_from_metadata(mem_store.clone(), metadata)
            .await
            .map_err(error_map)?;

        Ok(Self {
            context,
            store: mem_store,
        })
    }

    pub async fn new_http(url: String, metadata: MetaData) -> Result<Self, JsValue> {
        let mut url_str = url;
        if !url_str.ends_with('/') {
            url_str.push('/');
        }
        let base_url = Url::parse(&url_str).map_err(error_map)?;
        let store = Arc::new(PublicHTTPReadonlyStore::new(base_url.clone()));

        let context = get_context_from_metadata(store.clone(), metadata)
            .await
            .map_err(error_map)?;

        Ok(Self { context, store })
    }

    /// Optimize a plan and create a hash which matches semantically similar queries.
    fn hash_plan(&self, plan: LogicalPlan) -> Result<HashedPlan, DataFusionError> {
        let optimized = self.context.state().optimize(&plan)?;
        let plan = logical_plan_to_bytes(&optimized)?;
        let canon_plan = canonicalize_for_cache(optimized)?;

        let mut hasher = RapidHasher::default();
        canon_plan.hash(&mut hasher);
        let hash_u64 = hasher.finish();

        Ok(HashedPlan {
            plan: plan.into(),
            hash: hash_u64.to_le_bytes().to_vec(),
        })
    }

    /// Optimize a logical plan using the session's optimizer and serialize it to bytes.
    fn optimize_plan(&self, plan: LogicalPlan) -> Result<Vec<u8>, DataFusionError> {
        let optimized = self.context.state().optimize(&plan)?;
        let bytes = logical_plan_to_bytes(&optimized)?;
        Ok(bytes.into())
    }

    /// Deserialize, optimize, and execute a plan, returning Arrow IPC bytes.
    async fn execute_plan(&self, plan: LogicalPlan) -> Result<Vec<u8>, DataFusionError> {
        let df = self.context.execute_logical_plan(plan).await?;

        let mut buffer = Vec::new();
        let batches = df.collect().await?;
        if batches.is_empty() {
            return Ok(buffer);
        }
        let batch = compact::compact(&batches)?;

        let mut writer = StreamWriter::try_new(&mut buffer, &batch.schema())?;
        writer.write(&batch)?;
        writer.finish()?;

        Ok(buffer)
    }

    pub async fn evaluate_plan(&self, plan: Vec<u8>) -> Result<Vec<u8>, JsValue> {
        let plan: LogicalPlan =
            logical_plan_from_bytes(&plan, &self.context.task_ctx()).map_err(error_map)?;

        self.execute_plan(plan).await.map_err(error_map)
    }

    async fn execute_query_plan(&self, plan: LogicalPlan) -> Result<Vec<u8>, DataFusionError> {
        let df = self.context.execute_logical_plan(plan).await?;

        let batches = df.collect().await?;

        let mut total_rows = 0u32;
        let mut cumulative_match_count = 0u32;

        let mut offsets: Vec<u32> = vec![0];
        let mut oracles: Vec<u8> = Vec::new();
        let mut matches: Vec<u8> = Vec::new();

        for batch in batches {
            let oracle_ids = batch
                .column(0)
                .as_any()
                .downcast_ref::<FixedSizeBinaryArray>()
                .unwrap();
            let matched_lists = batch
                .column(1)
                .as_any()
                .downcast_ref::<ListArray>()
                .unwrap();
            let matched_values = matched_lists
                .values()
                .as_any()
                .downcast_ref::<FixedSizeBinaryArray>()
                .unwrap();

            let rows_in_batch = batch.num_rows();
            total_rows += rows_in_batch as u32;

            for i in 0..rows_in_batch {
                oracles.extend_from_slice(oracle_ids.value(i));

                let start_idx = matched_lists.value_offsets()[i] as usize;
                let end_idx = matched_lists.value_offsets()[i + 1] as usize;

                let match_count = (end_idx - start_idx) as u32;
                cumulative_match_count += match_count;
                offsets.push(cumulative_match_count);

                for j in start_idx..end_idx {
                    matches.extend_from_slice(matched_values.value(j));
                }
            }
        }

        let total_capacity = 4 + (offsets.len() * 4) + oracles.len() + matches.len();
        let mut final_buffer = Vec::with_capacity(total_capacity);

        final_buffer.extend_from_slice(&total_rows.to_le_bytes());

        for offset in offsets {
            final_buffer.extend_from_slice(&offset.to_le_bytes());
        }

        // Data Arrays
        final_buffer.extend_from_slice(&oracles);
        final_buffer.extend_from_slice(&matches);

        Ok(final_buffer)
    }
    /// Evaluate a query plan and returns a packed bytes array of the matching uuids
    pub async fn evaluate_query_plan(&self, plan: Vec<u8>) -> Result<Vec<u8>, JsValue> {
        let plan: LogicalPlan =
            logical_plan_from_bytes(&plan, &self.context.task_ctx()).map_err(error_map)?;

        self.execute_query_plan(plan).await.map_err(error_map)
    }

    pub async fn query_plan_from_query(&self, query: String) -> Result<HashedPlan, JsValue> {
        let plan = parse_query(&self.context, &query)
            .await
            .map_err(error_map)?;

        let plan = LogicalPlanBuilder::from(plan)
            .project(vec![col("cards.oracle_id"), col("matched_prints")])
            .map_err(error_map)?
            .build()
            .map_err(error_map)?;

        self.hash_plan(plan).map_err(error_map)
    }

    pub async fn completion_plan_from_query(
        &self,
        query: String,
        pos: usize,
    ) -> Result<CompletionPlan, JsValue> {
        let response = completion_from_query(&self.context, query.as_str(), pos)
            .await
            .ok_or(JsValue::from("Failed to get completion plan"))?;

        match response {
            CompletionResponse::Query(completion, logical_plan) => {
                let plan = self.optimize_plan(logical_plan).map_err(error_map)?;
                Ok(CompletionPlan { plan, completion })
            }
            CompletionResponse::Completion(completion) => Ok(CompletionPlan {
                plan: Vec::new(),
                completion,
            }),
        }
    }

    pub async fn cards_plan_from_card_ids(
        &self,
        card_ids_packed: Vec<u8>,
    ) -> Result<HashedPlan, JsValue> {
        let card_ids = card_ids_packed
            .chunks_exact(16)
            .filter_map(|chunk| Uuid::from_slice(chunk).ok())
            .collect();
        let plan = build_cards_detail_plan(&self.context, card_ids)
            .await
            .map_err(error_map)?;
        self.hash_plan(plan).map_err(error_map)
    }
}

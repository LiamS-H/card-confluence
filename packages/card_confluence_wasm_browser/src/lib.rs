use arrow_ipc::writer::StreamWriter;
use card_confluence_db::{
    autocompletion::{completion_from_query, Completion, CompletionResponse},
    context::get_context_from_metadata,
    query_parser::{
        parse_query,
        planner::{build_cards_detail_plan, build_rulings_plan, build_sets_plan},
    },
    schema::meta_data::MetaData,
};
use datafusion::{
    error::DataFusionError,
    logical_expr::{col, LogicalPlan, LogicalPlanBuilder},
    object_store::ObjectStore,
    prelude::SessionContext,
};
use datafusion_proto::bytes::{logical_plan_from_bytes, logical_plan_to_bytes};
use std::sync::Arc;
use url::Url;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};
use web_sys::FileSystemFileHandle;

use crate::http_binding::PublicHTTPReadonlyStore;
use crate::opfs_binding::OpfsReadonlyStore;

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

#[wasm_bindgen]
pub struct CardConfluenceBrowser {
    context: SessionContext,
    store: Arc<dyn ObjectStore>,
}

// 1. Define the structural binding for the JS object
#[wasm_bindgen]
extern "C" {
    pub type DBFileHandles;

    #[wasm_bindgen(method, getter)]
    pub fn cards(this: &DBFileHandles) -> FileSystemFileHandle;

    #[wasm_bindgen(method, getter)]
    pub fn prints(this: &DBFileHandles) -> FileSystemFileHandle;

    #[wasm_bindgen(method, getter)]
    pub fn rulings(this: &DBFileHandles) -> FileSystemFileHandle;

    #[wasm_bindgen(method, getter)]
    pub fn sets(this: &DBFileHandles) -> FileSystemFileHandle;
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

    // fn release_files(&self, store:Arc<OpfsReadonlyStore>) -> Result<(), JsValue> {
    //     store.release_file(Path::from("cards.parquet"))?;
    //     self.context.deregister_table("cards").map_err(error_map)?;
    //     store.release_file(Path::from("prints.parquet"))?;
    //     self.context.deregister_table("prints").map_err(error_map)?;
    //     store.release_file(Path::from("rulings.parquet"))?;
    //     self.context
    //         .deregister_table("rulings")
    //         .map_err(error_map)?;
    //     store.release_file(Path::from("sets.parquet"))?;
    //     self.context.deregister_table("sets").map_err(error_map)?;
    //     Ok(())
    // }

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
        {
            let batches = df.collect().await?;

            let Some(first_batch) = batches.first() else {
                return Ok(buffer);
            };

            let mut writer = StreamWriter::try_new(&mut buffer, &first_batch.schema())?;

            for batch in batches {
                writer.write(&batch)?;
            }
            writer.finish()?;
        }

        Ok(buffer)
    }

    pub async fn evaluate_plan(&self, plan: Vec<u8>) -> Result<Vec<u8>, JsValue> {
        let plan: LogicalPlan =
            logical_plan_from_bytes(&plan, &self.context.task_ctx()).map_err(error_map)?;

        self.execute_plan(plan).await.map_err(error_map)
    }

    pub async fn query_plan_from_query(&self, query: String) -> Result<Vec<u8>, JsValue> {
        let plan = parse_query(&self.context, &query)
            .await
            .map_err(error_map)?;

        let plan = LogicalPlanBuilder::from(plan)
            .project(vec![col("cards.oracle_id"), col("matched_prints")])
            .map_err(error_map)?
            .build()
            .map_err(error_map)?;

        self.optimize_plan(plan).map_err(error_map)
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

    pub async fn sets_plan_from_set_codes(&self, sets: Vec<String>) -> Result<Vec<u8>, JsValue> {
        let plan = build_sets_plan(&self.context, sets)
            .await
            .map_err(error_map)?;

        self.optimize_plan(plan).map_err(error_map)
    }

    pub async fn cards_plan_from_card_ids(&self, card_id: Vec<String>) -> Result<Vec<u8>, JsValue> {
        let plan = build_cards_detail_plan(&self.context, card_id)
            .await
            .map_err(error_map)?;

        self.optimize_plan(plan).map_err(error_map)
    }

    pub async fn rulings_plan_from_card_ids(
        &self,
        card_ids: Vec<String>,
    ) -> Result<Vec<u8>, JsValue> {
        let plan = build_rulings_plan(&self.context, card_ids)
            .await
            .map_err(error_map)?;

        self.optimize_plan(plan).map_err(error_map)
    }
}

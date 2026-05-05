use std::sync::Arc;

use arrow_ipc::writer::StreamWriter;
use card_confluence_db::{
    autocompletion::{completion_from_query, Completion, CompletionResponse},
    query_executor::context::{register_paths, TablePaths},
    query_parser::{
        parse_query,
        planner::{build_cards_detail_plan, build_rulings_plan, build_sets_plan},
    },
};
use datafusion::{
    error::DataFusionError,
    logical_expr::{col, LogicalPlan, LogicalPlanBuilder},
    prelude::SessionContext,
};
use datafusion_proto::bytes::{logical_plan_from_bytes, logical_plan_to_bytes};
use object_store::path::Path;
use url::Url;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};
use web_sys::FileSystemFileHandle;

use crate::opfs_binding::OpfsReadonlyStore;

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
pub struct CardConfluenceLocal {
    context: SessionContext,
    store: Arc<OpfsReadonlyStore>,
    base_url: Url,
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
impl CardConfluenceLocal {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<Self, JsValue> {
        let store = Arc::new(OpfsReadonlyStore::new());
        let base_url = Url::parse("db://data/").unwrap();

        let context = SessionContext::new();
        context
            .runtime_env()
            .register_object_store(&base_url, store.clone());
        Ok(Self {
            context,
            store,
            base_url,
        })
    }

    pub async fn attach_files(&self, files: DBFileHandles) -> Result<(), JsValue> {
        self.store
            .register_file(Path::from("cards.parquet"), files.cards())
            .await?;

        self.store
            .register_file(Path::from("prints.parquet"), files.prints())
            .await?;

        self.store
            .register_file(Path::from("rulings.parquet"), files.rulings())
            .await?;

        self.store
            .register_file(Path::from("sets.parquet"), files.sets())
            .await?;

        register_paths(
            self.base_url.clone(),
            &self.context,
            TablePaths {
                cards: "cards.parquet".into(),
                prints: "prints.parquet".into(),
                rulings: "rulings.parquet".into(),
                sets: "sets.parquet".into(),
            },
        )
        .await
        .map_err(error_map)?;
        Ok(())
    }

    pub fn release_files(&self) -> Result<(), JsValue> {
        self.store.release_file(Path::from("cards.parquet"))?;
        self.context.deregister_table("cards").map_err(error_map)?;
        self.store.release_file(Path::from("prints.parquet"))?;
        self.context.deregister_table("prints").map_err(error_map)?;
        self.store.release_file(Path::from("rulings.parquet"))?;
        self.context
            .deregister_table("rulings")
            .map_err(error_map)?;
        self.store.release_file(Path::from("sets.parquet"))?;
        self.context.deregister_table("sets").map_err(error_map)?;
        Ok(())
    }

    async fn execute_plan(&self, plan: LogicalPlan) -> Result<Vec<u8>, DataFusionError> {
        // web_sys::console::log_1(&format!("Executing plan: {}", plan.display_indent()).into());
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

        return self.execute_plan(plan).await.map_err(error_map);
    }

    pub async fn query_plan_from_query(&self, query: String) -> Result<Vec<u8>, JsValue> {
        let plan = parse_query(&self.context, &query)
            .await
            .map_err(error_map)?;

        let builder = LogicalPlanBuilder::from(plan)
            .project(vec![col("cards.oracle_id"), col("matched_prints")])
            .map_err(error_map)?;

        let plan = builder.build().map_err(error_map)?;

        return Ok(logical_plan_to_bytes(&plan).map_err(error_map)?.into());
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
                let plan = logical_plan_to_bytes(&logical_plan)
                    .map_err(error_map)?
                    .into();
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

        return Ok(logical_plan_to_bytes(&plan).map_err(error_map)?.into());
    }

    pub async fn cards_plan_from_card_ids(&self, card_id: Vec<String>) -> Result<Vec<u8>, JsValue> {
        let plan = build_cards_detail_plan(&self.context, card_id)
            .await
            .map_err(error_map)?;

        return Ok(logical_plan_to_bytes(&plan).map_err(error_map)?.into());
    }

    pub async fn rulings_plan_from_card_ids(
        &self,
        card_ids: Vec<String>,
    ) -> Result<Vec<u8>, JsValue> {
        let plan = build_rulings_plan(&self.context, card_ids)
            .await
            .map_err(error_map)?;

        return Ok(logical_plan_to_bytes(&plan).map_err(error_map)?.into());
    }
}

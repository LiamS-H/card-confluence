use arrow_ipc::writer::StreamWriter;
use card_confluence_db::{
    query_executor::context::{get_context, TablePaths},
    query_parser::parse_query,
};
use datafusion::{logical_expr::LogicalPlan, prelude::SessionContext};
use datafusion_proto::bytes::{logical_plan_from_bytes, logical_plan_to_bytes};
use object_store::path::Path;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};
use web_sys::FileSystemFileHandle;

use crate::opfs_binding::OpfsReadonlyStore;

pub mod opfs_binding;

#[wasm_bindgen]
pub struct CardConfluenceLocal {
    context: SessionContext,
}

// 1. Define the structural binding for the JS object
#[wasm_bindgen]
extern "C" {
    pub type DBFileHandles;

    #[wasm_bindgen(method, getter)]
    pub fn cards(this: &DBFileHandles) -> FileSystemFileHandle;

    #[wasm_bindgen(method, getter)]
    pub fn rulings(this: &DBFileHandles) -> FileSystemFileHandle;

    #[wasm_bindgen(method, getter)]
    pub fn sets(this: &DBFileHandles) -> FileSystemFileHandle;
}

#[wasm_bindgen]
impl CardConfluenceLocal {
    #[wasm_bindgen(js_name = "fromFiles")]
    pub async fn from_files(files: DBFileHandles) -> Result<Self, JsValue> {
        let mut store = OpfsReadonlyStore::new();

        store
            .register_file(Path::from("cards.parquet"), files.cards())
            .await?;
        store
            .register_file(Path::from("rulings.parquet"), files.rulings())
            .await?;
        store
            .register_file(Path::from("sets.parquet"), files.sets())
            .await?;

        let context = get_context(
            store,
            TablePaths {
                cards: "cards.parquet".into(),
                rulings: "rulings.parquet".into(),
                sets: "sets.parquet".into(),
            },
        )
        .await
        .map_err(|u| JsValue::from_str(format!("{:?}", u).as_str()))?;

        Ok(Self { context })
    }

    pub async fn plan_index(&self, query: String) -> Result<Vec<u8>, JsValue> {
        let plan = parse_query(&self.context, &query)
            .await
            .map_err(|u| JsValue::from_str(format!("{:?}", u).as_str()))?;

        return Ok(logical_plan_to_bytes(&plan)
            .map_err(|u| JsValue::from_str(format!("{:?}", u).as_str()))?
            .into());
    }

    pub async fn query(&self, plan: Vec<u8>) -> Result<Vec<u8>, JsValue> {
        let plan: LogicalPlan = logical_plan_from_bytes(&plan, &self.context.task_ctx())
            .map_err(|u| JsValue::from_str(format!("{:?}", u).as_str()))?;

        let df = self
            .context
            .execute_logical_plan(plan)
            .await
            .map_err(|u| JsValue::from_str(format!("{:?}", u).as_str()))?;

        let mut buffer = Vec::new();
        {
            let batches = df
                .collect()
                .await
                .map_err(|u| JsValue::from_str(format!("{:?}", u).as_str()))?;

            let first_batch = batches
                .first()
                .ok_or(JsValue::from_str(format!("No Results").as_str()))?;

            let mut writer = StreamWriter::try_new(&mut buffer, &first_batch.schema())
                .map_err(|u| JsValue::from_str(format!("{:?}", u).as_str()))?;

            for batch in batches {
                writer
                    .write(&batch)
                    .map_err(|u| JsValue::from_str(format!("{:?}", u).as_str()))?;
            }
            writer
                .finish()
                .map_err(|u| JsValue::from_str(format!("{:?}", u).as_str()))?;
        }

        Ok(buffer)
    }
}

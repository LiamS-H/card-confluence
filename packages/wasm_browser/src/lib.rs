use arrow_ipc::writer::StreamWriter;
use card_confluence_db::{query_executor::context::get_context, query_parser::parse_query};
use datafusion::prelude::{col, SessionContext};
use object_store::path::Path;
use wasm_bindgen::{prelude::wasm_bindgen, JsValue};
use web_sys::FileSystemFileHandle;

use crate::opfs_binding::OpfsReadonlyStore;

pub mod opfs_binding;

#[wasm_bindgen]
pub struct CardConfluenceLocal {
    context: SessionContext,
}

#[wasm_bindgen]
pub struct DBFileHandles {
    cards: FileSystemFileHandle,
    rulings: FileSystemFileHandle,
    sets: FileSystemFileHandle,
}

#[wasm_bindgen]
pub struct QueryRawResult {
    pub ptr: *const u8,
    pub len: usize,
}

#[wasm_bindgen]
impl CardConfluenceLocal {
    pub async fn from_files(files: DBFileHandles) -> Self {
        let mut store = OpfsReadonlyStore::new();
        store.register_file(Path::from("cards.parquet"), files.cards);
        store.register_file(Path::from("rulings.parquet"), files.rulings);
        store.register_file(Path::from("sets.parquet"), files.sets);

        let Ok(context) = get_context(store).await else {
            return Self {
                context: SessionContext::new(),
            };
        };

        Self { context }
    }

    #[wasm_bindgen()]
    pub async fn query(&self, query: String) -> Result<QueryRawResult, JsValue> {
        let plan = parse_query(&self.context, &query)
            .await
            .map_err(|u| JsValue::from_str(format!("{:?}", u).as_str()))?;

        let df = self
            .context
            .execute_logical_plan(plan)
            .await
            .map_err(|u| JsValue::from_str(format!("{:?}", u).as_str()))?;
        let df = df
            .select(vec![col("name"), col("colors"), col("mana_cost")])
            .map_err(|u| JsValue::from_str(format!("{:?}", u).as_str()))?;

        let mut buffer = Vec::new();
        {
            // 1. Execute the query and collect the results into memory
            let batches = df
                .collect()
                .await
                .map_err(|u| JsValue::from_str(format!("{:?}", u).as_str()))?;

            // 2. Write the RecordBatches to the buffer as an Arrow IPC Stream
            if let Some(first_batch) = batches.first() {
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
        }

        let res = QueryRawResult {
            ptr: buffer.as_ptr(),
            len: buffer.len(),
        };
        std::mem::forget(buffer);
        Ok(res)
    }
}

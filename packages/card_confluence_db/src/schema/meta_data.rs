use crate::context::TablePaths;
use datafusion::error::DataFusionError;
use serde::{Deserialize, Serialize};
use tsify::Tsify;

#[derive(Default, Debug, Clone, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct MetaDataSource {
    pub table: String,
    pub iso: String,
    pub path: String,
}

#[derive(Default, Debug, Clone, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct MetaData {
    pub sources: Vec<MetaDataSource>,
}

impl MetaData {
    pub fn get_table(&self, target_table: String) -> Result<MetaDataSource, DataFusionError> {
        for source in &self.sources {
            if target_table == *source.table {
                return Ok(source.clone());
            }
        }
        Err(DataFusionError::External(
            format!("MetaData: table {} couldn't be found", target_table).into(),
        ))
    }
}

impl TryFrom<MetaData> for TablePaths {
    type Error = DataFusionError;

    fn try_from(metadata: MetaData) -> std::prelude::v1::Result<Self, Self::Error> {
        let mut paths = TablePaths {
            cards: "null".into(),
            prints: "null".into(),
            rulings: "null".into(),
            sets: "null".into(),
        };

        for MetaDataSource { path, table, .. } in metadata.sources {
            match table.as_str() {
                "cards" => paths.cards = path,
                "prints" => paths.prints = path,
                "rulings" => paths.rulings = path,
                "sets" => paths.sets = path,
                _ => {
                    return Err(DataFusionError::External(
                        format!(
                            "MetaData: {} is not recognized as a valid metadata table",
                            table
                        )
                        .into(),
                    ));
                }
            }
        }

        Ok(paths)
    }
}

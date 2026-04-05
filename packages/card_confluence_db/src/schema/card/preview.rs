use arrow_convert::{ArrowDeserialize, ArrowField, ArrowSerialize};
use serde::{Deserialize, Serialize};
use tsify::Tsify;

#[derive(
    Debug, Clone, Serialize, Deserialize, Tsify, ArrowField, ArrowSerialize, ArrowDeserialize,
)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct Preview {
    /// ISO 8601 date string: "YYYY-MM-DD"
    pub previewed_at: Option<String>,
    pub source_uri: Option<String>,
    pub source: Option<String>,
}

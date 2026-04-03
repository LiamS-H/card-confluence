use arrow_convert::{ArrowDeserialize, ArrowField, ArrowSerialize};
use serde::{Deserialize, Serialize};
use tsify::Tsify;

#[derive(
    Debug, Clone, Serialize, Deserialize, Tsify, ArrowField, ArrowSerialize, ArrowDeserialize,
)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct Ruling {
    pub object: String,
    pub oracle_id: String,
    pub source: String,
    /// ISO 8601 date string: "YYYY-MM-DD"
    pub published_at: String,
    pub comment: String,
}

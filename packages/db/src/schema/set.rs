use arrow_convert::{ArrowDeserialize, ArrowField, ArrowSerialize};
use serde::{Deserialize, Serialize};
use tsify::Tsify;

#[derive(
    Debug, Clone, Serialize, Deserialize, Tsify, ArrowField, ArrowSerialize, ArrowDeserialize,
)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct Set {
    #[serde(rename = "name")]
    pub set_name: String,
    pub set_type: String,
    /// Short set code, e.g. "ltr"
    #[serde(rename = "code")]
    pub set: String,
    /// UUID
    #[serde(rename = "id")]
    pub set_id: String,
}

use arrow_convert::{ArrowDeserialize, ArrowField, ArrowSerialize};
use serde::{Deserialize, Serialize};
use tsify::Tsify;

#[derive(
    Debug, Clone, Serialize, Deserialize, Tsify, ArrowField, ArrowSerialize, ArrowDeserialize,
)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct Set {
    pub name: String,
    pub set_type: String,
    /// Short set code, e.g. "ltr"
    pub code: String,
    /// UUID
    pub id: String,
    pub released_at: Option<String>,
}

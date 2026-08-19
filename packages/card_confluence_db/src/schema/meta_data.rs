use serde::{Deserialize, Serialize};
use tsify::Tsify;

#[derive(Default, Debug, Clone, Serialize, Deserialize, Tsify)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct MetaData {
    pub cards_path: String,
    pub cards_iso: String,
    pub prints_path: String,
    pub prints_iso: String,
    pub rulings_path: String,
    pub rulings_iso: String,
    pub sets_path: String,
    pub sets_iso: String,
}

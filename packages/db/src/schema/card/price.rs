use arrow_convert::{ArrowDeserialize, ArrowField, ArrowSerialize};
use serde::{Deserialize, Serialize};
use tsify::Tsify;

#[derive(
    Debug, Clone, Serialize, Deserialize, Tsify, ArrowField, ArrowSerialize, ArrowDeserialize,
)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct Prices {
    pub usd: Option<f32>,
    pub usd_foil: Option<f32>,
    pub usd_etched: Option<f32>,
    pub eur: Option<f32>,
    pub eur_foil: Option<f32>,
    pub eur_etched: Option<f32>,
    pub tix: Option<f32>,
}
#[derive(
    Debug, Clone, Serialize, Deserialize, Tsify, ArrowField, ArrowSerialize, ArrowDeserialize,
)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct PurchaseUris {
    pub tcgplayer: Option<String>,
    pub cardmarket: Option<String>,
    pub cardhoarder: Option<String>,
}

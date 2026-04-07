use arrow_convert::{ArrowDeserialize, ArrowField, ArrowSerialize};
use serde::{Deserialize, Serialize};
use tsify::Tsify;

#[derive(
    Debug, Clone, Serialize, Deserialize, Tsify, ArrowField, ArrowSerialize, ArrowDeserialize,
)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct RelatedUris {
    pub gatherer: Option<String>,
    pub tcgplayer_infinite_articles: Option<String>,
    pub tcgplayer_infinite_decks: Option<String>,
    pub edhrec: Option<String>,
}

#[derive(
    Debug, Clone, Serialize, Deserialize, Tsify, ArrowField, ArrowSerialize, ArrowDeserialize,
)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct RelatedCard {
    /// UUID
    pub id: String,
    /// Always "related_card"
    pub object: String,
    /// One of: "token", "meld_part", "meld_result", "combo_piece"
    pub component: String,
    pub name: String,
    pub type_line: String,
    pub uri: String,
}

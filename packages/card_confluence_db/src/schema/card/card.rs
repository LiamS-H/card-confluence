use crate::schema::card::print::Print;

use super::{
    legality::Legalities,
    preview::Preview,
    related::{
        RelatedCard,
        // RelatedUris
    },
};
use arrow_convert::{ArrowDeserialize, ArrowField, ArrowSerialize};
use serde::{Deserialize, Serialize};
use tsify::Tsify;

#[derive(
    Debug, Clone, Serialize, Deserialize, Tsify, ArrowField, ArrowSerialize, ArrowDeserialize,
)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct CardFace {
    /// Always "card_face"
    // pub object: String,
    pub oracle_id: Option<String>,
    pub cmc: Option<f32>,
    pub type_line: Option<String>,
    pub oracle_text: Option<String>,
    pub flavor_text: Option<String>,
    pub color_indicator: Option<Vec<String>>,
    pub colors: Option<Vec<String>>,
    /// Empty string "" means explicitly no mana cost
    pub mana_cost: String,
    pub name: String,
    pub power: Option<String>,
    pub toughness: Option<String>,
    pub loyalty: Option<String>,
    pub defense: Option<String>,
}

#[derive(
    Debug, Clone, Serialize, Deserialize, Tsify, ArrowField, ArrowSerialize, ArrowDeserialize,
)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct Card {
    pub layout: String,
    pub oracle_id: String,

    pub name: String,
    pub all_parts: Option<Vec<RelatedCard>>,
    pub cmc: f32,
    pub color_identity: Vec<String>,
    pub color_indicator: Option<Vec<String>>,
    pub colors: Vec<String>,

    pub game_changer: bool,
    pub reserved: bool,
    pub otags: Vec<String>,

    pub edhrec_rank: Option<i32>,
    pub penny_rank: Option<i32>,

    pub power: Option<String>,
    pub toughness: Option<String>,
    pub loyalty: Option<String>,
    pub defense: Option<String>,

    pub keywords: Vec<String>,
    pub legalities: Legalities,
    pub mana_cost: Option<String>,
    pub oracle_text: Option<String>,
    pub produced_mana: Option<Vec<String>>,
    pub type_line: String,
    pub card_types: Vec<String>,
    pub super_types: Vec<String>,
    pub sub_types: Vec<String>,

    pub preview: Option<Preview>,

    pub card_faces: Option<Vec<CardFace>>,
    pub prints: Vec<Print>,
}

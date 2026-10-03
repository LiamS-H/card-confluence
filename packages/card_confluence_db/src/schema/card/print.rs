use super::{
    image::ImageUris,
    price::{Prices, PurchaseUris},
};
use arrow_convert::{ArrowDeserialize, ArrowField, ArrowSerialize};
use serde::{Deserialize, Serialize};
use tsify::Tsify;

#[derive(
    Debug, Clone, Serialize, Deserialize, Tsify, ArrowField, ArrowSerialize, ArrowDeserialize,
)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct Print {
    pub lang: String,
    #[tsify(type = "Uint8Array")]
    pub oracle_id: uuid::Uuid,
    #[tsify(type = "Uint8Array")]
    pub scryfall_id: uuid::Uuid,
    pub arena_id: Option<i32>,
    pub mtgo_id: Option<i32>,
    pub mtgo_foil_id: Option<i32>,
    /// one per image face
    pub multiverse_ids: Option<Vec<i32>>,
    pub tcgplayer_id: Option<i32>,
    pub tcgplayer_etched_id: Option<i32>,
    pub cardmarket_id: Option<i32>,

    pub collector_number: String,
    pub set_code: String,
    pub released_at: String,
    pub reprint: bool,
    pub booster: bool,
    pub promo: bool,
    pub digital: bool,
    pub oversized: bool,
    pub story_spotlight: bool,
    pub textless: bool,
    pub promo_types: Option<Vec<String>>,
    pub rarity: String,
    pub games: Vec<String>,
    pub finishes: Vec<String>,
    pub flavor_name: Option<String>,
    pub frame_effects: Option<Vec<String>>,
    /// One of: "oval", "triangle", "acorn", "circle", "arena", "heart"
    pub security_stamp: Option<String>,
    pub frame: String,
    pub full_art: bool,
    pub image_status: String,
    pub highres_image: bool,
    pub variation: bool,
    pub variation_of: Option<String>,

    #[tsify(type = "Uint8Array | null")]
    pub card_back_id: Option<uuid::Uuid>,

    pub border_color: String,
    pub content_warning: bool,
    pub illustrations: Vec<Illustration>,
    #[tsify(type = "Uint8Array[]")]
    pub artist_ids: Option<Vec<uuid::Uuid>>,
    pub purchase_uris: Option<PurchaseUris>,
    pub prices: Prices,
}

#[derive(
    Debug, Clone, Serialize, Deserialize, Tsify, ArrowField, ArrowSerialize, ArrowDeserialize,
)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct Illustration {
    #[tsify(type = "Uint8Array | null")]
    pub illustration_id: Option<uuid::Uuid>,
    pub artist: Option<String>,
    #[tsify(type = "Uint8Array[]")]
    pub artist_ids: Vec<uuid::Uuid>,

    pub watermark: Option<String>,
    pub flavor_text: Option<String>,

    pub printed_name: Option<String>,
    pub printed_text: Option<String>,
    pub printed_type_line: Option<String>,

    pub image_uris: Option<ImageUris>,
}

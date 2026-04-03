use super::{
    image::ImageUris,
    legality::Legalities,
    preview::Preview,
    price::{Prices, PurchaseUris},
    related::{RelatedCard, RelatedUris},
};
use arrow_convert::{ArrowDeserialize, ArrowField, ArrowSerialize};
use serde::{Deserialize, Serialize};
use tsify::Tsify;

#[derive(
    Debug, Clone, Serialize, Deserialize, Tsify, ArrowField, ArrowSerialize, ArrowDeserialize,
)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct CardFace {
    pub artist: Option<String>,
    /// UUID
    pub artist_id: Option<String>,
    /// Mana value — only present on reversible cards
    pub cmc: Option<f32>,
    /// Colors in this face's color indicator
    pub color_indicator: Option<Vec<String>>,
    /// This face's colors
    pub colors: Option<Vec<String>>,
    pub defense: Option<String>,
    pub flavor_text: Option<String>,
    /// UUID
    pub illustration_id: Option<String>,
    /// Only present on double-sided cards
    pub image_uris: Option<ImageUris>,
    /// Only present on reversible cards
    pub layout: Option<String>,
    pub loyalty: Option<String>,
    /// Empty string "" means explicitly no mana cost
    pub mana_cost: String,
    pub name: String,
    /// Always "card_face"
    pub object: String,
    /// UUID — only present on reversible cards
    pub oracle_id: Option<String>,
    pub oracle_text: Option<String>,
    pub power: Option<String>,
    pub printed_name: Option<String>,
    pub printed_text: Option<String>,
    pub printed_type_line: Option<String>,
    pub toughness: Option<String>,
    /// Only present on reversible cards
    pub type_line: Option<String>,
    pub watermark: Option<String>,
}

#[derive(
    Debug, Clone, Serialize, Deserialize, Tsify, ArrowField, ArrowSerialize, ArrowDeserialize,
)]
#[tsify(into_wasm_abi, from_wasm_abi)]
pub struct Card {
    // -----------------------------------------------------------------------
    // Core fields
    // -----------------------------------------------------------------------
    pub arena_id: Option<i32>,
    /// UUID — primary Scryfall identifier
    pub id: String,
    pub lang: String,
    pub mtgo_id: Option<i32>,
    pub mtgo_foil_id: Option<i32>,
    pub multiverse_ids: Option<Vec<i32>>,
    pub resource_id: Option<String>,
    pub tcgplayer_id: Option<i32>,
    pub tcgplayer_etched_id: Option<i32>,
    pub cardmarket_id: Option<i32>,
    /// Always "card"
    pub object: String,
    pub layout: String,
    /// UUID — absent for `reversible_card` layout; oracle_id lives on card_faces
    pub oracle_id: Option<String>,
    // removed from scryfall
    // pub prints_search_uri: String,
    // pub rulings_uri: String,
    // pub scryfall_uri: String,
    // pub uri: String,

    // -----------------------------------------------------------------------
    // Gameplay fields
    // -----------------------------------------------------------------------
    pub all_parts: Option<Vec<RelatedCard>>,
    pub card_faces: Option<Vec<CardFace>>,
    /// f64 because some Un-set cards have fractional mana values
    pub cmc: f32,
    pub color_identity: Vec<String>,
    pub color_indicator: Option<Vec<String>>,
    pub colors: Option<Vec<String>>,
    pub defense: Option<String>,
    pub edhrec_rank: Option<i32>,
    pub game_changer: Option<bool>,
    /// Vanguard delta, e.g. "-1"
    pub hand_modifier: Option<String>,
    pub keywords: Vec<String>,
    pub legalities: Legalities,
    /// Vanguard delta, e.g. "+2"
    pub life_modifier: Option<String>,
    pub loyalty: Option<String>,
    /// Empty string "" means explicitly no mana cost
    pub mana_cost: Option<String>,
    pub name: String,
    pub oracle_text: Option<String>,
    pub penny_rank: Option<i32>,
    /// Note: may be non-numeric, e.g. "*"
    pub power: Option<String>,
    pub produced_mana: Option<Vec<String>>,
    pub reserved: bool,
    /// Note: may be non-numeric, e.g. "*"
    pub toughness: Option<String>,
    pub type_line: String,

    // -----------------------------------------------------------------------
    // Print fields
    // -----------------------------------------------------------------------
    pub artist: Option<String>,
    pub artist_ids: Option<Vec<String>>,
    /// Lit Unfinity attraction lights
    pub attraction_lights: Option<Vec<i32>>,
    pub booster: bool,
    /// One of: "black", "white", "borderless", "yellow", "silver", "gold"
    pub border_color: String,
    /// UUID
    pub card_back_id: String,
    /// May contain non-numeric chars like "★"
    pub collector_number: String,
    pub content_warning: Option<bool>,
    pub digital: bool,
    /// e.g. ["foil", "nonfoil"] or ["etched"]
    pub finishes: Vec<String>,
    /// Alternate fun name, e.g. Godzilla series
    pub flavor_name: Option<String>,
    pub flavor_text: Option<String>,
    pub frame_effects: Option<Vec<String>>,
    pub frame: String,
    pub full_art: bool,
    /// e.g. ["paper"], ["paper", "mtgo"], ["arena"]
    pub games: Vec<String>,
    pub highres_image: bool,
    /// UUID
    pub illustration_id: Option<String>,
    /// One of: "missing", "placeholder", "lowres", "highres_scan"
    pub image_status: String,
    pub image_uris: Option<ImageUris>,
    pub oversized: bool,
    pub prices: Prices,
    pub printed_name: Option<String>,
    pub printed_text: Option<String>,
    pub printed_type_line: Option<String>,
    pub promo: bool,
    pub promo_types: Option<Vec<String>>,
    pub purchase_uris: Option<PurchaseUris>,
    /// One of: "common", "uncommon", "rare", "special", "mythic", "bonus"
    pub rarity: String,
    pub related_uris: RelatedUris,
    /// ISO 8601 date string: "YYYY-MM-DD"
    pub released_at: String,
    pub reprint: bool,

    pub story_spotlight: bool,
    pub textless: bool,
    pub variation: bool,
    /// UUID — the print this card is a variation of
    pub variation_of: Option<String>,
    /// One of: "oval", "triangle", "acorn", "circle", "arena", "heart"
    pub security_stamp: Option<String>,
    pub watermark: Option<String>,
    pub preview: Option<Preview>,
}

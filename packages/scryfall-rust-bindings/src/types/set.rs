use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ScryfallSetList {
    pub has_more: bool,
    pub data: Vec<ScryfallSet>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScryfallSet {
    pub object: String,
    pub id: String,
    pub code: String,
    pub mtgo_code: Option<String>,
    pub arena_code: Option<String>,
    pub tcgplayer_id: Option<u32>,
    pub name: String,
    pub set_type: String,
    // ISO 8061
    pub released_at: Option<String>,
    pub block_code: Option<String>,
    pub block: Option<String>,
    pub parent_set_code: Option<String>,
    pub card_count: u32,
    pub printed_size: Option<u32>,
    pub digital: bool,
    pub nonfoil_only: bool,
    pub foil_only: bool,
    pub scryfall_uri: String,
    pub uri: String,
    pub icon_svg_uri: String,
    pub search_uri: String,
}

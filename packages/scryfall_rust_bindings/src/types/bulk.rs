use serde::{Deserialize, Serialize};

pub const SCRYFALL_BULK_DATA_TYPES: [&str; 5] = [
    "oracle_cards",
    "unique_artwork",
    "default_cards",
    "all_cards",
    "rulings",
];

#[derive(Debug, Serialize, Deserialize)]
pub struct ScryfallBulkData {
    pub object: String,
    pub id: String,
    pub r#type: String,
    pub updated_at: String,
    pub uri: String,
    pub name: String,
    pub description: String,
    pub size: u64,
    pub download_uri: String,
    pub content_type: String,
    pub content_encoding: String,
}

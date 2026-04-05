use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ScryfallMigrationList {
    pub total_cards: u32,
    pub has_more: bool,
    pub next_page: Option<String>,
    pub data: Vec<ScryfallMigration>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScryfallMigrationMetadata {
    pub id: Option<String>,
    pub lang: Option<String>,
    pub name: Option<String>,
    pub set_code: Option<String>,
    pub oracle_id: Option<String>,
    pub collector_number: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScryfallMigration {
    pub object: String,
    pub uri: String,
    pub id: String,
    // ISO 8601
    pub performed_at: String,
    pub old_scryfall_id: String,
    pub new_scryfall_id: Option<String>,
    pub not: Option<String>,
    pub metadata: Option<ScryfallMigrationMetadata>,
}

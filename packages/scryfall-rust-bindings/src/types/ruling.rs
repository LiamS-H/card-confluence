use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ScryfallRuling {
    pub object: String,
    pub oracle_id: String,
    pub source: String,
    pub published_at: String,
    pub comment: String,
}

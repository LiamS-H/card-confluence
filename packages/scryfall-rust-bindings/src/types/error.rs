use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct ScryfallError {
    pub status: i32,
    pub object: String,
    pub code: String,
    pub details: String,
    pub r#type: Option<String>,
    pub warnings: Option<Vec<String>>,
}

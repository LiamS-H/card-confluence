use scryfall_rust_bindings::fetch_sets;

pub async fn fetch_sets_bytes() -> Result<Vec<u8>, Box<dyn std::error::Error>> {
    Ok(serde_json::to_vec(&fetch_sets().await?.data)?)
}

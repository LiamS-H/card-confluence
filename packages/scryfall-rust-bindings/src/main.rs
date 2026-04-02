use scryfall_rust_bindings::{SearchSettings, fetch_search};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let query = "akki lavarunner";
    let settings = SearchSettings {
        unique: Some("cards".to_string()),
        ..Default::default()
    };

    println!("Searching for: {}", query);
    let result = fetch_search(query, Some(settings)).await?;

    // Just print the first card name if available
    if let Some(cards) = result.get("data").and_then(|d| d.as_array()) {
        if let Some(first_card) = cards.first() {
            if let Some(name) = first_card.get("name").and_then(|n| n.as_str()) {
                println!("Found card: {}", name);
            }
        }
    } else {
        println!("No cards found or error: {:?}", result);
    }

    Ok(())
}

use scryfall_rust_bindings::{
    ScryfallSearchResponse, ScryfallSearchSettings, fetch_bulk, fetch_search, fetch_sets,
};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let query = "akki lavarunner";
    let settings = ScryfallSearchSettings {
        unique: Some("cards".to_string()),
        ..Default::default()
    };

    println!("Searching for: {}", query);
    let result = fetch_search(query, Some(settings)).await?;

    let list = match result {
        ScryfallSearchResponse::List(scryfall_card_list) => scryfall_card_list,
        ScryfallSearchResponse::Error(scryfall_error) => {
            println!("Returned Error {}", scryfall_error.details);
            return Ok(());
        }
    };
    let cards = list.data;
    if let Some(first_card) = cards.first() {
        println!("Found card: {}", first_card.name);
    }

    println!("Fetching sets");
    let result = fetch_sets().await?;

    let sets = result.data;

    if let Some(first_set) = sets.first() {
        println!("Found set: {}", first_set.name);
    }

    println!("Fetching bulk");
    let result = fetch_bulk("rulings").await?;

    println!("Found set: {}", result.name);

    Ok(())
}

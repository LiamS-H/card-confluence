use card_confluence_db::seed::{self, SeedMode};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();

    if args.len() > 1 {
        let command = &args[1];

        match command.as_str() {
            "seed" => {
                let mode = match args.get(2).unwrap_or(&"".into()).as_str() {
                    "cached" => SeedMode::LatestCached,
                    "" => SeedMode::Latest,
                    id => SeedMode::Specific(id.into()),
                };
                seed::seed(mode).await?;
            }
            _ => {
                eprintln!("Unknown command: {}", command);
                print_usage();
                std::process::exit(1);
            }
        }
    } else {
        println!("No command provided.");
        print_usage();
        std::process::exit(1);
    }
    Ok(())
}

fn print_usage() {
    println!("Usage: cargo run <command>");
    println!("Available commands:");
    println!("  seed: Create parquet files from scryfall - latest by default.");
}

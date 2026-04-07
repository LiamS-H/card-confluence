use std::path::Path;

use card_confluence_db::{
    query_executor::context::get_context,
    query_parser::parse_query,
    seed::{self, SeedMode},
};
use datafusion::prelude::col;
use object_store::local::LocalFileSystem;

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
            "query" => {
                let query = if args.len() > 2 {
                    args[2..].join(" ")
                } else {
                    eprintln!("No query provided.");
                    print_usage();
                    std::process::exit(1);
                };

                let parquet_dir = Path::new(".parquet");
                let mut entries: Vec<_> = std::fs::read_dir(parquet_dir)?
                    .filter_map(|e| e.ok())
                    .filter(|e| e.path().is_dir())
                    .collect();

                entries.sort_by_key(|e| e.file_name());
                let latest_path = entries
                    .last()
                    .ok_or("No parquet directories found. Run seed first.")?
                    .path();

                let ctx = get_context(
                    LocalFileSystem::new_with_prefix(latest_path)
                        .expect("Failed to instantiate LocalFileStore"),
                )
                .await?;

                let plan = parse_query(&ctx, &query).await?;

                let df = ctx.execute_logical_plan(plan).await?;
                let df = df.select(vec![col("name"), col("colors"), col("mana_cost")])?;
                df.show().await?;
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
    println!("  query <query_string>: Query the latest parquet data.");
}

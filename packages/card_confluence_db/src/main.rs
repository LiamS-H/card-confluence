use card_confluence_db::{
    query_executor::context::{get_context, TablePaths},
    query_parser::parse_query,
    seed::{self, SeedMode},
    utils::get_latest,
};
use datafusion::prelude::col;
use object_store::{local::LocalFileSystem, path::Path as ObjectPath, ObjectStore};
use std::sync::Arc;

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
                let json_store = Arc::new(LocalFileSystem::new_with_prefix(".scryfall")?);
                let parquet_store = Arc::new(LocalFileSystem::new_with_prefix(".parquet")?);
                seed::seed(mode, json_store, parquet_store).await?;
            }
            "query" => {
                let query = if args.len() > 2 {
                    args[2..].join(" ")
                } else {
                    eprintln!("No query provided.");
                    print_usage();
                    std::process::exit(1);
                };

                let parquet_store: Arc<dyn ObjectStore> =
                    Arc::new(LocalFileSystem::new_with_prefix(".parquet")?);

                let latest_cards =
                    get_latest(&parquet_store, &ObjectPath::from("cards"), "parquet")
                        .await
                        .ok_or("No card parquet files found. Run seed first.")?;
                let latest_rulings =
                    get_latest(&parquet_store, &ObjectPath::from("rulings"), "parquet")
                        .await
                        .ok_or("No ruling parquet files found. Run seed first.")?;
                let latest_sets = get_latest(&parquet_store, &ObjectPath::from("sets"), "parquet")
                    .await
                    .ok_or("No set parquet files found. Run seed first.")?;

                let paths = TablePaths {
                    cards: format!("db://data/{}", latest_cards),
                    rulings: format!("db://data/{}", latest_rulings),
                    sets: format!("db://data/{}", latest_sets),
                };

                let ctx = get_context(parquet_store, paths).await?;

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

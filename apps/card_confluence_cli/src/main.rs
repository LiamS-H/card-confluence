use anyhow::{Context, Result};
use card_confluence_db::{
    query_executor::context::{get_context, TablePaths},
    query_parser::parse_query,
    seed::{self, SeedMode},
    utils::get_latest,
};
use clap::{Parser, Subcommand};
use datafusion::prelude::col;
use dotenvy::dotenv;
use object_store::{
    aws::AmazonS3Builder, local::LocalFileSystem, path::Path as ObjectPath, prefix::PrefixStore,
    ObjectStore,
};
use std::sync::Arc;

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Use R2 for history (scryfall json)
    #[arg(long, env = "HISTORY_USE_R2")]
    history_r2: bool,
}

#[derive(Subcommand)]
enum Commands {
    /// Create parquet files from Scryfall
    Seed {
        /// Mode: cached, latest, or a specific ID
        mode: Option<String>,
    },
    /// Query the latest parquet data
    Query {
        /// The query string
        query: String,
    },
    /// Move latest local parquet files to R2
    UploadLatest,
}

fn get_r2_from_env_prefix(prefix: &str) -> Result<Arc<dyn ObjectStore>> {
    let endpoint = std::env::var(format!("{}_R2_ENDPOINT", prefix))
        .context(format!("{}_R2_ENDPOINT must be set", prefix))?;
    let access_key = std::env::var(format!("{}_R2_ACCESS_KEY_ID", prefix))
        .context(format!("{}_R2_ACCESS_KEY_ID must be set", prefix))?;
    let secret_key = std::env::var(format!("{}_R2_SECRET_ACCESS_KEY", prefix))
        .context(format!("{}_R2_SECRET_ACCESS_KEY must be set", prefix))?;
    let bucket = std::env::var(format!("{}_R2_BUCKET", prefix))
        .context(format!("{}_R2_BUCKET must be set", prefix))?;

    let s3 = AmazonS3Builder::new()
        .with_endpoint(endpoint)
        .with_access_key_id(access_key)
        .with_secret_access_key(secret_key)
        .with_bucket_name(bucket)
        .with_region("auto")
        .build()?;
    Ok(Arc::new(s3))
}

#[tokio::main]
async fn main() -> Result<()> {
    dotenv().ok();
    let cli = Cli::parse();

    let local = Arc::new(LocalFileSystem::new_with_prefix("./")?);

    let history_store = if cli.history_r2 {
        get_r2_from_env_prefix("HISTORY")?
    } else {
        local.clone()
    };

    let json_store: Arc<dyn ObjectStore> =
        Arc::new(PrefixStore::new(history_store.clone(), ".scryfall"));
    let parquet_store: Arc<dyn ObjectStore> = Arc::new(PrefixStore::new(history_store, ".parquet"));

    match cli.command {
        Commands::Seed { mode } => {
            let mode = match mode.as_deref() {
                Some("cached") => SeedMode::LatestCached,
                None | Some("") => SeedMode::Latest,
                Some(id) => SeedMode::Specific(id.into()),
            };
            seed::seed(mode, json_store, parquet_store)
                .await
                .map_err(|e| anyhow::anyhow!("{:?}", e))?;
        }
        Commands::Query { query } => {
            let latest_cards = get_latest(&parquet_store, &ObjectPath::from("cards"), "parquet")
                .await
                .ok_or_else(|| anyhow::anyhow!("No card parquet files found. Run seed first."))?;
            let latest_rulings =
                get_latest(&parquet_store, &ObjectPath::from("rulings"), "parquet")
                    .await
                    .ok_or_else(|| {
                        anyhow::anyhow!("No ruling parquet files found. Run seed first.")
                    })?;
            let latest_sets = get_latest(&parquet_store, &ObjectPath::from("sets"), "parquet")
                .await
                .ok_or_else(|| anyhow::anyhow!("No set parquet files found. Run seed first."))?;

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
        Commands::UploadLatest => {
            let latest_store = get_r2_from_env_prefix("LATEST")?;

            for table in &["cards", "rulings", "sets"] {
                println!("Uploading latest {}...", table);
                if let Some(latest) =
                    get_latest(&parquet_store, &ObjectPath::from(*table), "parquet").await
                {
                    let source_path = ObjectPath::from(latest.clone());
                    let dest_path = ObjectPath::from(format!("{}.parquet", table));

                    println!("Moving {} to {}", source_path, dest_path);

                    let get_res = parquet_store.get(&source_path).await?;
                    let bytes = get_res.bytes().await?;
                    latest_store.put(&dest_path, bytes.into()).await?;
                    println!("Uploaded {}.parquet", table);
                } else {
                    println!("No latest file found for {}", table);
                }
            }
        }
    }

    Ok(())
}

mod commands;

use anyhow::{Context, Result};
use clap::{Parser, Subcommand};
use dotenvy::dotenv;
use object_store::{
    aws::AmazonS3Builder, local::LocalFileSystem, prefix::PrefixStore,
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
    /// Query the latest parquet data via interactive TUI
    Query,
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
            commands::seed::exec(mode, json_store, parquet_store).await?;
        }
        Commands::Query => {
            commands::query::exec(parquet_store).await?;
        }
        Commands::UploadLatest => {
            let latest_store = get_r2_from_env_prefix("LATEST")?;
            commands::upload::exec(parquet_store, latest_store).await?;
        }
    }

    Ok(())
}

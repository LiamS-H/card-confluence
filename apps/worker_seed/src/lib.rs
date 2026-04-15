use card_confluence_db::seed::{self, SeedMode};
use card_confluence_db::utils::get_latest;
use chrono::Utc;
use cloudflare_utils::r2_worker_store::R2WorkerStore;
use object_store::prefix::PrefixStore;
use object_store::{path::Path as ObjectPath, ObjectStore};
use std::sync::Arc;
use worker::*;

#[event(scheduled)]
pub async fn scheduled(event: ScheduledEvent, env: Env, _ctx: ScheduleContext) {
    let history_bucket = match env.bucket("cc_parquet_history") {
        Ok(b) => b,
        Err(_) => {
            console_log!("Error: Could not find cc_parquet_history R2 binding");
            return;
        }
    };
    let latest_bucket = match env.bucket("cc_parquet_latest") {
        Ok(b) => b,
        Err(_) => {
            console_log!("Error: Could not find cc_parquet_latest R2 binding");
            return;
        }
    };

    let r2_history_store: Arc<dyn ObjectStore> = Arc::new(R2WorkerStore::new(history_bucket));

    let history_json_store: Arc<dyn ObjectStore> =
        Arc::new(PrefixStore::new(r2_history_store.clone(), ".scryfall"));
    let history_parquet_store: Arc<dyn ObjectStore> =
        Arc::new(PrefixStore::new(r2_history_store.clone(), ".parquet"));

    let latest_store: Arc<dyn ObjectStore> = Arc::new(R2WorkerStore::new(latest_bucket));

    console_log!("Starting seed at: {}", event.schedule());

    match seed::seed(
        SeedMode::Latest,
        history_json_store.clone(),
        history_parquet_store.clone(),
    )
    .await
    {
        Ok(_) => console_log!("Successfully seeded"),
        Err(e) => {
            console_log!("Seeding failed: {:?}", e);
            return;
        }
    }

    // Copy latest files to cc-parquet-latest
    let targets = [
        ("cards", "cards.parquet"),
        ("rulings", "rulings.parquet"),
        ("sets", "sets.parquet"),
    ];

    for (prefix, target_name) in targets {
        if let Some(latest_path) =
            get_latest(&history_parquet_store, &ObjectPath::from(prefix), "parquet").await
        {
            console_log!("Found latest {}: {}", prefix, latest_path);
            match history_parquet_store.get(&latest_path).await {
                Ok(res) => match res.bytes().await {
                    Ok(bytes) => {
                        match latest_store
                            .put(&ObjectPath::from(target_name), bytes.into())
                            .await
                        {
                            Ok(_) => console_log!("Successfully updated {}", target_name),
                            Err(e) => console_log!("Failed to update {}: {:?}", target_name, e),
                        }
                    }
                    Err(e) => console_log!("Failed to read bytes for {}: {:?}", latest_path, e),
                },
                Err(e) => console_log!("Failed to get {} from history: {:?}", latest_path, e),
            }
        } else {
            console_log!("Could not find latest {} in history", prefix);
        }
    }

    console_log!("Finished seed at: {}", Utc::now().to_rfc3339());
}

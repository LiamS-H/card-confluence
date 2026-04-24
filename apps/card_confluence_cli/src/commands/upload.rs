use anyhow::Result;
use card_confluence_db::utils::get_latest;
use object_store::{path::Path as ObjectPath, ObjectStore};
use std::sync::Arc;

pub async fn exec(
    parquet_store: Arc<dyn ObjectStore>,
    latest_store: Arc<dyn ObjectStore>,
) -> Result<()> {
    for table in &["cards", "rulings", "sets"] {
        println!("Uploading latest {}...", table);
        if let Some(latest) = get_latest(&parquet_store, &ObjectPath::from(*table), "parquet").await {
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
    Ok(())
}

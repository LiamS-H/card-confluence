use anyhow::Result;
use card_confluence_db::utils::get_latest;
use futures::StreamExt;
use object_store::{path::Path as ObjectPath, ObjectStore};
use std::sync::Arc;

pub async fn exec(
    parquet_store: Arc<dyn ObjectStore>,
    latest_store: Arc<dyn ObjectStore>,
) -> Result<()> {
    for table in &["cards", "prints", "rulings", "sets"] {
        println!("Uploading latest {}...", table);
        if let Some(latest) = get_latest(&parquet_store, &ObjectPath::from(*table), "parquet").await
        {
            let source_path = ObjectPath::from(latest.clone());
            let dest_path = ObjectPath::from(format!("{}.parquet", table));

            println!("Moving {} to {}", source_path, dest_path);

            let get_res = parquet_store.get(&source_path).await?;
            let mut stream = get_res.into_stream();
            let mut upload = latest_store.put_multipart(&dest_path).await?;

            let mut buffer = Vec::new();
            const MIN_PART_SIZE: usize = 5 * 1024 * 1024;

            while let Some(chunk) = stream.next().await {
                let chunk = chunk?;
                buffer.extend_from_slice(&chunk);
                if buffer.len() >= MIN_PART_SIZE {
                    upload.put_part(std::mem::take(&mut buffer).into()).await?;
                }
            }
            if !buffer.is_empty() {
                upload.put_part(buffer.into()).await?;
            }
            upload.complete().await?;

            println!("Uploaded {}.parquet", table);
        } else {
            println!("No latest file found for {}", table);
        }
    }
    Ok(())
}

use crate::google;
use crate::speech::range::Range;
use tracing::error;
use tracing::info;

pub async fn wait_for_gcs_ready(key: &str) -> anyhow::Result<()> {
  let mut retries = 10;
  let mut wait_time = 1;
  while retries > 0 {
    match google::storage::is_uploaded(key).await {
      Ok(true) => {
        return Ok(());
      }
      Ok(false) => {
        info!("GCS URI not ready yet ({key}). Retrying in {wait_time} seconds...");
        tokio::time::sleep(std::time::Duration::from_secs(wait_time)).await;
        retries -= 1;
        wait_time *= 2; // Exponential backoff
      }
      Err(err) => {
        error!("Error checking GCS URI readiness: {:#?}", err);
        return Err(anyhow::anyhow!(
          "Error checking GCS URI readiness: {:?}",
          err
        ));
      }
    }
  }

  return Err(anyhow::anyhow!(
    "GCS URI not ready after multiple retries: {}",
    key
  ));
}

pub async fn transcribe(key: &str, language: &str) -> anyhow::Result<Range> {
  let results = google::speech::transcribe(key, language).await?;
  let ranges: Vec<Range> = results.into_iter().map(Into::into).collect();
  return Ok(Range::merge(ranges));
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::google::storage::{is_uploaded, upload};
  use crate::tests::utils::download_and_cache_s3_asset;
  use anyhow::Result;
  use tokio::fs::File;
  use tokio::io::AsyncReadExt;

  #[tokio::test]
  async fn test_wait_for_gcs_ready() -> Result<()> {
    dotenv::dotenv().ok();

    let asset_path = download_and_cache_s3_asset("sepedi.wav").await?;
    let mut file = File::open(&asset_path).await?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).await?;

    let key_prefix = "test/test-wait-for-gcs-ready-";
    let key = format!("{}{}.wav", key_prefix, uuid::Uuid::new_v4());
    let mime_type = "audio/wav";

    upload(&key, bytes, mime_type).await?;

    // Should be uploaded now, but wait_for_gcs_ready should still succeed
    wait_for_gcs_ready(&key).await?;

    // Double check is_uploaded returns true
    assert!(is_uploaded(&key).await?);

    Ok(())
  }
}

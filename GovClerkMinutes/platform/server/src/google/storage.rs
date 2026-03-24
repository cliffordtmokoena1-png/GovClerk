use crate::google::{auth::get_token, consts::BUCKET_NAME};
use anyhow::{anyhow, Context};
use reqwest::{header, Client, StatusCode};

pub async fn upload(key: &str, bytes: Vec<u8>, mime_type: &str) -> anyhow::Result<String> {
  let token = get_token().await.context("fetching access token")?;

  let client = Client::new();

  let start_url = format!(
    "https://storage.googleapis.com/upload/storage/v1/b/{BUCKET_NAME}/o?uploadType=resumable&name={key}",
  );

  let start_resp = client
    .post(&start_url)
    .header(
      header::AUTHORIZATION,
      format!("Bearer {}", token.access_token),
    )
    .header("X-Upload-Content-Type", mime_type)
    .header("X-Upload-Content-Length", bytes.len())
    .header(header::CONTENT_LENGTH, 0)
    .header(header::CONTENT_TYPE, mime_type)
    .send()
    .await
    .context("starting resumable session")?;

  if !start_resp.status().is_success() {
    return Err(anyhow!(
      "GCS resumable session failed: {} - {}",
      start_resp.status(),
      start_resp.text().await.unwrap_or_default()
    ));
  }

  let session_url = start_resp
    .headers()
    .get(header::LOCATION)
    .ok_or_else(|| anyhow!("Missing Location header from GCS"))?
    .to_str()
    .context("Location header not valid UTF-8")?
    .to_owned();

  let put_resp = client
    .put(session_url)
    .header(
      header::AUTHORIZATION,
      format!("Bearer {}", token.access_token),
    )
    .header(header::CONTENT_TYPE, mime_type)
    .header(
      "Content-Range",
      format!("bytes 0-{}/{}", bytes.len() - 1, bytes.len()),
    )
    .body(bytes)
    .send()
    .await
    .context("uploading file bytes")?;

  if !put_resp.status().is_success() {
    return Err(anyhow!(
      "GCS upload failed: {} - {}",
      put_resp.status(),
      put_resp.text().await.unwrap_or_default()
    ));
  }

  Ok(format!("gs://{}/{}", BUCKET_NAME, key))
}

pub async fn is_uploaded(raw_key: &str) -> anyhow::Result<bool> {
  let token = get_token().await.context("fetching access token")?;

  let key = raw_key.replace("/", "%2F");

  let client = Client::new();
  let resp = client
    .get(format!(
      "https://storage.googleapis.com/storage/v1/b/{BUCKET_NAME}/o/{key}"
    ))
    .header(
      header::AUTHORIZATION,
      format!("Bearer {}", token.access_token),
    )
    // Limit payload; we only need to know if it exists.
    .query(&[("fields", "bucket,name,size,updated,generation")])
    .send()
    .await
    .context("checking GCS object metadata")?;

  match resp.status() {
    StatusCode::OK => Ok(true),
    StatusCode::NOT_FOUND => Ok(false),
    status => {
      let body = resp.text().await.unwrap_or_default();
      Err(anyhow!("GCS objects.get failed: {status} - {body}"))
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::tests::utils::download_and_cache_s3_asset;
  use anyhow::Result;
  use tokio::fs::File;
  use tokio::io::AsyncReadExt;

  #[tokio::test]
  async fn test_upload_to_gcs() -> Result<()> {
    dotenv::dotenv().unwrap();

    let asset_path = download_and_cache_s3_asset("sepedi.wav").await?;
    let mut file = File::open(&asset_path).await?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).await?;

    let key_prefix = "test/test-upload-";

    let key = format!("{}{}.wav", key_prefix, uuid::Uuid::new_v4());
    let mime_type = "audio/wav";

    let gcs_uri = upload(&key, bytes, mime_type).await?;
    assert!(
      gcs_uri.starts_with(&format!("gs://{}/{}", super::BUCKET_NAME, key_prefix)),
      "Unexpected GCS URI: {}",
      gcs_uri
    );
    println!("Uploaded to: {}", gcs_uri);

    // Test is_uploaded for the same key
    let uploaded = is_uploaded(&key).await?;
    assert!(
      uploaded,
      "is_uploaded should return true for uploaded object"
    );

    Ok(())
  }

  #[tokio::test]
  async fn test_is_uploaded_specific_key() -> anyhow::Result<()> {
    dotenv::dotenv().ok(); // load creds from .env if needed

    let key = "test_uploads%2Fupload_38463";

    let uploaded = super::is_uploaded(key).await?;
    assert!(
      uploaded,
      "Expected {} to be uploaded, but is_uploaded returned false",
      key
    );

    println!("✅ {} is uploaded", key);
    Ok(())
  }
}

use anyhow::Result;
use aws_sdk_s3::config::Credentials;
use std::path::PathBuf;
use tokio::{fs, fs::File};

pub async fn download_and_cache_s3_asset(asset_name: &str) -> Result<PathBuf> {
  let cache_dir = ".cached_test_assets";
  fs::create_dir_all(cache_dir).await?;

  let asset_path = format!("{}/{}", cache_dir, asset_name);

  if fs::metadata(&asset_path).await.is_ok() {
    println!("Found asset: {}", &asset_path);
    return Ok(asset_path.into());
  }

  dotenv::dotenv().ok();

  let credentials = Credentials::new(
    std::env::var("AWS_ACCESS_KEY_ID").expect("AWS_ACCESS_KEY_ID not found in env"),
    std::env::var("AWS_SECRET_ACCESS_KEY").expect("AWS_SECRET_ACCESS_KEY not found in env"),
    None,
    None,
    "myprovider",
  );

  let config = aws_config::from_env()
    .credentials_provider(credentials)
    .region("us-east-1")
    .load()
    .await;

  let s3_client = aws_sdk_s3::Client::new(&config);

  let response = s3_client
    .get_object()
    .bucket("govclerk-bucket")
    .key(asset_name)
    .send()
    .await?;

  let mut file = File::create(&asset_path).await?;
  let mut body = response.body.into_async_read();
  tokio::io::copy(&mut body, &mut file).await?;

  println!("Downloaded and cached file: {}", asset_path);

  Ok(asset_path.into())
}

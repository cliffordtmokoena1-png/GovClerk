use crate::s3::get_object;
use crate::upload_key::get_upload_key;
use crate::SharedRequestState;
use std::io::Cursor;
use std::sync::Arc;
use zip::read::ZipArchive;

pub enum ImageUpload {
  Image(Vec<u8>),
  Zip(Vec<Vec<u8>>),
}

fn is_zip(bytes: &[u8]) -> bool {
  bytes.len() >= 4 && &bytes[0..4] == b"PK\x03\x04"
}

pub async fn get_image_upload(
  state: Arc<SharedRequestState>,
  transcript_id: u64,
  region: &str,
  test_mode: bool,
) -> anyhow::Result<ImageUpload> {
  let object = get_object(
    state.clone(),
    region.to_string(),
    get_upload_key(transcript_id, test_mode),
  )
  .await?;

  let bytes = object.body.collect().await?.into_bytes().to_vec();

  if is_zip(&bytes) {
    let mut archive = ZipArchive::new(Cursor::new(&bytes))?;
    let mut files = Vec::new();
    for i in 0..archive.len() {
      let mut file = archive.by_index(i)?;
      let mut buf = Vec::new();
      std::io::copy(&mut file, &mut buf)?;
      files.push(buf);
    }
    return Ok(ImageUpload::Zip(files));
  }

  Ok(ImageUpload::Image(bytes))
}

fn make_data_url(bytes: &[u8], mime_type: &str) -> String {
  let base64_str = base64::encode(bytes);
  format!("data:{};base64,{}", mime_type, base64_str)
}

fn make_data_url_checked(bytes: &[u8]) -> anyhow::Result<String> {
  let mime_type = infer::get(bytes)
    .map(|t| t.mime_type())
    .ok_or_else(|| anyhow::anyhow!("Could not determine mime type"))?;
  if !mime_type.starts_with("image/") {
    anyhow::bail!("Not an image type: {}", mime_type);
  }
  Ok(make_data_url(bytes, mime_type))
}

pub async fn get_image_upload_as_data_urls(
  state: Arc<SharedRequestState>,
  transcript_id: u64,
  region: &str,
  test_mode: bool,
) -> anyhow::Result<Vec<String>> {
  let upload = get_image_upload(state, transcript_id, region, test_mode).await?;

  match upload {
    ImageUpload::Image(bytes) => vec![make_data_url_checked(&bytes)].into_iter().collect(),
    ImageUpload::Zip(files) => files
      .into_iter()
      .map(|file| make_data_url_checked(&file))
      .collect(),
  }
}

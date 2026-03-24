use crate::SharedRequestState;
use aws_sdk_s3::operation::get_object::GetObjectOutput;
use std::sync::Arc;

pub fn get_bucket_name(region: String) -> String {
  if region == "eu-central-1" {
    return "GovClerkMinutesfrankfurt".to_string();
  } else {
    return "govclerk-audio-uploads".to_string();
  }
}

pub async fn get_object(
  state: Arc<SharedRequestState>,
  region: String,
  key: String,
) -> anyhow::Result<GetObjectOutput> {
  tracing::warn!("Getting object: region {}", region);
  if region == "eu-central-1" {
    return state
      .s3_client_frankfurt
      .get_object()
      .bucket(get_bucket_name(region))
      .key(&key)
      .send()
      .await
      .map_err(|e| anyhow::anyhow!("Error getting frankfurt object: {:?}", e));
  } else {
    return state
      .s3_client
      .get_object()
      .bucket(get_bucket_name(region))
      .key(&key)
      .send()
      .await
      .map_err(|e| anyhow::anyhow!("Error getting object: {:?}", e));
  }
}

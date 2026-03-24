use crate::google::{
  consts::{BUCKET_NAME, PROJECT_ID},
  model::best_model_for,
};
use anyhow::{anyhow, Context, Result};
use reqwest::{header, Client};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, time::Duration};
use tokio::time::sleep;
use tracing::info;

#[allow(dead_code)]
#[derive(Debug, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
enum ProcessingStrategy {
  ProcessingStrategyUnspecified,
  DynamicBatching,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecognitionOutputConfig {
  inline_response_config: EmptyObj,
}

#[derive(Debug, Serialize)]
struct BatchRecognizeFileMetadata<'a> {
  uri: &'a str,
}

#[derive(Debug, Serialize)]
struct EmptyObj {}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecognitionFeatures {
  enable_word_time_offsets: bool,
  profanity_filter: bool,
  enable_word_confidence: bool,
  enable_automatic_punctuation: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BatchRecognitionConfig<'a> {
  model: &'a str,
  language_codes: [&'a str; 1],
  features: RecognitionFeatures,
  auto_decoding_config: EmptyObj,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct BatchRecognizeRequestBody<'a> {
  config: BatchRecognitionConfig<'a>,
  files: [BatchRecognizeFileMetadata<'a>; 1],
  recognition_output_config: RecognitionOutputConfig,
  processing_strategy: ProcessingStrategy,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WordInfo {
  pub start_offset: Option<String>,
  pub end_offset: Option<String>,
  pub word: String,
  #[allow(dead_code)]
  pub confidence: Option<f32>,
  #[allow(dead_code)]
  pub speaker_tag: Option<i32>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeechRecognitionAlternative {
  pub transcript: String,
  #[allow(dead_code)]
  pub confidence: Option<f32>,
  pub words: Option<Vec<WordInfo>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpeechRecognitionResult {
  #[serde(default)]
  pub alternatives: Vec<SpeechRecognitionAlternative>,
  #[allow(dead_code)]
  pub channel_tag: Option<i32>,
  #[allow(dead_code)]
  pub result_end_offset: Option<String>,
  pub language_code: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecognitionResponseMetadata {
  #[allow(dead_code)]
  pub total_billed_duration: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchRecognizeResults {
  pub results: Vec<SpeechRecognitionResult>,
  #[allow(dead_code)]
  pub metadata: Option<RecognitionResponseMetadata>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InlineResult {
  pub transcript: BatchRecognizeResults,
  #[allow(dead_code)]
  pub vtt_captions: Option<String>,
  #[allow(dead_code)]
  pub srt_captions: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CloudStorageResult {
  #[allow(dead_code)]
  pub uri: String,
  #[allow(dead_code)]
  pub vtt_format_uri: Option<String>,
  #[allow(dead_code)]
  pub srt_format_uri: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(untagged, rename_all = "camelCase")]
pub enum ResultVariant {
  CloudStorageResult {
    #[serde(rename = "cloudStorageResult")]
    cloud_storage_result: CloudStorageResult,
  },
  InlineResult {
    #[serde(rename = "inlineResult")]
    inline_result: InlineResult,
  },
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchRecognizeFileResult {
  pub error: Option<Status>,
  #[allow(dead_code)]
  pub metadata: Option<RecognitionResponseMetadata>,
  #[serde(flatten)]
  pub result: Option<ResultVariant>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchRecognizeResponse {
  pub results: HashMap<String, BatchRecognizeFileResult>,
  #[allow(dead_code)]
  pub total_billed_duration: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct Status {
  #[allow(dead_code)]
  pub code: i32,
  pub message: String,
  #[allow(dead_code)]
  #[serde(default)]
  pub details: Vec<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct Operation {
  pub name: String,
  #[allow(dead_code)]
  pub metadata: Option<serde_json::Value>,
  #[serde(default)]
  pub done: bool,
  #[serde(default)]
  pub error: Option<Status>,
  #[serde(default)]
  pub response: Option<BatchRecognizeResponse>,
}

/// Sends the batchRecognize request and returns the poll URL.
async fn request_batch_recognize(
  client: &Client,
  token: &str,
  gcs_uri: &str,
  language: &str,
) -> anyhow::Result<String> {
  let (location, model) = best_model_for(language)?;
  info!("Using model {model} at location {location}");

  let mut api_domain = "speech.googleapis.com".to_string();
  if location != "global" {
    api_domain = format!("{}-{}", location, api_domain);
  }

  let body = BatchRecognizeRequestBody {
    config: BatchRecognitionConfig {
      model,
      language_codes: [language],
      features: RecognitionFeatures {
        enable_word_time_offsets: true,
        profanity_filter: false,
        enable_word_confidence: false,
        enable_automatic_punctuation: false,
      },
      auto_decoding_config: EmptyObj {},
    },
    files: [BatchRecognizeFileMetadata { uri: gcs_uri }],
    recognition_output_config: RecognitionOutputConfig {
      inline_response_config: EmptyObj {},
    },
    processing_strategy: ProcessingStrategy::ProcessingStrategyUnspecified,
  };

  let res = client
    .post(format!(
      "https://{api_domain}/v2/projects/{PROJECT_ID}/locations/{location}/recognizers/_:batchRecognize"
    ))
    .header(
      header::AUTHORIZATION,
      format!("Bearer {}", token),
    )
    .json(&body)
    .send()
    .await?;

  if !res.status().is_success() {
    return Err(anyhow!(
      "Speech API request failed: {} - {}",
      res.status(),
      res.text().await.unwrap_or_default()
    ));
  }

  let op: Operation = res.json().await.context("starting batchRecognize")?;
  let poll_url = format!(
    "https://{api_domain}/v2/{name}",
    name = op
      .name
      .strip_prefix(&format!("projects/{PROJECT_ID}/locations/{location}/"))
      .unwrap_or(&op.name)
  );

  Ok(poll_url)
}

/// Polls the batchRecognize operation once and returns the result if done, or None if not done.
async fn poll_batch_recognize_result(
  client: &Client,
  token: &str,
  poll_url: &str,
) -> anyhow::Result<Option<Vec<SpeechRecognitionResult>>> {
  let res = client
    .get(poll_url)
    .header(header::AUTHORIZATION, format!("Bearer {}", token))
    .send()
    .await?;

  if !res.status().is_success() {
    return Err(anyhow!(
      "Speech API operation failed: {} - {}",
      res.status(),
      res.text().await.unwrap_or_default()
    ));
  }

  let op: Operation = res.json().await?;
  if !op.done {
    return Ok(None);
  }

  if op.error.is_some() {
    return Err(anyhow!(
      "Speech API operation error: {}",
      op.error.as_ref().unwrap().message
    ));
  }

  let response = op
    .response
    .ok_or_else(|| anyhow::anyhow!("No result in done operation"))?;

  if let Some(file_result) = response.results.into_values().next() {
    if let Some(error) = file_result.error {
      return Err(anyhow!("Speech API file error: {}", error.message));
    }

    if let Some(inline_result) = file_result.result {
      match inline_result {
        ResultVariant::InlineResult { inline_result } => {
          return Ok(Some(inline_result.transcript.results));
        }
        ResultVariant::CloudStorageResult {
          cloud_storage_result,
        } => {
          return Err(anyhow!(
            "Cloud storage result not supported yet: {:?}",
            cloud_storage_result
          ));
        }
      }
    }
  }

  return Err(anyhow!("No file result found in response"));
}

/// Transcribes a single audio file in GCS and returns the recognition results.
///
/// `gcs_uri`   – e.g. "uploads/file.wav"
/// `language`  – "nso-ZA", "st-ZA", "xh-ZA", "zu-ZA", "af-ZA"
pub async fn transcribe(key: &str, language: &str) -> Result<Vec<SpeechRecognitionResult>> {
  let token = crate::google::auth::get_token()
    .await
    .context("fetching access token")?;

  let uri = format!("gs://{BUCKET_NAME}/{key}");

  let client = Client::new();

  let poll_url = request_batch_recognize(&client, &token.access_token, &uri, language).await?;

  loop {
    match poll_batch_recognize_result(&client, &token.access_token, &poll_url).await? {
      Some(results) => {
        return Ok(
          results
            .into_iter()
            .filter(|r| !r.alternatives.is_empty())
            .collect(),
        )
      }
      None => sleep(Duration::from_secs(15)).await,
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use anyhow::Result;

  #[tokio::test]
  async fn test_transcribe_gcs_uri() -> Result<()> {
    dotenv::dotenv().unwrap();

    // This audio is Northern Sotho
    let key = "test/test-upload-138c2e8a-4738-473b-ada5-ad03c63b3460.wav";
    let language = "nso-ZA";

    let words = transcribe(key, language).await?;
    assert!(!words.is_empty(), "Transcript should not be empty");
    println!("Words: {:?}", words);

    Ok(())
  }

  #[tokio::test]
  async fn test_transcribe_gcs_uri_tswana() -> Result<()> {
    dotenv::dotenv().unwrap();

    // This audio is Tswana
    // let key = "test/tswana_english_mixed.webm";
    let key = "test/tswana_clip.wav";
    let language = "tn-Latn-ZA";

    let words = transcribe(key, language).await?;
    assert!(!words.is_empty(), "Transcript should not be empty");
    println!("Words: {:?}", words);

    Ok(())
  }
}

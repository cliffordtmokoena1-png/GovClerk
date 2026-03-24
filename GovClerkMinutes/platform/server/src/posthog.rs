use http::{header::CONTENT_TYPE, HeaderMap, HeaderValue};
use reqwest::Client;
use serde_json::{json, Value};
use std::env;
use tracing::{error, info};

pub const ANONYMOUS_POSTHOG_PANIC_ID: &str = "anonymous_posthog_panic_userid";

#[derive(Clone)]
pub enum PostHogEventType {
  FileUploaded,
  FileSegmented,
  FileTranscribed,
  TranscribePaused,
  TranscribeFinished,
  TranscribeFailed,
  CreateMinutesStarted,
  CreateMinutesFinished,
  CreateMinutesErrored,
  TombstoneFound,
  AutoMinutesCreated,
  ScribeJobStarted,
}

impl PostHogEventType {
  pub fn as_str(&self) -> &'static str {
    match self {
      PostHogEventType::FileUploaded => "file_uploaded",
      PostHogEventType::FileSegmented => "file_segmented",
      PostHogEventType::FileTranscribed => "file_transcribed",
      PostHogEventType::TranscribePaused => "transcribe_paused",
      PostHogEventType::TranscribeFinished => "transcribe_finished",
      PostHogEventType::TranscribeFailed => "transcribe_failed",
      PostHogEventType::CreateMinutesStarted => "create_minutes_started",
      PostHogEventType::CreateMinutesFinished => "create_minutes_finished",
      PostHogEventType::CreateMinutesErrored => "create_minutes_errored",
      PostHogEventType::TombstoneFound => "tombstone_found",
      PostHogEventType::AutoMinutesCreated => "auto_minutes_created",
      PostHogEventType::ScribeJobStarted => "scribe_job_started",
    }
  }

  pub fn capture(self, distinct_id: String, mut properties: Value) {
    info!("Capturing PostHog event: {}", self.as_str());

    tokio::spawn(async move {
      let client = reqwest::Client::new();

      let api_key =
        env::var("NEXT_PUBLIC_POSTHOG_KEY").expect("NEXT_PUBLIC_POSTHOG_KEY not found in .env");
      let host =
        env::var("NEXT_PUBLIC_POSTHOG_HOST").expect("NEXT_PUBLIC_POSTHOG_HOST not found in .env");

      let mut headers = HeaderMap::new();
      headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

      let transcript_id = properties["transcript_id"].as_u64();

      let mut batch = Vec::new();

      if let Some(tid) = transcript_id {
        batch.push(json!({
          "event": "$groupidentify",
          "distinct_id": "group:transcript",
          "properties": {
            "$group_type": "transcript",
            "$group_key": tid
          },
        }));

        properties["$groups"] = json!({ "transcript": tid });
      }

      batch.push(json!({
        "event": self.as_str(),
        "distinct_id": distinct_id,
        "properties": properties,
        "timestamp": chrono::Utc::now().to_rfc3339(),
      }));

      match client
        .post(format!("{}/batch/", host))
        .headers(headers)
        .body(
          json!(
            {
              "api_key": api_key,
              "batch": batch,
            }
          )
          .to_string(),
        )
        .send()
        .await
      {
        Err(e) => {
          error!("Failed to send PostHog event: {}", e);
        }
        Ok(response) => {
          info!("PostHog response: {:?}", response);
        }
      };
    });
  }
}

#[allow(dead_code)]
pub async fn check_feature_flag(user_id: &str, feature_flag: &str) -> anyhow::Result<bool> {
  let posthog_api_key = env::var("POSTHOG_API_KEY").expect("POSTHOG_API_KEY not found in .env");
  let posthog_url = "https://us.i.posthog.com/decide?v=3";

  let client = Client::new();
  let response = client
    .post(posthog_url)
    .header("Content-Type", "application/json")
    .json(&json!({
        "api_key": posthog_api_key,
        "distinct_id": user_id,
    }))
    .send()
    .await
    .map_err(|e| {
      info!("Failed to parse PostHog response (after sending): {}", e);
      anyhow::anyhow!("Failed to parse PostHog response: {}", e)
    })?
    .json::<serde_json::Value>()
    .await
    .map_err(|e| {
      info!("Failed to parse PostHog response (end of await): {}", e);
      anyhow::anyhow!("Failed to parse PostHog response: {}", e)
    })?;

  info!("PostHog decide response: {:?}", response);

  info!("Posthog check_feature_flag response: {:?}", response);

  let is_flag_enabled = response["featureFlags"]
    .get(feature_flag)
    .and_then(|flag| flag.as_bool())
    .ok_or(anyhow::anyhow!("Feature flag not found"))?;

  if let Some(errors_while_computing_flags) = response.get("errorsWhileComputingFlags") {
    if errors_while_computing_flags.as_bool() == Some(true) {
      error!("PostHog reported errors while computing flags");
    }
  }

  let user_id_clone = user_id.to_string();
  let feature_flag_clone = feature_flag.to_string();
  tokio::spawn(async move {
    let _ = client
      .post("https://us.i.posthog.com/capture/")
      .header("Content-Type", "application/json")
      .json(&json!({
          "api_key": posthog_api_key,
          "distinct_id": user_id_clone,
          "event": "$feature_flag_called",
          "properties": {
            "$feature_flag": feature_flag_clone,
            "$feature_flag_response": is_flag_enabled,
          }
      }))
      .send()
      .await;
  });

  Ok(is_flag_enabled)
}

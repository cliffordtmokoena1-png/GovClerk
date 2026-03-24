use http::{header::CONTENT_TYPE, HeaderMap, HeaderValue};
use serde_json::{json, Value};
use std::env;
use tracing::{error, info};

#[derive(Clone)]
pub enum PostHogEventType {
  FileUploaded,
  FileDiarized,
  FileSegmented,
  FileTranscribed,
  TranscribePaused,
  TranscribeFinished,
  TranscribeFailed,
  CreateMinutesStarted,
  CreateMinutesFinished,
  CreateMinutesErrored,
  DiarizationGpuReleased,
  EmailLeadAdded,
  EmailLeadAddFailed,
}

impl PostHogEventType {
  pub fn as_str(&self) -> &'static str {
    match self {
      PostHogEventType::FileUploaded => "file_uploaded",
      PostHogEventType::FileDiarized => "file_diarized",
      PostHogEventType::FileSegmented => "file_segmented",
      PostHogEventType::FileTranscribed => "file_transcribed",
      PostHogEventType::TranscribePaused => "transcribe_paused",
      PostHogEventType::TranscribeFinished => "transcribe_finished",
      PostHogEventType::TranscribeFailed => "transcribe_failed",
      PostHogEventType::CreateMinutesStarted => "create_minutes_started",
      PostHogEventType::CreateMinutesFinished => "create_minutes_finished",
      PostHogEventType::CreateMinutesErrored => "create_minutes_errored",
      PostHogEventType::DiarizationGpuReleased => "diarization_gpu_released",
      PostHogEventType::EmailLeadAdded => "email_lead_added",
      PostHogEventType::EmailLeadAddFailed => "email_lead_add_failed",
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

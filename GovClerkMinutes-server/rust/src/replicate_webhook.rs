use anyhow::anyhow;
use aws_sdk_s3::presigning::PresigningConfig;
use axum::{
  extract::{Json, State},
  response::IntoResponse,
};
use http::StatusCode;
use mysql_async::{
  params,
  prelude::{Query, WithParams},
};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use std::{env, process::Output, time::Duration};
use tempfile::NamedTempFile;
use tokio::fs::File;
use tokio::io::AsyncWriteExt;
use tracing::{error, info, warn};

use crate::{
  error::LogError, get_current_balance::get_current_balance, posthog::PostHogEventType,
  task_tracker::TaskTracker, transcript::Transcript, SharedRequestState,
};

extern crate libc;

// TODO: authenticate this webhook

#[derive(Debug)]
pub enum WhisperRequestError {
  Retryable(usize),
  Fatal,
}

impl From<WhisperRequestError> for anyhow::Error {
  fn from(err: WhisperRequestError) -> Self {
    match err {
      WhisperRequestError::Retryable(remaining_requests) => {
        anyhow!(
          "Retryable error, remaining requests: {}",
          remaining_requests
        )
      }
      WhisperRequestError::Fatal => anyhow!("Fatal error"),
    }
  }
}

#[derive(Deserialize, Serialize)]
pub struct ReplicateWebhookResponse {}

pub async fn get_object(
  client: aws_sdk_s3::Client,
  bucket: &String,
  key: &String,
  output_path: std::path::PathBuf,
) -> Result<(), anyhow::Error> {
  let mut file = File::create(output_path).await?;

  let object = client.get_object().bucket(bucket).key(key).send().await?;

  let bytes = object.body.collect().await?;
  let file_content: Vec<u8> = bytes.to_vec();

  file.write_all(&file_content).await?;

  Ok(())
}

pub fn timestamp_to_seconds(timestamp: &str) -> Option<f32> {
  let parts: Vec<&str> = timestamp.split(':').collect();
  if parts.len() != 3 {
    return None;
  }

  let hours: f32 = parts[0].parse().ok()?;
  let minutes: f32 = parts[1].parse().ok()?;
  let seconds: f32 = parts[2].parse().ok()?;

  Some(hours * 3600.0 + minutes * 60.0 + seconds)
}

pub async fn transcribe_segments_fast(
  transcript_id: u64,
  s3_audio_key: String,
  state: Arc<SharedRequestState>,
  user_id: String,
  upload_kind: String,
) -> anyhow::Result<()> {
  let original_audio_path = NamedTempFile::new()?;
  if let Err(e) = get_object(
    state.s3_client.clone(),
    &"govclerk-audio-uploads".to_string(),
    &s3_audio_key,
    original_audio_path.path().to_owned(),
  )
  .await
  {
    error!("got error getting s3 audio: {}", e.to_string());
    return Err(e);
  }
  return transcribe_segments_fast_impl(
    transcript_id,
    original_audio_path
      .into_temp_path()
      .to_str()
      .ok_or_else(|| anyhow!("could not convert temp path to str"))?
      .to_string(),
    state,
    user_id,
    upload_kind,
  )
  .await;
}

pub async fn fail_job(
  transcript_id: u64,
  status: u64,
  state: Arc<SharedRequestState>,
  user_id: String,
) -> anyhow::Result<(), mysql_async::Error> {
  error!(
    "FAILING JOB IN REPLICATE WEBHOOK: {} {} {}",
    user_id, transcript_id, status
  );

  // TODO: log upload_kind
  PostHogEventType::TranscribeFailed.capture(
    user_id.clone(),
    json!({
      "transcript_id": transcript_id,
      "error_code": status,
    }),
  );

  let mut conn = state.db.get_conn().await?;
  return r"UPDATE transcripts SET transcribe_failed = :status WHERE id = :id"
    .with(params! {
      "id" => transcript_id,
      "status" => status,
    })
    .ignore(&mut conn)
    .await;
}

async fn update_segments_table(
  transcript_id: u64,
  text: String,
  i: usize,
  state: Arc<SharedRequestState>,
  source: String,
) -> anyhow::Result<()> {
  let mut conn = state.db.get_conn().await?;

  return r"UPDATE gc_segments SET transcript = :transcript, source = :source WHERE transcript_id = :transcript_id AND segment_index = :segment_index;"
          .with(params! {
              "transcript" => text,
              "transcript_id" => transcript_id,
              "segment_index" => i,
              "source" => source,
          })
          .ignore(&mut conn)
          .await.map_err(|e| anyhow!("failed to update gc_segments {}", e));
}

async fn handle_transcription_request(
  transcript_id: u64,
  slice_audio: String,
  i: usize,
  state: Arc<SharedRequestState>,
  http_client: Arc<Client>,
) -> anyhow::Result<usize, WhisperRequestError> {
  let (remaining, maybe_text) = send_openai_whisper_request(slice_audio, http_client).await?;

  if let Some(text) = maybe_text {
    update_segments_table(transcript_id, text, i, state, "openai".to_string())
      .await
      .map_err(|e| {
        error!("failed to update segments table: {}", e);
        return WhisperRequestError::Retryable(1);
      })?;
  } else {
    return Err(WhisperRequestError::Retryable(1));
  }

  Ok(remaining)
}

pub async fn send_openai_whisper_request(
  slice_audio: String,
  http_client: Arc<Client>,
) -> Result<(usize, Option<String>), WhisperRequestError> {
  let request_timeout = Duration::from_secs(300);
  let openai_api_key = env::var("OPENAI_KEY").expect("OPENAI_KEY must be set");

  info!("sending openai whisper request for {}", slice_audio);

  let form = reqwest::multipart::Form::new()
    .text("model", "whisper-1")
    .text("language", "en")
    .part(
      "file",
      reqwest::multipart::Part::bytes(tokio::fs::read(slice_audio.clone()).await.map_err(
        |openai_err| {
          error!("failed to read slice audio: {:?}", openai_err);
          return WhisperRequestError::Fatal;
        },
      )?)
      .mime_str("video/webm")
      .map_err(|openai_err| {
        error!("failed to set mime type: {:?}", openai_err);
        return WhisperRequestError::Fatal;
      })?
      .file_name(slice_audio.clone()),
    );

  let response = match http_client
    .post("https://api.openai.com/v1/audio/transcriptions")
    .header("Authorization", format!("Bearer {}", openai_api_key))
    .multipart(form)
    .timeout(request_timeout)
    .send()
    .await
  {
    Ok(r) => r,
    Err(e) => {
      error!("failed to send openai whisper request: {:?}", e);
      return Err(WhisperRequestError::Retryable(0));
    }
  };

  if response.status().is_success() {
    let remaining_str = response
      .headers()
      .get("x-ratelimit-remaining-requests")
      .expect("couldn't find header value f")
      .to_str()
      .expect("couldn't make header a str");
    let remaining = usize::from_str_radix(remaining_str, 10).expect("couldn't make header an int");

    let response_data: serde_json::Value = response.json().await.map_err(|response_err| {
      error!("failed to parse response json: {:?}", response_err);
      return WhisperRequestError::Fatal;
    })?;

    let text = match response_data["text"].as_str() {
      Some(t) => Some(t.to_string()),
      None => None,
    };

    Ok((remaining, text))
  } else {
    warn!(
      "OpenAI whisper request failed with status {} and body {:?}",
      response.status(),
      response.text().await
    );
    Err(WhisperRequestError::Retryable(0))
  }
}

#[allow(unused)]
async fn send_replicate_whisper_request(
  transcript_id: u64,
  prompt: Option<String>,
  slice_audio_key: String,
  i: usize,
  state: Arc<SharedRequestState>,
  user_id: String,
) -> anyhow::Result<()> {
  let http_client = Client::new();

  let replicate_token =
    env::var("REPLICATE_API_TOKEN").expect("REPLICATE_API_TOKEN not found in env");

  let presigned_request = match state
    .s3_client
    .get_object()
    .bucket("govclerk-audio-uploads")
    .key(slice_audio_key)
    .presigned(PresigningConfig::expires_in(Duration::from_secs(1200))?)
    .await
  {
    Ok(p) => p,
    Err(e) => {
      fail_job(transcript_id, 9, state, user_id).await?;
      panic!("failed to generate presigned s3 link: {:?}", e);
    }
  };

  let replicate_response = match http_client.post("https://api.replicate.com/v1/predictions")
              .header("Authorization", format!("Token {}", replicate_token))
              .json(&json!({
                  "version": "91ee9c0c3df30478510ff8c8a3a545add1ad0259ad3a9f78fba57fbc05ee64f7",
                  "input": json!({
                      "audio": presigned_request.uri().to_string(),
                      "initial_prompt": prompt.clone().unwrap_or("".to_string()),
                  }),
                  "webhook": format!("https://GovClerkMinutes.com/api/whisper-webhook?transcriptId={}&segmentId={}&retries=1", transcript_id, i),
                  "webhook_events_filter": ["completed"],
              }))
              .send()
              .await {
                Ok(r) => r,
                Err(e) => {
                  fail_job(transcript_id, 10, state, user_id).await?;
                  panic!("failed to send replicate whisper api call: {:?}", e);
                }
              };

  if !replicate_response.status().is_success() {
    let replicate_error = match replicate_response.json::<serde_json::Value>().await {
      Ok(r) => r,
      Err(e) => {
        fail_job(transcript_id, 11, state, user_id).await?;
        panic!("failed to parse replicate error: {:?}", e);
      }
    };
    error!("Replicate error: {}", replicate_error);
    fail_job(transcript_id, 12, state, user_id).await?;
    panic!("failed to call replicate whisper");
  }

  return Ok(());
}

/// Wrapped by transcribe_segments_fast which does S3 and DB operations
pub async fn transcribe_segments_fast_impl(
  transcript_id: u64,
  original_audio_path: String,
  state: Arc<SharedRequestState>,
  user_id: String,
  upload_kind: String,
) -> anyhow::Result<()> {
  let mut conn = state.db.get_conn().await?;
  let transcript = Transcript::from_db(&mut conn, transcript_id, &user_id).await?;

  let len = transcript.segments.len();

  let temp_dir = tempfile::tempdir()?;

  let ffmpeg_semaphore = state.ffmpeg_semaphore.clone();

  let http_client = Arc::new(Client::new());
  let whisper_semaphore = state.whisper_semaphore.clone();

  let mut tasks = vec![];

  for (i, segment) in transcript.segments.iter().enumerate() {
    let start = timestamp_to_seconds(&segment.start)
      .ok_or_else(|| anyhow!("could not convert start time to seconds"))?;
    let end = timestamp_to_seconds(&segment.stop)
      .ok_or_else(|| anyhow!("could not convert stop time to seconds"))?;
    let output_path = temp_dir.path().join(format!("slice{}.webm", i + 1));
    let original_audio_path = original_audio_path.clone();
    let sem_clone = ffmpeg_semaphore.clone();

    let state_clone = state.clone();
    let http_client_clone = http_client.clone();
    let whisper_semaphore_clone = whisper_semaphore.clone();
    let user_id_clone = user_id.clone();

    let task = tokio::spawn(async move {
      let _permit = match sem_clone.acquire().await {
        Ok(p) => p,
        Err(e) => {
          error!("Failed to acquire semaphore: {}", e);
          return;
        }
      };

      info!("starting ffmpeg command {}", i);

      let mut ffmpeg_command = tokio::process::Command::new("ffmpeg");
      ffmpeg_command
        .arg("-y")
        .arg("-i")
        .arg(&original_audio_path)
        .arg("-ss")
        .arg(start.to_string())
        .arg("-to")
        .arg(end.to_string())
        .arg("-vn")
        .arg("-c:a")
        .arg("libvorbis")
        .arg("-q:a")
        .arg("4")
        .arg(output_path.clone());

      let Output {
        status,
        stdout,
        stderr,
      } = match ffmpeg_command.output().await {
        Ok(r) => r,
        Err(e) => {
          error!("failed to start ffmpeg command: {}", e);
          return;
        }
      };

      if !status.success() {
        error!("ffmpeg command failed with status {}", status);
        error!("ffmpeg stdout: {}", String::from_utf8_lossy(&stdout));
        error!("ffmpeg sterr: {}", String::from_utf8_lossy(&stderr));
      }

      info!("handling segment: {:?}/{:?}", i + 1, len);

      let mut tries = 3;
      while tries > 0 {
        let _permit = match whisper_semaphore_clone.acquire().await {
          Ok(p) => p,
          Err(e) => {
            error!("Failed to acquire whisper semaphore: {}", e);
            return;
          }
        };

        // Ratelimiter loop.
        loop {
          if let Err(sleep) = state_clone.clone().rate_limiter2.try_wait() {
            match (
              cfg!(target_os = "macos"),
              state_clone.python_process.try_lock(),
            ) {
              (false, Ok(mut guard)) => {
                // Locked now
                warn!("waiting for answer about to transcribe");
                let path_to_transcribe = match output_path.clone().to_str() {
                  Some(p) => p.to_string(),
                  None => {
                    error!("failed to convert path to str in ratelimiter loop");
                    return;
                  }
                };
                match guard.transcribe(path_to_transcribe).await {
                  Err(e) => {
                    warn!("got error from python: {}", e);
                    // If we got an error we need to retry, so continue.
                    continue;
                  }
                  Ok(text) => {
                    warn!("got back from python: {}", text);
                    match update_segments_table(
                      transcript_id,
                      text,
                      i,
                      state_clone.clone(),
                      "local".to_string(),
                    )
                    .await
                    {
                      Ok(_) => {
                        return;
                      }
                      Err(e) => {
                        error!("failed to update segments table: {}", e);
                        // Retry by continuing
                        continue;
                      }
                    }
                  }
                };
              }
              _ => {
                warn!("for {} sleeping for {:?}", i, sleep);
                tokio::time::sleep(sleep).await;
                continue;
              }
            };
          } else {
            break;
          }
        }

        let remaining = match handle_transcription_request(
          transcript_id,
          output_path.clone().to_str().unwrap().to_string(),
          i,
          state_clone.clone(),
          http_client_clone.clone(),
        )
        .await
        {
          Ok(r) => r,
          Err(WhisperRequestError::Retryable(_remaining_requests)) => {
            error!("failed to send openai whisper request with retryable err");
            tries -= 1;
            continue;
          }
          Err(WhisperRequestError::Fatal) => {
            fail_job(transcript_id, 57, state_clone, user_id_clone)
              .await
              .unwrap();
            panic!("whisper fatal error");
          }
        };

        info!(
          "For segment {} remaining requests from rate limiter {}",
          i, remaining
        );

        break;
      }
    });

    tasks.push(task);
  }

  // Wait for all tasks to complete
  for task in tasks {
    match task.await {
      Ok(_) => {}
      Err(e) => {
        error!("task failed: {}", e);
      }
    }
  }

  info!("All segments transcribed for transcript {}", transcript_id);

  PostHogEventType::FileTranscribed.capture(
    user_id.clone(),
    json!({
      "transcript_id": transcript_id,
    }),
  );

  let mut conn = state.db.get_conn().await?;

  r"UPDATE transcripts SET transcribe_finished = 1, ts_whisper = UTC_TIMESTAMP() WHERE id = :id;"
    .with(params! {
      "id" => transcript_id,
    })
    .ignore(&mut conn)
    .await?;

  // TODO: get total time and log it...

  // let rows = r"SELECT dateCreated FROM transcripts WHERE id = :transcript_id;"
  //   .with(params! {
  //     "transcript_id" => transcript_id,
  //   })
  //   .map(&mut conn, |text: String| {
  //     return text;
  //   })
  //   .await
  //   .map_and_log_err(
  //     "failed to get from gc_segments",
  //     StatusCode::INTERNAL_SERVER_ERROR,
  //   )
  //   .unwrap();

  PostHogEventType::TranscribeFinished.capture(
    user_id.clone(),
    json!({
      "transcript_id": transcript_id,
      "upload_kind": upload_kind,
    }),
  );

  return Ok(());
}

#[derive(Deserialize, Serialize)]
pub struct ReplicateWebhookQuery {
  #[serde(rename = "transcriptId")]
  transcript_id: u64,
}

#[derive(Deserialize, Serialize, Clone)]
struct TranscriptionData {
  s3_audio_key: String,
  user_id: String,
}

pub async fn replicate_webhook_handler(
  axum::extract::Query(ReplicateWebhookQuery { transcript_id }): axum::extract::Query<
    ReplicateWebhookQuery,
  >,
  State(state): State<Arc<SharedRequestState>>,
  Json(body): Json<Value>,
) -> Result<impl IntoResponse, StatusCode> {
  info!("got webhook response {:?}", body);
  replicate_webhook_handler_impl(transcript_id, state)
    .await
    .map_and_log_err(
      "failed to successfully call replicate webhook",
      StatusCode::INTERNAL_SERVER_ERROR,
    )?;
  return Ok(axum::response::Json(ReplicateWebhookResponse {}));
}

pub async fn replicate_webhook_handler_impl(
  transcript_id: u64,
  state: Arc<SharedRequestState>,
) -> anyhow::Result<()> {
  let mut conn = state.db.get_conn().await?;

  let rows = r"SELECT diarization_ready, insufficient_tokens, credits_required, userId, upload_kind FROM transcripts WHERE id = :id;"
    .with(params! {
      "id" => transcript_id,
    })
    .map(
      &mut conn,
      |(diarization_ready, insufficient_tokens, tokens_required, user_id, upload_kind): (i32, i32, i32, String, String)| {
        (diarization_ready, insufficient_tokens, tokens_required, user_id, upload_kind)
      },
    )
    .await?;

  if rows.len() != 1 {
    error!("expected one row of ready data, found {}", rows.len());
    return Err(anyhow!(
      "expected one row of ready data, found {}",
      rows.len()
    ));
  }

  // TODO: don't rely on insufficient_tokens to gate here
  // Instead compute it fresh because we could be called from after a payment
  // In which case we need to set insufficient_tokens to 0 (if it changed)

  let (diarization_ready, insufficient_tokens, tokens_required, user_id, upload_kind) =
    rows[0].clone();

  let current_balance = get_current_balance(&mut conn, user_id.clone()).await?;

  if diarization_ready == 0 || current_balance < tokens_required {
    warn!(
      "diarization_ready {} or insufficient_tokens {} is false",
      diarization_ready, insufficient_tokens
    );

    r"UPDATE transcripts SET was_paywalled = 1 WHERE id = :id;"
      .with(params! {
        "id" => transcript_id,
      })
      .ignore(&mut conn)
      .await?;

    info!("paywalled transcript {}", transcript_id);

    return Ok(());
  }

  r"INSERT INTO payments (user_id, transcript_id, credit, action) VALUES (:user_id, :transcript_id, :credit, 'sub');"
    .with(params! {
      user_id,
      transcript_id,
      "credit" => -tokens_required,
    })
    .ignore(&mut conn)
    .await?;

  // Update transcribe_paused = 0 and insufficient_tokens = 0 because we've paid and we're going through with it
  r"UPDATE transcripts SET transcribe_paused = 0, insufficient_tokens = 0 WHERE id = :id;"
    .with(params! {
      "id" => transcript_id,
    })
    .ignore(&mut conn)
    .await?;

  let rows = r"SELECT userId, s3AudioKey FROM transcripts WHERE id = :id;"
    .with(params! {
      "id" => transcript_id,
    })
    .map(&mut conn, |(user_id, s3_audio_key)| TranscriptionData {
      s3_audio_key,
      user_id,
    })
    .await?;

  if rows.len() != 1 {
    error!("expected one row of transcript data, found {}", rows.len());
    return Err(anyhow!(
      "expected one row of transcript data, found {}",
      rows.len()
    ));
  }

  let TranscriptionData {
    s3_audio_key,
    user_id,
  } = rows[0].clone();

  let counter_clone = Arc::clone(&state.pending_tasks_counter);
  tokio::spawn(async move {
    // Keep track of pending task, when dropped it will decrement the counter
    let _tracker = TaskTracker::new(counter_clone);

    match transcribe_segments_fast(
      transcript_id,
      s3_audio_key.clone(),
      state,
      user_id,
      upload_kind,
    )
    .await
    {
      Ok(()) => {}
      Err(e) => {
        error!("Top level error handler: {}", e.to_string());
        r"UPDATE transcripts SET transcribe_failed = 1 WHERE id = :id"
          .with(params! {
            "id" => transcript_id,
          })
          .ignore(&mut conn)
          .await
          .expect("failed to write transcribe_failed=1 into DB after webhook failure");
      }
    };
  });

  return Ok(());
}

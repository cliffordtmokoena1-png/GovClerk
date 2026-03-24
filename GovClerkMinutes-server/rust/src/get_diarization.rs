use axum::{
  extract::{Extension, Json, State},
  headers::{authorization::Bearer, Authorization},
  response::IntoResponse,
  TypedHeader,
};

use http::StatusCode;
use mysql_async::{
  params,
  prelude::{BatchQuery, Query, Queryable, WithParams},
  TxOpts,
};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{cmp::max, env, result, sync::Arc};
use tempfile::NamedTempFile;
use tokio::{fs::File, io::AsyncWriteExt, process::Command, task};
use tracing::{error, info, warn};

use crate::{
  error::LogError, get_current_balance::get_current_balance, get_email::get_primary_email, get_email::get_primary_email_id, mysql::DbManager, posthog::PostHogEventType, UserId, replicate_webhook::{
    fail_job, replicate_webhook_handler_impl, send_openai_whisper_request, timestamp_to_seconds,
  }, transcript::{Segment, Speaker, Transcript, TranscriptFromModel}, SharedRequestState
};

#[derive(Deserialize, Serialize)]
pub struct GetDiarizationBody {
  s3_audio_key: String,
  // audio_url: String,
  // webhook_url: String,
}

#[derive(Deserialize, Serialize)]
pub struct GetDiarizationResponse {
  // status: String, output: String,
}

#[derive(Deserialize)]
pub struct GetDiarizationQueryParam {
  test: Option<String>,
}

const TEST_SPEAKER_SEGMENTATION_JSON: &str = include_str!("../assets/small_test_segmentation.json");

pub async fn get_required_tokens(audio_path: &str) -> anyhow::Result<i32> {
  // ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 input.mp4
  let mut ffprobe_command = tokio::process::Command::new("ffprobe");
  ffprobe_command
    .arg("-v")
    .arg("error")
    .arg("-show_entries")
    .arg("format=duration")
    .arg("-of")
    .arg("default=noprint_wrappers=1:nokey=1")
    .arg(&audio_path);

  info!("command: {:?}", ffprobe_command);

  let output = ffprobe_command.output().await?;

  info!("ffprobe output: {:?}", output);

  // Parse command stdout to f64
  let seconds = String::from_utf8(output.stdout)?.trim().parse::<f64>()?;

  // Get number of minutes and then round down to nearest int.  If 0, round up to 1.
  return Ok(max((seconds / 60.0).floor() as i32, 1_i32));
}

async fn get_snippet(
  audio_path: String,
  segment_start: String,
  segment_stop: String,
  http_client: Arc<reqwest::Client>,
) -> String {
  let start = if let Some(start) = timestamp_to_seconds(&segment_start) {
    start
  } else {
    return "".to_string();
  };

  let stop = if let Some(stop) = timestamp_to_seconds(&segment_stop) {
    stop
  } else {
    return "".to_string();
  };

  let temp_file = match tempfile::Builder::new().suffix(".webm").tempfile() {
    Ok(temp_file) => temp_file,
    Err(e) => {
      error!("Failed to create temp file: {}", e);
      return "".to_string();
    }
  };

  let temp_file_path = match temp_file.path().to_str() {
    Some(temp_file_path) => temp_file_path.to_string(),
    None => {
      error!("Failed to convert temp file path to string");
      return "".to_string();
    }
  };

  let mut ffmpeg_command = tokio::process::Command::new("ffmpeg");
  ffmpeg_command
    .arg("-y")
    .arg("-i")
    .arg(&audio_path)
    .arg("-ss")
    .arg(start.to_string())
    .arg("-t")
    .arg(stop.to_string())
    .arg("-vn")
    .arg("-c:a")
    .arg("libvorbis")
    .arg("-q:a")
    .arg("4")
    .arg(&temp_file_path);

  if let Err(_) = ffmpeg_command.output().await {
    error!("ffmpeg command failed to execute");
    return "".to_string();
  }

  let (_remaining, maybe_text) =
    match send_openai_whisper_request(temp_file_path, http_client).await {
      Ok((remaining, maybe_text)) => (remaining, maybe_text),
      Err(e) => {
        error!("Failed to send whisper request for snippet: {:?}", e);
        return "".to_string();
      }
    };

  maybe_text.unwrap_or("".to_string())
}

fn transcribe_first_n_segments(
  transcript: Transcript,
  n: usize,
  audio_path: String,
  http_client: Arc<reqwest::Client>,
  db_manager: &DbManager,
  transcript_id: u64,
) {
  let mut tasks = Vec::new();
  for i in 0..(std::cmp::min(n, transcript.segments.len())) {
    let audio_path_clone = audio_path.clone();
    let start = transcript.segments[i].start.clone();
    let stop = transcript.segments[i].stop.clone();
    let http_client_clone = http_client.clone();
    let db_manager_clone = db_manager.clone();
    let task = tokio::spawn(async move {
      info!("transcribing first n segments, segment: {}/{}", i + 1, n);

      let conn = match db_manager_clone.get_conn().await {
        Ok(conn) => conn,
        Err(e) => {
          error!("Failed to get db connection: {}", e);
          return;
        }
      };

      let text = get_snippet(audio_path_clone, start, stop, http_client_clone).await;

      r"UPDATE gc_segments SET transcript = :transcript WHERE transcript_id = :transcript_id AND segment_index = :segment_index;"
        .with(params! {
          "transcript" => text,
          "transcript_id" => transcript_id,
          "segment_index" => i,
        })
        .ignore(conn)
        .await
        .unwrap_or_else(|e| {
          error!("Failed to update initial first nth ({}) segment transcript: {}", i, e);
        });
    });

    tasks.push(task);
  }
}

/// Uses a transaction to ensure no races and that this endpoint is idempotent
/// AKA resilient to duplicate uploads from the client.  We want this to ensure
/// we don't double-deduct tokens if an upload is retried e.g. as part of a
/// background sync API retry in Chrome
///
/// Also returns true if the job was failed e.g. by a timeout, which is nice
/// because then we won't deduct tokens from the user for an upload that is
/// retried after it's marked timed out.
async fn upload_already_happened(
  conn: &mut mysql_async::Conn,
  transcript_id: u64,
) -> anyhow::Result<bool> {
  let mut tx = conn.start_transaction(TxOpts::default()).await?;

  let result: Option<(i32, i32)> = tx
    .exec_first(
      "SELECT upload_complete, transcribe_failed FROM transcripts WHERE id = ? FOR UPDATE",
      (transcript_id,),
    )
    .await?;

  if let Some((upload_complete, transcribe_failed)) = result {
    if upload_complete == 1 || transcribe_failed != 0 {
      tx.commit().await?;
      return Ok(true);
    }
  }

  tx.exec_drop(
    "UPDATE transcripts SET upload_complete = 1 WHERE id = ?",
    (transcript_id,),
  )
  .await?;

  tx.commit().await?;

  return Ok(false);
}

async fn run_speaker_segmentation(
  state: Arc<SharedRequestState>,
  audio_path: String,
  user_id: String,
  transcript_id: u64,
  snippet: String,
  tokens_required: i32,
  s3_audio_key: String,
) -> anyhow::Result<String> {
  let start = chrono::Utc::now();
  let _lock = state.gpu_mutex.lock().await;

  PostHogEventType::DiarizationGpuReleased.capture(
    user_id.clone(),
    json!({
      "transcript_id": transcript_id,
      "snippet": snippet,
      "tokens_required": tokens_required,
      "duration": (chrono::Utc::now() - start).num_milliseconds(),
    }),
  );

  info!(
    "Running python for {} at {} on input",
    s3_audio_key, audio_path
  );

  let output = match Command::new("conda")
    .arg("run")
    .arg("--live-stream")
    .arg("-n")
    .arg("gcenv")
    .arg("python")
    .arg("predict.py")
    .arg(&audio_path)
    .current_dir("/root/speaker-diarization")
    .output()
    .await
  {
    Ok(output) if output.status.success() => String::from_utf8_lossy(&output.stdout).to_string(),
    Ok(output) => {
      let stderr = String::from_utf8_lossy(&output.stderr).to_string();
      error!("Subprocess failed: {}", stderr);
      fail_job(transcript_id, 63, state.clone(), user_id).await?;
      panic!("Subprocess failed: {}", stderr);
    }
    Err(e) => {
      error!("Failed to execute subprocess: {}", e);
      fail_job(transcript_id, 63, state.clone(), user_id).await?;
      panic!("failed to execute subprocess: {}", e);
    }
  };

  info!("output: {}", output);

  let path_regex = Regex::new(r"Result saved to (/tmp/.+?\.json)")?;
  let mut json_output_path = "";

  // Search for the line with the file path
  for line in output.lines() {
    if let Some(captures) = path_regex.captures(line) {
      json_output_path = captures.get(1).map_or("", |m| m.as_str());
      break;
    }
  }
  info!("json_output_path: {}", json_output_path);

  return tokio::fs::read_to_string(json_output_path)
    .await
    .map_err(|e| e.into());
}

pub async fn process_diarization(
  transcript_id: u64,
  user_id: String,
  upload_kind: String,
  s3_audio_key: String,
  state: Arc<SharedRequestState>,
  test_mode: bool,
) -> anyhow::Result<()> {
  let mut conn = state.db.get_conn().await?;

  if upload_already_happened(&mut conn, transcript_id).await? {
    warn!(
      "Upload already happened for transcript_id: {}",
      transcript_id
    );
    return Ok(());
  }

  if upload_kind != "audio" {
    // For text transcript upload we charge flat 50 token rate.
    r"UPDATE transcripts SET credits_required = 50, transcribe_finished = 1, ts_upload = UTC_TIMESTAMP() WHERE id = :transcript_id;"
      .with(params! {
        "transcript_id" => transcript_id,
      })
      .ignore(&mut conn)
      .await?;

    PostHogEventType::FileUploaded.capture(
      user_id.clone(),
      json!({
        "transcript_id": transcript_id,
        "tokens_required": 50,
        "upload_kind": upload_kind,
      }),
    );

    // No need to do diarization for text transcript upload.
    return Ok(());
  }

  let temp = NamedTempFile::new()?;
  let temp_path = temp.into_temp_path();
  let mut temp_audio_file = File::create(&temp_path).await?;

  let object = state
    .s3_client
    .get_object()
    .bucket("govclerk-audio-uploads")
    .key(&s3_audio_key)
    .send()
    .await?;

  let bytes = object.body.collect().await?;

  let file_content: Vec<u8> = bytes.to_vec();

  if file_content.len() == 0 {
    r"UPDATE transcripts SET transcribe_failed = 11 WHERE id = :transcript_id;"
      .with(params! {
        "transcript_id" => transcript_id,
      })
      .ignore(&mut conn)
      .await?;

    return Err(anyhow::anyhow!("file content is empty"));
  }

  temp_audio_file.write_all(&file_content).await?;

  temp_audio_file.flush().await?;

  let audio_path = temp_path
    .to_str()
    .ok_or_else(|| anyhow::anyhow!("could not convert path to str"))?
    .to_string();

  let client = Arc::new(reqwest::Client::new());

  let snippet = get_snippet(
    audio_path.clone(),
    "00:00:00".to_owned(),
    "00:00:03".to_owned(),
    client.clone(),
  )
  .await;

  info!("Got snippet: {}", snippet);

  let tokens_required = get_required_tokens(&audio_path).await?;

  info!("tokens required: {}", tokens_required);

  r"UPDATE transcripts SET credits_required = :credits_required, snippet = :snippet, ts_upload = UTC_TIMESTAMP() WHERE id = :transcript_id;"
    .with(params! {
      "credits_required" => tokens_required,
      "transcript_id" => transcript_id,
      "snippet" => snippet.clone(),
    })
    .ignore(&mut conn)
    .await?;

  PostHogEventType::FileUploaded.capture(
    user_id.clone(),
    json!({
      "transcript_id": transcript_id,
      "snippet": snippet,
      "tokens_required": tokens_required,
      "upload_kind": upload_kind,
    }),
  );

  let transcript_str = if test_mode {
    warn!(
      "Using TEST MODE speaker segmentation json!  Beware: your audio must be over 1 minute long."
    );
    TEST_SPEAKER_SEGMENTATION_JSON.to_string()
  } else {
    run_speaker_segmentation(
      state.clone(),
      audio_path.clone(),
      user_id.clone(),
      transcript_id,
      snippet,
      tokens_required,
      s3_audio_key,
    )
    .await?
  };

  let transcript_from_model: TranscriptFromModel = serde_json::from_str(&transcript_str)?;
  let transcript: Transcript = transcript_from_model.into();

  PostHogEventType::FileDiarized.capture(
    user_id.clone(),
    json!({
      "transcript_id": transcript_id,
    }),
  );

  r"INSERT INTO speakers (userId, transcriptId, label, name, uses, embedding) VALUES (:user_id, :transcript_id, :label, :name, 0, :embedding)"
      .with(
        transcript
          .speakers
          .iter()
          .map(|Speaker { label, name, embedding }| {
            return params! {
              "user_id" => user_id.clone(),
              "transcript_id" => transcript_id,
              "label" => label,
              "name" => name,
              "embedding" => serde_json::to_string(embedding).unwrap_or("".to_string()),
            };
          }),
        )
      .batch(&mut conn)
      .await?;

  r"INSERT INTO gc_segments (transcript_id, start, stop, speaker, segment_index) VALUES (:transcript_id, :start, :stop, :speaker, :segment_index)"
      .with(
        transcript
          .segments
          .iter()
          .enumerate()
          .map(| (segment_index, Segment { start, stop, speaker, transcript: _transcript })| {
            return params! {
              "transcript_id" => transcript_id,
              "start" => start,
              "stop" => stop,
              "speaker" => speaker,
              "segment_index" => segment_index,
            };
          }),
        )
      .batch(&mut conn)
      .await?;

  transcribe_first_n_segments(transcript, 5, audio_path, client, &state.db, transcript_id);

  let current_balance = get_current_balance(&mut conn, user_id.clone()).await?;

  let insufficient_tokens = if current_balance < tokens_required {
    1
  } else {
    0
  };
  let transcribe_paused = insufficient_tokens;

  if transcribe_paused == 1 {
    PostHogEventType::TranscribePaused.capture(
      user_id.clone(),
      json!({
        "transcript_id": transcript_id,
        "current_balance": current_balance,
        "upload_kind": upload_kind,
      }),
    );

    let result: Option<mysql_async::Row> = r"SELECT COUNT(*) as count FROM gc_emails WHERE user_id = :user_id AND transcript_id = :transcript_id AND campaign = 'paywall_abandonment'"
        .with(params! {
            "user_id" => user_id.clone(),
            "transcript_id" => transcript_id,
        })
        .fetch(&mut conn)
        .await?
        .into_iter()
        .next();

    let count: i64 = match result {
        Some(row) => row.get::<i64, &str>("count").ok_or_else(|| anyhow::anyhow!("Failed to get count"))?,
        None => return Err(anyhow::anyhow!("Failed to fetch count")),
    };

    if count == 0 {
        let select_query = r"SELECT COUNT(*) FROM gc_emails WHERE user_id = :user_id AND transcript_id = :transcript_id AND campaign = 'paywall_abandonment'";
        let count_gc_emails: u64 = conn
            .exec_first(select_query, params! {
                "user_id" => user_id.clone(),
                "transcript_id" => transcript_id.clone(),
            })
            .await?
            .unwrap_or(0);
    
        if count_gc_emails == 0 {
          let email_id = get_primary_email_id(&user_id, State(state.clone())).await?;
          info!("email_id: {}", email_id);
          let email = get_primary_email(&email_id, State(state.clone())).await?;

          r"INSERT INTO gc_emails (should_email, email, campaign, user_id, transcript_id) VALUES (1, :email, 'paywall_abandonment', :user_id, :transcript_id)"
              .with(params! {
                  "email" => email,
                  "user_id" => user_id.clone(),
                  "transcript_id" => transcript_id,
              })
              .run(&mut conn)
              .await?;
        }
    }
  }

  r"UPDATE transcripts SET diarization_ready = 1, insufficient_tokens = :insufficient_tokens, transcribe_paused = :transcribe_paused, ts_diarization = UTC_TIMESTAMP() WHERE id = :transcript_id AND userId = :user_id;"
      .with(params! {
        "insufficient_tokens" => insufficient_tokens,
        "transcribe_paused" => transcribe_paused,
        "transcript_id" => transcript_id,
        "user_id" => user_id.clone(),
      })
      .ignore(&mut conn)
      .await?;

  PostHogEventType::FileSegmented.capture(
    user_id.clone(),
    json!({
      "transcript_id": transcript_id,
      "insufficient_tokens": insufficient_tokens,
      "current_balance": current_balance,
    }),
  );

  return replicate_webhook_handler_impl(transcript_id, state).await;
}

pub async fn get_diarization_handler(
  TypedHeader(auth): TypedHeader<Authorization<Bearer>>,
  State(state): State<Arc<SharedRequestState>>,
  axum::extract::Query(GetDiarizationQueryParam { test }): axum::extract::Query<
    GetDiarizationQueryParam,
  >,
  Json(GetDiarizationBody { s3_audio_key }): Json<GetDiarizationBody>,
) -> Result<impl IntoResponse, StatusCode> {
  if auth.token() != env::var("UPLOAD_COMPLETE_WEBHOOK_SECRET").unwrap() {
    error!("Unauthorized get diarization handler");
    return Err(StatusCode::UNAUTHORIZED);
  }

  let test_mode = test.is_some();
  if test_mode {
    warn!("IN TEST MODE!");
  }

  // key has format "{test_}uploads/upload_<TRANSCRIPT_ID>"
  let transcript_id = s3_audio_key
    .split("_")
    .collect::<Vec<&str>>()
    .last()
    .ok_or(StatusCode::BAD_REQUEST)? // Corrected
    .parse::<u64>()
    .map_err(|_| StatusCode::BAD_REQUEST)?; // Corrected and simplified

  info!("Transcript id: {}", transcript_id);

  let mut conn = state
    .db
    .get_conn()
    .await
    .map_and_log_err("conn error", StatusCode::INTERNAL_SERVER_ERROR)?;

  let rows = r"SELECT userId, upload_kind FROM transcripts WHERE id = :transcript_id"
    .with(params! {
      "transcript_id" => transcript_id,
    })
    .map(&mut conn, |(user_id, upload_kind): (String, String)| {
      (user_id, upload_kind)
    })
    .await
    .map_and_log_err("failed to query userid", StatusCode::INTERNAL_SERVER_ERROR)?;

  let (user_id, upload_kind) = rows[0].clone();

  task::spawn(async move {
    match process_diarization(
      transcript_id,
      user_id.clone(),
      upload_kind,
      s3_audio_key,
      state.clone(),
      test_mode,
    )
    .await
    {
      Ok(_) => info!("Successfully processed diarization"),
      Err(e) => {
        error!("Failed to process diarization: {}", e);
        fail_job(transcript_id, 62, state, user_id)
          .await
          .unwrap_or_else(|e| {
            error!("Failed to fail job: {}", e);
          });
      }
    }
  });

  return Ok(axum::response::Json(GetDiarizationResponse {}));
}

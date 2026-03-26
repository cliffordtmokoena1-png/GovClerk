use axum::{
  extract::{Json, State},
  headers::{authorization::Bearer, Authorization},
  response::IntoResponse,
  TypedHeader,
};
use http::StatusCode;
use mysql_async::{
  params,
  prelude::{Query, WithParams},
};
use serde::{Deserialize, Serialize};
use std::{cmp::max, env, sync::Arc};
use tempfile::NamedTempFile;
use tokio::{fs::File, io::AsyncWriteExt};
use tracing::{error, info};

use crate::{error::LogError, SharedRequestState};

// TODO: write middleware here where we write transcribe_failed = 1 if we have non-200 status code

#[derive(Deserialize, Serialize)]
pub struct GetRequiredTokenBody {
  transcript_id: u64,
}

#[derive(Deserialize, Serialize)]
pub struct GetRequiredTokenResponse {
  tokens_required: i32,
}

struct TranscribeInput {
  s3_audio_key: String,
}

pub async fn get_required_tokens(
  client: &aws_sdk_s3::Client,
  audio_key: &str,
) -> Result<i32, StatusCode> {
  let temp = NamedTempFile::new()
    .map_and_log_err("couldnt make temp file", StatusCode::INTERNAL_SERVER_ERROR)?;
  let temp_path = temp.into_temp_path();
  let mut temp_audio_file = File::create(&temp_path).await.map_and_log_err(
    "couldn't make async file",
    StatusCode::INTERNAL_SERVER_ERROR,
  )?;

  let object = client
    .get_object()
    .bucket("govclerk-bucket")
    .key(audio_key)
    .send()
    .await
    .map_and_log_err("could not get s3 object", StatusCode::INTERNAL_SERVER_ERROR)?;

  let bytes = object.body.collect().await.map_and_log_err(
    "could not collect to bytes",
    StatusCode::INTERNAL_SERVER_ERROR,
  )?;

  let file_content: Vec<u8> = bytes.to_vec();

  temp_audio_file
    .write_all(&file_content)
    .await
    .map_and_log_err(
      "could not write to temp file",
      StatusCode::INTERNAL_SERVER_ERROR,
    )?;

  temp_audio_file.flush().await.map_and_log_err(
    "could not flush temp file",
    StatusCode::INTERNAL_SERVER_ERROR,
  )?;

  let audio_path = temp_path.to_str().unwrap().to_string();

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

  let output = ffprobe_command
    .output()
    .await
    .map_and_log_err("could not run ffprobe", StatusCode::INTERNAL_SERVER_ERROR)?;

  // Parse command stdout to f64
  let seconds = String::from_utf8(output.stdout)
    .map_and_log_err(
      "could not convert ffprobe output to string",
      StatusCode::INTERNAL_SERVER_ERROR,
    )?
    .trim()
    .parse::<f64>()
    .map_and_log_err(
      "could not parse ffprobe output to f64",
      StatusCode::INTERNAL_SERVER_ERROR,
    )?;

  // Get number of minutes and then round down to nearest int.  If 0, round up to 1.
  return Ok(max((seconds / 60.0).floor() as i32, 1_i32));
}

pub async fn get_required_tokens_handler(
  TypedHeader(auth): TypedHeader<Authorization<Bearer>>,
  State(state): State<Arc<SharedRequestState>>,
  Json(GetRequiredTokenBody { transcript_id }): Json<GetRequiredTokenBody>,
) -> Result<impl IntoResponse, StatusCode> {
  if auth.token() != env::var("UPLOAD_COMPLETE_WEBHOOK_SECRET").unwrap() {
    error!("unauthorized get required tokens handler");
    return Err(StatusCode::UNAUTHORIZED);
  }

  let mut conn = state
    .db
    .get_conn()
    .await
    .map_and_log_err("failed to connect to db", StatusCode::INTERNAL_SERVER_ERROR)?;

  let rows = r"SELECT s3AudioKey FROM transcripts WHERE id = :id;"
    .with(params! {
      "id" => transcript_id,
    })
    .map(&mut conn, |s3_audio_key| TranscribeInput { s3_audio_key })
    .await
    .map_and_log_err(
      "failed to query replicate db",
      StatusCode::INTERNAL_SERVER_ERROR,
    )?;

  if rows.len() != 1 {
    error!("Multiple transcripts found for id {}", transcript_id);
    return Err(StatusCode::INTERNAL_SERVER_ERROR);
  }

  let TranscribeInput { s3_audio_key } = &rows[0];

  let tokens_required = get_required_tokens(&state.s3_client, s3_audio_key).await?;

  info!("tokens required: {}", tokens_required);

  return Ok(axum::response::Json(GetRequiredTokenResponse {
    tokens_required,
  }));
}

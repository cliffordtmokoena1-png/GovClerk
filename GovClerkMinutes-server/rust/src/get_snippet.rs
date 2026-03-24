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

use crate::{error::LogError, SharedRequestState, UserId};

// TODO: write middleware here where we write transcribe_failed = 1 if we have non-200 status code

#[derive(Deserialize, Serialize)]
pub struct GetSnippetBody {
  audio_key: String,
}

#[derive(Deserialize, Serialize)]
pub struct GetSnippetResponse {
  snippet: String,
}

pub async fn download_and_get_beginning_snippet(
  client: &aws_sdk_s3::Client,
  audio_key: &str,
) -> Result<String, StatusCode> {
  let temp = NamedTempFile::new()
    .map_and_log_err("couldnt make temp file", StatusCode::INTERNAL_SERVER_ERROR)?;
  let temp_path = temp.into_temp_path();
  let mut temp_audio_file = File::create(&temp_path).await.map_and_log_err(
    "couldn't make async file",
    StatusCode::INTERNAL_SERVER_ERROR,
  )?;

  let object = client
    .get_object()
    .bucket("govclerk-audio-uploads")
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

  let mut ffmpeg_command = tokio::process::Command::new("ffmpeg");
  ffmpeg_command.arg("-i ...");

  // TODO: Return temp filepath of snippet...
}

pub async fn get_snippet_handler(
  TypedHeader(auth): TypedHeader<Authorization<Bearer>>,
  State(state): State<Arc<SharedRequestState>>,
  Json(GetSnippetBody { audio_key }): Json<GetSnippetBody>,
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

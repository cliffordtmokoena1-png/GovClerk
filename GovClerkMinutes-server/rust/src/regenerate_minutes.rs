use crate::create_minutes::{call_gemini, get_speakers, get_transcript_str, GPT_CREATE_MINUTES_PROMPT_SYSTEM, GPT_CREATE_MINUTES_PROMPT_PREFIX};
use crate::{SharedRequestState, UserId, transcript::Transcript};
use axum::{
  extract::{Json, Path, State},
  response::IntoResponse,
  Extension,
};
use http::StatusCode;
use mysql_async::{params, prelude::Queryable, Conn, Row};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::task;
use tracing::{error, info};
use serde_json::json;
use mysql_async::prelude::{FromRow, Query, WithParams};
use tokio::process::Command;
use tokio::io::AsyncWriteExt;
use tempfile::NamedTempFile;
use anyhow::Context;

#[derive(Deserialize)]
pub struct RegenerateMinutesBody {
  feedback: String,
}

#[derive(Debug)]
struct Minutes {
  transcript_id: u64,
  user_id: String,
  minutes: String,
  version: i32,
  feedback: Option<String>,
}

impl FromRow for Minutes {
  fn from_row_opt(row: Row) -> Result<Self, mysql_async::FromRowError> {
    let transcript_id: u64 = row.get("transcript_id").unwrap();
    let user_id: String = row.get("user_id").unwrap();
    let minutes: String = row.get("minutes").unwrap();
    let version: i32 = row.get("version").unwrap();
    let feedback: Option<String> = row.get("feedback").unwrap();

    Ok(Minutes {
      transcript_id,
      user_id,
      minutes,
      version,
      feedback,
    })
  }
}

#[derive(Serialize)]
struct ApiResponse {
  message: String,
}

pub async fn regenerate_minutes_handler(
  Extension(UserId(user_id)): Extension<UserId>,
  State(state): State<Arc<SharedRequestState>>,
  Path(transcript_id): Path<u64>,
  Json(RegenerateMinutesBody { feedback }): Json<RegenerateMinutesBody>,
) -> Result<impl IntoResponse, StatusCode> {
  info!(
    "Handler called with transcript_id: {} and user_id: {}",
    transcript_id, user_id
  );

  let mut conn = state.db.get_conn().await.map_err(|err| {
    error!("Error getting database connection: {:?}", err);
    StatusCode::INTERNAL_SERVER_ERROR
  })?;

  // Fetch existing minutes and feedback from the database
  let rows = r"SELECT transcript_id, user_id, minutes, version, feedback FROM minutes WHERE transcript_id = :transcript_id AND user_id = :user_id ORDER BY version"
    .with(params! {
      "transcript_id" => transcript_id,
      "user_id" => &user_id,
    })
    .map(&mut conn, |row: Row| {
      let transcript_id: u64 = row.get(0).unwrap();
      let user_id: String = row.get(1).unwrap();
      let minutes: String = row.get(2).unwrap();
      let version: i32 = row.get(3).unwrap();
      let feedback: Option<String> = row.get(4).unwrap();
      (transcript_id, user_id, minutes, version, feedback)
    })
    .await
    .map_err(|err| {
      error!("Error fetching original minutes: {:?}", err);
      StatusCode::INTERNAL_SERVER_ERROR
    })?;

  if rows.is_empty() {
    return Err(StatusCode::NOT_FOUND);
  }

  // Create an initial row in the minutes table to mark the task as started
  let new_version = rows.last().unwrap().3 + 1;

  // Look up org_id from the transcripts table so it is stored alongside the new minutes row
  let org_id_rows = r"SELECT org_id FROM transcripts WHERE id = :transcript_id"
    .with(params! {
      "transcript_id" => transcript_id,
    })
    .map(&mut conn, |org_id: Option<String>| org_id)
    .await
    .map_err(|err| {
      error!("Error fetching org_id for transcript: {:?}", err);
      StatusCode::INTERNAL_SERVER_ERROR
    })?;
  let org_id: Option<String> = org_id_rows.into_iter().next().flatten();

  r"INSERT INTO minutes (transcript_id, user_id, org_id, version, ts_start, feedback) VALUES (:transcript_id, :user_id, :org_id, :version, UTC_TIMESTAMP(), :feedback)"
    .with(params! {
      "transcript_id" => transcript_id,
      "user_id" => user_id.clone(),
      "org_id" => org_id,
      "version" => new_version,
      "feedback" => feedback.clone(),
    })
    .ignore(&mut conn)
    .await
    .map_err(|err| {
      error!("Error inserting initial minutes: {:?}", err);
      StatusCode::INTERNAL_SERVER_ERROR
    })?;

  // Spawn a background task to handle the actual regeneration
  let state_clone = Arc::clone(&state);
  let user_id_clone = user_id.clone();
  let feedback_clone = feedback.clone();
  task::spawn(async move {
    regenerate_minutes_task(state_clone, transcript_id, user_id_clone, feedback_clone, rows).await;
  });

  let response = ApiResponse {
    message: "Minutes regeneration started".to_string(),
  };

  Ok((StatusCode::OK, Json(response)))
}

async fn regenerate_minutes_task(
  state: Arc<SharedRequestState>,
  transcript_id: u64,
  user_id: String,
  feedback: String,
  rows: Vec<(u64, String, String, i32, Option<String>)>,
) {
  let mut conn = match state.db.get_conn().await {
    Ok(conn) => conn,
    Err(err) => {
      error!("Error getting database connection: {:?}", err);
      return;
    }
  };

  let transcript_str = match get_transcript_str(state.clone(), &mut conn, transcript_id, &user_id, "audio", false).await {
      Ok(str) => str,
      Err(err) => {
        error!("Error getting transcript string: {:?}", err);
        return;
      }
  };

  let initial_message = json!({
    "role": "user",
    "parts": [
      {
        "text": GPT_CREATE_MINUTES_PROMPT_PREFIX.to_owned() + "\n\n" + &transcript_str
      }
    ]
  });

  // Prepare the messages for the call_gemini API
  let mut messages = vec![initial_message];

  for (transcript_id, user_id, minutes, version, feedback) in &rows {
    messages.push(json!({
      "role": "model",
      "parts": [
        {
          "text": minutes
        }
      ]
    }));
    messages.push(json!({
      "role": "user",
      "parts": [
        {
          "text": format!("The meeting minutes you generated can be improved. Please re-generate them to address the following feedback: {:?}.", feedback)
        }
      ]
    }));
  }

  let new_minutes = match call_gemini(
    crate::create_minutes::GPT_CREATE_MINUTES_PROMPT_SYSTEM.to_owned(),
    0.3,
    json!(messages)
  ).await {
    Ok(minutes) => minutes,
    Err(err) => {
      error!("Error calling gemini: {:?}", err);
      return;
    }
  };

  let new_version = rows.last().unwrap().3 + 1;

  if let Err(err) = r"UPDATE minutes SET minutes = :minutes, ts_second_gpt = UTC_TIMESTAMP() WHERE transcript_id = :transcript_id AND user_id = :user_id AND version = :version"
    .with(params! {
      "transcript_id" => transcript_id,
      "user_id" => user_id,
      "minutes" => new_minutes,
      "version" => new_version,
    })
    .ignore(&mut conn)
    .await
  {
    error!("Error updating new minutes: {:?}", err);
  }
}


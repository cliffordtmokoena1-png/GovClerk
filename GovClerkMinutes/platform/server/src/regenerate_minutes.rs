use crate::create_minutes::get_transcript_str;
use crate::error::LogError;
use crate::minutes::pipeline::{Ctx, Step};
use crate::minutes::steps::regenerate::{RegenerateStep, RegenerationStepInput};
use crate::minutes_handler::MinutesPipelineStep;
use crate::{make_pipeline, SharedRequestState, UserId};
use anyhow::anyhow;
use axum::{
  extract::{Json, State},
  http::StatusCode,
  response::IntoResponse,
  Extension,
};
use mysql_async::prelude::{FromRow, Query as MySqlQuery, Queryable, WithParams};
use mysql_async::{params, Row, TxOpts};
use serde::Deserialize;
use std::str;
use std::sync::Arc;
use tracing::{error, info};

#[derive(Deserialize)]
pub struct RegenerateMinutesRequest {
  pub transcript_id: u64,
  pub feedback: String,
  pub test_mode: bool,
}

#[derive(Debug)]
struct Minutes {
  id: u64,
  minutes: Option<String>,
  version: i32,
  feedback: Option<String>,
  #[allow(dead_code)]
  outline: Option<String>, // meeting notes
}

impl FromRow for Minutes {
  fn from_row_opt(row: Row) -> Result<Self, mysql_async::FromRowError> {
    let id: u64 = row.get("id").unwrap();
    let minutes: Option<String> = row.get("minutes").unwrap();
    let version: i32 = row.get("version").unwrap();
    let feedback: Option<String> = row.get("feedback").unwrap();
    let outline: Option<String> = row.get("outline").unwrap();

    Ok(Minutes {
      id,
      minutes,
      version,
      feedback,
      outline,
    })
  }
}

/// Returns the insert id of the pending row, and the minutes created up to this point for this transcript.
/// Or an error if we can't start a new regeneration.
async fn setup_regeneration(
  conn: &mut mysql_async::Conn,
  transcript_id: u64,
  user_id: String,
  feedback: &str,
) -> anyhow::Result<(u64, Vec<Minutes>)> {
  let mut tx = conn.start_transaction(TxOpts::default()).await?;

  // Check regeneration limit (max 2 regenerations per transcript)
  let count_result: Vec<(u64,)> = tx
    .exec(
      "SELECT COUNT(1) as cnt FROM minutes WHERE user_id = ? AND transcript_id = ?",
      (user_id.clone(), transcript_id),
    )
    .await?;

  if let Some((count,)) = count_result.first() {
    if *count >= 3 {
      return Err(anyhow!("Regeneration limit exceeded."));
    }
  }

  let mut minutes: Vec<Minutes> = tx.exec("SELECT id, transcript_id, user_id, minutes, version, feedback, outline FROM minutes WHERE transcript_id = ? AND user_id = ? AND fast_mode = 0 ORDER BY version FOR UPDATE",
    (transcript_id, user_id.clone())).await?;

  let latest_minutes = minutes.last_mut().ok_or(anyhow!("No minutes found"))?;

  if latest_minutes.feedback.is_some() {
    return Err(anyhow!(
      "Feedback was already given for these minutes.  Bailing out to avoid duplicate work.",
    ));
  }

  if latest_minutes.minutes.is_none() {
    return Err(anyhow!(
      "No minutes found for this transcript. This can happen if there are two requests to this endpoint in rapid succession.  Bailing out to avoid duplicate work.",
    ));
  }

  latest_minutes.feedback = Some(feedback.to_string());

  tx.exec_drop(
    "UPDATE minutes SET feedback = ? WHERE id = ?",
    (feedback, latest_minutes.id),
  )
  .await?;

  let org_id_row: Option<Option<String>> = tx
    .exec_first(
      "SELECT org_id FROM transcripts WHERE id = ?",
      (transcript_id,),
    )
    .await?;

  let org_id = org_id_row.flatten();

  tx.exec_drop(
    "INSERT INTO minutes (transcript_id, user_id, org_id, version, ts_start) VALUES (?, ?, ?, ?, UTC_TIMESTAMP())",
    (transcript_id, user_id.clone(), org_id, latest_minutes.version + 1),
  ).await?;

  let pending_minutes_id = tx.last_insert_id().ok_or(anyhow!("no last insert id"))?;

  tx.commit().await?;

  return Ok((pending_minutes_id, minutes));
}

pub async fn regenerate_minutes_handler(
  Extension(UserId(user_id)): Extension<UserId>,
  State(state): State<Arc<SharedRequestState>>,
  Json(RegenerateMinutesRequest {
    transcript_id,
    mut feedback,
    test_mode,
  }): Json<RegenerateMinutesRequest>,
) -> Result<impl IntoResponse, StatusCode> {
  info!(
    "[regenerate] user={} transcript_id={} test_mode={}",
    user_id, transcript_id, test_mode
  );

  feedback = feedback.trim().to_string();

  if feedback.is_empty() {
    error!("[regenerate] empty feedback, returning 400");
    return Err(StatusCode::BAD_REQUEST);
  }

  let mut conn = state.db.get_conn().await.map_err(|err| {
    error!("[regenerate] db connection error: {:?}", err);
    StatusCode::INTERNAL_SERVER_ERROR
  })?;

  info!("[regenerate] calling setup_regeneration");
  let (pending_minutes_id, past_minutes) =
    setup_regeneration(&mut conn, transcript_id, user_id.clone(), &feedback)
      .await
      .map_err(|err| {
        let error_msg = err.to_string();
        if error_msg.contains("Regeneration limit exceeded") {
          error!(
            "[regenerate] limit exceeded user={} transcript={}",
            user_id, transcript_id
          );
          StatusCode::FORBIDDEN
        } else {
          error!("[regenerate] setup_regeneration failed: {:?}", err);
          StatusCode::BAD_REQUEST
        }
      })?;
  info!(
    "[regenerate] setup done, pending_minutes_id={}, past_minutes_count={}",
    pending_minutes_id,
    past_minutes.len()
  );

  let rows: Vec<(String, String, Option<String>)> = "
    SELECT
      aws_region,
      upload_kind,
      extension
    FROM transcripts
    WHERE id = :transcript_id
    AND userId = :user_id;
    "
  .with(params! {
    "transcript_id" => transcript_id,
    "user_id" => user_id.clone(),
  })
  .map(
    &mut conn,
    |(aws_region, upload_kind, extension): (String, String, Option<String>)| {
      (aws_region, upload_kind, extension)
    },
  )
  .await
  .map_and_log_err(
    "Error getting region/upload_kind",
    StatusCode::INTERNAL_SERVER_ERROR,
  )?;

  if rows.is_empty() {
    error!(
      "[regenerate] no transcript rows for transcript_id={} user_id={} — returning 404",
      transcript_id, user_id
    );
    return Err(StatusCode::NOT_FOUND);
  }

  let (region, upload_kind, extension) = rows.first().cloned().ok_or(StatusCode::NOT_FOUND)?;
  info!(
    "[regenerate] transcript: region={} upload_kind={} extension={:?}",
    region, upload_kind, extension
  );

  let extension = extension.unwrap_or_default();

  let past_minutes_clone = Arc::new(past_minutes);
  let mut retries = 1;
  let mut result = Err("No attempts made".to_string());

  while retries >= 0 {
    info!("[regenerate] attempt (retries_left={})", retries);

    match regenerate_minutes_task(
      state.clone(),
      transcript_id,
      user_id.clone(),
      upload_kind.clone(),
      &extension,
      region.clone(),
      pending_minutes_id,
      past_minutes_clone.clone(),
      test_mode,
    )
    .await
    {
      Ok(_) => {
        info!("[regenerate] succeeded for transcript_id={}", transcript_id);
        result = Ok(());
        break;
      }
      Err(err) => {
        error!(
          "[regenerate] task failed (retries_left={}): {:?}",
          retries, err
        );
        result = Err(err.to_string());
        retries -= 1;
        continue;
      }
    }
  }

  match result {
    Ok(_) => {
      let response = serde_json::json!({"status": "success"});
      Ok(axum::response::Json(response))
    }
    Err(err) => {
      error!(
        "[regenerate] FINAL ERROR for transcript_id={}: {}",
        transcript_id, err
      );
      Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
  }
}

async fn regenerate_minutes_task(
  state: Arc<SharedRequestState>,
  transcript_id: u64,
  user_id: String,
  upload_kind: String,
  extension: &str,
  region: String,
  pending_minutes_id: u64,
  rows: Arc<Vec<Minutes>>,
  test_mode: bool,
) -> anyhow::Result<()> {
  let mut conn = state.db.get_conn().await?;

  let mut context_parts = Vec::new();

  if upload_kind == "image" {
    let notes = rows
      .first()
      .and_then(|m| m.outline.as_deref())
      .ok_or_else(|| anyhow::anyhow!("No meeting notes found"))?;

    context_parts.push("Meeting notes:\n\n".to_owned() + notes);
  } else {
    let transcript_str = get_transcript_str(
      state.clone(),
      &mut conn,
      transcript_id,
      &upload_kind,
      extension,
      region.clone(),
      test_mode, // Test mode
      false,     // Fast mode
    )
    .await?;

    context_parts.push("Transcript:\n\n".to_owned() + &transcript_str);
  }

  for (
    i,
    Minutes {
      minutes, feedback, ..
    },
  ) in rows.iter().enumerate()
  {
    context_parts
      .push(format!("Draft #{} Meeting Minutes:\n\n", i + 1) + minutes.as_ref().map_or("", |v| v));

    if let Some(feedback) = feedback {
      context_parts.push("Boss's Feedback:\n\n".to_owned() + feedback);
    }
  }

  let current_version = rows.last().map_or(1, |m| m.version + 1);

  let ctx = Ctx {
    state: state.clone(),
    user_id: &user_id,
    transcript_id,
    upload_kind: &upload_kind,
    region: &region,
    test_mode,
  };

  let pipeline = make_pipeline![RegenerateStep];

  pipeline
    .framework_run(
      RegenerationStepInput {
        context: context_parts.join("\n\n"),
        step: MinutesPipelineStep::Regeneration(current_version as usize),
        pending_minutes_id: pending_minutes_id as usize,
      },
      &ctx,
    )
    .await?;

  return Ok(());
}

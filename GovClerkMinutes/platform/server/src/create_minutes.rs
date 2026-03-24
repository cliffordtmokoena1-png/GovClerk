use crate::minutes::pipeline::Step;
use crate::minutes_handler::{save_step_state, MinutesPipelineStep, StepStatus};
use crate::pandoc;
use crate::{
  error::LogError,
  get_current_balance::get_current_balance,
  html::remove_igc_tags,
  make_pipeline,
  minutes::{
    pipeline::Ctx,
    steps::{
      final_minutes::FinalMinutesStep, first_draft::FirstDraftStep,
      meeting_notes::MeetingNotesStep, oracle_feedback::OracleFeedbackStep,
    },
  },
  GovClerkMinutes_webhook::{send_request, GcWebhookEvent},
  posthog::PostHogEventType,
  s3::get_object,
  span_timer::{SpanTimer, TimeSpanEvent},
  task_tracker::TaskTracker,
  transcript::Transcript,
  upload_key::get_upload_key,
  SharedRequestState,
};
use chrono::{DateTime, NaiveDateTime, TimeZone, Utc};
use http::StatusCode;
use mysql_async::{
  params,
  prelude::{Query as MySqlQuery, Queryable, WithParams},
  Conn, TxOpts,
};
use reqwest::Client;
use reqwest::Error as ReqwestError;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{env, sync::Arc};
use tracing::{error, info, warn};

// STEP 2: First draft of minutes from transcript + meeting notes
// STEP 4: Final minutes incorporating all previous steps
use crate::minutes::steps::image_final_minutes::ImageFinalMinutesStep;
use crate::minutes::steps::image_to_meeting_notes::ImageToMeetingNotesStep;
use crate::prompt_templates::{
  render_final_minutes_system, render_finetuned_minutes_prefix, FinetunedPromptData,
};

#[derive(Debug)]
pub enum MinutesError {
  Retryable(String),
  NonRetryable(String),
  Json(serde_json::Error),
}

impl From<anyhow::Error> for MinutesError {
  fn from(err: anyhow::Error) -> Self {
    MinutesError::Retryable(err.to_string())
  }
}

impl From<ReqwestError> for MinutesError {
  fn from(err: ReqwestError) -> Self {
    MinutesError::Retryable(err.to_string())
  }
}

impl From<serde_json::Error> for MinutesError {
  fn from(err: serde_json::Error) -> Self {
    MinutesError::Json(err)
  }
}

#[derive(Deserialize, Serialize)]
pub struct SavedEmbeddingsV1 {
  version: usize,
  transcript_id: u64,
  window_size: usize,
  embeddings: Vec<Vec<f64>>,
}

#[derive(Deserialize, Serialize)]
pub struct CreateMinutesBody {
  transcript_id: u64,
  upload_kind: String,
  test_mode: bool,
}

#[derive(Deserialize, Serialize)]
pub struct CreateMinutesResponse {}

/// Starts a create-minutes task by writing into the DB if there is not already
/// a started minutes for the same transcript id.
/// Returns true iff we are already processing minutes for the same transcript id.
pub async fn start_minutes_if_needed(
  conn: &mut Conn,
  transcript_id: u64,
  user_id: &str,
) -> anyhow::Result<bool> {
  let mut tx = conn.start_transaction(TxOpts::default()).await?;

  let result: Option<i32>  = tx
    .exec_first(
      "SELECT COUNT(1) FROM minutes WHERE transcript_id = :transcript_id AND user_id = :user_id AND fast_mode = 0;",
      (transcript_id, user_id),
    )
    .await?;

  if let Some(count) = result {
    if count > 0 {
      tx.commit().await?;
      return Ok(true);
    }
  }

  let org_id_row: Option<Option<String>> = tx
    .exec_first(
      "SELECT org_id FROM transcripts WHERE id = :transcript_id;",
      (transcript_id,),
    )
    .await?;

  let org_id: Option<String> = org_id_row.flatten();

  tx.exec_drop(
    "INSERT INTO minutes (transcript_id, user_id, org_id, ts_start, fast_mode) VALUES (:transcript_id, :user_id, :org_id, UTC_TIMESTAMP(), 0)",
    params! {
      "transcript_id" => transcript_id,
      "user_id" => user_id,
      "org_id" => org_id,
    },
  )
  .await?;

  tx.commit().await?;

  return Ok(false);
}

async fn is_transcript_finished(conn: &mut Conn, transcript_id: u64) -> Result<bool, StatusCode> {
  let rows = r"SELECT transcribe_finished FROM transcripts WHERE id = :transcript_id;"
    .with(params! {
      "transcript_id" => transcript_id,
    })
    .map(&mut *conn, |transcribe_finished: i32| transcribe_finished)
    .await
    .map_and_log_err(
      "failed to get transcribe finished",
      StatusCode::INTERNAL_SERVER_ERROR,
    )?;

  info!("transcript finished: {:?}", rows);

  return Ok(rows.len() == 1 && rows[0] == 1);
}

async fn get_full_duration_since_transcribe_started(
  conn: &mut Conn,
  transcript_id: u64,
) -> anyhow::Result<Option<DateTime<Utc>>> {
  let rows =
    r"SELECT dateCreated FROM transcripts WHERE id = :transcript_id AND was_paywalled = 0;"
      .with(params! {
        "transcript_id" => transcript_id,
      })
      .map(&mut *conn, |date_created: NaiveDateTime| date_created)
      .await?;

  if rows.is_empty() {
    // The paywall was seen so don't log the duration because it includes time spent paying/deliberting/etc.
    return Ok(None);
  }

  let date_created = rows[0];
  return Ok(Some(Utc.from_utc_datetime(&date_created)));
}

async fn update_minutes_db(
  conn: &mut Conn,
  transcript_id: u64,
  user_id: &str,
  minutes: &str,
  oracle_feedback: &str,
  outline: &str,
) -> Result<(), StatusCode> {
  r#"UPDATE minutes SET minutes = :minutes, oracle_feedback = :oracle_feedback, outline = :outline 
      WHERE transcript_id = :transcript_id AND user_id = :user_id AND fast_mode = 0;"#
    .with(params! {
      "transcript_id" => transcript_id,
      "user_id" => user_id,
      "minutes" => minutes,
      "oracle_feedback" => oracle_feedback,
      "outline" => outline,
    })
    .ignore(&mut *conn)
    .await
    .map_and_log_err("failure update failed for minutes db", StatusCode::OK)?;
  Ok(())
}

async fn delete_record_from_minutes_db(
  conn: &mut Conn,
  transcript_id: u64,
  user_id: &str,
) -> anyhow::Result<()> {
  return r"DELETE FROM minutes WHERE transcript_id = :transcript_id AND user_id = :user_id"
    .with(params! {
      "transcript_id" => transcript_id,
      "user_id" => user_id,
    })
    .ignore(&mut *conn)
    .await
    .map_err(|e| anyhow::anyhow!("failed to delete from minutes: {}", e));
}

async fn refund_tokens(
  conn: &mut Conn,
  transcript_id: u64,
  user_id: &str,
  token: i32,
) -> anyhow::Result<()> {
  return r"INSERT INTO payments (transcript_id, user_id, credit, action) VALUES (:transcript_id, :user_id, :credit, 'refund')"
    .with(params! {
      "transcript_id" => transcript_id,
      "user_id" => user_id,
      "credit" => token,
    })
    .ignore(&mut *conn)
    .await
    .map_err(|e| anyhow::anyhow!("failed to refund tokens: {}", e));
}

pub async fn call_llm(
  model: String,
  temperature: f32,
  messages: serde_json::Value,
  max_continuations: Option<usize>,
) -> Result<String, MinutesError> {
  use reqwest::Client;
  use tracing::{error, info};

  info!("calling OpenRouter for {}", model);

  let http_client = Client::new();
  let openrouter_key = env::var("OPENROUTER_API_KEY")
    .map_err(|_| MinutesError::NonRetryable("OPENROUTER_API_KEY not found".into()))?;

  let request_body = json!({
    "model": model,
    "messages": messages,
    "temperature": temperature,
    "stream": false,
  });

  let response = http_client
    .post("https://openrouter.ai/api/v1/chat/completions")
    .header("Content-Type", "application/json")
    .header("Authorization", format!("Bearer {}", openrouter_key))
    .json(&request_body)
    .send()
    .await
    .map_err(|e| MinutesError::NonRetryable(format!("Failed to send request: {}", e)))?;

  if !response.status().is_success() {
    let error_text = response
      .text()
      .await
      .map_err(|e| MinutesError::NonRetryable(format!("Failed to get error text: {}", e)))?;
    error!("OpenRouter API error: {}", error_text);
    return Err(MinutesError::NonRetryable(format!(
      "OpenRouter API error: {}",
      error_text
    )));
  }

  info!("Processing response");
  let response_text = response.text().await?.to_string();
  let response_json: serde_json::Value = serde_json::from_str(&response_text)
    .map_err(|e| MinutesError::NonRetryable(format!("JSON parse error: {}", e)))?;

  info!("OpenRouter response: {}", response_text);

  let text = response_json["choices"]
    .as_array()
    .and_then(|arr| arr.first())
    .and_then(|choice| choice.get("message"))
    .and_then(|msg| msg.get("content"))
    .and_then(|c| c.as_str())
    .ok_or_else(|| MinutesError::NonRetryable("Failed to extract text from response".into()))?
    .to_string();

  let finish_reason = response_json["choices"]
    .as_array()
    .and_then(|arr| arr.first())
    .and_then(|choice| choice.get("finish_reason"))
    .and_then(|reason| reason.as_str())
    .unwrap_or("stop");

  let current_continuations = max_continuations.unwrap_or(3);
  if finish_reason == "length" && current_continuations > 0 {
    info!("Response was truncated due to length limit. Continuing generation...");

    let new_messages = if let serde_json::Value::Array(mut message_array) = messages.clone() {
      let assistant_message = json!({
        "role": "assistant",
        "content": text.clone()
      });

      let continuation_message = serde_json::json!({
        "role": "user",
        "content": "The previous response was cut off. Please continue where you left off, completing the remaining content."
      });

      message_array.push(assistant_message);
      message_array.push(continuation_message);
      serde_json::Value::Array(message_array)
    } else {
      return Err(MinutesError::NonRetryable(
        "Failed to create continuation messages".into(),
      ));
    };

    let continuation_future = Box::pin(call_llm(
      model.clone(),
      temperature,
      new_messages,
      Some(current_continuations - 1),
    ));
    let continuation_text = continuation_future.await?;

    return Ok(format!("{}{}", text, continuation_text));
  }

  Ok(text)
}

#[allow(dead_code)]
async fn call_gpt_with_messages(
  messages: serde_json::Value,
  temperature: f32,
) -> anyhow::Result<String> {
  info!("calling gpt for minutes");
  let http_client = Client::new();

  let openai_key = env::var("OPENAI_KEY").expect("OPENAI_KEY not found in env");

  let gpt_response = http_client
    .post("https://api.openai.com/v1/chat/completions")
    .header("Authorization", format!("Bearer {}", openai_key))
    .json(&json!({
      "model": "gpt-4o",
      "messages": messages,
      "temperature": temperature,
    }))
    .send()
    .await?;

  let status = gpt_response.status();

  let response = gpt_response.json::<serde_json::Value>().await?;

  info!("gpt response: {}", response);

  if !status.is_success() {
    error!("GPT error: {}", response);
    return Err(anyhow::anyhow!("GPT error: {}", response));
  }

  let content = match response.get("choices") {
    None => {
      error!("GPT response does not have choices: {}", response);
      return Err(anyhow::anyhow!(
        "GPT response does not have choices: {}",
        response
      ));
    }
    Some(choices) => match choices.get(0) {
      None => {
        error!("GPT response does not have choices[0]: {}", response);
        return Err(anyhow::anyhow!(
          "GPT response does not have choices[0]: {}",
          response
        ));
      }
      Some(choice) => match choice.get("message") {
        None => {
          error!(
            "GPT response does not have choices[0].message: {}",
            response
          );
          return Err(anyhow::anyhow!(
            "GPT response does not have choices[0].message: {}",
            response
          ));
        }
        Some(message) => match message.get("content") {
          None => {
            error!(
              "GPT response does not have choices[0].message.content: {}",
              response
            );
            return Err(anyhow::anyhow!(
              "GPT response does not have choices[0].message.content: {}",
              response
            ));
          }
          Some(content) => content.as_str().expect("gpt result string"),
        },
      },
    },
  };

  // ["choices"][0]["message"]["content"]
  return Ok(content.to_string());
}

#[derive(Serialize, Deserialize, Debug)]
struct Section {
  title: String,
  content: String,
}

#[derive(Serialize, Deserialize, Debug)]
struct MeetingMinutes {
  title: String,
  summary: String,
  sections: Vec<Section>,
}

pub async fn get_meeting_notes(
  conn: &mut Conn,
  transcript_id: u64,
  user_id: &str,
) -> anyhow::Result<Option<String>> {
  info!(
    "Querying for meeting notes: transcript_id={}, user_id={}",
    transcript_id, user_id
  );

  let result = r"SELECT outline FROM minutes WHERE transcript_id = :transcript_id AND user_id = :user_id ORDER BY id DESC LIMIT 1;"
    .with(params! {
      "transcript_id" => transcript_id,
      "user_id" => user_id,
    })
    .map(conn, |outline: Option<String>| outline)
    .await?;

  if result.is_empty() || result[0].is_none() || result[0].as_ref().unwrap().is_empty() {
    info!(
      "No meeting notes found in db for transcript_id={}",
      transcript_id
    );
    return Ok(None);
  }

  info!(
    "Found meeting notes in db for transcript_id={}",
    transcript_id
  );
  return Ok(result[0].clone());
}

pub async fn get_oracle_feedback(
  conn: &mut Conn,
  transcript_id: u64,
  user_id: &str,
) -> anyhow::Result<Option<String>> {
  info!(
    "Querying for oracle feedback: transcript_id={}, user_id={}",
    transcript_id, user_id
  );

  let result = r"SELECT oracle_feedback FROM minutes WHERE transcript_id = :transcript_id AND user_id = :user_id ORDER BY id DESC LIMIT 1;"
    .with(params! {
      "transcript_id" => transcript_id,
      "user_id" => user_id,
    })
    .map(conn, |feedback: Option<String>| feedback)
    .await?;

  if result.is_empty() || result[0].is_none() || result[0].as_ref().unwrap().is_empty() {
    info!(
      "No oracle feedback found in db for transcript_id={}",
      transcript_id
    );
    return Ok(None);
  }

  info!(
    "Found oracle feedback in db for transcript_id={}",
    transcript_id
  );
  return Ok(result[0].clone());
}

pub async fn create_minutes_fast(
  conn: &mut Conn,
  state: Arc<SharedRequestState>,
  transcript_id: u64,
  user_id: &str,
  upload_kind: String,
  extension: &str,
  region: String,
  test_mode: bool,
) -> Result<(), MinutesError> {
  PostHogEventType::CreateMinutesStarted.capture(
    user_id.to_string(),
    json!({
      "transcript_id": transcript_id,
      "upload_kind": upload_kind,
      "is_streaming": false,
    }),
  );

  let timer = Arc::new(SpanTimer::new());
  timer.start(TimeSpanEvent::CreateMinutes);

  info!("create_minutes_fast: transcript_id={}", transcript_id);

  // Check for the GC-finetuned feature flag
  if let Ok(true) = crate::posthog::check_feature_flag(user_id, "mg-finetuned").await {
    info!(
      "Using finetuned model for transcript_id={} (mg-finetuned flag enabled)",
      transcript_id
    );

    return generate_minutes_with_finetuned_model(
      state.clone(),
      conn,
      transcript_id,
      user_id,
      &upload_kind,
      extension,
      region.clone(),
      test_mode,
    )
    .await;
  }

  let ctx = Ctx {
    state: state.clone(),
    user_id,
    transcript_id,
    upload_kind: &upload_kind,
    region: &region,
    test_mode,
  };

  if upload_kind == "image" {
    let pipeline = make_pipeline![ImageToMeetingNotesStep, ImageFinalMinutesStep];

    pipeline
      .framework_run((), &ctx)
      .await
      .map_err(|e| MinutesError::Retryable(format!("Error running minutes pipeline: {}", e)))?;
  } else {
    let transcript_str = get_transcript_str(
      state.clone(),
      conn,
      transcript_id,
      &upload_kind,
      extension,
      region.to_string(),
      test_mode,
      false, // fast_mode
    )
    .await
    .map_err(|e| MinutesError::Retryable(e.to_string()))?;

    let pipeline = make_pipeline![
      MeetingNotesStep,
      FirstDraftStep,
      OracleFeedbackStep,
      FinalMinutesStep,
    ];

    pipeline
      .framework_run(crate::minutes::pipeline::Transcript(transcript_str), &ctx)
      .await
      .map_err(|e| MinutesError::Retryable(format!("Error running minutes pipeline: {}", e)))?;
  }

  let duration_since_transcribe_started =
    get_full_duration_since_transcribe_started(conn, transcript_id)
      .await?
      .map(|created_at| {
        Utc::now()
          .signed_duration_since(created_at)
          .num_milliseconds()
      });

  if let Err(e) = send_request(GcWebhookEvent::SendMinutesFinishedEmail { transcript_id }).await {
    error!("Failed to send webhook event: {}", e);
  }

  PostHogEventType::CreateMinutesFinished.capture(
    user_id.to_string(),
    json!({
      "transcript_id": transcript_id,
      "duration": timer.stop(TimeSpanEvent::CreateMinutes).map(|d| d.as_secs()),
      "is_streaming": false,
      "upload_kind": upload_kind,
      "duration_since_transcribe_started": duration_since_transcribe_started,
    }),
  );

  Ok(())
}

pub async fn start_minutes_creation(
  user_id: String,
  state: Arc<SharedRequestState>,
  transcript_id: u64,
  upload_kind: String,
  test_mode: bool,
) -> Result<bool, StatusCode> {
  info!(
    "start_minutes_creation: transcript_id: {}, upload_kind: {}, test_mode: {}",
    transcript_id, upload_kind, test_mode
  );

  let mut conn = state
    .db
    .get_conn()
    .await
    .map_and_log_err("failed to connect to db", StatusCode::INTERNAL_SERVER_ERROR)?;

  if upload_kind != "audio" {
    // TODO: Re-enable token check for text uploads once billing is set up for portal
    let skip_token_check = upload_kind == "text";

    let tokens_required = if skip_token_check { 0 } else { 50 };

    let current_balance = match get_current_balance(&mut conn, user_id.clone()).await {
      Ok(balance) => balance,
      Err(e) => {
        error!("Error getting current balance: {}", e);
        return Err(StatusCode::INTERNAL_SERVER_ERROR);
      }
    };

    let insufficient_tokens = !skip_token_check && tokens_required > current_balance;

    r"
      UPDATE transcripts SET
        credits_required = :credits_required,
        transcribe_paused = :transcribe_paused, 
        insufficient_tokens = :insufficient_tokens,
        was_paywalled = :was_paywalled
      WHERE id = :transcript_id
    "
    .with(params! {
      "credits_required" => tokens_required,
      "transcribe_paused" => insufficient_tokens,
      "insufficient_tokens" => insufficient_tokens,
      "was_paywalled" => insufficient_tokens,
      "transcript_id" => transcript_id,
    })
    .ignore(&mut conn)
    .await
    .map_and_log_err("failed to update token requirements", StatusCode::OK)?;

    if insufficient_tokens {
      PostHogEventType::TranscribePaused.capture(
        user_id.clone(),
        json!({
          "transcript_id": transcript_id,
          "tokens_required": tokens_required,
          "current_balance": current_balance,
          "upload_kind": upload_kind,
        }),
      );

      r"
        UPDATE transcripts SET
          upload_complete = 1 
        WHERE 
          id = :transcript_id AND
          userId = :user_id AND
          (upload_kind = 'text' OR upload_kind = 'word')
      "
      .with(params! { "transcript_id" => transcript_id, "user_id" => user_id.clone() })
      .ignore(&mut conn)
      .await
      .map_and_log_err("failed to update upload_complete", StatusCode::OK)?;

      return Ok(false);
    }

    r"
      UPDATE transcripts SET
        transcribe_finished = 1, 
        preview_transcribe_finished = 1,
        upload_complete = 1 
      WHERE 
        id = :transcript_id AND
        upload_complete = 1 AND 
        userId = :user_id AND
        (upload_kind = 'text' OR upload_kind = 'word')
    "
    .with(params! { "transcript_id" => transcript_id, "user_id" => user_id.clone() })
    .ignore(&mut conn)
    .await
    .map_and_log_err("failed to update transcribe_finished", StatusCode::OK)?;
  }

  if !is_transcript_finished(&mut conn, transcript_id).await? {
    error!("transcript not finished for transcript {}", transcript_id);
    return Ok(false);
  }

  let already_started = start_minutes_if_needed(&mut conn, transcript_id, &user_id.clone())
    .await
    .map_and_log_err(
      "failed to check if minutes in flight",
      StatusCode::INTERNAL_SERVER_ERROR,
    )?;

  if already_started {
    info!("minutes already in flight for transcript {}", transcript_id);
    return Ok(false);
  }

  let balance = get_current_balance(&mut conn, user_id.clone())
    .await
    .map_and_log_err(
      "could not get balance in create minutes",
      StatusCode::INTERNAL_SERVER_ERROR,
    )?;

  let rows = "
    SELECT
      credits_required,
      aws_region,
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
    |(tokens_required, aws_region, extension): (i32, String, Option<String>)| {
      (tokens_required, aws_region, extension)
    },
  )
  .await
  .map_and_log_err(
    "failed to get tokens required",
    StatusCode::INTERNAL_SERVER_ERROR,
  )?;

  let (tokens_required, _region, extension) = rows[0].clone();

  // Token are deducted when minutes generated for non-audio uploads only.
  // For audio uploads, tokens are deducted when the transcript is created.
  if upload_kind != "audio" {
    if tokens_required > balance {
      warn!(
        "user {} does not have enough tokens to create minutes for transcript {}",
        user_id.clone(),
        transcript_id
      );
      return Ok(false); // Not enough tokens, skip auto-creation
    }

    // If we made it here, the user has enough token, so deduct from their
    // balance and generate their minutes

    r"INSERT INTO payments (transcript_id, user_id, credit, action) VALUES (:transcript_id, :user_id, :credit, 'sub')"
    .with(params! {
      "transcript_id" => transcript_id,
      "user_id" => user_id.clone(),
      "credit" => -tokens_required,
    })
    .ignore(&mut conn)
    .await
    .map_and_log_err(
      "failed to insert into payments in create minutes",
      StatusCode::INTERNAL_SERVER_ERROR,
    )?;
  }
  // Note: For audio uploads, we don't need a separate token check here
  // because insufficient_tokens flag in get_diarization.rs already prevents
  // on_transcribe_finished from being called if tokens are insufficient

  let extension = extension.unwrap_or_default();

  let user_id_clone = user_id.clone();
  let upload_kind_clone = upload_kind.clone();
  let counter_clone = Arc::clone(&state.pending_tasks_counter);

  tokio::spawn(async move {
    // Keep track of pending task, when dropped it will decrement the counter
    let _tracker = TaskTracker::new(counter_clone);

    let mut conn = match state.db.get_conn().await {
      Ok(conn) => conn,
      Err(e) => {
        error!("Failed to get database connection: {}", e);
        return;
      }
    };

    let region = match r"SELECT aws_region FROM transcripts WHERE id = :transcript_id;"
      .with(params! {
        "transcript_id" => transcript_id,
      })
      .map(&mut conn, |aws_region: String| aws_region)
      .await
    {
      Ok(rows) => {
        if rows.is_empty() {
          error!("Could not find region for transcript {}", transcript_id);
          return;
        }
        rows[0].clone()
      }
      Err(e) => {
        error!("Failed to get region: {}", e);
        return;
      }
    };

    let mut retries = 1;
    while retries >= 0 {
      let state_clone = state.clone();

      info!("Retries left: {}", retries);

      match create_minutes_fast(
        &mut conn,
        state_clone,
        transcript_id,
        &user_id_clone,
        upload_kind_clone.clone(),
        &extension,
        region.clone(),
        test_mode,
      )
      .await
      {
        Ok(()) => {
          info!("Finished create minutes for transcript {}", transcript_id);
          return;
        }
        Err(MinutesError::Retryable(e)) => {
          error!("Retryable error handler: {}", e);
          retries -= 1;
          continue;
        }
        Err(MinutesError::NonRetryable(e)) => {
          error!("Non-retryable error handler: {}", e);
          PostHogEventType::CreateMinutesErrored.capture(
            user_id_clone.clone(),
            json!({
              "transcript_id": transcript_id,
              "upload_kind": upload_kind_clone,
            }),
          );
          break;
        }
        Err(MinutesError::Json(e)) => {
          error!("JSON error handler: {}", e);
          break;
        }
      };
    }

    // Execution reaches here when all retries are exhausted.  Then we need to refund.
    if let Err(e) = refund_tokens(&mut conn, transcript_id, &user_id_clone, tokens_required).await
    {
      error!("Failed to refund tokens: {}", e);
    }

    if let Err(e) = delete_record_from_minutes_db(&mut conn, transcript_id, &user_id_clone).await {
      error!("Failed to delete record from minutes db: {}", e);
    }
  });

  PostHogEventType::AutoMinutesCreated.capture(
    user_id.clone(),
    json!({
      "transcript_id": transcript_id,
      "upload_kind": upload_kind.clone(),
    }),
  );

  return Ok(true);
}

/// Generates minutes using the fine-tuned GPT model
async fn generate_minutes_with_finetuned_model(
  state: Arc<SharedRequestState>,
  conn: &mut Conn,
  transcript_id: u64,
  user_id: &str,
  upload_kind: &str,
  extension: &str,
  region: String,
  test_mode: bool,
) -> Result<(), MinutesError> {
  for step in [
    MinutesPipelineStep::MeetingNotes,
    MinutesPipelineStep::FirstDraft,
    MinutesPipelineStep::OracleFeedback,
    MinutesPipelineStep::FinalMinutes,
  ] {
    save_step_state(conn, transcript_id, user_id, &step, &StepStatus::InProgress)
      .await
      .ok();
  }

  let transcript_str = match get_transcript_str(
    state.clone(),
    conn,
    transcript_id,
    upload_kind,
    extension,
    region,
    test_mode,
    false, // fast_mode
  )
  .await
  {
    Ok(str) => str,
    Err(err) => {
      error!("Error getting transcript string: {:?}", err);
      return Err(MinutesError::NonRetryable(err.to_string()));
    }
  };

  let system_prompt = render_final_minutes_system().map_err(|e| {
    MinutesError::Retryable(format!(
      "Failed to render final minutes system prompt: {}",
      e
    ))
  })?;
  let finetuned_prompt = render_finetuned_minutes_prefix(&FinetunedPromptData {
    transcript: transcript_str.clone(),
    upload_kind: Some(upload_kind.to_string()),
    is_audio_upload: upload_kind == "audio",
  })
  .map_err(|e| {
    MinutesError::Retryable(format!("Failed to render finetuned minutes prompt: {}", e))
  })?;

  let messages = vec![
    serde_json::json!({
      "role": "system",
      "content": system_prompt
    }),
    serde_json::json!({
      "role": "user",
      "content": finetuned_prompt
    }),
  ];

  let openai_key = env::var("OPENAI_KEY").expect("OPENAI_KEY not found in environment");
  let client = reqwest::Client::new();

  let openai_request = serde_json::json!({
    "model": "ft:gpt-4.1-2025-04-14:GovClerkMinutes:mg-051925-r27:BYvmGnuK:ckpt-step-29",
    "messages": messages,
    "temperature": 0.2,
  });

  let final_minutes_result = client
    .post("https://api.openai.com/v1/chat/completions")
    .header("Content-Type", "application/json")
    .header("Authorization", format!("Bearer {}", openai_key))
    .json(&openai_request)
    .send()
    .await
    .map_err(|e| MinutesError::NonRetryable(format!("Failed to send request to OpenAI: {}", e)))?;

  if !final_minutes_result.status().is_success() {
    let error_text = final_minutes_result.text().await.map_err(|e| {
      MinutesError::NonRetryable(format!("Failed to get error text from OpenAI: {}", e))
    })?;
    error!("OpenAI API error: {}", error_text);
    return Err(MinutesError::NonRetryable(format!(
      "OpenAI API error: {}",
      error_text
    )));
  }

  let response_json: serde_json::Value = final_minutes_result
    .json()
    .await
    .map_err(|e| MinutesError::NonRetryable(format!("Failed to parse OpenAI response: {}", e)))?;

  let content = response_json["choices"][0]["message"]["content"]
    .as_str()
    .ok_or_else(|| {
      MinutesError::NonRetryable("Failed to get content from OpenAI response".to_string())
    })?
    .to_string();

  let final_minutes = content;

  if let Err(e) = update_minutes_db(conn, transcript_id, user_id, &final_minutes, "", "").await {
    error!("Failed to update minutes DB: {:?}", e);
    return Err(MinutesError::Retryable(format!(
      "Failed to update minutes DB: {}",
      e
    )));
  }

  for step in [
    MinutesPipelineStep::MeetingNotes,
    MinutesPipelineStep::FirstDraft,
    MinutesPipelineStep::OracleFeedback,
    MinutesPipelineStep::FinalMinutes,
  ] {
    save_step_state(conn, transcript_id, user_id, &step, &StepStatus::Success)
      .await
      .ok();
  }

  if let Err(e) = send_request(GcWebhookEvent::SendMinutesFinishedEmail { transcript_id }).await {
    error!("Failed to send webhook event: {}", e);
  }

  PostHogEventType::CreateMinutesFinished.capture(
    user_id.to_string(),
    json!({
      "transcript_id": transcript_id,
      "upload_kind": upload_kind,
      "is_streaming": false,
      "used_finetuned_model": true,
    }),
  );

  Ok(())
}

/// Assembles and returns a String that is the transcript of the meeting.
///
/// Note: If the upload_kind is "word", this string will be HTML.  Sometimes a
/// Word document can have images, but this function strips out <img> tags
/// because we don't want to pass them to the model.
pub async fn get_transcript_str(
  state: Arc<SharedRequestState>,
  conn: &mut Conn,
  transcript_id: u64,
  upload_kind: &str,
  extension: &str,
  region: String,
  test_mode: bool,
  fast_mode: bool,
) -> Result<String, anyhow::Error> {
  let transcript_str = if upload_kind == "audio" {
    let transcript = Transcript::from_db(conn, transcript_id, fast_mode).await?;

    transcript
      .segments
      .iter()
      .filter_map(|segment| {
        segment.transcript.as_ref()?;
        let speaker = &segment.speaker;
        let text = segment.transcript.as_ref().unwrap();
        Some(format!("{}: {}", speaker, text))
      })
      .collect::<Vec<String>>()
      .join("\n")
  } else if upload_kind == "text" {
    let object = get_object(
      state.clone(),
      region,
      get_upload_key(transcript_id, test_mode),
    )
    .await
    .map_err(|e| anyhow::anyhow!("failed to get s3 object in create minutes: {}", e))?;

    String::from_utf8(
      object
        .body
        .collect()
        .await
        .map_err(|e| anyhow::anyhow!("failed to collect s3 object body in create minutes: {}", e))?
        .into_bytes()
        .to_vec(),
    )
    .map_err(|e| {
      anyhow::anyhow!(
        "failed to collect into utf8 string in create minutes: {}",
        e
      )
    })?
  } else if upload_kind == "word" {
    let object = get_object(
      state.clone(),
      region,
      get_upload_key(transcript_id, test_mode),
    )
    .await
    .map_err(|e| anyhow::anyhow!("failed to get s3 object in create minutes: {}", e))?;

    let file_bytes = object
      .body
      .collect()
      .await
      .map_err(|e| anyhow::anyhow!("failed to collect s3 object body in create minutes: {}", e))?
      .into_bytes()
      .to_vec();

    let html_bytes = pandoc::convert(
      file_bytes,
      pandoc::OutputFormat::Html,
      pandoc::InputFormat::from_extension(extension)?,
    )
    .await?;

    let html_transcript = String::from_utf8(html_bytes)?;

    let html_transcript_without_imgs = remove_igc_tags(&html_transcript)?;

    info!(html_transcript_without_imgs);

    html_transcript_without_imgs
  } else {
    return Err(anyhow::anyhow!("invalid upload_kind: {}", upload_kind));
  };

  Ok(transcript_str)
}

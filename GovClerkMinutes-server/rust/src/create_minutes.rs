use anyhow::Context;
use axum::{
  extract::{Json, State},
  response::IntoResponse,
  Extension,
};
use http::StatusCode;
use mysql_async::{
  params,
  prelude::{Query, WithParams},
  Conn,
};
use reqwest::Client;
use reqwest::Error as ReqwestError;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{collections::HashMap, env, sync::Arc};
use tempfile::NamedTempFile;
use tokio::{io::AsyncWriteExt, process::Command};
use tracing::{error, info, warn};

use crate::{
  error::LogError, get_current_balance::get_current_balance, posthog::PostHogEventType,
  task_tracker::TaskTracker, transcript::Transcript, SharedRequestState, UserId,
};

pub const GPT_CREATE_MINUTES_PROMPT_SYSTEM: &'static str = r###"You are the world's best administrative assistant. You have won awards for your attention to detail. You are responsible for outputting extraordinarily detailed, beautiful, high quality, comprehensive, informative, praise-worthy, lengthy, and impressive meeting minutes in markdown format. You will be given a transcript of a meeting as input. Your output must be only a markdown document."###;
// const GPT_CREATE_MINUTES_PROMPT_PREFIX: &'static str = r###"Below is the transcript of the meeting that you will summarize into meeting minutes formatted as markdown. Include extremely relevant pull quotes from the transcript to give the reader context and help them understand the meeting. Be detailed, write a lot, ensure all topics from the conversation are included as sections in the document. Do not omit topics from the transcript in your meeting minutes. You should make heavy use of bullet points in your document for maximum clarity. You should include sections for Attendees, and for Key Takeaways, and for Next Steps. These minutes must be the most perfect, extraordinary, accurate, lengthy, comprehensive and precise document ever. These minutes must be so good they get the admin responsible for them promoted. No need to prefix with '```markdown'. The transcript to summarize is:"###;
pub const GPT_CREATE_MINUTES_PROMPT_PREFIX: &'static str = r###"Below is the transcript of the meeting that you will summarize into meeting minutes formatted as markdown. Be detailed, write a lot, ensure all topics from the conversation are included as sections in the document. You should make heavy use of bullet points in your document for maximum clarity. Bullet points generally should start with the name of the speaker, like 'Sherman explained that ...' or 'Carver presented a draft of ...'. Do NOT bold names. If you include date, time and location, leave placeholders for them. You should include sections for Attendees, and for Key Takeaways, and for Next Steps. These minutes must be the most perfect, extraordinary, accurate, lengthy, comprehensive and precise document ever. These minutes must be so good they get the admin responsible for them promoted. No need to prefix with '```markdown'. The transcript to summarize is:"###;

#[derive(Debug)]
pub enum MinutesError {
  RetryableError(String),
  NonRetryableError(String),
  JsonError(serde_json::Error),
}

impl From<anyhow::Error> for MinutesError {
  fn from(err: anyhow::Error) -> Self {
    MinutesError::NonRetryableError(err.to_string())
  }
}

impl From<ReqwestError> for MinutesError {
  fn from(err: ReqwestError) -> Self {
    MinutesError::NonRetryableError(err.to_string())
  }
}

impl From<serde_json::Error> for MinutesError {
  fn from(err: serde_json::Error) -> Self {
      MinutesError::JsonError(err)
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

async fn is_minutes_in_flight(
  conn: &mut Conn,
  transcript_id: u64,
  user_id: &str,
) -> Result<bool, StatusCode> {
  let rows =
    r"SELECT COUNT(1) FROM minutes WHERE transcript_id = :transcript_id AND user_id = :user_id;"
      .with(params! {
        "transcript_id" => transcript_id,
        "user_id" => user_id,
      })
      .map(&mut *conn, |count: usize| count)
      .await
      .map_and_log_err(
        "failed to get count of minutes",
        StatusCode::INTERNAL_SERVER_ERROR,
      )?;

  return Ok(rows.len() != 1 || rows[0] != 0);
}

async fn is_transcript_finished(
  conn: &mut Conn,
  transcript_id: u64,
  user_id: &str,
) -> Result<bool, StatusCode> {
  let rows =
    r"SELECT transcribe_finished FROM transcripts WHERE id = :transcript_id AND userId = :user_id;"
      .with(params! {
        "transcript_id" => transcript_id,
        "user_id" => user_id,
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

async fn update_minutes_db(
  conn: &mut Conn,
  transcript_id: u64,
  user_id: &str,
  minutes: &str,
) -> Result<(), StatusCode> {
  r"UPDATE minutes SET minutes = :minutes WHERE transcript_id = :transcript_id AND user_id = :user_id;"
      .with(params! {
        "transcript_id" => transcript_id,
        "user_id" => user_id,
        "minutes" => minutes,
      })
      .ignore(&mut *conn)
      .await
      .map_and_log_err("failure update failed for minutes db", StatusCode::OK)?;

  return Ok(());
}

async fn insert_record_into_minutes_db(
  conn: &mut Conn,
  transcript_id: u64,
  user_id: &str,
  org_id: Option<String>,
) -> Result<(), StatusCode> {
  return r"INSERT INTO minutes (transcript_id, user_id, org_id, ts_start) VALUES (:transcript_id, :user_id, :org_id, UTC_TIMESTAMP())"
    .with(params! {
      "transcript_id" => transcript_id,
      "user_id" => user_id,
      "org_id" => org_id,
    })
    .ignore(&mut *conn)
    .await
    .map_and_log_err(
      "failed to insert into minutes",
      StatusCode::INTERNAL_SERVER_ERROR,
    );
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


pub async fn call_gemini(
  system_prompt: String,
  temperature: f32,
  messages: serde_json::Value,
) -> Result<String, MinutesError> {
  info!("calling gemini for minutes");
  let http_client = Client::new();

  let key = env::var("GEMINI_PRO_15_API_KEY").expect("GEMINI_PRO_15_API_KEY not found in env");

  let response = http_client
      .post(format!("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}"))
      .header("Content-Type", "application/json")
      .json(&json!({
          "generationConfig": {
              "temperature": temperature,
              "maxOutputTokens": 8000,
          },
          "systemInstruction": {
              "parts": [
                  {
                      "text": system_prompt
                  }
              ]
          },
          "contents": messages
      }))
      .send()
      .await?;

  let status = response.status();
  let response_text = response.text().await?;
  let response_json: serde_json::Value = serde_json::from_str(&response_text)?;

  info!("gemini response: {}", response_text);
  info!("Response JSON structure: {:?}", response_json);

  if status.is_server_error() {
      return Err(MinutesError::RetryableError(format!(
          "gemini server error: {}",
          response_text
      )));
  }

  if !status.is_success() {
      return Err(anyhow::anyhow!("gemini error: {}", response_text).into());
  }

  let text = response_json["candidates"]
      .as_array()
      .and_then(|candidates| candidates.get(0))
      .and_then(|candidate| {
          candidate["content"]["parts"]
              .as_array()
              .and_then(|parts| parts.get(0))
              .and_then(|part| part["text"].as_str())
      })
      .ok_or_else(|| anyhow::anyhow!("Failed to extract text from response"))?
      .to_string();

  return Ok(text);
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

pub async fn get_speakers(
  conn: &mut Conn,
  transcript_id: u64,
  user_id: &str,
) -> anyhow::Result<HashMap<String, String>> {
  let rows = r"SELECT label, name FROM speakers WHERE transcriptId = :id AND userId = :user_id;"
    .with(params! {
      "id" => transcript_id,
      "user_id" => user_id,
    })
    .map(&mut *conn, |(label, name): (String, String)| (label, name))
    .await?;

  let mut speakers = HashMap::new();
  for (label, name) in rows {
    speakers.insert(label, name);
  }
  return Ok(speakers);
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

pub async fn create_minutes_fast(
  mut conn: &mut Conn,
  state: Arc<SharedRequestState>,
  transcript_id: u64,
  user_id: &str,
  upload_kind: String,
  test_mode: bool,
) -> Result<(), MinutesError> {
  PostHogEventType::CreateMinutesStarted.capture(
    user_id.to_string(),
    json!({
      "transcript_id": transcript_id,
      "upload_kind": upload_kind,
    }),
  );

  let start = chrono::Utc::now();

  let transcript_str = match get_transcript_str(state.clone(), &mut conn, transcript_id, user_id, &upload_kind, test_mode).await {
    Ok(str) => str,
    Err(err) => {
      error!("Error getting transcript string: {:?}", err);
      return Err(MinutesError::NonRetryableError(err.to_string()));
    }
  };

  let messages = json!([
    {
      "role": "user",
      "parts": [
        {
          "text": GPT_CREATE_MINUTES_PROMPT_PREFIX.to_owned() + "\n\n" + &transcript_str
        }
      ]
    }
  ]);

  let initial_response = call_gemini(
      GPT_CREATE_MINUTES_PROMPT_SYSTEM.to_owned(),
      0.3,
      messages,
    )
    .await?;

  r"UPDATE minutes SET ts_first_gpt = UTC_TIMESTAMP() WHERE transcript_id = :transcript_id AND user_id = :user_id;"
    .with(params! {
      "transcript_id" => transcript_id,
      "user_id" => user_id,
    })
    .ignore(&mut *conn)
    .await.map_err(|e| {
      error!("failure update failed for minutes db: {}", e);
      MinutesError::NonRetryableError(e.to_string())
    })?;

  let minutes = initial_response;

  update_minutes_db(&mut conn, transcript_id, &user_id, &minutes)
    .await
    .map_err(|e| {
      error!("failure update failed for minutes db: {}", e);
      MinutesError::NonRetryableError(e.to_string())
    })?;

  PostHogEventType::CreateMinutesFinished.capture(
    user_id.to_string(),
    json!({
      "transcript_id": transcript_id,
      "duration": chrono::Utc::now().signed_duration_since(start).num_seconds(),
    }),
  );

  Ok(())
}

pub async fn create_minutes_handler(
  Extension(UserId(user_id)): Extension<UserId>,
  State(state): State<Arc<SharedRequestState>>,
  Json(CreateMinutesBody {
    transcript_id,
    upload_kind,
    test_mode,
  }): Json<CreateMinutesBody>,
) -> Result<impl IntoResponse, StatusCode> {
  let mut conn = state
    .db
    .get_conn()
    .await
    .map_and_log_err("failed to connect to db", StatusCode::INTERNAL_SERVER_ERROR)?;

  if !is_transcript_finished(&mut conn, transcript_id, &user_id).await? {
    error!("transcript not finished for transcript {}", transcript_id);
    return Err(StatusCode::BAD_REQUEST);
  }

  if is_minutes_in_flight(&mut conn, transcript_id, &user_id).await? {
    error!("minutes already in flight for transcript {}", transcript_id);
    return Err(StatusCode::BAD_REQUEST);
  }

  // Token are deducted when minutes generated for non-audio uploads only.
  // For audio uploads, tokens are deducted when the transcript is created.
  let mut tokens_required = None;

  if upload_kind != "audio" {
    let balance = get_current_balance(&mut conn, user_id.clone())
      .await
      .map_and_log_err(
        "could not get balance in create minutes",
        StatusCode::INTERNAL_SERVER_ERROR,
      )?;

    let rows =
      r"SELECT credits_required FROM transcripts WHERE id = :transcript_id AND userId = :user_id;"
        .with(params! {
          "transcript_id" => transcript_id,
          "user_id" => user_id.clone(),
        })
        .map(&mut conn, |tokens_required: i32| tokens_required)
        .await
        .map_and_log_err(
          "failed to get tokens required",
          StatusCode::INTERNAL_SERVER_ERROR,
        )?;

    tokens_required = Some(rows[0]);

    if tokens_required.unwrap() > balance {
      warn!(
        "user {} does not have enough tokens to create minutes for transcript {}",
        user_id.clone(),
        transcript_id
      );
      return Err(StatusCode::BAD_REQUEST);
    }

    // If we made it here, the user has enough token, so deduct from their
    // balance and generate their minutes

    r"INSERT INTO payments (transcript_id, user_id, credit, action) VALUES (:transcript_id, :user_id, :credit, 'sub')"
    .with(params! {
      "transcript_id" => transcript_id,
      "user_id" => user_id.clone(),
      "credit" => -tokens_required.unwrap(),
    })
    .ignore(&mut conn)
    .await
    .map_and_log_err(
      "failed to insert into payments in create minutes",
      StatusCode::INTERNAL_SERVER_ERROR,
    )?;
  }

  // TODO: insert upload_kind into minutes DB
  let org_id_rows = r"SELECT org_id FROM transcripts WHERE id = :transcript_id"
    .with(params! {
      "transcript_id" => transcript_id,
    })
    .map(&mut conn, |org_id: Option<String>| org_id)
    .await
    .map_and_log_err("failed to get org_id", StatusCode::INTERNAL_SERVER_ERROR)?;
  let org_id: Option<String> = org_id_rows.into_iter().next().flatten();
  insert_record_into_minutes_db(&mut conn, transcript_id, &user_id, org_id).await?;

  let counter_clone = Arc::clone(&state.pending_tasks_counter);
  tokio::spawn(async move {
    // Keep track of pending task, when dropped it will decrement the counter
    let _tracker = TaskTracker::new(counter_clone);

    let mut retries = 1;
    while retries >= 0 {
      let state_clone = state.clone();

      info!("Retries left: {}", retries);

      match create_minutes_fast(
        &mut conn,
        state_clone,
        transcript_id,
        &user_id,
        upload_kind.clone(),
        test_mode,
      )
      .await
      {
        Ok(()) => {
          info!("Finished create minutes for transcript {}", transcript_id);
          return;
        }
        Err(MinutesError::RetryableError(e)) => {
          error!("Retryable error handler: {}", e);
          retries -= 1;
          continue;
        }
        Err(MinutesError::NonRetryableError(e)) => {
          error!("Non-retryable error handler: {}", e);
          PostHogEventType::CreateMinutesErrored.capture(
            user_id.clone(),
            json!({
              "transcript_id": transcript_id,
              "upload_kind": upload_kind,
            }),
          );
          break;
        }
        Err(MinutesError::JsonError(e)) => {
          error!("JSON error handler: {}", e);
          break;
        }
      };
    }

    // Execution reaches here when all retries are exhausted.  Then we need to refund.
    if tokens_required.is_some() {
      if let Err(e) = refund_tokens(
        &mut conn,
        transcript_id,
        &user_id,
        tokens_required.unwrap(),
      )
      .await
      {
        error!("Failed to refund tokens: {}", e);
      }
    }

    if let Err(e) = delete_record_from_minutes_db(&mut conn, transcript_id, &user_id).await {
      error!("Failed to delete record from minutes db: {}", e);
    }
  });

  return Ok(axum::response::Json(CreateMinutesResponse {}));
}

pub async fn get_transcript_str(
  state: Arc<SharedRequestState>,
  conn: &mut Conn,
  transcript_id: u64,
  user_id: &str,
  upload_kind: &str,
  test_mode: bool,
) -> Result<String, anyhow::Error> {
  let transcript_str = if upload_kind == "audio" {
      let speakers = get_speakers(conn, transcript_id, user_id).await?;
      let transcript = Transcript::from_db(conn, transcript_id, user_id).await?;

      transcript
          .segments
          .iter()
          .filter_map(|segment| {
              if let None = &segment.transcript {
                  return None;
              }
              let mut name = &segment.speaker;
              if let Some(mapped_name) = speakers.get(&segment.speaker) {
                  name = mapped_name;
              }
              let text = segment.transcript.as_ref().unwrap();
              Some(format!("{}: {}", name, text))
          })
          .collect::<Vec<String>>()
          .join("\n")
  } else if upload_kind == "text" {
      let object = state
          .s3_client
          .get_object()
          .bucket("govclerk-bucket")
          .key(format!(
              "{}uploads/upload_{}",
              if test_mode { "test_" } else { "" },
              transcript_id
          ))
          .send()
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
      .map_err(|e| anyhow::anyhow!("failed to collect into utf8 string in create minutes: {}", e))?
  } else if upload_kind == "word" {
      let object = state
          .s3_client
          .get_object()
          .bucket("govclerk-bucket")
          .key(format!(
              "{}uploads/upload_{}",
              if test_mode { "test_" } else { "" },
              transcript_id
          ))
          .send()
          .await
          .map_err(|e| anyhow::anyhow!("failed to get s3 object in create minutes: {}", e))?;

      let file_bytes = object
          .body
          .collect()
          .await
          .map_err(|e| anyhow::anyhow!("failed to collect s3 object body in create minutes: {}", e))?
          .into_bytes()
          .to_vec();

      let temp_file =
          NamedTempFile::new().map_err(|e| anyhow::anyhow!("failed to create a temp file: {}", e))?;

      let temp_path = temp_file.path().to_owned();

      let mut async_file = tokio::fs::File::create(temp_path.clone())
          .await
          .map_err(|e| anyhow::anyhow!("failed to create/open temp file for writing: {}", e))?;

      async_file
          .write_all(&file_bytes)
          .await
          .map_err(|e| anyhow::anyhow!("failed to write to temp file: {}", e))?;

      let output = Command::new("npx")
          .arg("mammoth")
          .arg("--output-format")
          .arg("html")
          .arg(temp_path)
          .output()
          .await
          .context("Failed to run npx mammoth command")?;

      info!(
          "npx mammoth stderr: {:?}",
          String::from_utf8(output.stderr).unwrap_or("".to_owned())
      );

      if !output.status.success() {
          return Err(anyhow::anyhow!(
              "npx mammoth command failed with status: {:?}",
              output.status
          ));
      }

      String::from_utf8(output.stdout)
          .map_err(|e| anyhow::anyhow!("Failed to convert output to string: {}", e))?
  } else {
      return Err(anyhow::anyhow!("invalid upload_kind: {}", upload_kind));
  };

  Ok(transcript_str)
}
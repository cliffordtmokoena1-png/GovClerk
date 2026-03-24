use crate::create_minutes::call_llm;
use crate::prompt_templates::{
  render_create_agenda_system, render_regenerate_agenda, RegenerateAgendaPromptData,
};
use crate::{SharedRequestState, UserId};
use axum::{
  extract::{Json, State},
  http::StatusCode,
  response::IntoResponse,
  Extension,
};
use mysql_async::prelude::{FromRow, Query as MySqlQuery, Queryable, WithParams};
use mysql_async::{params, Row, TxOpts};
use serde::Deserialize;
use std::sync::Arc;
use tracing::{error, info};

#[derive(Deserialize)]
pub struct RegenerateAgendaRequest {
  pub series_id: String,
  pub feedback: String,
}

#[derive(Debug, Clone)]
pub struct Agenda {
  pub id: u64,
  pub content: Option<String>,
  pub version: i32,
}

impl FromRow for Agenda {
  fn from_row_opt(row: Row) -> Result<Self, mysql_async::FromRowError> {
    let id: u64 = row
      .get("id")
      .ok_or_else(|| mysql_async::FromRowError(row.clone()))?;
    let content: Option<String> = row.get("content");
    let version: i32 = row
      .get("version")
      .ok_or_else(|| mysql_async::FromRowError(row.clone()))?;

    Ok(Agenda {
      id,
      content,
      version,
    })
  }
}

/// Returns the insert id of the pending row, and the agendas created up to this point for this series.
/// Or an error if we can't start a new regeneration.
async fn setup_regeneration(
  conn: &mut mysql_async::Conn,
  series_id: &str,
  user_id: String,
) -> anyhow::Result<(u64, Vec<Agenda>)> {
  let mut tx = conn.start_transaction(TxOpts::default()).await?;

  // Check regeneration limit (max 3 total versions: 1 initial + 2 regenerations)
  let count_result: Vec<(u64,)> = tx
    .exec(
      "SELECT COUNT(1) as cnt FROM agendas WHERE user_id = ? AND series_id = ?",
      (user_id.clone(), series_id),
    )
    .await?;

  if let Some((count,)) = count_result.first() {
    if *count >= 3 {
      return Err(anyhow::anyhow!("Regeneration limit exceeded."));
    }
  }

  let mut agendas: Vec<Agenda> = tx
    .exec(
      "SELECT id, content, version FROM agendas WHERE series_id = ? AND user_id = ? ORDER BY version FOR UPDATE",
      (series_id, user_id.clone()),
    )
    .await?;

  let latest_agenda = agendas
    .last_mut()
    .ok_or(anyhow::anyhow!("No agenda found"))?;

  if latest_agenda.content.is_none() {
    return Err(anyhow::anyhow!(
      "No content found for this agenda. This can happen if there are two requests to this endpoint in rapid succession. Bailing out to avoid duplicate work.",
    ));
  }

  tx.exec_drop(
    "INSERT INTO agendas (series_id, user_id, version, status, source_kind, source_text, title, created_at, updated_at) 
     SELECT series_id, user_id, ? as version, 'pending' as status, source_kind, source_text, title, NOW(), NOW() 
     FROM agendas WHERE id = ?",
    (latest_agenda.version + 1, latest_agenda.id),
  )
  .await?;

  let pending_agenda_id = tx
    .last_insert_id()
    .ok_or(anyhow::anyhow!("no last insert id"))?;

  tx.commit().await?;

  Ok((pending_agenda_id, agendas))
}

pub async fn regenerate_agenda_handler(
  Extension(UserId(user_id)): Extension<UserId>,
  State(state): State<Arc<SharedRequestState>>,
  Json(RegenerateAgendaRequest {
    series_id,
    mut feedback,
  }): Json<RegenerateAgendaRequest>,
) -> Result<impl IntoResponse, StatusCode> {
  feedback = feedback.trim().to_string();

  if feedback.is_empty() {
    return Err(StatusCode::BAD_REQUEST);
  }

  let mut conn = state.db.get_conn().await.map_err(|err| {
    error!("Error getting database connection: {:?}", err);
    StatusCode::INTERNAL_SERVER_ERROR
  })?;

  let (pending_agenda_id, past_agendas) =
    setup_regeneration(&mut conn, &series_id, user_id.clone())
      .await
      .map_err(|err| {
        let error_msg = err.to_string();
        if error_msg.contains("Regeneration limit exceeded") {
          error!(
            "Regeneration limit exceeded for user {} series {}",
            user_id, series_id
          );
          StatusCode::FORBIDDEN
        } else {
          error!("Error setting up regeneration: {:?}", err);
          StatusCode::BAD_REQUEST
        }
      })?;

  let past_agendas_clone = Arc::new(past_agendas);
  let mut retries = 1;
  let mut result = Err("No attempts made".to_string());

  while retries >= 0 {
    info!("Retries left: {}", retries);

    match regenerate_agenda_task(
      state.clone(),
      series_id.clone(),
      user_id.clone(),
      pending_agenda_id,
      past_agendas_clone.clone(),
      feedback.clone(),
    )
    .await
    {
      Ok(_) => {
        info!("Regeneration succeeded for series {}", series_id);
        result = Ok(());
        break;
      }
      Err(err) => {
        error!("Regeneration failed: {}", err);
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
      error!("Final regeneration error: {}", err);
      Err(StatusCode::INTERNAL_SERVER_ERROR)
    }
  }
}

async fn regenerate_agenda_task(
  state: Arc<SharedRequestState>,
  series_id: String,
  user_id: String,
  pending_agenda_id: u64,
  agendas: Arc<Vec<Agenda>>,
  feedback: String,
) -> anyhow::Result<()> {
  let mut conn = state.db.get_conn().await?;

  // Get source_text from the first agenda
  let source_text: Option<String> = conn
    .exec_first(
      "SELECT source_text FROM agendas WHERE series_id = ? AND user_id = ? ORDER BY version ASC LIMIT 1",
      (&series_id, &user_id),
    )
    .await?;

  let source_text = source_text.ok_or_else(|| anyhow::anyhow!("No source text found"))?;

  let mut context_parts = Vec::new();
  context_parts.push("Original Source:\n\n".to_owned() + &source_text);

  for (i, Agenda { content, .. }) in agendas.iter().enumerate() {
    context_parts
      .push(format!("Draft #{} Agenda:\n\n", i + 1) + content.as_ref().map_or("", |v| v));
  }

  // Add the current feedback at the end
  context_parts.push("User's Feedback:\n\n".to_owned() + &feedback);

  let system_prompt = render_create_agenda_system()?;

  let prompt_data = RegenerateAgendaPromptData {
    regeneration_context: context_parts.join("\n\n"),
  };

  let user_prompt = render_regenerate_agenda(&prompt_data)?;

  let messages = serde_json::json!([
    { "role": "system", "content": system_prompt },
    { "role": "user", "content": user_prompt }
  ]);

  let agenda_content = call_llm("google/gemini-2.5-pro".to_string(), 0.3, messages, Some(3))
    .await
    .map_err(|err| {
      error!(
        "LLM call failed for agenda {}: {:?}",
        pending_agenda_id, err
      );

      let mut conn_block = tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(async { state.db.get_conn().await })
      });

      if let Ok(ref mut conn) = conn_block {
        let _ = tokio::task::block_in_place(|| {
          tokio::runtime::Handle::current().block_on(async {
            conn
              .exec_drop(
                "UPDATE agendas SET status = 'failed', updated_at = NOW() WHERE id = ?",
                (pending_agenda_id,),
              )
              .await
          })
        });
      }

      anyhow::anyhow!("Error calling LLM: {:?}", err)
    })?;

  "UPDATE agendas SET content = :content, status = 'generated', generated_at = NOW(), updated_at = NOW() WHERE id = :id"
    .with(params! {
      "content" => &agenda_content,
      "id" => pending_agenda_id,
    })
    .ignore(&mut conn)
    .await?;

  Ok(())
}

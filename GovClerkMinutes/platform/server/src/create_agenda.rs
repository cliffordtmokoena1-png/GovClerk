use crate::create_minutes::call_llm;
use crate::error::LogError;
use crate::prompt_templates::{
  render_create_agenda, render_create_agenda_system, AgendaPromptData,
};
use crate::{SharedRequestState, UserId};
use axum::{
  extract::{Json, State},
  http::StatusCode,
  response::IntoResponse,
  Extension,
};
use mysql_async::prelude::{Query as MySqlQuery, Queryable, WithParams};
use mysql_async::{params, TxOpts};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info};

#[derive(Deserialize)]
pub struct CreateAgendaRequest {
  pub agenda_id: u64,
  pub source_text: String,
  pub title: Option<String>,
}

#[derive(Serialize)]
pub struct CreateAgendaResponse {
  pub status: String,
  pub content: Option<String>,
}

pub async fn create_agenda_handler(
  Extension(UserId(user_id)): Extension<UserId>,
  State(state): State<Arc<SharedRequestState>>,
  Json(CreateAgendaRequest {
    agenda_id,
    source_text,
    title,
  }): Json<CreateAgendaRequest>,
) -> Result<impl IntoResponse, StatusCode> {
  let mut conn = state.db.get_conn().await.map_err(|err| {
    error!("Error getting database connection: {:?}", err);
    StatusCode::INTERNAL_SERVER_ERROR
  })?;

  let mut tx = conn
    .start_transaction(TxOpts::default())
    .await
    .map_err(|err| {
      error!("Error starting transaction: {:?}", err);
      StatusCode::INTERNAL_SERVER_ERROR
    })?;

  let rows: Vec<(String, String)> = "
    SELECT user_id, series_id
    FROM agendas
    WHERE id = :agenda_id
  "
  .with(params! {
    "agenda_id" => agenda_id,
  })
  .map(&mut tx, |(user_id, series_id): (String, String)| {
    (user_id, series_id)
  })
  .await
  .map_and_log_err("Error fetching agenda", StatusCode::INTERNAL_SERVER_ERROR)?;

  let (agenda_user_id, _series_id) = rows.first().cloned().ok_or_else(|| {
    error!("Agenda not found: {}", agenda_id);
    StatusCode::NOT_FOUND
  })?;

  if agenda_user_id != user_id {
    error!("Unauthorized access to agenda {}", agenda_id);
    return Err(StatusCode::FORBIDDEN);
  }

  tx.exec_drop(
    "UPDATE agendas SET status = 'pending', updated_at = NOW() WHERE id = ?",
    (agenda_id,),
  )
  .await
  .map_err(|err| {
    error!("Error updating agenda status: {:?}", err);
    StatusCode::INTERNAL_SERVER_ERROR
  })?;

  tx.commit().await.map_err(|err| {
    error!("Error committing transaction: {:?}", err);
    StatusCode::INTERNAL_SERVER_ERROR
  })?;

  info!("Generating agenda {} for user {}", agenda_id, user_id);

  let system_prompt = render_create_agenda_system().map_err(|err| {
    error!("Failed to render agenda system prompt: {:?}", err);
    StatusCode::INTERNAL_SERVER_ERROR
  })?;

  let current_date = chrono::Local::now().format("%B %d, %Y").to_string();
  let prompt_data = AgendaPromptData {
    source_text,
    title,
    current_date,
  };
  let user_prompt = render_create_agenda(&prompt_data).map_err(|err| {
    error!("Failed to render agenda user prompt: {:?}", err);
    StatusCode::INTERNAL_SERVER_ERROR
  })?;

  let messages = serde_json::json!([
    { "role": "system", "content": system_prompt },
    { "role": "user", "content": user_prompt }
  ]);

  let content = call_llm("google/gemini-2.5-pro".to_string(), 0.3, messages, Some(3))
    .await
    .map_err(|err| {
      error!("LLM call failed for agenda {}: {:?}", agenda_id, err);

      let mut conn_block = tokio::task::block_in_place(|| {
        tokio::runtime::Handle::current().block_on(async { state.db.get_conn().await })
      });

      if let Ok(ref mut conn) = conn_block {
        let _ = tokio::task::block_in_place(|| {
          tokio::runtime::Handle::current().block_on(async {
            conn
              .exec_drop(
                "UPDATE agendas SET status = 'failed', updated_at = NOW() WHERE id = ?",
                (agenda_id,),
              )
              .await
          })
        });
      }

      StatusCode::INTERNAL_SERVER_ERROR
    })?;

  let mut conn = state.db.get_conn().await.map_err(|err| {
    error!("Error getting database connection: {:?}", err);
    StatusCode::INTERNAL_SERVER_ERROR
  })?;

  conn
    .exec_drop(
      "UPDATE agendas SET content = ?, status = 'generated', updated_at = NOW() WHERE id = ?",
      (content.clone(), agenda_id),
    )
    .await
    .map_err(|err| {
      error!("Error updating agenda with content: {:?}", err);
      StatusCode::INTERNAL_SERVER_ERROR
    })?;

  info!("Successfully generated agenda {}", agenda_id);

  Ok(axum::response::Json(CreateAgendaResponse {
    status: "generated".to_string(),
    content: Some(content),
  }))
}

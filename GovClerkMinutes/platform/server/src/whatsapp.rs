use crate::{websocket::Message, SharedRequestState};
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use std::sync::Arc;

/// Use this endpoint to signal to clients via websocket that a new whatsapp
/// message or event has occured.  This should trigger a revalidation on the client.
pub async fn new_whatsapp_handler(
  State(state): State<Arc<SharedRequestState>>,
) -> impl IntoResponse {
  let ws = state.websocket.lock().await;
  ws.broadcast(Message::NewWhatsapp).await;
  StatusCode::OK
}

/// Unified call relay body: { kind, value }
#[derive(serde::Deserialize)]
pub struct CallBody {
  kind: String,
  value: serde_json::Value,
}

/// Signal that a call-related webhook change was received; broadcast payload to clients.
pub async fn call_handler(
  State(state): State<Arc<SharedRequestState>>,
  Json(body): Json<CallBody>,
) -> impl IntoResponse {
  let ws = state.websocket.lock().await;
  ws.broadcast(Message::Call {
    kind: body.kind,
    value: body.value,
  })
  .await;
  StatusCode::OK
}

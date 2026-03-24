use axum::{extract::State, response::IntoResponse};
use http::StatusCode;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::SharedRequestState;

#[derive(Deserialize, Serialize)]
pub struct GetPendingTasksResponse {
  tasks: usize,
}

pub async fn get_pending_tasks_handler(
  State(state): State<Arc<SharedRequestState>>,
) -> Result<impl IntoResponse, StatusCode> {
  return Ok(axum::response::Json(GetPendingTasksResponse {
    tasks: state
      .pending_tasks_counter
      .load(std::sync::atomic::Ordering::SeqCst),
  }));
}

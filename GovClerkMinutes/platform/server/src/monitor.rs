use axum::response::IntoResponse;
use http::StatusCode;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize)]
pub struct MonitorResponse {
  monitor: u64,
}

pub async fn monitor_handler() -> Result<impl IntoResponse, StatusCode> {
  return Ok(axum::response::Json(MonitorResponse { monitor: 12345 }));
}

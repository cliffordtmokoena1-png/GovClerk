use axum::{
  extract::{Json, State},
  response::IntoResponse,
  Extension,
};
use http::StatusCode;
use mysql_async::{
  params,
  prelude::{Query, WithParams},
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::{error::LogError, SharedRequestState, UserId};

#[derive(Deserialize, Serialize)]
pub struct GetClustersBody {
  transcript_id: u64,
}

#[derive(Deserialize, Serialize)]
pub struct GetClustersResponse {
  minutes: Vec<String>,
}

pub async fn get_clusters_handler(
  Extension(UserId(user_id)): Extension<UserId>,
  State(state): State<Arc<SharedRequestState>>,
  Json(body): Json<GetMinutesBody>,
) -> Result<impl IntoResponse, StatusCode> {
  let mut conn = state
    .db
    .get_conn()
    .await
    .map_and_log_err("failed to connect to db", StatusCode::INTERNAL_SERVER_ERROR)?;

  let minutes =
    r"SELECT minutes FROM minutes WHERE transcript_id = :transcript_id AND user_id = :user_id;"
      .with(params! {
        "transcript_id" => body.transcript_id,
        "user_id" => user_id,
      })
      .map(&mut conn, |minutes: Option<String>| minutes)
      .await
      .map_and_log_err(
        "failed to query replicate db",
        StatusCode::INTERNAL_SERVER_ERROR,
      )?
      .iter()
      .filter_map(|minutes| minutes.as_ref())
      .map(|minutes| minutes.to_string())
      .collect::<Vec<String>>();

  return Ok(axum::response::Json(GetMinutesResponse { minutes }));
}

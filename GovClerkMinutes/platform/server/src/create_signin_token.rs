use axum::{
  extract::{Json, State},
  http::{Method, StatusCode},
  middleware,
  routing::post,
  Router,
};
use mysql_async::{
  params,
  prelude::{Query, WithParams},
};
use rand::rngs::OsRng;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

use crate::api_auth::verify_webhook_secret;
use crate::SharedRequestState;

/// Creates a random 100 character string token that can be used to authenticate users.
fn create_auth_token() -> String {
  let mut rng = OsRng;
  let token: String = std::iter::repeat(())
    .map(|()| {
      let chars = b"abcdefghijklmnopqrstuvwxyz0123456789";
      let idx = rng.gen_range(0..chars.len());
      chars[idx] as char
    })
    .take(100)
    .collect();

  return format!("gc_{}", token);
}

async fn create_gc_auth_token_record(
  user_id: String,
  state: Arc<SharedRequestState>,
) -> anyhow::Result<String> {
  let mut conn = state.db.get_conn().await?;

  let token = create_auth_token();

  r"INSERT INTO gc_auth_tokens (user_id, token, expires_at) VALUES (:user_id, :token, NOW() + INTERVAL 1 YEAR)"
    .with(params! {
      "user_id" => user_id,
      "token" => token.clone(),
    })
    .ignore(&mut conn)
    .await?;

  return Ok(token);
}

#[derive(Deserialize)]
pub struct AuthRequest {
  user_id: String,
}

#[derive(Serialize)]
pub struct AuthResponse {
  token: String,
}

pub async fn create_auth_token_handler(
  State(state): State<Arc<SharedRequestState>>,
  Json(payload): Json<AuthRequest>,
) -> Result<Json<AuthResponse>, StatusCode> {
  let token = create_gc_auth_token_record(payload.user_id, state)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

  Ok(Json(AuthResponse { token }))
}

pub fn create_auth_router() -> Router<Arc<SharedRequestState>> {
  Router::new()
    .route(
      "/api/auth/create-auth-token",
      post(create_auth_token_handler),
    )
    .layer(
      CorsLayer::new()
        .allow_methods([Method::POST])
        .allow_origin(Any)
        .allow_headers(vec![
          axum::http::header::AUTHORIZATION,
          axum::http::header::CONTENT_TYPE,
        ]),
    )
    .layer(middleware::from_fn(verify_webhook_secret))
}

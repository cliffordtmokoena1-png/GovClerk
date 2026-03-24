use std::env;

use axum::extract::{State, TypedHeader};
use axum::headers::authorization::{Authorization, Bearer};
use axum::http::{Request, StatusCode};
use axum::middleware::Next;
use axum::response::Response;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use tracing::{error, info};

use crate::{SharedRequestState, UserId};

#[derive(Debug, serde::Serialize, serde::Deserialize)]
struct Claims {
  exp: usize,
  nbf: usize,
  sub: String,
  #[serde(default)]
  role: Option<String>,
}

#[derive(Debug, Clone)]
pub struct User {
  pub user_id: String,
  pub role: Option<String>,
}

/// Attempt to decode a JWT using a PEM public key stored in the given env var name.
/// Returns Some(User) on success, None on any failure (missing var, bad key, decode error).
fn try_decode_with_env_var(token: &str, env_var: &str) -> Option<User> {
  let public_key = match env::var(env_var) {
    Ok(v) => v,
    Err(_) => return None,
  };

  let decoding_key = match DecodingKey::from_rsa_pem(public_key.as_bytes()) {
    Ok(key) => key,
    Err(err) => {
      error!(
        "failed to decode jwt public key from {}: {:?}",
        env_var, err
      );
      return None;
    }
  };

  let validation = Validation::new(Algorithm::RS256);
  match decode::<Claims>(token, &decoding_key, &validation) {
    Ok(c) => {
      let uid = c.claims.sub;
      let role = c.claims.role;
      info!("User authenticated: {} (via {})", uid, env_var);
      Some(User { user_id: uid, role })
    }
    Err(err) => {
      error!("failed to decode jwt with {}: {:?}", env_var, err);
      None
    }
  }
}

/// Core JWT authentication using Clerk public key. Returns the authenticated user id on success.
pub fn authenticate_bearer_token(token: &str) -> Result<User, StatusCode> {
  // Try all known Clerk JWT public keys (GC prod, GC test, GovClerk prod, GovClerk test)
  let env_vars = [
    "CLERK_JWT_PUBLIC_KEY",
    "CLERK_TEST_JWT_PUBLIC_KEY",
    "GovClerk_JWT_PUBLIC_KEY",
    "GovClerk_TEST_JWT_PUBLIC_KEY",
  ];

  for env_var in env_vars {
    if let Some(user) = try_decode_with_env_var(token, env_var) {
      return Ok(user);
    }
  }

  Err(StatusCode::UNAUTHORIZED)
}

/// Accepts either the master webhook key or a valid JWT; returns the user id.
pub fn authenticate_any_token(token: &str) -> Result<User, StatusCode> {
  // Master key short-circuit (used by webhooks and optional WS)
  if let Ok(master_key) = env::var("UPLOAD_COMPLETE_WEBHOOK_SECRET") {
    if token == master_key {
      return Ok(User {
        user_id: "master".to_string(),
        role: Some("admin".to_string()),
      });
    }
  }
  authenticate_bearer_token(token)
}

/// Axum middleware: authorizes either via master key or JWT. Inserts `UserId` into request extensions.
pub async fn auth(
  TypedHeader(auth): TypedHeader<Authorization<Bearer>>,
  State(_state): State<std::sync::Arc<SharedRequestState>>,
  mut request: Request<axum::body::Body>,
  next: Next<axum::body::Body>,
) -> Result<Response, StatusCode> {
  let master_key =
    env::var("UPLOAD_COMPLETE_WEBHOOK_SECRET").map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

  let token = auth.token();
  if token == master_key {
    info!("Webhook secret authenticated");
    return Ok(next.run(request).await);
  }

  match authenticate_bearer_token(token) {
    Ok(user) => {
      request.extensions_mut().insert(UserId(user.user_id));
      Ok(next.run(request).await)
    }
    Err(status) => Err(status),
  }
}

/// Middleware requiring an admin user (role == "admin") OR master key.
/// Inserts UserId when JWT path used. Master key path skips insertion (system-level access).
pub async fn admin_auth(
  TypedHeader(auth): TypedHeader<Authorization<Bearer>>,
  State(_state): State<std::sync::Arc<SharedRequestState>>,
  mut request: Request<axum::body::Body>,
  next: Next<axum::body::Body>,
) -> Result<Response, StatusCode> {
  // Master key always allowed
  if let Ok(master_key) = env::var("UPLOAD_COMPLETE_WEBHOOK_SECRET") {
    if auth.token() == master_key {
      return Ok(next.run(request).await);
    }
  }

  match authenticate_bearer_token(auth.token()) {
    Ok(user) => match user.role.as_deref() {
      Some("admin") => {
        request.extensions_mut().insert(UserId(user.user_id));
        Ok(next.run(request).await)
      }
      _ => Err(StatusCode::UNAUTHORIZED),
    },
    Err(status) => Err(status),
  }
}

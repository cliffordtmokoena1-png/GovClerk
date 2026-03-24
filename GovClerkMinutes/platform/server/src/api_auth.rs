use axum::{
  http::{Request, StatusCode},
  middleware::Next,
  response::Response,
};

pub async fn verify_webhook_secret<B>(
  req: Request<B>,
  next: Next<B>,
) -> Result<Response, StatusCode> {
  let secret = std::env::var("UPLOAD_COMPLETE_WEBHOOK_SECRET")
    .expect("UPLOAD_COMPLETE_WEBHOOK_SECRET not found in environment");

  if let Some(auth_header) = req.headers().get(axum::http::header::AUTHORIZATION) {
    if let Ok(auth_str) = auth_header.to_str() {
      let prefix = "Bearer ";
      if let Some(token) = auth_str.strip_prefix(prefix) {
        if token == secret {
          return Ok(next.run(req).await);
        }
      }
    }
  }

  Err(StatusCode::FORBIDDEN)
}

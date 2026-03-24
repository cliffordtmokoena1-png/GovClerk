use std::{sync::Arc, time::Duration};

use serde_json::{json, Value};
use tracing::error;

use crate::SharedRequestState;

pub async fn create_signin_token(
  user_id: String,
  state: Arc<SharedRequestState>,
) -> anyhow::Result<String> {
  let client = reqwest::Client::new();

  let clerk_token = match state.options.clerk_test_mode {
    true => std::env::var("CLERK_TEST_SECRET_KEY").expect("CLERK_TEST_SECRET_KEY not found in env"),
    false => std::env::var("CLERK_SECRET_KEY").expect("CLERK_SECRET_KEY not found in env"),
  };

  let response = match client
    .post("https://api.clerk.com/v1/sign_in_tokens")
    .header("Authorization", format!("Bearer {}", clerk_token))
    .header("Content-Type", "application/json")
    .body(
      serde_json::to_string(&json!({
        "user_id": user_id,
      }))
      .unwrap(),
    )
    .timeout(Duration::from_secs(300))
    .send()
    .await
  {
    Ok(r) => r,
    Err(e) => {
      error!("failed to send clerk signin token request: {:?}", e);
      return Err(anyhow::anyhow!("failed to send clerk signin token request"));
    }
  };

  if response.status() != 200 {
    error!("failed to send clerk signin token request: {:?}", response);
    return Err(anyhow::anyhow!("failed to send clerk signin token request"));
  }

  let json: Value = response.json().await?;
  return match json["token"].as_str() {
    Some(token) => Ok(token.to_string()),
    None => Err(anyhow::anyhow!("token not found in the response")),
  };
}

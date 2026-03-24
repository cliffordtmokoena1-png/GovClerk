use crate::SharedRequestState;
use anyhow::{anyhow, Result};
use http::StatusCode;
use reqwest::Client;
use std::{env, sync::Arc};
use tracing::error;

fn get_clerk_secret_key(clerk_test_mode: bool) -> String {
  match clerk_test_mode {
    true => env::var("CLERK_TEST_SECRET_KEY").expect("CLERK_TEST_SECRET_KEY not found in env"),
    false => env::var("CLERK_SECRET_KEY").expect("CLERK_SECRET_KEY not found in env"),
  }
}

fn get_GovClerk_secret_key(clerk_test_mode: bool) -> Option<String> {
  match clerk_test_mode {
    true => env::var("GovClerk_TEST_SECRET_KEY").ok(),
    false => env::var("GovClerk_SECRET_KEY").ok(),
  }
}

async fn try_get_primary_email_with_key(
  user_id: &str,
  token: &str,
  http_client: &Client,
) -> Result<String> {
  let user_response = http_client
    .get(format!("https://api.clerk.com/v1/users/{}", user_id))
    .header("Authorization", format!("Bearer {}", token))
    .send()
    .await
    .map_err(|e| anyhow!("failed to send clerk user get api call: {}", e))?;

  if !user_response.status().is_success() {
    let err = user_response
      .json::<serde_json::Value>()
      .await
      .map_err(|e| anyhow!("failed to parse error: {}", e))?;
    return Err(anyhow!("received error from clerk api: {}", err));
  }

  let user_body = user_response
    .json::<serde_json::Value>()
    .await
    .map_err(|e| anyhow!("failed to parse response: {}", e))?;

  let email_id = user_body
    .get("primary_email_address_id")
    .and_then(|v| v.as_str())
    .ok_or_else(|| anyhow!(StatusCode::BAD_REQUEST.to_string()))?;

  let email_response = http_client
    .get(format!(
      "https://api.clerk.com/v1/email_addresses/{}",
      email_id,
    ))
    .header("Authorization", format!("Bearer {}", token))
    .send()
    .await
    .map_err(|e| anyhow!("failed to send clerk email api call: {}", e))?;

  if !email_response.status().is_success() {
    let err = email_response
      .json::<serde_json::Value>()
      .await
      .map_err(|e| anyhow!("failed to parse error: {}", e))?;
    error!("error: {}", err);
    return Err(anyhow!("received error from clerk api: {}", err));
  }

  let body = email_response
    .json::<serde_json::Value>()
    .await
    .map_err(|e| anyhow!("failed to parse response: {}", e))?;

  let email = body
    .get("email_address")
    .and_then(|v| v.as_str())
    .ok_or_else(|| anyhow!(StatusCode::BAD_REQUEST.to_string()))?;

  Ok(email.to_string())
}

pub async fn get_primary_email(user_id: &str, state: Arc<SharedRequestState>) -> Result<String> {
  let http_client = Client::new();
  let gc_token = get_clerk_secret_key(state.options.clerk_test_mode);
  let cd_token = get_GovClerk_secret_key(state.options.clerk_test_mode);

  let gc_future = try_get_primary_email_with_key(user_id, &gc_token, &http_client);

  match cd_token {
    Some(cd_token) => {
      let cd_future = try_get_primary_email_with_key(user_id, &cd_token, &http_client);
      let (gc_result, cd_result) = tokio::join!(gc_future, cd_future);
      gc_result.or(cd_result)
    }
    None => gc_future.await,
  }
}

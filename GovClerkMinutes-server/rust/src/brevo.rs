use std::{collections::HashMap, time::Duration};

use serde_json::{json, Value};
use tracing::error;

pub async fn add_brevo_contact(
  email: String,
  list_id: u64,
  attributes: HashMap<String, String>,
) -> anyhow::Result<Value> {
  let client = reqwest::Client::new();

  let api_key = std::env::var("BREVO_API_KEY").expect("BREVO_API_KEY not found in env");

  let response = match client
    .post("https://api.brevo.com/v3/contacts")
    .header("Content-Type", "application/json")
    .header("api-key", api_key)
    .body(
      serde_json::to_string(&json!({
        "email": email,
        "attributes": attributes,
        "listIds": [list_id],
        "updateEnabled": true
      }))
      .unwrap(),
    )
    .timeout(Duration::from_secs(300))
    .send()
    .await
  {
    Ok(r) => r,
    Err(e) => {
      error!("failed to add contact with Brevo: {:?}", e);
      return Err(anyhow::anyhow!("failed to add contact with Brevo"));
    }
  };

  if response.status() != 200 && response.status() != 201 && response.status() != 204 {
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    error!("failed to get 200/201/204 from Brevo: {} - {}", status, body);
    return Err(anyhow::anyhow!(
      "failed to get 200/201/204 from Brevo: {} - {}",
      status,
      body
    ));
  }

  // 204 No Content — return empty object
  let text = response.text().await.unwrap_or_default();
  if text.is_empty() {
    return Ok(json!({}));
  }

  serde_json::from_str::<Value>(&text)
    .map_err(|e| anyhow::anyhow!("Failed to parse JSON: {:?}", e))
}

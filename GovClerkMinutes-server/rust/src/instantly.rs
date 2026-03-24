use std::{collections::HashMap, sync::Arc, time::Duration};

use serde_json::{json, Value};
use tracing::{error};

use crate::{create_signin_token, SharedRequestState};

pub async fn add_instantly_lead(
  email: String,
  campaign_id: String,
  custom_variables: HashMap<String, String>,
) -> anyhow::Result<Value> {
  let client = reqwest::Client::new();

  let token = std::env::var("INSTANTLY_API_KEY").expect("INSTANTLY_API_KEY not found in env");

  let response = match client
    .post("https://api.instantly.ai/api/v1/lead/add")
    .header("Content-Type", "application/json")
    .body(
      serde_json::to_string(&json!({
        "api_key": token,
        "campaign_id": campaign_id,
        "leads": [
          {
            "email": email,
            "custom_variables": custom_variables
          }
        ]
      }))
      .unwrap(),
    )
    .timeout(Duration::from_secs(300))
    .send()
    .await
  {
    Ok(r) => r,
    Err(e) => {
      error!("failed to add lead with instantly: {:?}", e);
      return Err(anyhow::anyhow!("failed to add lead with instantly"));
    }
  };

  if response.status() != 200 {
    error!("failed to get 200 lead with instantly");
    return Err(anyhow::anyhow!(
      "failed to get 200 lead with instantly: {:?}",
      response.text().await
    ));
  }

  return response
    .json::<Value>()
    .await
    .map_err(|e| anyhow::anyhow!("Failed to parse JSON: {:?}", e));
}
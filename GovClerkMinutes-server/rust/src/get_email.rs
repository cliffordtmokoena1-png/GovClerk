use std::{env, sync::Arc};
use axum::{extract::State, response::IntoResponse, Extension, Json};
use http::StatusCode;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::{error, info};
use anyhow::{Result, anyhow};
use crate::{error::LogError, SharedRequestState, UserId};

pub async fn get_primary_email(email_id: &str, State(state): State<Arc<SharedRequestState>>) -> Result<String> {
    let token = match state.options.clerk_test_mode {
        true => env::var("CLERK_TEST_SECRET_KEY").expect("CLERK_TEST_SECRET_KEY not found in env"),
        false => env::var("CLERK_SECRET_KEY").expect("CLERK_SECRET_KEY not found in env"),
    };

    let http_client = Client::new();

    let response = http_client
        .get(format!(
            "https://api.clerk.com/v1/email_addresses/{}",
            email_id,
        ))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| anyhow!("failed to send clerk email api call: {}", e))?;

    if !response.status().is_success() {
        let err = response
            .json::<serde_json::Value>()
            .await
            .map_err(|e| anyhow!("failed to parse error: {}", e))?;
        error!("error: {}", err);
        return Err(anyhow!("received error from clerk api: {}", err));
    }

    let body = response.json::<serde_json::Value>().await.map_err(
        |e| anyhow!("failed to parse response: {}", e),
    )?;

    let email = body
        .get("email_address")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!(StatusCode::BAD_REQUEST.to_string()))?;

    Ok(email.to_string())
}

pub async fn get_primary_email_id(user_id: &str, State(state): State<Arc<SharedRequestState>>) -> Result<String> {
    let token = match state.options.clerk_test_mode {
        true => env::var("CLERK_TEST_SECRET_KEY").expect("CLERK_TEST_SECRET_KEY not found in env"),
        false => env::var("CLERK_SECRET_KEY").expect("CLERK_SECRET_KEY not found in env"),
    };

    let http_client = Client::new();

    let response = http_client
        .get(format!("https://api.clerk.com/v1/users/{}", user_id))
        .header("Authorization", format!("Bearer {}", token))
        .send()
        .await
        .map_err(|e| anyhow!("failed to send clerk user get api call: {}", e))?;

    if !response.status().is_success() {
        let err = response
            .json::<serde_json::Value>()
            .await
            .map_err(|e| anyhow!("failed to parse error: {}", e))?;
        error!("error: {}", err);
        return Err(anyhow!("received error from clerk api: {}", err));
    }

    let body = response.json::<serde_json::Value>().await.map_err(
        |e| anyhow!("failed to parse response: {}", e),
    )?;

    let email_id = body
        .get("primary_email_address_id")
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow!(StatusCode::BAD_REQUEST.to_string()))?;

    Ok(email_id.to_string())
}
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use std::env;

#[derive(Deserialize)]
struct ServiceCredentials {
  private_key_id: String,
  private_key: String,
  client_email: String,
  token_uri: String,
}

async fn get_service_credentials() -> anyhow::Result<ServiceCredentials> {
  let encoded_credentials = env::var("GCP_CREDENTIALS").expect("GCP_CREDENTIALS not found in .env");
  let credentials = base64::decode(encoded_credentials)?;
  return serde_json::from_slice(&credentials).map_err(|e| e.into());
}

#[derive(Serialize)]
struct Claims<'a> {
  iss: &'a str,
  scope: &'a str,
  aud: &'a str,
  exp: usize,
  iat: usize,
}

fn make_jwt(
  ServiceCredentials {
    private_key_id,
    private_key,
    client_email,
    token_uri,
  }: &ServiceCredentials,
) -> anyhow::Result<String> {
  let header = Header {
    alg: Algorithm::RS256,
    kid: Some(private_key_id.clone()),
    ..Header::default()
  };

  let now = chrono::Utc::now().timestamp() as usize;
  let claims = Claims {
    iss: client_email,
    scope: "https://www.googleapis.com/auth/cloud-platform",
    aud: token_uri,
    iat: now,
    exp: now + 3600,
  };

  let encoding_key = EncodingKey::from_rsa_pem(private_key.as_bytes())?;
  return encode(&header, &claims, &encoding_key).map_err(|e| e.into());
}

#[derive(Deserialize, Debug)]
pub struct Token {
  pub access_token: String,
  #[allow(dead_code)]
  pub expires_in: u64,
  #[allow(dead_code)]
  pub token_type: String,
}

pub async fn get_token() -> anyhow::Result<Token> {
  let credentials = get_service_credentials().await?;
  let jwt = make_jwt(&credentials)?;

  let client = reqwest::Client::new();
  let res = client
    .post(&credentials.token_uri) // https://oauth2.googleapis.com/token
    .form(&[
      ("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer"),
      ("assertion", &jwt),
    ])
    .send()
    .await?;

  if !res.status().is_success() {
    return Err(anyhow::anyhow!("Failed to get token: {}", res.status()));
  }

  return res.json().await.map_err(|e| e.into());
}

#[cfg(test)]
mod tests {
  use super::*;

  #[tokio::test]
  async fn test_get_token() {
    dotenv::dotenv().unwrap();

    let result = get_token().await;
    assert!(result.is_ok(), "get_token failed: {:?}", result.err());
    let token = result.unwrap();
    assert!(
      !token.access_token.is_empty(),
      "access_token should not be empty"
    );
    assert!(token.expires_in > 0, "expires_in should be positive");
    assert_eq!(token.token_type, "Bearer");
  }
}

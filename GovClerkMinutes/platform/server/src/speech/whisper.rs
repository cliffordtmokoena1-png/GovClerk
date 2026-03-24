use crate::speech::range::Range;
use crate::speech::range::Source;
use anyhow::anyhow;
use axum::body::Bytes;
use reqwest::Client;
use reqwest::Response;
use std::env;
use std::sync::Arc;
use std::time::Duration;
use tracing::error;
use tracing::info;
use tracing::warn;

#[derive(Debug)]
enum WhisperRequestError {
  Retryable(usize),
  Fatal,
}

impl From<WhisperRequestError> for anyhow::Error {
  fn from(err: WhisperRequestError) -> Self {
    match err {
      WhisperRequestError::Retryable(remaining_requests) => anyhow!(
        "Retryable error, remaining requests: {}",
        remaining_requests
      ),
      WhisperRequestError::Fatal => anyhow!("Fatal error"),
    }
  }
}

pub async fn send_request_with_retries(
  slice_audio: Vec<u8>,
  http_client: Arc<Client>,
  retries: usize,
) -> anyhow::Result<Range> {
  if slice_audio.len() < 6000 {
    // Both APIs require at least 0.1 seconds of audio.
    // In this case we can return an empty range.
    return Ok(Range {
      task: "transcribe".to_string(),
      language: "en".to_string(),
      duration: 0.0,
      text: "".to_string(),
      words: Some(vec![]),
      source: None,
    });
  }

  let slice_audio_bytes = Bytes::from(slice_audio);

  // GROQ SIDE --------
  info!("Attempting transcription with Groq...");
  for i in 0..(retries + 1) {
    match send_groq_request(slice_audio_bytes.clone(), http_client.clone()).await {
      Ok(response) => match response.json::<Range>().await {
        Ok(mut range) => {
          info!("Groq transcription successful.");
          range.source = Some(Source::Groq);
          return Ok(range);
        }
        Err(err) => {
          error!(
            "Groq succeeded but failed to parse response json: {:#?}",
            err
          );
          break;
        }
      },
      Err(WhisperRequestError::Retryable(_)) => {
        warn!(
          "Groq request failed (retryable), attempt {}/{}. Retrying...",
          i + 1,
          retries + 1
        );
        continue;
      }
      Err(WhisperRequestError::Fatal) => {
        error!("Groq request failed (fatal). Falling back to OpenAI.");
        break;
      }
    }
  }

  warn!(
    "Groq transcription failed after {} attempts. Falling back to OpenAI.",
    retries + 1
  );

  // OPENAI SIDE --------
  info!("Attempting transcription with OpenAI...");
  for i in 0..(retries + 1) {
    match send_openai_request(slice_audio_bytes.clone(), http_client.clone()).await {
      Ok(response) => match response.json::<Range>().await {
        Ok(mut range) => {
          info!("OpenAI transcription successful.");
          range.source = Some(Source::OpenAI);
          return Ok(range);
        }
        Err(err) => {
          error!(
            "OpenAI succeeded but failed to parse response json: {:#?}",
            err
          );
          return Err(anyhow!("OpenAI failed to parse response json: {:?}", err));
        }
      },
      Err(WhisperRequestError::Retryable(_)) => {
        warn!(
          "OpenAI request failed (retryable), attempt {}/{}. Retrying...",
          i + 1,
          retries + 1
        );
        continue;
      }
      Err(WhisperRequestError::Fatal) => {
        error!("OpenAI request failed (fatal).");
        return Err(anyhow!("OpenAI request failed fatally after Groq fallback"));
      }
    }
  }

  error!(
    "Both Groq and OpenAI transcription failed after {} attempts each.",
    retries + 1
  );
  Err(anyhow!(
    "Failed to get text from Groq and OpenAI after retries"
  ))
}

async fn send_groq_request(
  slice_audio_bytes: Bytes,
  http_client: Arc<Client>,
) -> anyhow::Result<Response, WhisperRequestError> {
  let request_timeout = Duration::from_secs(300);
  let groq_api_key = env::var("GROQ_API_KEY").map_err(|_| {
    error!("GROQ_API_KEY environment variable not set.");
    WhisperRequestError::Fatal
  })?;

  info!("Sending Groq whisper request");

  let form = reqwest::multipart::Form::new()
    .text("model", "whisper-large-v3")
    .text("response_format", "verbose_json")
    .text("language", "en")
    .text("timestamp_granularities[]", "word")
    .part(
      "file",
      reqwest::multipart::Part::stream(slice_audio_bytes)
        .mime_str("audio/wav")
        .map_err(|groq_err| {
          error!("Groq: failed to set mime type: {:?}", groq_err);
          return WhisperRequestError::Fatal;
        })?
        .file_name("GC_audio.wav"),
    );

  let response = http_client
    .post("https://api.groq.com/openai/v1/audio/transcriptions")
    .header("Authorization", format!("Bearer {}", groq_api_key))
    .multipart(form)
    .timeout(request_timeout)
    .send()
    .await
    .map_err(|e| {
      error!("Failed to send Groq whisper request: {:?}", e);
      return WhisperRequestError::Retryable(0);
    })?;

  if !response.status().is_success() {
    let status = response.status();
    let body = response
      .text()
      .await
      .unwrap_or_else(|_| "Failed to read body".to_string());
    warn!(
      "Groq whisper request failed with status {} and body: {}",
      status, body
    );
    return Err(WhisperRequestError::Retryable(0));
  }

  info!(
    "Groq whisper request successful (status code {}).",
    response.status()
  );
  return Ok(response);
}

async fn send_openai_request(
  slice_audio_bytes: Bytes,
  http_client: Arc<Client>,
) -> anyhow::Result<Response, WhisperRequestError> {
  let request_timeout = Duration::from_secs(300);
  let openai_api_key = env::var("OPENAI_KEY").map_err(|_| {
    error!("OPENAI_KEY environment variable not set.");
    WhisperRequestError::Fatal
  })?;

  info!("Sending OpenAI whisper request");

  let form = reqwest::multipart::Form::new()
    .text("model", "whisper-1")
    .text("language", "en")
    .text("response_format", "verbose_json")
    .text("timestamp_granularities[]", "word")
    .part(
      "file",
      reqwest::multipart::Part::stream(slice_audio_bytes)
        .mime_str("audio/wav")
        .map_err(|openai_err| {
          error!("OpenAI: failed to set mime type: {:?}", openai_err);
          return WhisperRequestError::Fatal;
        })?
        .file_name("GC_audio.wav"),
    );

  let response = http_client
    .post("https://api.openai.com/v1/audio/transcriptions")
    .header("Authorization", format!("Bearer {}", openai_api_key))
    .multipart(form)
    .timeout(request_timeout)
    .send()
    .await
    .map_err(|e| {
      error!("Failed to send OpenAI whisper request: {:?}", e);
      return WhisperRequestError::Retryable(0);
    })?;

  if !response.status().is_success() {
    let status = response.status();
    let body = response
      .text()
      .await
      .unwrap_or_else(|_| "Failed to read body".to_string());
    warn!(
      "OpenAI whisper request failed with status {} and body: {}",
      status, body
    );
    return Err(WhisperRequestError::Retryable(0));
  }

  info!(
    "OpenAI whisper request successful (status code {}).",
    response.status()
  );
  return Ok(response);
}

use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{error, info, warn};

use crate::create_minutes::MinutesError;
use crate::transcript::Transcript;

const SPEAKER_EMBEDDING_SIMILIARITY_THRESHOLD: f64 = 0.7;

#[derive(Debug)]
pub struct PreviousSpeaker {
  pub id: u64,
  pub name: String,
  pub embedding: Vec<f64>,
}

pub fn cosine_similarity(a: &[f64], b: &[f64]) -> f64 {
  let length = a.len().min(b.len());
  let mut dot_product = 0.0;
  let mut a_sum = 0.0;
  let mut b_sum = 0.0;

  for i in 0..length {
    dot_product += a[i] * b[i];
    a_sum += a[i] * a[i];
    b_sum += b[i] * b[i];
  }

  dot_product / (a_sum.sqrt() * b_sum.sqrt())
}

pub fn get_top_n_similar_speakers(
  speaker_embedding: &[f64],
  previous_speakers: &[PreviousSpeaker],
  n: usize,
) -> Vec<(u64, String, f64)> {
  let speaker_pattern = Regex::new(r"^Speaker \d+$").unwrap();

  let mut similarities: Vec<(u64, String, f64)> = previous_speakers
    .iter()
    .filter(|prev_speaker| !speaker_pattern.is_match(&prev_speaker.name))
    .map(|prev_speaker| {
      let similarity = cosine_similarity(speaker_embedding, &prev_speaker.embedding);
      (prev_speaker.id, prev_speaker.name.clone(), similarity)
    })
    .collect();

  similarities.retain(|(_, _, similarity)| similarity.is_finite());

  similarities.sort_by(|a, b| b.2.total_cmp(&a.2));

  similarities.truncate(n);

  similarities
}

#[derive(Serialize, Deserialize, Debug)]
struct SpeakerIdentity {
  speaker_label: String,
  identified_name: String,
  confidence: f32,
}

#[derive(Serialize, Deserialize, Debug)]
struct SpeakerIdentificationResponse {
  speakers: Vec<SpeakerIdentity>,
}

pub async fn identify_speakers_from_transcript(
  transcript: &Transcript,
) -> Result<HashMap<String, String>, MinutesError> {
  info!("Starting speaker identification from transcript content");

  let mut transcript_text = String::new();

  transcript_text.push_str("== FULL TRANSCRIPT (CHRONOLOGICAL) ==\n\n");

  for segment in &transcript.segments {
    if let Some(text) = &segment.transcript {
      if !text.trim().is_empty() {
        transcript_text.push_str(&format!("Speaker {}: {}\n\n", segment.speaker, text));
      }
    }
  }

  let estimated_token_count = transcript_text.len() / 4;
  info!(
    "Generated transcript context with ~{} tokens",
    estimated_token_count
  );

  let system_prompt = "Identify real names of speakers from a meeting transcript. Pay attention to how speakers address each other and self-references. Only return ACTUAL NAMES when mentioned, not generic labels like 'Speaker A'. Only return names with high confidence (70%+). If no real name is mentioned for a speaker, do not include them in the output. Format: JSON with speaker_label, identified_name, and confidence fields.";

  let user_prompt = format!(
    "Analyze this transcript and identify ONLY the real names of speakers based on how they talk and are addressed by others. DO NOT return entries with generic labels like 'Speaker A' - only return actual personal names (e.g., 'John Smith', 'Sarah', 'Dr. Johnson'). If you cannot identify a real name for a speaker with high confidence, do not include them in the output. If uncertain, it is always better to NOT include a name.\n\n{}\n\nJSON format: {{\"speakers\": [{{\"speaker_label\": \"SPEAKER_LABEL\", \"identified_name\": \"NAME\", \"confidence\": SCORE}}]}}",
    transcript_text
  );

  let messages = serde_json::json!([{
      "role": "system", "content": system_prompt},
      {"role": "user", "content": user_prompt}
  ]);

  let model = "openai/gpt-5-mini";

  let response = match call_openrouter(model.to_string(), 0.0, messages).await {
    Ok(response) => response,
    Err(e) => {
      warn!(
        "Failed to call OpenRouter for speaker identification: {:?}",
        e
      );
      return Ok(HashMap::new());
    }
  };

  let identification_response: SpeakerIdentificationResponse = match serde_json::from_str(&response)
  {
    Ok(response) => response,
    Err(e) => {
      error!("Failed to parse speaker identification response: {}", e);
      error!("Raw response: {}", response);
      return Ok(HashMap::new());
    }
  };

  // Use a HashMap to store highest confidence identifications for each speaker
  let mut speaker_confidence_map: HashMap<String, f32> = HashMap::new();
  let mut speaker_name_map = HashMap::new();

  for identity in identification_response.speakers {
    if !identity.identified_name.trim().is_empty() && identity.confidence >= 0.9 {
      let actual_label = if identity.speaker_label.starts_with("Speaker ") {
        identity
          .speaker_label
          .trim_start_matches("Speaker ")
          .to_string()
      } else {
        identity.speaker_label.clone()
      };

      // Check if the identified name is just "Speaker X" which is not a real identification
      let name_is_default_label = identity
        .identified_name
        .trim()
        .to_lowercase()
        .starts_with("speaker ")
        && identity.identified_name.split_whitespace().count() == 2;

      if !name_is_default_label {
        let current_confidence = speaker_confidence_map
          .get(&actual_label)
          .copied()
          .unwrap_or(0.0);

        info!(
          "Found identification for speaker {}: '{}' with confidence {} (current highest: {})",
          actual_label, identity.identified_name, identity.confidence, current_confidence
        );

        if identity.confidence > current_confidence {
          info!(
            "Updating identification for speaker {} to '{}' with higher confidence {}",
            actual_label, identity.identified_name, identity.confidence
          );
          speaker_name_map.insert(actual_label.clone(), identity.identified_name);
          speaker_confidence_map.insert(actual_label, identity.confidence);
        } else {
          info!(
            "Ignoring lower confidence identification '{}' ({}%) for speaker {}, keeping '{}' ({}%)",
            identity.identified_name,
            identity.confidence,
            actual_label,
            speaker_name_map.get(&actual_label).unwrap_or(&"none".to_string()),
            current_confidence
          );
        }
      } else {
        info!(
          "Ignoring default-style name '{}' for speaker {}",
          identity.identified_name, actual_label
        );
      }
    }
  }

  info!(
    "Completed speaker identification. Found {} names",
    speaker_name_map.len()
  );
  Ok(speaker_name_map)
}

/// Process speaker identities by analyzing the transcript and combining with cosine similarity data
///
/// This function handles all speaker identity assignment logic in one place, including:
/// 1. Identifying speakers from transcript content (if not in fast mode)
/// 2. Falling back to cosine similarity matching with previous speakers
/// 3. Generating suggested speaker identities
/// 4. Returning speaker assignments for database updates
pub async fn process_speaker_identities(
  transcript: &Transcript,
  previous_speakers: &[PreviousSpeaker],
  fast_mode: bool,
) -> anyhow::Result<Vec<(String, String, i32, String)>> {
  // First, identify speakers from transcript if not in fast mode
  let identified_speakers = if !fast_mode {
    match identify_speakers_from_transcript(transcript).await {
      Ok(speakers) => {
        info!(
          "Identified {} speakers from transcript content",
          speakers.len()
        );
        speakers
      }
      Err(e) => {
        warn!("Failed to identify speakers from transcript: {:?}", e);
        std::collections::HashMap::new()
      }
    }
  } else {
    std::collections::HashMap::new()
  };

  // Process each speaker and determine appropriate name assignments
  let mut processed_speakers_data = Vec::new();

  for speaker in &transcript.speakers {
    let mut assigned_name = speaker.name.clone();
    let mut uses = 0;
    let mut suggested_speakers_json = serde_json::json!({
      "suggested_identities": [],
    });

    if !fast_mode {
      // First priority: Check if we identified the speaker from transcript content
      if let Some(identified_name) = identified_speakers.get(&speaker.label) {
        info!(
          "Using identified name '{}' for speaker {}",
          identified_name, speaker.label
        );
        assigned_name = identified_name.clone();
        uses = 2; // this is to temporarily mark identified speakers
      } else {
        // Second priority: Use cosine similarity with previous speakers
        let top_similar_speakers =
          get_top_n_similar_speakers(&speaker.embedding, previous_speakers, 3);

        suggested_speakers_json = serde_json::json!({
          "suggested_identities": top_similar_speakers.iter().map(|(id, name, similarity)| {
            serde_json::json!({
              "id": id,
              "name": name,
              "similarity_score": similarity,
            })
          }).collect::<Vec<_>>()
        });

        if let Some((_, top_name, top_similarity)) = top_similar_speakers.first() {
          if *top_similarity >= SPEAKER_EMBEDDING_SIMILIARITY_THRESHOLD {
            assigned_name = top_name.clone();
            uses = 1;
          }
        }
      }
    }

    processed_speakers_data.push((
      speaker.label.clone(),
      assigned_name,
      uses,
      serde_json::to_string(&suggested_speakers_json).unwrap(),
    ));
  }

  Ok(processed_speakers_data)
}

async fn call_openrouter(
  model: String,
  temperature: f32,
  messages: serde_json::Value,
) -> Result<String, MinutesError> {
  use anyhow::Context;
  use reqwest::Client;
  use tracing::info;

  info!(
    "Calling OpenRouter (model: {}) for speaker identification",
    model
  );

  let openrouter_key =
    std::env::var("OPENROUTER_API_KEY").expect("OPENROUTER_API_KEY not found in env");

  let body = serde_json::json!({
      "model": model,
      "temperature": temperature,
      "max_tokens": 2000,
      "messages": messages,
      "response_format": {
          "type": "json_schema",
          "json_schema": {
              "name": "speaker_identification",
              "strict": true,
              "schema": {
                  "type": "object",
                  "properties": {
                      "speakers": {
                          "type": "array",
                          "items": {
                              "type": "object",
                              "properties": {
                                  "speaker_label": { "type": "string" },
                                  "identified_name": { "type": "string" },
                                  "confidence": { "type": "number" }
                              },
                              "required": ["speaker_label", "identified_name", "confidence"],
                              "additionalProperties": false
                          }
                      }
                  },
                  "required": ["speakers"],
                  "additionalProperties": false
              }
          }
      },
      "safety_settings": [
          { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" },
          { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE" },
          { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE" },
          { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE" }
      ]
  });

  let http_client = Client::new();
  let request_builder = http_client
    .post("https://openrouter.ai/api/v1/chat/completions")
    .header("Authorization", format!("Bearer {}", openrouter_key))
    .header("Content-Type", "application/json")
    .json(&body);

  let response = request_builder
    .send()
    .await
    .context("Failed to send request to OpenRouter")?;

  let status = response.status();
  if !status.is_success() {
    if status.is_server_error() {
      return Err(MinutesError::Retryable(format!(
        "OpenRouter server error: {}",
        status
      )));
    } else {
      return Err(MinutesError::NonRetryable(format!(
        "OpenRouter error: {}",
        status
      )));
    }
  }

  let response_text = response
    .text()
    .await
    .context("Failed to get response text from OpenRouter")?;
  info!("OpenRouter response received {}", response_text);

  let response_json: serde_json::Value =
    serde_json::from_str(&response_text).map_err(MinutesError::Json)?;

  let content = response_json["choices"]
    .as_array()
    .and_then(|arr| arr.first())
    .and_then(|choice| choice.get("message"))
    .and_then(|msg| msg.get("content"))
    .and_then(|c| c.as_str())
    .ok_or_else(|| {
      MinutesError::NonRetryable("Failed to extract content from OpenRouter response".into())
    })?
    .to_string();

  Ok(content)
}

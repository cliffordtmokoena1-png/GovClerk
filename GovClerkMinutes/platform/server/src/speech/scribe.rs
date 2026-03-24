use crate::{media_file::MediaFile, utils::time::seconds_to_timestamp, SharedRequestState};
use anyhow::{Context, Result};
use reqwest::multipart::{Form, Part};
use serde::Deserialize;
use std::sync::Arc;
use std::time::Duration;
use tracing::{error, info, warn};

#[derive(Debug, Deserialize)]
struct ScribeWordJson {
  #[serde(rename = "text")]
  text: String,
  start: f64,
  end: f64,
  #[serde(default)]
  speaker_id: Option<String>,
  #[serde(default)]
  r#type: Option<String>,
  #[allow(dead_code)]
  #[serde(default)]
  logprob: Option<f64>,
}

#[derive(Debug, Deserialize)]
struct ScribeJsonPayload {
  #[serde(default)]
  words: Option<Vec<ScribeWordJson>>,
}

async fn scribe_post_file(
  client: &reqwest::Client,
  api_url: &str,
  api_key: &str,
  bytes: Vec<u8>,
  filename: String,
) -> Result<serde_json::Value> {
  let file_part = Part::bytes(bytes)
    .file_name(filename)
    .mime_str("audio/wav")?;

  let form = Form::new()
    .part("file", file_part)
    .text("model_id", "scribe_v2")
    .text("diarize", "true")
    .text("tag_audio_events", "true")
    .text("timestamps_granularity", "word");

  let resp = client
    .post(format!("{}/speech-to-text", api_url))
    .header("xi-api-key", api_key)
    .header("Accept", "application/json")
    .multipart(form)
    .timeout(std::time::Duration::from_secs(900))
    .send()
    .await?;

  if !resp.status().is_success() {
    let status = resp.status();
    let body = resp.text().await.unwrap_or_default();
    anyhow::bail!("Scribe error {}: {}", status, body);
  }

  resp
    .json::<serde_json::Value>()
    .await
    .context("parse scribe json")
}

async fn scribe_post_file_with_retries(
  client: &reqwest::Client,
  api_url: &str,
  api_key: &str,
  bytes: Vec<u8>,
  filename: String,
) -> Result<serde_json::Value> {
  const MAX_RETRIES: usize = 3;
  const BASE_DELAY_MS: u64 = 2000;

  for attempt in 0..MAX_RETRIES {
    match scribe_post_file(client, api_url, api_key, bytes.clone(), filename.clone()).await {
      Ok(response) => return Ok(response),
      Err(err) => {
        let error_msg = err.to_string();
        if attempt < MAX_RETRIES - 1 {
          let delay_ms = BASE_DELAY_MS * (1 << attempt); // Exponential backoff: 2s, 4s, 8s
          warn!(
            "Scribe API error, attempt {}/{}, retrying in {}ms: {}",
            attempt + 1,
            MAX_RETRIES,
            delay_ms,
            error_msg
          );
          tokio::time::sleep(Duration::from_millis(delay_ms)).await;
          continue;
        } else {
          anyhow::bail!("Scribe error after {} attempts: {}", MAX_RETRIES, error_msg);
        }
      }
    }
  }

  unreachable!("Loop should have returned or failed")
}

async fn transcribe_and_diarize(
  transcript_id: u64,
  state: Arc<SharedRequestState>,
  audio_bytes: Vec<u8>,
) -> Result<()> {
  use std::env;

  let scribe_api_key = env::var("ELEVEN_LABS_API_KEY")
    .map_err(|_| anyhow::anyhow!("ELEVEN_LABS_API_KEY environment variable not set"))?;

  let scribe_api_url =
    env::var("SCRIBE_API_URL").unwrap_or_else(|_| "https://api.elevenlabs.io/v1".to_string());

  let client = reqwest::Client::new();

  info!(
    "Starting Scribe job for transcript {} with model: scribe_v1",
    transcript_id
  );

  crate::posthog::PostHogEventType::ScribeJobStarted.capture(
    format!("transcript_{}", transcript_id),
    serde_json::json!({
      "transcript_id": transcript_id,
    }),
  );

  // Register the diarization job synchronously so waiters can observe it
  let guard = state
    .transcript_manager
    .start_diarization(transcript_id)
    .await;

  // Start the API call in a background task and store the result
  let api_call = async move {
    info!(
      "Starting Eleven Labs API call for transcript {}",
      transcript_id
    );

    let response = scribe_post_file_with_retries(
      &client,
      &scribe_api_url,
      &scribe_api_key,
      audio_bytes,
      format!("transcript_{}.wav", transcript_id),
    )
    .await;

    match response {
      Ok(response_json) => {
        info!(
          "Scribe transcription completed for transcript {}",
          transcript_id
        );

        match guard.complete(Some(response_json)).await {
          Ok(()) => {
            info!(
              "Successfully completed diarization for transcript {}",
              transcript_id
            );
          }
          Err(e) => {
            error!(
              "Failed to complete diarization with payload for transcript {}: {}",
              transcript_id, e
            );
          }
        }
      }
      Err(e) => {
        error!(
          "Scribe request failed for transcript {}: {}",
          transcript_id, e
        );
        // RAII guard will cancel on drop.
      }
    }

    info!(
      "Scribe API background task completed for transcript {}",
      transcript_id
    );
  };

  tokio::spawn(api_call);

  info!(
    "Scribe job initiated for transcript {} (async, waiting for response)",
    transcript_id
  );
  Ok(())
}

/// Ensures a Scribe diarization job exists for the transcript and waits for completion.
pub async fn process_scribe_job(
  state: Arc<SharedRequestState>,
  media_file: MediaFile,
  transcript_id: u64,
) -> Result<()> {
  if !state.transcript_manager.has_job(transcript_id).await {
    let full_audio = media_file.slice(0.0, media_file.duration)?;
    transcribe_and_diarize(transcript_id, state.clone(), full_audio).await?;
  }
  state
    .transcript_manager
    .wait_for_diarization(transcript_id, Duration::from_secs(1000))
    .await
}

// Convert Scribe data to transcript format
pub async fn convert_scribe_to_transcript(
  transcript_id: u64,
  state: Arc<SharedRequestState>,
  media_file: MediaFile,
  include_text: bool,
) -> Result<crate::transcript::TranscriptFromModel> {
  info!(
    "Converting Scribe data for transcript {} (include_text: {})",
    transcript_id, include_text
  );

  let parsed: ScribeJsonPayload = state
    .transcript_manager
    .get_payload_typed(transcript_id)
    .await?;
  let words = parsed.words.unwrap_or_default();

  // Filter and sort words
  let mut word_entries: Vec<ScribeWordJson> = words
    .into_iter()
    .filter(|w| w.r#type.as_deref().unwrap_or("word") == "word")
    .collect();

  word_entries.sort_by(|a, b| {
    a.start
      .partial_cmp(&b.start)
      .unwrap_or(std::cmp::Ordering::Equal)
  });

  // Group words by speaker to create segments
  let mut segments = Vec::new();
  let mut current_speaker: Option<String> = None;
  let mut current_segment_words: Vec<ScribeWordJson> = Vec::new();
  let mut current_start: Option<f64> = None;
  let mut last_end_time: f64 = 0.0;

  for word in word_entries {
    let speaker_id = word
      .speaker_id
      .clone()
      .unwrap_or_else(|| "speaker_0".to_string());

    // If speaker changed, finish previous segment and start new one
    if current_speaker.as_ref() != Some(&speaker_id) {
      if let (Some(speaker), Some(start)) = (current_speaker.take(), current_start.take()) {
        if !current_segment_words.is_empty() {
          let end_time = current_segment_words.last().unwrap().end;
          let transcript_text = if include_text {
            Some(
              current_segment_words
                .iter()
                .map(|w| w.text.as_str())
                .collect::<Vec<_>>()
                .join(" "),
            )
          } else {
            None
          };

          segments.push(crate::transcript::Segment {
            start: seconds_to_timestamp(start),
            stop: seconds_to_timestamp(end_time),
            speaker: map_speaker_id_to_label(&speaker),
            transcript: transcript_text,
          });

          last_end_time = end_time;
        }
      }

      // Start new segment
      let segment_start = if word.start < last_end_time {
        last_end_time
      } else {
        word.start
      };

      current_speaker = Some(speaker_id);
      current_start = Some(segment_start);
      current_segment_words.clear();
    }

    current_segment_words.push(word);
  }

  // Finish the last segment
  if let (Some(speaker), Some(start)) = (current_speaker, current_start) {
    if !current_segment_words.is_empty() {
      let end_time = current_segment_words.last().unwrap().end;
      let transcript_text = if include_text {
        Some(
          current_segment_words
            .iter()
            .map(|w| w.text.as_str())
            .collect::<Vec<_>>()
            .join(" "),
        )
      } else {
        None
      };

      segments.push(crate::transcript::Segment {
        start: seconds_to_timestamp(start),
        stop: seconds_to_timestamp(end_time),
        speaker: map_speaker_id_to_label(&speaker),
        transcript: transcript_text,
      });
    }
  }

  let speakers = get_speakers_from_segments(&segments, media_file, state).await?;

  info!(
    "Converted Scribe data for transcript {}: {} segments, {} speakers",
    transcript_id,
    segments.len(),
    speakers.count
  );

  Ok(crate::transcript::TranscriptFromModel { segments, speakers })
}

/// Map Eleven Labs speaker IDs to simple labels (A, B, C, etc.)
fn map_speaker_id_to_label(raw: &str) -> String {
  // Produce Excel-like labels: 0->A, 25->Z, 26->AA, etc.
  if let Some(num) = raw
    .strip_prefix("speaker_")
    .and_then(|n| n.parse::<u32>().ok())
  {
    let mut n = num + 1; // switch to 1-based
    let mut buf: Vec<char> = Vec::new();
    while n > 0 {
      let rem = ((n - 1) % 26) as u8;
      buf.push((b'A' + rem) as char);
      n = (n - 1) / 26;
    }
    buf.into_iter().rev().collect()
  } else {
    // Fallback to first character or A
    raw.chars().next().unwrap_or('A').to_uppercase().to_string()
  }
}

async fn get_speakers_from_segments(
  segments: &[crate::transcript::Segment],
  media_file: MediaFile,
  state: Arc<SharedRequestState>,
) -> anyhow::Result<crate::transcript::Speakers> {
  // Collect distinct, sorted labels from segments
  let mut labels: Vec<String> = segments
    .iter()
    .map(|s| s.speaker.clone())
    .collect::<std::collections::BTreeSet<_>>()
    .into_iter()
    .collect();

  labels.sort();

  use std::collections::HashMap;
  let mut slices_by_label: HashMap<String, Vec<Vec<u8>>> = HashMap::new();
  for seg in segments {
    let start = crate::utils::time::timestamp_to_seconds(&seg.start)? as f64;
    let stop = crate::utils::time::timestamp_to_seconds(&seg.stop)? as f64;
    if stop > start {
      if let Ok(slice) = media_file.slice(start, stop) {
        slices_by_label
          .entry(seg.speaker.clone())
          .or_default()
          .push(slice);
      } else {
        warn!(
          "Failed to slice media for segment {}-{} of speaker {}",
          seg.start, seg.stop, seg.speaker
        );
      }
    }
  }

  let mut embeddings: HashMap<String, Vec<f64>> = HashMap::new();
  let py = state.python.lock().await;
  for label in &labels {
    if let Some(slices) = slices_by_label.get(label) {
      match py.get_speaker_embedding(slices) {
        Ok(Some(embedding)) => {
          embeddings.insert(label.clone(), embedding);
        }
        Ok(None) => {
          warn!("No segments for label {label}, skipping embedding");
        }
        Err(err) => {
          warn!("Failed to compute embedding for label {}: {}", label, err);
        }
      }
    }
  }

  let speakers = crate::transcript::Speakers {
    count: labels.len() as u32,
    labels,
    embeddings,
  };

  Ok(speakers)
}

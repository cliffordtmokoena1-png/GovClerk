use std::collections::HashMap;

use mysql_async::{
  params,
  prelude::{Query, WithParams},
  Conn,
};
use serde::{Deserialize, Serialize};
use tracing::info;

/// Struct that matches the json format of the ML model that does the
/// diarization.
#[derive(Serialize, Deserialize, Debug)]
pub struct Speakers {
  pub count: u32,
  pub labels: Vec<String>,
  pub embeddings: HashMap<String, Vec<f64>>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct Speaker {
  pub label: String,
  pub name: String,
  pub embedding: Vec<f64>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Segment {
  pub start: String,
  pub stop: String,
  pub speaker: String,
  pub transcript: Option<String>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Transcript {
  pub segments: Vec<Segment>,
  pub speakers: Vec<Speaker>,
}

/// Struct that matches the json format of the ML model that does the
/// diarization.
#[derive(Deserialize, Serialize, Debug)]
pub struct TranscriptFromModel {
  pub segments: Vec<Segment>,
  pub speakers: Speakers,
}

impl From<TranscriptFromModel> for Transcript {
  fn from(transcript: TranscriptFromModel) -> Self {
    let speakers = transcript
      .speakers
      .labels
      .iter()
      .enumerate()
      .map(|(idx, label)| {
        info!("Looking at label: {}, idx: {}", label, idx);
        let embedding = transcript.speakers.embeddings.get(label).unwrap();

        return Speaker {
          label: label.to_string(),
          name: format!("Speaker {}", idx + 1),
          embedding: embedding.to_vec(),
        };
      })
      .collect();

    return Transcript {
      segments: transcript.segments,
      speakers,
    };
  }
}

impl Transcript {
  pub async fn from_db(
    conn: &mut Conn,
    transcript_id: u64,
    user_id: &str,
  ) -> anyhow::Result<Transcript> {
    let segments = r"SELECT start, stop, speaker, transcript FROM gc_segments WHERE transcript_id = :transcript_id ORDER BY segment_index;"
      .with(params! {
        "transcript_id" => transcript_id,
      })
      .map(&mut *conn, |(start, stop, speaker, transcript): (String, String, String, Option<String>)| {
        return Segment {
          start,
          stop,
          speaker,
          transcript,
        };
      })
      .await?;

    let speakers =
      r"SELECT label, name FROM speakers WHERE transcriptId = :id AND userId = :user_id;"
        .with(params! {
          "id" => transcript_id,
          "user_id" => user_id,
        })
        .map(conn, |(label, name): (String, String)| {
          return Speaker {
            label,
            name,
            embedding: vec![],
          };
        })
        .await?;

    return Ok(Transcript { segments, speakers });
  }
}

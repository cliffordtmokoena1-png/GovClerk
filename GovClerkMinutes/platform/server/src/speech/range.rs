use crate::google::speech::{SpeechRecognitionAlternative, SpeechRecognitionResult};
use serde::Deserialize;
use serde::Serialize;

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum Source {
  Groq,
  OpenAI,
  GoogleCloud,
  Scribe,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Word {
  pub word: String,
  pub start: f64,
  pub end: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Range {
  pub task: String,
  pub language: String,
  pub duration: f64,
  pub text: String,
  pub words: Option<Vec<Word>>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub source: Option<Source>,
}

impl From<SpeechRecognitionResult> for Range {
  fn from(res: SpeechRecognitionResult) -> Self {
    fn parse_secs(raw: &Option<String>) -> f64 {
      raw
        .as_deref()
        .and_then(|s| s.strip_suffix('s')) // "12.345s" -> "12.345"
        .and_then(|s| s.parse::<f64>().ok()) // -> 12.345
        .unwrap_or(0.0)
    }

    // Google always orders best-hypothesis first.
    let alt: SpeechRecognitionAlternative =
      res
        .alternatives
        .into_iter()
        .next()
        .unwrap_or_else(|| SpeechRecognitionAlternative {
          transcript: String::new(),
          confidence: None,
          words: None,
        });

    let mut words: Vec<Word> = vec![];
    let mut earliest: f64 = f64::MAX;
    let mut latest: f64 = 0.0;
    if let Some(ws) = alt.words {
      for w in ws {
        let start = parse_secs(&w.start_offset);
        let end = parse_secs(&w.end_offset);
        words.push(Word {
          word: w.word.clone(),
          start,
          end,
        });

        earliest = earliest.min(start);
        latest = latest.max(end);
      }
    };

    Range {
      task: "transcribe".to_owned(),
      language: res.language_code,
      duration: latest - earliest,
      text: alt.transcript,
      words: Some(words),
      source: Some(Source::GoogleCloud),
    }
  }
}

impl Range {
  /// Merge an ordered collection of `Range`s into one contiguous segment.
  ///
  /// * `task`, `language`, and `source` are inherited from the first range.
  /// * `duration` is the sum of all durations.
  /// * Word times are shifted so they remain absolute; if any segment lacks
  ///   a word list the merged `words` becomes `None`.
  pub fn merge<I>(segments: I) -> Self
  where
    I: IntoIterator<Item = Range>,
  {
    let mut iter = segments.into_iter();
    let first = match iter.next() {
      Some(range) => range,
      None => {
        return Self {
          task: String::new(),
          language: String::new(),
          duration: 0.0,
          text: String::new(),
          words: None,
          source: None,
        };
      }
    };

    let mut text = first.text;
    let mut words = first.words.unwrap_or_default();
    let mut duration: f64 = 0.0;

    for seg in iter {
      if !seg.text.is_empty() {
        if !text.is_empty() {
          text.push(' ');
        }
        text.push_str(&seg.text);
      }

      if let Some(ws) = &seg.words {
        for w in ws {
          words.push(w.clone());
          duration = duration.max(w.end);
        }
      }
    }

    let merged = Range {
      task: first.task,
      language: first.language,
      duration,
      text,
      words: Some(words),
      source: first.source,
    };

    return merged;
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::google::speech::transcribe;
  use crate::google::storage::upload;
  use crate::tests::utils::download_and_cache_s3_asset;
  use anyhow::Result;
  use tokio::fs::File;
  use tokio::io::AsyncReadExt;

  #[tokio::test]
  async fn test_merge_google_transcribe() -> Result<()> {
    dotenv::dotenv().ok();

    // Download and upload a test audio file
    let asset_path = download_and_cache_s3_asset("sepedi.wav").await?;
    let mut file = File::open(&asset_path).await?;
    let mut bytes = Vec::new();
    file.read_to_end(&mut bytes).await?;

    let key_prefix = "test/test_merge_google_";
    let key = format!(
      "{}{}",
      key_prefix,
      uuid::Uuid::new_v4().to_string().replace('-', "")
    );
    let mime_type = "audio/wav";

    upload(&key, bytes, mime_type).await?;

    // Transcribe the uploaded file
    let language = "nso-ZA";
    let results = transcribe(&key, language).await?;

    // Convert each recognition result to Range
    let ranges: Vec<Range> = results.into_iter().map(Range::from).collect();

    // Merge the ranges
    let merged = Range::merge(ranges.clone());

    // Basic assertions
    assert!(!ranges.is_empty(), "Should have at least one range");
    assert!(!merged.text.is_empty(), "Merged text should not be empty");
    assert_eq!(merged.language, language);
    assert_eq!(merged.task, "transcribe");
    assert_eq!(merged.source, Some(Source::GoogleCloud));
    // If all segments have words, merged.words should be Some
    if ranges.iter().all(|r| r.words.is_some()) {
      assert!(merged.words.is_some(), "Merged words should be present");
    }

    println!("Merged text: {}", merged.text);
    Ok(())
  }
}

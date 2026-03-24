use std::fmt;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GoogleCloudStrategyParams {
  pub transcript_id: u64,
  pub test_mode: bool,
  pub language: String, // BCP-47 language code
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ScribeV1Params {
  pub transcript_id: u64,
  pub test_mode: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SpeechToTextStrategy {
  Whisper,
  GoogleCloud(GoogleCloudStrategyParams),
  ScribeV1(ScribeV1Params),
}

impl fmt::Display for SpeechToTextStrategy {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      SpeechToTextStrategy::Whisper => write!(f, "whisper"),
      SpeechToTextStrategy::GoogleCloud(_) => write!(f, "google"),
      SpeechToTextStrategy::ScribeV1(_) => write!(f, "scribe"),
    }
  }
}

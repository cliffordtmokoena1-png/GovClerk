use super::holder::Holder;
use super::word_utilization::WordUtilizationMetrics;
use crate::media_file::MediaFile;
use crate::speech;
use crate::speech::range::{Range, Source};
use crate::speech::strategy::{GoogleCloudStrategyParams, ScribeV1Params, SpeechToTextStrategy};
use crate::speech::whisper;
use crate::upload_key::get_upload_key;
use std::sync::Arc;
use tokio::sync::Mutex;
use tracing::debug;

#[derive(Clone)]
pub struct HolderInitializer {
  step: f64,
  client: Arc<reqwest::Client>,
  strategy: SpeechToTextStrategy,
  media_file: MediaFile,
  holder: Arc<Mutex<Holder>>, // TODO: use RwLock instead
  state: Arc<crate::SharedRequestState>,
}

impl HolderInitializer {
  pub fn new(
    media_file: MediaFile,
    state: Arc<crate::SharedRequestState>,
    strategy: SpeechToTextStrategy,
  ) -> Self {
    let duration = media_file.duration;
    let step = match strategy {
      SpeechToTextStrategy::Whisper => 600.0, // 10 minute chunks.
      SpeechToTextStrategy::GoogleCloud(_) => duration, // Google doesn't need chunking.
      SpeechToTextStrategy::ScribeV1(_) => duration, // Scribe doesn't need chunking.
    };
    Self {
      step,
      client: Arc::new(reqwest::Client::new()),
      strategy,
      media_file,
      holder: Arc::new(Mutex::new(Holder::new(step, duration))),
      state,
    }
  }

  pub fn holder(&self) -> Arc<Mutex<Holder>> {
    self.holder.clone()
  }

  pub fn strategy(&self) -> &SpeechToTextStrategy {
    &self.strategy
  }

  /// Slices the audio file into `step`-seconds long slices and sends them to the OpenAI API
  /// This happens from the start of the file until `end`-seconds into the file.
  /// This lets us support things like fast preview efficiently.
  pub async fn initialize_until(&mut self, mut end: f64) -> anyhow::Result<()> {
    if end > self.media_file.duration {
      end = self.media_file.duration;
    }

    let end_index = (end / self.step).ceil() as usize;
    let state = self.state.clone();

    let tasks: Vec<_> = (0..end_index)
      .map(|index| {
        let client = self.client.clone();
        let media_file = self.media_file.clone();
        let holder = self.holder.clone();
        let step = self.step;
        let strategy = self.strategy.clone();
        let state = state.clone();
        tokio::spawn(async move {
          {
            let h = holder.lock().await;
            if h.ranges[index].is_some() {
              return Ok::<(), anyhow::Error>(());
            }
          }

          let start = index as f64 * step;
          let slice_end = (start + step).min(media_file.duration);
          let slice = media_file.slice(start, slice_end)?;
          let range: Range = match strategy {
            SpeechToTextStrategy::Whisper => {
              whisper::send_request_with_retries(slice, client.clone(), 3).await?
            }
            SpeechToTextStrategy::GoogleCloud(GoogleCloudStrategyParams {
              transcript_id,
              test_mode,
              language,
            }) => {
              speech::scribe::process_scribe_job(state.clone(), media_file.clone(), transcript_id)
                .await?;
              let key: String = get_upload_key(transcript_id, test_mode);
              speech::google::wait_for_gcs_ready(&key).await?;
              speech::google::transcribe(&key, &language).await?
            }
            SpeechToTextStrategy::ScribeV1(ScribeV1Params { transcript_id, .. }) => {
              speech::scribe::process_scribe_job(state.clone(), media_file.clone(), transcript_id)
                .await?;
              // Placeholder to mark Scribe completion at this index
              Range {
                task: "transcribe".to_string(),
                language: String::new(),
                duration: 0.0,
                text: String::new(),
                words: Some(Vec::new()),
                source: Some(Source::Scribe),
              }
            }
          };

          {
            let mut h = holder.lock().await;
            h.add(index, range);
          }
          Ok(())
        })
      })
      .collect();

    for res in futures::future::join_all(tasks).await {
      res??;
    }

    let mut h = self.holder.lock().await;
    return h.prepare_for_search();
  }

  /// Transcribes all ranges in the media file and prepares them for searching with get_segment().
  pub async fn initialize_until_end(&mut self) -> anyhow::Result<()> {
    return self.initialize_until(self.media_file.duration).await;
  }

  /// Waits until all ranges up to `secs` are filled in.
  pub async fn wait_for_ranges_up_to(&self, secs: f64) -> anyhow::Result<()> {
    let needed_ranges = (secs / self.step).ceil() as usize;
    loop {
      {
        let h = self.holder.lock().await;
        if h.ranges.iter().take(needed_ranges).all(|r| r.is_some()) {
          return Ok(());
        }
      }
      tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
  }

  pub async fn wait_for_ranges_up_to_end(&self) -> anyhow::Result<()> {
    return self.wait_for_ranges_up_to(self.media_file.duration).await;
  }

  pub async fn get_utilization_stats(&self) -> anyhow::Result<WordUtilizationMetrics> {
    let holder = self.holder.lock().await;
    let total_words = holder.words.len();

    // TODO: This is likely very slow so we should remove it once we fix the word loss issue.
    for word_idx in holder.words.iter() {
      if !holder.word_usage.is_word_used(word_idx) {
        if let Ok(word) = holder.get_word(word_idx) {
          debug!("Word not used: {:?}", word);
        } else {
          debug!("Bad word at index: {:?}", word_idx);
        }
      }
    }

    return Ok(
      holder
        .word_usage
        .calculate_metrics_from_tracker(total_words),
    );
  }
}

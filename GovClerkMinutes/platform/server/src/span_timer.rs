use std::collections::HashMap;
use std::hash::Hash;
use std::sync::Mutex;
use std::time::{Duration, Instant};

#[derive(Debug, Hash, PartialEq, Eq, Clone, Copy)]
pub enum TimeSpanEvent {
  GetDiarizationInitialQuery,
  GetDiarizationFileDownload,
  GetDiarizationParallelSliceSnippetToken,
  GetDiarizationTokenRequiredUpdate,
  GetDiarizationInsertSegments,
  GetDiarizationPreview,
  GetDiarization,
  TranscribeSegmentsPreview,
  TranscribeSegments,
  CreateMinutes,
  TotalTranscribe,
  TotalTranscribePreview,
}

/// A threadsafe timer for measuring the duration of events.
/// Stop littering the codebase with ad-hoc timing code.  Use this instead.
/// Designed to be request-local.  Create a new one for each request.
/// Use the `start` and `stop` methods to record the start and stop of an event.
pub struct SpanTimer<T> {
  events: Mutex<HashMap<T, Vec<Duration>>>,
  active_timers: Mutex<HashMap<T, Instant>>,
}

impl<T: Eq + Hash + Copy> SpanTimer<T> {
  pub fn new() -> Self {
    SpanTimer {
      events: Mutex::new(HashMap::new()),
      active_timers: Mutex::new(HashMap::new()),
    }
  }

  pub fn start(&self, event: T) {
    let mut active_timers = self.active_timers.lock().unwrap();
    active_timers.insert(event, Instant::now());
  }

  pub fn stop(&self, event: T) -> Option<Duration> {
    let mut active_timers = self.active_timers.lock().unwrap();
    if let Some(start) = active_timers.remove(&event) {
      let duration = start.elapsed();
      let mut events = self.events.lock().unwrap();
      events.entry(event).or_default().push(duration);
      Some(duration)
    } else {
      None
    }
  }

  #[allow(dead_code)]
  pub fn durations(&self) -> Vec<(T, Duration)> {
    let events = self.events.lock().unwrap();
    events
      .iter()
      .flat_map(|(event, durations)| durations.iter().map(move |&duration| (*event, duration)))
      .collect()
  }

  pub fn get(&self, event: T) -> Option<Duration> {
    let active_timers = self.active_timers.lock().unwrap();
    active_timers
      .get(&event)
      .map(|start| start.elapsed())
      .or_else(|| {
        let events = self.events.lock().unwrap();
        events
          .get(&event)
          .and_then(|durations| durations.last().copied())
      })
  }
}

use serde::de::DeserializeOwned;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{watch, Mutex};
use tracing::error;

#[derive(Clone, Debug, PartialEq, Eq)]
pub enum DiarizationStatus {
  Pending,
  Succeeded,
  Failed,
}

/// Holds both the sender and receiver so that a receiver is always active.
#[derive(Clone)]
pub struct DiarizationEntry {
  pub tx: watch::Sender<DiarizationStatus>,
  pub rx: watch::Receiver<DiarizationStatus>,
  pub payload: Option<serde_json::Value>,
}

#[derive(Clone)]
pub struct TranscriptManager {
  inner: Arc<Mutex<HashMap<u64, DiarizationEntry>>>,
}

impl TranscriptManager {
  pub fn new() -> Self {
    Self {
      inner: Arc::new(Mutex::new(HashMap::new())),
    }
  }

  /// Start a diarization job for the given transcript.
  /// This creates a watch channel with an initial status of `Pending`
  /// and stores both the sender and receiver in the hashmap.
  /// Returns a RAII guard that will cancel the job if not completed.
  pub async fn start_diarization(&self, transcript_id: u64) -> DiarizationGuard {
    let (tx, rx) = watch::channel(DiarizationStatus::Pending);
    {
      let mut map = self.inner.lock().await;
      map.insert(
        transcript_id,
        DiarizationEntry {
          tx,
          rx,
          payload: None,
        },
      );
    }
    DiarizationGuard {
      transcript_id,
      transcript_manager: self.clone(),
      completed: false,
    }
  }

  /// Mark a job as successfully completed by sending a status update.
  pub async fn complete_diarization(&self, transcript_id: u64) -> anyhow::Result<()> {
    let maybe_entry = {
      let map = self.inner.lock().await;
      map.get(&transcript_id).cloned()
    };
    if let Some(entry) = maybe_entry {
      // We ignore errors here (e.g. if no receiver exists) by using `let _ =`
      let _ = entry.tx.send(DiarizationStatus::Succeeded);
    }
    Ok(())
  }

  /// Retrieve a stored payload (if any) for a completed diarization.
  pub async fn get_payload(&self, transcript_id: u64) -> Option<serde_json::Value> {
    let map = self.inner.lock().await;
    map
      .get(&transcript_id)
      .and_then(|entry| entry.payload.as_ref())
      .cloned()
  }

  /// Cancel a pending diarization job by sending a failure status.
  pub async fn cancel_diarization(&self, transcript_id: u64) -> anyhow::Result<()> {
    let maybe_entry = {
      let map = self.inner.lock().await;
      map.get(&transcript_id).cloned()
    };
    if let Some(entry) = maybe_entry {
      let _ = entry.tx.send(DiarizationStatus::Failed);
    }
    Ok(())
  }

  /// Wait for diarization success with a timeout.
  pub async fn wait_for_diarization(
    &self,
    transcript_id: u64,
    timeout: Duration,
  ) -> anyhow::Result<()> {
    let mut rx = {
      let map = self.inner.lock().await;
      match map.get(&transcript_id) {
        Some(entry) => entry.rx.clone(),
        None => {
          return Err(anyhow::anyhow!(
            "no diarization job registered for transcript {}",
            transcript_id
          ));
        }
      }
    };

    // Wait with timeout until a non-Pending status is observed.
    let rx_after_timeout = rx.clone();
    let fut = async move {
      loop {
        if *rx.borrow() != DiarizationStatus::Pending {
          return rx.borrow().clone();
        }
        if rx.changed().await.is_err() {
          // Sender dropped; treat as failure unless it reported success
          return if *rx.borrow() != DiarizationStatus::Pending {
            rx.borrow().clone()
          } else {
            DiarizationStatus::Failed
          };
        }
      }
    };

    let status_result = tokio::time::timeout(timeout, fut).await;
    match status_result {
      Ok(DiarizationStatus::Succeeded) => Ok(()),
      Ok(DiarizationStatus::Failed) => Err(anyhow::anyhow!(
        "Diarization failed for transcript {}",
        transcript_id
      )),
      Ok(DiarizationStatus::Pending) => Err(anyhow::anyhow!(
        "Diarization stuck in pending for transcript {}",
        transcript_id
      )),
      Err(_) => {
        // Timeout fired so check the latest observed value in case it succeeded just after the deadline.
        match *rx_after_timeout.borrow() {
          DiarizationStatus::Succeeded => Ok(()),
          DiarizationStatus::Failed => Err(anyhow::anyhow!(
            "Diarization failed for transcript {}",
            transcript_id
          )),
          DiarizationStatus::Pending => Err(anyhow::anyhow!(
            "Diarization timed out for transcript {}",
            transcript_id
          )),
        }
      }
    }
  }

  /// Retrieve payload and parse as type T.
  pub async fn get_payload_typed<T: DeserializeOwned>(
    &self,
    transcript_id: u64,
  ) -> anyhow::Result<T> {
    let raw = self
      .get_payload(transcript_id)
      .await
      .ok_or_else(|| anyhow::anyhow!("No payload for transcript {}", transcript_id))?;
    let parsed = serde_json::from_value::<T>(raw)?;
    Ok(parsed)
  }

  /// Remove the entire diarization entry for this transcript to free memory.
  pub async fn finish(&self, transcript_id: u64) {
    let mut map = self.inner.lock().await;
    map.remove(&transcript_id);
  }

  /// Returns true if a diarization job entry is present for the transcript.
  pub async fn has_job(&self, transcript_id: u64) -> bool {
    let map = self.inner.lock().await;
    map.contains_key(&transcript_id)
  }
}

/// A RAII guard that ensures the diarization job is either explicitly completed
/// or canceled when the guard is dropped.
pub struct DiarizationGuard {
  transcript_id: u64,
  transcript_manager: TranscriptManager,
  completed: bool,
}

impl DiarizationGuard {
  /// Mark the job as complete, optionally attaching a payload.
  pub async fn complete(mut self, payload: Option<serde_json::Value>) -> anyhow::Result<()> {
    if let Some(payload) = payload {
      let mut map = self.transcript_manager.inner.lock().await;
      if let Some(entry) = map.get_mut(&self.transcript_id) {
        entry.payload = Some(payload);
      } else {
        return Err(anyhow::anyhow!(
          "no diarization job registered (guard invalid) for transcript {}",
          self.transcript_id
        ));
      }
    }

    self
      .transcript_manager
      .complete_diarization(self.transcript_id)
      .await?;
    self.completed = true;
    Ok(())
  }
}

impl Drop for DiarizationGuard {
  fn drop(&mut self) {
    if !self.completed {
      let transcript_id = self.transcript_id;
      let manager = self.transcript_manager.clone();
      tokio::spawn(async move {
        manager
          .cancel_diarization(transcript_id)
          .await
          .unwrap_or_else(|e| {
            error!("Failed to cancel diarization: {:?}", e);
          });
      });
    }
  }
}

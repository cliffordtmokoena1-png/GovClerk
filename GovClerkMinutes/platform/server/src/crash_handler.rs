use crate::{
  posthog::{PostHogEventType, ANONYMOUS_POSTHOG_PANIC_ID},
  SharedRequestState,
};
use backtrace::Backtrace;
use chrono::Utc;
use mysql_async::{
  params,
  prelude::{Query, WithParams},
};
use serde::{Deserialize, Serialize};
use std::io::Write;
use std::{fs::OpenOptions, panic, sync::Arc};
use tokio::fs;
use uuid::Uuid;

#[derive(Serialize, Deserialize)]
struct Tombstone {
  id: String,
  message: String,
  location: String,
  backtrace: Vec<String>,
}

pub fn install_crash_handler() {
  panic::set_hook(Box::new(|panic_info| {
    let id = Uuid::new_v4().to_string();

    let message = if let Some(msg) = panic_info.payload().downcast_ref::<&str>() {
      format!("Panic occurred: {}", msg)
    } else {
      "Panic occurred!".to_string()
    };

    let location = if let Some(location) = panic_info.location() {
      format!(
        "Panic occurred in file '{}' at line {}",
        location.file(),
        location.line()
      )
    } else {
      "No location information available.".to_string()
    };

    let crash_report = Tombstone {
      id: id.clone(),
      message,
      location,
      backtrace: format!("{:?}", Backtrace::new())
        .split('\n')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect(),
    };

    let json_report = match serde_json::to_string_pretty(&crash_report) {
      Ok(json) => json,
      Err(err) => {
        eprintln!("Failed to serialize crash report to JSON: {}", err);
        return;
      }
    };

    let timestamp = Utc::now().format("%Y-%m-%d_%H-%M-%S");
    let filename = format!("crash_tombstone_{}.json", timestamp);

    if let Err(err) = OpenOptions::new()
      .create_new(true)
      .write(true)
      .open(&filename)
      .and_then(|mut file| writeln!(file, "{}", json_report))
    {
      eprintln!("Failed to write tombstone file: {}", err);
    }

    eprintln!("{}", json_report);
  }));
}

async fn find_tombstones() -> anyhow::Result<Vec<Tombstone>> {
  let mut tombstones = Vec::new();

  let current_dir = std::env::current_dir()?;
  let mut dir = fs::read_dir(&current_dir).await?;

  while let Some(entry) = dir.next_entry().await? {
    let path = entry.path();

    // Look for files named like "crash_tombstone_*.json"
    if let Some(file_name) = path.file_name().and_then(|f| f.to_str()) {
      if file_name.starts_with("crash_tombstone_") && file_name.ends_with(".json") {
        match fs::read_to_string(&path).await {
          Ok(content) => {
            match serde_json::from_str(&content) {
              Ok(json_value) => {
                tombstones.push(serde_json::from_value(json_value)?);
                // Remove the tombstone file after successfully reading it.
                if let Err(e) = fs::remove_file(&path).await {
                  eprintln!("Failed to remove tombstone file {}: {}", file_name, e);
                }
              }
              Err(e) => {
                eprintln!(
                  "Failed to parse tombstone file {} as JSON: {}",
                  file_name, e
                );
              }
            }
          }
          Err(e) => {
            eprintln!("Failed to read tombstone file {}: {}", file_name, e);
          }
        }
      }
    }
  }

  return Ok(tombstones);
}

async fn log_tombstone(
  state: Arc<SharedRequestState>,
  tombstone: &Tombstone,
) -> anyhow::Result<()> {
  let tombstone_val = serde_json::to_value(tombstone)?;

  PostHogEventType::TombstoneFound.capture(
    ANONYMOUS_POSTHOG_PANIC_ID.to_string(),
    tombstone_val.clone(),
  );

  let conn = state.db.get_conn().await?;
  "
  INSERT INTO tombstones (id, json)
  VALUES (:id, :json)
  "
  .with(params! {
    "id" => &tombstone.id,
    "json" => &tombstone_val,
  })
  .ignore(conn)
  .await?;

  return Ok(());
}

pub async fn find_and_log_tombstones(state: Arc<SharedRequestState>) -> anyhow::Result<usize> {
  let tombstones = find_tombstones().await?;

  for tombstone in tombstones.iter() {
    log_tombstone(state.clone(), tombstone).await?;
  }

  return Ok(tombstones.len());
}

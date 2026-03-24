use crate::error::LogError;
use axum::http::StatusCode;
use mysql_async::{
  params,
  prelude::{Query, Queryable, WithParams},
  Conn,
};
use serde::{Deserialize, Serialize};
use std::{fmt, str::FromStr};

// --- STEP STATE MANAGEMENT ---

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum MinutesPipelineStep {
  MeetingNotes,
  FirstDraft,
  OracleFeedback,
  FinalMinutes,
  Regeneration(usize),
  ImageToMeetingNotes,
  ImageFinalMinutes,
}

impl fmt::Display for MinutesPipelineStep {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      MinutesPipelineStep::MeetingNotes => write!(f, "MeetingNotes"),
      MinutesPipelineStep::FirstDraft => write!(f, "FirstDraft"),
      MinutesPipelineStep::OracleFeedback => write!(f, "OracleFeedback"),
      MinutesPipelineStep::FinalMinutes => write!(f, "FinalMinutes"),
      MinutesPipelineStep::Regeneration(version) => write!(f, "Regeneration:v{}", version),
      MinutesPipelineStep::ImageToMeetingNotes => write!(f, "ImageToMeetingNotes"),
      MinutesPipelineStep::ImageFinalMinutes => write!(f, "ImageFinalMinutes"),
    }
  }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum StepStatus {
  NotStarted,
  InProgress,
  Success,
  Failed(String),
}

impl fmt::Display for StepStatus {
  fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
    match self {
      StepStatus::NotStarted => write!(f, "NotStarted"),
      StepStatus::InProgress => write!(f, "InProgress"),
      StepStatus::Success => write!(f, "Success"),
      StepStatus::Failed(_) => write!(f, "Failed"),
    }
  }
}

impl FromStr for StepStatus {
  type Err = anyhow::Error;

  fn from_str(s: &str) -> Result<Self, Self::Err> {
    match s {
      "NotStarted" => Ok(StepStatus::NotStarted),
      "InProgress" => Ok(StepStatus::InProgress),
      "Success" => Ok(StepStatus::Success),
      "Failed" => Ok(StepStatus::Failed(String::new())),
      _ => Err(anyhow::anyhow!("Unknown step status")),
    }
  }
}

pub async fn save_step_state(
  conn: &mut Conn,
  transcript_id: u64,
  user_id: &str,
  step: &MinutesPipelineStep,
  status: &StepStatus,
) -> anyhow::Result<()> {
  let error_str = if let StepStatus::Failed(msg) = status {
    Some(msg)
  } else {
    None
  };

  let org_id_row: Option<Option<String>> = conn
    .exec_first(
      "SELECT org_id FROM transcripts WHERE id = ?",
      (transcript_id,),
    )
    .await?;

  let org_id: Option<String> = org_id_row.flatten();

  conn.exec_drop(
    "REPLACE INTO minutes_step_state (transcript_id, user_id, org_id, step, status, error, updated_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
    (transcript_id, user_id, org_id, step.to_string(), status.to_string(), error_str),
  ).await?;

  return Ok(());
}

pub async fn get_step_state(
  conn: &mut Conn,
  transcript_id: u64,
  user_id: &str,
  step: &MinutesPipelineStep,
) -> anyhow::Result<Option<StepStatus>> {
  let row: Option<(String, Option<String>)> = conn
    .exec_first(
      "
      SELECT status, error
      FROM minutes_step_state
      WHERE transcript_id = ?
      AND user_id = ?
      AND step = ?
      ",
      (transcript_id, user_id, step.to_string()),
    )
    .await?;

  if let Some((status_str, error)) = row {
    let mut status = StepStatus::from_str(&status_str).unwrap_or(StepStatus::NotStarted);
    if let StepStatus::Failed(_) = status {
      status = StepStatus::Failed(error.unwrap_or_default());
    }
    return Ok(Some(status));
  } else {
    return Ok(None);
  }
}

pub async fn update_minutes_field(
  conn: &mut Conn,
  transcript_id: u64,
  user_id: &str,
  field_name: &str,
  field_value: &str,
) -> Result<(), StatusCode> {
  let query = format!("UPDATE minutes SET {} = :field_value WHERE transcript_id = :transcript_id AND user_id = :user_id AND fast_mode = 0", field_name);

  query
    .with(params! {
      "transcript_id" => transcript_id,
      "user_id" => user_id,
      "field_value" => field_value,
    })
    .ignore(&mut *conn)
    .await
    .map_and_log_err(
      &format!("failure updating {} field for minutes db", field_name),
      StatusCode::INTERNAL_SERVER_ERROR,
    )?;

  Ok(())
}

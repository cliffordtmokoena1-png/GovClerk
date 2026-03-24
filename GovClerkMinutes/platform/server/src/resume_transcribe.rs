use axum::{
  extract::{Json, State},
  response::IntoResponse,
};
use http::StatusCode;
use mysql_async::{
  params,
  prelude::{Query, Queryable, WithParams},
  TxOpts,
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::sync::Arc;
use tracing::{error, info, warn};

use crate::{
  create_minutes::start_minutes_creation,
  error::LogError,
  get_diarization::{on_transcribe_finished, GCSegmentsRow},
  media_file::MediaFile,
  posthog::PostHogEventType,
  s3::get_object,
  span_timer::{SpanTimer, TimeSpanEvent},
  speech::{
    detection::is_whisper_supported_for_language,
    strategy::{GoogleCloudStrategyParams, SpeechToTextStrategy},
  },
  transcribed_ranges::HolderInitializer,
  transcript::{Segment, Transcript},
  upload_key::get_upload_key,
  utils::{
    db::{insert_gc_segments_batch, update_segments_table, SegmentUpdate},
    time::timestamp_to_seconds,
  },
  SharedRequestState,
};

// TODO: authenticate this webhook

#[derive(Deserialize, Serialize)]
pub struct ResumeTranscribeResponse {}

pub async fn fail_job(
  transcript_id: u64,
  status: u64,
  state: Arc<SharedRequestState>,
  user_id: String,
  fast_mode: bool,
) -> anyhow::Result<()> {
  error!(
    "FAILING JOB IN RESUME TRANSCRIBE: {} {} {} {}",
    user_id, transcript_id, status, fast_mode
  );

  // TODO: log upload_kind
  PostHogEventType::TranscribeFailed.capture(
    user_id.clone(),
    json!({
      "transcript_id": transcript_id,
      "error_code": status,
      "fast_mode": fast_mode,
    }),
  );

  let mut conn = state.db.get_conn().await?;
  return r"UPDATE transcripts SET transcribe_failed = :status WHERE id = :id"
    .with(params! {
      "id" => transcript_id,
      "status" => status,
    })
    .ignore(&mut conn)
    .await
    .map_err(|err| anyhow::anyhow!("failed to update transcript: {}", err));
}

/// Called to ensure we only call this api endpoint once per paused transcript.
/// If the transcript is not paused, we return true.  If not, we return false,
/// and mark transcribe_paused = 0.  This is done inside a mysql transaction to
/// avoid races.
async fn check_is_already_resumed(
  conn: &mut mysql_async::Conn,
  transcript_id: u64,
) -> anyhow::Result<bool> {
  let mut tx = conn.start_transaction(TxOpts::default()).await?;

  let result: Option<(i32, i32)> = tx
    .exec_first(
      "SELECT transcribe_paused, transcribe_failed FROM transcripts WHERE id = ? FOR UPDATE",
      (transcript_id,),
    )
    .await?;

  if let Some((transcribe_paused, transcribe_failed)) = result {
    if transcribe_paused == 0 || transcribe_failed != 0 {
      tx.commit().await?;
      return Ok(true);
    }
  }

  tx.exec_drop(
    "UPDATE transcripts SET transcribe_paused = 0 WHERE id = ?",
    (transcript_id,),
  )
  .await?;

  tx.commit().await?;

  return Ok(false);
}

pub async fn transcribe_segments(
  transcript_id: u64,
  media_file: MediaFile,
  state: Arc<SharedRequestState>,
  timer: Arc<SpanTimer<TimeSpanEvent>>,
  user_id: String,
  language: Option<String>,
  test_mode: bool,
) -> anyhow::Result<()> {
  let mut conn = state.db.get_conn().await?;
  let fast_mode = false; // Always false when resuming a paused transcript.

  let mut holder_initializer = match language {
    Some(ref lang) if is_whisper_supported_for_language(lang) => {
      // Sometimes the user selects a language that actually is supported by
      // whisper, so best to just try and use whisper.
      HolderInitializer::new(
        media_file.clone(),
        state.clone(),
        SpeechToTextStrategy::Whisper,
      )
    }
    Some(language) => HolderInitializer::new(
      media_file.clone(),
      state.clone(),
      SpeechToTextStrategy::GoogleCloud(GoogleCloudStrategyParams {
        transcript_id,
        test_mode,
        language,
      }),
    ),
    None => HolderInitializer::new(
      media_file.clone(),
      state.clone(),
      SpeechToTextStrategy::Whisper,
    ),
  };

  holder_initializer.initialize_until_end().await?;

  info!(
    "Waiting for STT/diarization ranges for transcript {}",
    transcript_id
  );
  holder_initializer.wait_for_ranges_up_to_end().await?;
  info!("Ranges ready for transcript {}", transcript_id);

  let transcript = Transcript::from_db(&mut conn, transcript_id, fast_mode).await?;

  let holder = holder_initializer.holder();

  let mut updates: Vec<SegmentUpdate> = Vec::new();
  for (
    i,
    Segment {
      start,
      stop,
      speaker: _speaker,
      transcript,
    },
  ) in transcript.segments.iter().enumerate()
  {
    let start = timestamp_to_seconds(start)?;
    let stop = timestamp_to_seconds(stop)?;
    let mut holder = holder.lock().await;
    let new_transcript = holder.get_segment(start.into(), stop.into())?;

    updates.push(SegmentUpdate {
      segment_index: i,
      source: "openai".to_string(),
      transcript: if transcript.is_some() {
        None
      } else {
        new_transcript
      },
    });
  }

  let orphaned_segments = {
    let raw = holder.lock().await.get_orphaned_segments();
    raw
      .into_iter()
      .filter(|seg| timestamp_to_seconds(&seg.stop).unwrap_or(0.0) > 600.0)
      .map(|seg| GCSegmentsRow {
        transcript_id,
        start: seg.start,
        stop: seg.stop,
        speaker: seg.speaker,
        transcript: seg.transcript,
        segment_index: 0,
        fast_mode,
        is_user_visible: true,
        is_orphan: true,
      })
      .collect::<Vec<GCSegmentsRow>>()
  };

  insert_gc_segments_batch(&mut conn, &orphaned_segments).await?;

  update_segments_table(transcript_id, state.clone(), updates).await?;

  info!("All segments transcribed for transcript {}", transcript_id);

  let word_utilization = if fast_mode {
    None // Ignore utilization for fast_mode because it's an incomplete transcript.
  } else {
    Some(holder_initializer.get_utilization_stats().await?)
  };

  let stt_source = holder_initializer.strategy().to_string();
  PostHogEventType::FileTranscribed.capture(
    user_id.clone(),
    json!({
      "transcript_id": transcript_id,
      "stt_source": stt_source,
    }),
  );

  on_transcribe_finished(
    transcript_id,
    user_id,
    test_mode,
    fast_mode,
    &mut conn,
    word_utilization,
    timer,
    state.clone(),
  )
  .await?;

  return Ok(());
}

#[derive(Deserialize, Serialize)]
pub struct ResumeTranscribeQuery {
  #[serde(rename = "transcriptId")]
  transcript_id: u64,
  test: Option<String>,
}

#[derive(Deserialize, Serialize, Clone)]
struct TranscriptionData {
  s3_audio_key: String,
  user_id: String,
}

type TranscriptRow = (
  String,         // userId
  Option<i32>,    // tokens_required
  String,         // aws_region
  String,         // upload_kind
  Option<String>, // language
  Option<String>, // org_id
  i32,            // current_balance
);

pub async fn resume_transcribe_handler(
  axum::extract::Query(ResumeTranscribeQuery {
    transcript_id,
    test,
  }): axum::extract::Query<ResumeTranscribeQuery>,
  State(state): State<Arc<SharedRequestState>>,
  Json(body): Json<Value>,
) -> Result<impl IntoResponse, StatusCode> {
  info!("got webhook response {:?}", body);
  let timer = Arc::new(SpanTimer::new());

  let test_mode = test.is_some();

  let mut conn = state
    .db
    .get_conn()
    .await
    .map_and_log_err("conn error", StatusCode::INTERNAL_SERVER_ERROR)?;

  let rows: Vec<TranscriptRow> = conn
    .exec(
      r#"
      SELECT 
          t.userId, 
          t.credits_required,
          t.aws_region,
          t.upload_kind,
          t.language,
          t.org_id,
          COALESCE(
            CASE
              WHEN t.org_id IS NOT NULL THEN (SELECT SUM(p.credit) FROM payments p WHERE p.org_id = t.org_id)
              ELSE (SELECT SUM(p.credit) FROM payments p WHERE p.user_id = t.userId AND p.org_id IS NULL)
            END,
            0
          ) AS current_balance
      FROM 
          transcripts t 
      WHERE 
          t.id = :transcript_id
    "#,
      params! {
        "transcript_id" => transcript_id,
      },
    )
    .await
    .map_and_log_err(
      "failed to query user info",
      StatusCode::INTERNAL_SERVER_ERROR,
    )?;

  let (user_id, tokens_required, region, upload_kind, language, org_id, current_balance) =
    rows.first().cloned().ok_or(StatusCode::NOT_FOUND)?;

  if upload_kind != "audio" {
    let started =
      start_minutes_creation(user_id, state, transcript_id, upload_kind, test_mode).await?;
    if started {
      info!("Started minutes creation for transcript {}", transcript_id);
    } else {
      // Minutes already in progress - this is fine, treat as idempotent success
      info!(
        "Minutes creation already started for transcript {}, treating as success",
        transcript_id
      );
    }
    return Ok(axum::response::Json(ResumeTranscribeResponse {}));
  }

  let object = get_object(
    state.clone(),
    region,
    get_upload_key(transcript_id, test_mode),
  )
  .await
  .map_err(|err| {
    error!("failed to get object from s3: {}", err);
    StatusCode::NOT_FOUND
  })?;

  let media_file = MediaFile::init(object.body.into_async_read())
    .await
    .map_err(|err| {
      error!("failed to init media file: {}", err);
      StatusCode::INTERNAL_SERVER_ERROR
    })?;

  resume_transcribe_handler_impl(
    transcript_id,
    state,
    user_id,
    org_id,
    language,
    tokens_required.ok_or(StatusCode::INTERNAL_SERVER_ERROR)?,
    current_balance,
    timer,
    test_mode,
    &media_file,
  )
  .await
  .map_and_log_err(
    "failed to successfully call resume transcribe handler",
    StatusCode::INTERNAL_SERVER_ERROR,
  )?;

  return Ok(axum::response::Json(ResumeTranscribeResponse {}));
}

fn transcribe_segments_in_bg(
  transcript_id: u64,
  media_file: MediaFile,
  state: Arc<SharedRequestState>,
  timer: Arc<SpanTimer<TimeSpanEvent>>,
  user_id: String,
  language: Option<String>,
  test_mode: bool,
) {
  tokio::spawn(async move {
    match transcribe_segments(
      transcript_id,
      media_file,
      state.clone(),
      timer,
      user_id.clone(),
      language,
      test_mode,
    )
    .await
    {
      Ok(()) => {
        info!("transcribe_segments succeeded in bg");
      }
      Err(e) => {
        error!("transcribe_segments failed: {}", e.to_string());
        fail_job(transcript_id, 91, state, user_id, false)
          .await
          .expect("fail job failed");
      }
    };
  });
}

async fn resume_transcribe_handler_impl(
  transcript_id: u64,
  state: Arc<SharedRequestState>,
  user_id: String,
  org_id: Option<String>,
  language: Option<String>,
  tokens_required: i32,
  current_balance: i32,
  timer: Arc<SpanTimer<TimeSpanEvent>>,
  test_mode: bool,
  media_file: &MediaFile,
) -> anyhow::Result<()> {
  timer.start(TimeSpanEvent::TranscribeSegments);

  info!(
    "resume transcribe handler for transcript {}, test_mode: {}, current_balance: {}, tokens_required: {}",
    transcript_id, test_mode, current_balance, tokens_required
  );

  let insufficient_tokens = current_balance < tokens_required;

  if insufficient_tokens {
    return Ok(());
  }

  let mut conn = state.db.get_conn().await?;

  if check_is_already_resumed(&mut conn, transcript_id).await? {
    warn!("transcript {} was already resumed", transcript_id);
    return Ok(());
  }

  r"INSERT INTO payments (user_id, org_id, transcript_id, credit, action, billing_subject) VALUES (:user_id, :org_id, :transcript_id, :credit, 'sub', :billing_subject);"
    .with(params! {
      "user_id" => user_id.clone(),
      "org_id" => org_id.clone(),
      "transcript_id" => transcript_id,
      "credit" => -tokens_required,
      "billing_subject" => if org_id.is_some() { "org" } else { "user" },
    })
    .ignore(&mut conn)
    .await?;

  transcribe_segments_in_bg(
    transcript_id,
    media_file.clone(),
    state.clone(),
    timer.clone(),
    user_id.clone(),
    language,
    test_mode,
  );

  return Ok(());
}

use axum::{
  extract::{Json, State},
  headers::{authorization::Bearer, Authorization},
  response::IntoResponse,
  TypedHeader,
};

use http::StatusCode;
use mysql_async::{
  params,
  prelude::{BatchQuery, Query, Queryable, WithParams},
  Conn, TxOpts,
};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::{cmp::max, env, sync::Arc};
use tokio::task;
use tracing::{error, info, warn};

use crate::{
  create_minutes::{self, start_minutes_creation},
  error::LogError,
  get_email::get_primary_email,
  google,
  media_file::MediaFile,
  posthog::PostHogEventType,
  resume_transcribe::fail_job,
  s3::get_object,
  span_timer::{SpanTimer, TimeSpanEvent},
  speaker_identification::{process_speaker_identities, PreviousSpeaker},
  speech::{
    detection::{is_whisper_supported, is_whisper_supported_for_language},
    scribe::convert_scribe_to_transcript,
    strategy::{GoogleCloudStrategyParams, ScribeV1Params, SpeechToTextStrategy},
    whisper,
  },
  transcribed_ranges::{self, HolderInitializer, WordUtilizationMetrics},
  transcript::Transcript,
  upload_key::get_upload_key,
  utils::{db, time},
  SharedRequestState,
};
use anyhow::Context;
use chrono::{DateTime, NaiveDateTime, TimeZone, Utc};

#[derive(Deserialize, Serialize)]
pub struct GetDiarizationBody {
  s3_audio_key: String,
}

#[derive(Deserialize, Serialize)]
pub struct GetDiarizationResponse {}

#[derive(Deserialize)]
pub struct GetDiarizationQueryParam {
  test: Option<String>,
  prodindev: Option<String>,
  afterlanguage: Option<String>,
}

async fn get_required_tokens(media_file: &MediaFile) -> anyhow::Result<i32> {
  // Get number of minutes and then round down to nearest int. If 0, round up to 1.
  return Ok(max((media_file.duration / 60.0).floor() as i32, 1_i32));
}

async fn get_snippet(
  state: Arc<SharedRequestState>,
  transcript_id: u64,
  media_file: &MediaFile,
  http_client: Arc<reqwest::Client>,
) -> anyhow::Result<()> {
  let first_3_seconds = media_file.slice(0.0, 3.0)?;

  let range = whisper::send_request_with_retries(first_3_seconds, http_client, 1).await?;
  let snippet = range.text;

  info!("Got snippet: {:?}", snippet);

  let mut conn = state.db.get_conn().await?;

  r"UPDATE transcripts SET snippet = :snippet WHERE id = :transcript_id"
    .with(params! {
      "snippet" => snippet,
      "transcript_id" => transcript_id,
    })
    .ignore(&mut conn)
    .await?;

  return Ok(());
}

/// Uses a transaction to ensure no races and that this endpoint is idempotent
/// AKA resilient to duplicate uploads from the client.  We want this to ensure
/// we don't double-deduct tokens if an upload is retried e.g. as part of a
/// background sync API retry in Chrome
///
/// Also returns true if the job was failed e.g. by a timeout, which is nice
/// because then we won't deduct tokens from the user for an upload that is
/// retried after it's marked timed out.
async fn upload_already_happened(
  conn: &mut mysql_async::Conn,
  transcript_id: u64,
) -> anyhow::Result<bool> {
  let mut tx = conn.start_transaction(TxOpts::default()).await?;

  let result: Option<(i32, i32)> = tx
    .exec_first(
      "SELECT upload_complete, transcribe_failed FROM transcripts WHERE id = ? FOR UPDATE",
      (transcript_id,),
    )
    .await?;

  if let Some((upload_complete, transcribe_failed)) = result {
    if upload_complete == 1 || transcribe_failed != 0 {
      tx.commit().await?;
      return Ok(true);
    }
  }

  tx.exec_drop(
    "UPDATE transcripts SET upload_complete = 1 WHERE id = ?",
    (transcript_id,),
  )
  .await?;

  tx.commit().await?;

  return Ok(false);
}

async fn fetch_previous_speakers(
  conn: &mut mysql_async::Conn,
  user_id: &str,
  transcript_id: u64,
) -> anyhow::Result<Vec<PreviousSpeaker>> {
  let org_id: Option<String> = conn
    .exec_first(
      "SELECT org_id FROM transcripts WHERE id = ?",
      (transcript_id,),
    )
    .await?
    .flatten();

  let result: Vec<mysql_async::Row> = if let Some(org_id) = org_id {
    r"
      SELECT s.id, s.userId, s.name, s.embedding
      FROM speakers s
      INNER JOIN transcripts t ON s.transcriptId = t.id
      WHERE t.org_id = :org_id AND s.transcriptId != :transcript_id AND s.fast_mode = 0
        AND s.embedding IS NOT NULL
    "
    .with(params! { "org_id" => org_id, "transcript_id" => transcript_id })
    .fetch(conn)
    .await
    .context("Failed to fetch org speakers")?
  } else {
    r"
      SELECT id, userId, name, embedding
      FROM speakers
      WHERE userId = :user_id AND transcriptId != :transcript_id AND fast_mode = 0
        AND embedding IS NOT NULL
    "
    .with(params! { "user_id" => user_id, "transcript_id" => transcript_id })
    .fetch(conn)
    .await
    .context("Failed to fetch user speakers")?
  };

  let previous_speakers = result
    .into_iter()
    .map(|row| {
      let embedding_str: String = row
        .get("embedding")
        .ok_or(anyhow::anyhow!("missing embedding column"))?;
      let embedding: Vec<f64> =
        serde_json::from_str(&embedding_str).context("Failed to parse embedding JSON")?;

      Ok(PreviousSpeaker {
        id: row.get("id").context("Missing id column")?,
        name: row.get("name").unwrap_or_default(),
        embedding,
      })
    })
    .collect::<Result<Vec<PreviousSpeaker>, anyhow::Error>>()?;

  Ok(previous_speakers)
}

async fn handle_paywall_abandonment_email(
  user_id: String,
  transcript_id: u64,
  state: Arc<SharedRequestState>,
  conn: &mut mysql_async::Conn,
) -> anyhow::Result<()> {
  let count: Vec<i32> = conn
    .exec(
      "
      SELECT COUNT(*) as count
      FROM GC_emails
      WHERE user_id = :user_id
      AND campaign = 'paywall_abandonment'
      ",
      params! {
        "user_id" => user_id.clone(),
      },
    )
    .await?;

  let sent_already = count
    .first()
    .cloned()
    .ok_or_else(|| anyhow::anyhow!("Failed to get count"))?
    > 0;

  if sent_already {
    return Ok(());
  }

  let email = get_primary_email(&user_id, state.clone()).await?;

  "
  INSERT INTO GC_emails (should_email, email, campaign, user_id, transcript_id)
  VALUES (1, :email, 'paywall_abandonment', :user_id, :transcript_id)
  "
  .with(params! {
    "email" => email,
    "user_id" => user_id.clone(),
    "transcript_id" => transcript_id,
  })
  .ignore(conn)
  .await?;

  return Ok(());
}

#[derive(Clone)]
pub struct GCSegmentsRow {
  pub transcript_id: u64,
  pub start: String,
  pub stop: String,
  pub speaker: String,
  pub transcript: Option<String>,
  pub segment_index: usize,
  pub fast_mode: bool,
  pub is_user_visible: bool,
  pub is_orphan: bool,
}

pub async fn run_post_speaker_segmentation(
  transcript_id: u64,
  user_id: String,
  state: Arc<SharedRequestState>,
  holder_initializer: transcribed_ranges::HolderInitializer,
  media_file: MediaFile,
  insufficient_tokens: bool,
  test_mode: bool,
  fast_mode: bool,
  timer: Arc<SpanTimer<TimeSpanEvent>>,
) -> anyhow::Result<()> {
  let mut conn = state.db.get_conn().await?;

  let include_text = matches!(
    holder_initializer.strategy(),
    SpeechToTextStrategy::ScribeV1(_)
  );

  let transcript_from_model =
    convert_scribe_to_transcript(transcript_id, state.clone(), media_file, include_text).await?;

  // Free diarization state now that we've consumed it
  state.transcript_manager.finish(transcript_id).await;

  let mut transcript: Transcript = transcript_from_model.into();

  let previous_speakers = fetch_previous_speakers(&mut conn, &user_id, transcript_id).await?;

  // Only use holder-based text filling for non-Scribe strategies
  let orphaned_rows: Vec<GCSegmentsRow> = if include_text {
    Vec::new()
  } else {
    fill_text_and_collect_orphans(
      &holder_initializer,
      &mut transcript,
      transcript_id,
      insufficient_tokens,
      fast_mode,
    )
    .await?
  };

  let processed_speakers_data =
    process_speaker_identities(&transcript, &previous_speakers, fast_mode).await?;

  timer.start(TimeSpanEvent::GetDiarizationInsertSegments);

  r"INSERT INTO speakers (
      userId,
      transcriptId,
      label,
      name,
      uses,
      embedding,
      fast_mode,
      suggested_speakers
  ) VALUES (
      :user_id,
      :transcript_id,
      :label,
      :name,
      :uses,
      CAST(:embedding AS CHAR CHARACTER SET utf8mb4),
      :fast_mode,
      :suggested_speakers
  )"
  .with(
    processed_speakers_data
      .iter()
      .zip(transcript.speakers.iter())
      .map(
        |((label, assigned_name, uses, suggested_speakers_json), speaker)| {
          params! {
              "user_id" => user_id.clone(),
              "transcript_id" => transcript_id,
              "label" => label,
              "name" => assigned_name,
              "uses" => uses,
              "embedding" => serde_json::to_string(&speaker.embedding).unwrap_or("".to_string()),
              "fast_mode" => fast_mode,
              "suggested_speakers" => suggested_speakers_json,
          }
        },
      ),
  )
  .batch(&mut conn)
  .await?;

  let mut values: Vec<GCSegmentsRow> = transcript
    .segments
    .into_iter()
    .enumerate()
    .map(|(i, seg)| {
      let end_secs = time::timestamp_to_seconds(&seg.stop).unwrap_or(0.0);
      let should_show_transcript = !insufficient_tokens || end_secs <= 600.0;
      let is_user_visible = should_show_transcript;
      GCSegmentsRow {
        transcript_id,
        start: seg.start,
        stop: seg.stop,
        speaker: seg.speaker,
        transcript: seg.transcript.filter(|_| should_show_transcript),
        segment_index: i,
        fast_mode,
        is_user_visible,
        is_orphan: false,
      }
    })
    .collect();

  values.extend(orphaned_rows);

  db::insert_gc_segments_batch(&mut conn, &values).await?;

  timer.stop(TimeSpanEvent::GetDiarizationInsertSegments);

  let get_diarization_duration = timer
    .stop(if fast_mode {
      TimeSpanEvent::GetDiarizationPreview
    } else {
      TimeSpanEvent::GetDiarization
    })
    .map(|d| d.as_millis());

  PostHogEventType::FileSegmented.capture(
      user_id.clone(),
      json!({
        "transcript_id": transcript_id,
        "fast_mode": fast_mode,
        "get_diarization_duration_ms": get_diarization_duration,
        "get_diarization_insert_segments_duration_ms": timer.get(TimeSpanEvent::GetDiarizationInsertSegments).map(|d| d.as_millis()),
        "speaker_identification_used": !fast_mode,
        "identified_speakers_count": processed_speakers_data.iter().filter(|(_, _, uses, _)| *uses == 2).count(),
     }),
    );

  let word_utilization = if fast_mode {
    None // Ignore utilization for fast_mode because it's an incomplete transcript.
  } else {
    Some(holder_initializer.get_utilization_stats().await?)
  };

  // Only mark transcribe_finished = 1 if we fully transcribed the audio.
  if fast_mode || !insufficient_tokens {
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
  }

  return Ok(());
}

async fn fill_text_and_collect_orphans(
  holder_initializer: &transcribed_ranges::HolderInitializer,
  transcript: &mut Transcript,
  transcript_id: u64,
  insufficient_tokens: bool,
  fast_mode: bool,
) -> anyhow::Result<Vec<GCSegmentsRow>> {
  tracing::info!(
    "Using Google STT for text fill with Scribe diarization for transcript {}",
    transcript_id
  );

  holder_initializer.wait_for_ranges_up_to_end().await?;

  let holder = holder_initializer.holder();

  let raw = {
    let mut guard = holder.lock().await;

    for segment in &mut transcript.segments {
      let start = time::timestamp_to_seconds(&segment.start)?;
      let stop = time::timestamp_to_seconds(&segment.stop)?;
      if (!insufficient_tokens || stop <= 600.0) && segment.transcript.is_none() {
        segment.transcript = guard.get_segment(start.into(), stop.into())?;
      }
    }

    guard.get_orphaned_segments()
  };
  let orphaned_rows = raw
    .into_iter()
    .map(|seg| {
      let end_secs = time::timestamp_to_seconds(&seg.stop).unwrap_or(0.0);
      let show = !insufficient_tokens || end_secs <= 600.0;
      GCSegmentsRow {
        transcript_id,
        start: seg.start,
        stop: seg.stop,
        speaker: seg.speaker,
        transcript: seg.transcript.filter(|_| show),
        segment_index: 0,
        fast_mode,
        is_user_visible: show,
        is_orphan: true,
      }
    })
    .collect();

  Ok(orphaned_rows)
}

pub async fn on_transcribe_finished(
  transcript_id: u64,
  user_id: String,
  test_mode: bool,
  fast_mode: bool,
  conn: &mut mysql_async::Conn,
  word_utilization: Option<WordUtilizationMetrics>,
  timer: Arc<SpanTimer<TimeSpanEvent>>,
  state: Arc<SharedRequestState>,
) -> anyhow::Result<()> {
  if fast_mode {
    r"UPDATE transcripts SET preview_transcribe_finished = 1 WHERE id = :id;"
      .with(params! {
        "id" => transcript_id,
      })
      .ignore(&mut *conn)
      .await?;
  } else {
    r"UPDATE transcripts SET transcribe_finished = 1 WHERE id = :id;"
      .with(params! {
        "id" => transcript_id,
      })
      .ignore(&mut *conn)
      .await?;
  }

  if !fast_mode {
    let rows = r"SELECT upload_kind FROM transcripts WHERE id = :id;"
      .with(params! {
        "id" => transcript_id,
      })
      .map(&mut *conn, |upload_kind: String| upload_kind)
      .await?;

    if let Some(upload_kind) = rows.first() {
      let user_id_clone = user_id.clone();
      let upload_kind_clone = upload_kind.clone();

      let state_clone = Arc::clone(&state);

      tokio::spawn(async move {
        match start_minutes_creation(
          user_id_clone,
          state_clone,
          transcript_id,
          upload_kind_clone,
          test_mode,
        )
        .await
        {
          Ok(started) => {
            if started {
              info!(
                "Auto-started minutes creation for transcript {}",
                transcript_id
              );
            } else {
              info!(
                "Skipped auto-starting minutes creation for transcript {}",
                transcript_id
              );
            }
          }
          Err(e) => {
            error!("Error auto-starting minutes creation: {:?}", e);
          }
        }
      });
    }
  }

  PostHogEventType::TranscribeFinished.capture(
    user_id.clone(),
    json!({
      "transcript_id": transcript_id,
      "fast_mode": fast_mode,
      "total_transcribe_duration_ms": timer.stop(
        if fast_mode {
          TimeSpanEvent::TotalTranscribePreview
        } else {
          TimeSpanEvent::TotalTranscribe
        }).map(|d| d.as_millis()),
      "word_utilization": word_utilization,
    }),
  );

  return Ok(());
}

async fn start_holder_initialization(
  mut holder_initializer: transcribed_ranges::HolderInitializer,
  tokens_required: i32,
  state: Arc<SharedRequestState>,
  transcript_id: u64,
  user_id: String,
  org_id: Option<String>,
  insufficient_tokens: bool,
  timer: Arc<SpanTimer<TimeSpanEvent>>,
  transcribe_started_datetime: DateTime<Utc>,
) -> anyhow::Result<()> {
  let mut conn = state.db.get_conn().await?;

  timer.start(TimeSpanEvent::TranscribeSegmentsPreview);

  // First transcribe fast preview
  holder_initializer.initialize_until(600.0).await?;
  let stt_source = holder_initializer.strategy().to_string();
  PostHogEventType::FileTranscribed.capture(
    user_id.clone(),
    json!({
      "transcript_id": transcript_id,
      "fast_mode": true,
      "stt_source": stt_source,
      "transcribe_segments_duration_ms": timer.stop(TimeSpanEvent::TranscribeSegmentsPreview).map(|d| d.as_millis()),
    }),
  );

  // Initialize the rest if we have the tokens.
  if !insufficient_tokens {
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

    holder_initializer.initialize_until_end().await?;

    PostHogEventType::FileTranscribed.capture(
      user_id.clone(),
      json!({
        "transcript_id": transcript_id,
        "fast_mode": false,
        "stt_source": stt_source,
        "transcribe_segments_duration_ms": timer.stop(TimeSpanEvent::TranscribeSegments).map(|d| d.as_millis()),
      }),
    );
  } else {
    PostHogEventType::TranscribePaused.capture(
      user_id.clone(),
      json!({
        "transcript_id": transcript_id,
        "tokens_required": tokens_required,
        "duration_since_transcribe_started": Utc::now().signed_duration_since(transcribe_started_datetime).num_milliseconds(),
      }),
    );

    handle_paywall_abandonment_email(user_id.clone(), transcript_id, state.clone(), &mut conn)
      .await?;
  }

  return Ok(());
}

fn start_holder_initialization_in_bg(
  holder_initializer: transcribed_ranges::HolderInitializer,
  tokens_required: i32,
  state: Arc<SharedRequestState>,
  transcript_id: u64,
  user_id: String,
  org_id: Option<String>,
  insufficient_tokens: bool,
  timer: Arc<SpanTimer<TimeSpanEvent>>,
  transcribe_started_millis: DateTime<Utc>,
) {
  tokio::spawn(async move {
    match start_holder_initialization(
      holder_initializer,
      tokens_required,
      state.clone(),
      transcript_id,
      user_id.clone(),
      org_id,
      insufficient_tokens,
      timer,
      transcribe_started_millis,
    )
    .await
    {
      Ok(_) => info!("Successfully initialized holder in bg"),
      Err(e) => {
        error!("Failed to initialize holder in bg: {}", e);
        fail_job(transcript_id, 82, state, user_id, true)
          .await
          .expect("fail job failed");
      }
    }
  });
}

pub async fn ask_user_for_language(
  transcript_id: u64,
  media_file: &MediaFile,
  conn: &mut Conn,
  test_mode: bool,
) -> anyhow::Result<()> {
  // Initiate a Google Cloud Storage upload eagerly so it's ready to be
  // transcribed when the user chooses a language.
  google::storage::upload(
    &get_upload_key(transcript_id, test_mode),
    media_file.slice(0.0, media_file.duration)?,
    "audio/wav",
  )
  .await?;

  "UPDATE transcripts SET language = 'pending' WHERE id = :transcript_id;"
    .with(params! {
      "transcript_id" => transcript_id,
    })
    .ignore(conn)
    .await?;

  return Ok(());
}

pub async fn process_diarization(
  transcript_id: u64,
  user_id: String,
  org_id: Option<String>,
  upload_kind: String,
  s3_audio_key: String,
  state: Arc<SharedRequestState>,
  current_balance: i32,
  timer: Arc<SpanTimer<TimeSpanEvent>>,
  region: String,
  file_size: Option<u64>,
  transcribe_started_datetime: DateTime<Utc>,
  language: Option<String>,
  test_mode: bool,
  _prod_in_dev: bool,
) -> anyhow::Result<()> {
  let mut conn = state.db.get_conn().await?;

  if upload_kind != "audio" {
    // For text transcript upload we charge flat 50 token rate.
    r"UPDATE transcripts SET credits_required = 50, preview_transcribe_finished = 1, transcribe_finished = 1 WHERE id = :transcript_id;"
      .with(params! {
        "transcript_id" => transcript_id,
      })
      .ignore(&mut conn)
      .await?;

    PostHogEventType::FileUploaded.capture(
      user_id.clone(),
      json!({
        "transcript_id": transcript_id,
        "tokens_required": 50,
        "upload_kind": upload_kind,
      }),
    );

    let user_id_clone = user_id.clone();
    let upload_kind_clone = upload_kind.clone();
    let state_clone = Arc::clone(&state);

    info!(
      "Triggering minutes creation for non-audio upload: {}",
      transcript_id
    );
    tokio::spawn(async move {
      match create_minutes::start_minutes_creation(
        user_id_clone,
        state_clone,
        transcript_id,
        upload_kind_clone,
        test_mode,
      )
      .await
      {
        Ok(started) => {
          if started {
            info!(
              "Auto-started minutes creation for text transcript {}",
              transcript_id
            );
          } else {
            info!(
              "Skipped auto-starting minutes creation for text transcript {}",
              transcript_id
            );
          }
        }
        Err(e) => {
          error!(
            "Error auto-starting minutes creation for text transcript: {:?}",
            e
          );
        }
      }
    });

    return Ok(());
  }

  timer.start(TimeSpanEvent::GetDiarizationFileDownload);

  let object = get_object(state.clone(), region.clone(), s3_audio_key).await?;

  let media_file = MediaFile::init(object.body.into_async_read()).await?;

  timer.stop(TimeSpanEvent::GetDiarizationFileDownload);

  let client = Arc::new(reqwest::Client::new());

  let language = language.filter(|lang| lang != "pending");

  let holder_initializer = match language {
    Some(ref lang) if is_whisper_supported_for_language(lang) => {
      // Language supported by Whisper: prefer Scribe STT + diarization
      HolderInitializer::new(
        media_file.clone(),
        state.clone(),
        SpeechToTextStrategy::ScribeV1(ScribeV1Params {
          transcript_id,
          test_mode,
        }),
      )
    }
    Some(ref lang) => {
      // If we have an explicit language, it means whisper didn't support it, so
      // use Google Cloud Speech-to-Text
      HolderInitializer::new(
        media_file.clone(),
        state.clone(),
        SpeechToTextStrategy::GoogleCloud(GoogleCloudStrategyParams {
          transcript_id,
          test_mode,
          language: lang.to_string(),
        }),
      )
    }
    None if is_whisper_supported(state.clone(), &media_file).await? => {
      // Auto-detected language supported by Whisper: prefer Scribe STT + diarization
      HolderInitializer::new(
        media_file.clone(),
        state.clone(),
        SpeechToTextStrategy::ScribeV1(ScribeV1Params {
          transcript_id,
          test_mode,
        }),
      )
    }
    None => {
      // Whisper is NOT supported, so ask the user for a language and use Google Cloud Speech-to-Text.
      return ask_user_for_language(transcript_id, &media_file, &mut conn, test_mode).await;
    }
  };

  timer.start(TimeSpanEvent::GetDiarizationParallelSliceSnippetToken);

  // TODO use STT strategy here
  if language.is_none() {
    let state_clone = state.clone();
    let client_clone = client.clone();
    let media_file_clone = media_file.clone();
    tokio::spawn(async move {
      // No need to block execution for the snippet, so grab it in a bg task.
      get_snippet(state_clone, transcript_id, &media_file_clone, client_clone)
        .await
        .unwrap_or_else(|e| {
          error!("Failed to get snippet: {}", e);
        });
    });
  }

  let tokens_required = get_required_tokens(&media_file).await?;
  info!("tokens required: {}", tokens_required);

  let insufficient_tokens = tokens_required > current_balance;

  start_holder_initialization_in_bg(
    holder_initializer.clone(),
    tokens_required,
    state.clone(),
    transcript_id,
    user_id.clone(),
    org_id.clone(),
    insufficient_tokens,
    timer.clone(),
    transcribe_started_datetime,
  );

  timer.stop(TimeSpanEvent::GetDiarizationParallelSliceSnippetToken);

  timer.start(TimeSpanEvent::GetDiarizationTokenRequiredUpdate);

  r"UPDATE transcripts SET credits_required = :credits_required, transcribe_paused = :transcribe_paused, was_paywalled = :was_paywalled WHERE id = :transcript_id;"
    .with(params! {
      "credits_required" => tokens_required,
      "transcript_id" => transcript_id,
      "transcribe_paused" => insufficient_tokens,
      "was_paywalled" => insufficient_tokens,
    })
    .ignore(&mut conn)
    .await?;

  timer.stop(TimeSpanEvent::GetDiarizationTokenRequiredUpdate);

  PostHogEventType::FileUploaded.capture(
    user_id.clone(),
    json!({
      "transcript_id": transcript_id,
      "tokens_required": tokens_required,
      "upload_kind": upload_kind,
      "file_size": file_size,
      "region": region,
      "get_diarization_initial_query_duration_ms": timer.get(TimeSpanEvent::GetDiarizationInitialQuery).map(|d| d.as_millis()),
      "get_diarization_file_download_duration_ms": timer.get(TimeSpanEvent::GetDiarizationFileDownload).map(|d| d.as_millis()),
      "get_diarization_pssc_duration_ms": timer.get(TimeSpanEvent::GetDiarizationParallelSliceSnippetToken).map(|d| d.as_millis()),
      "get_diarization_tokens_required_update_duration_ms": timer.get(TimeSpanEvent::GetDiarizationTokenRequiredUpdate).map(|d| d.as_millis()),
    }),
  );

  info!(
    "Waiting for STT/diarization ranges for transcript {}",
    transcript_id
  );
  holder_initializer.wait_for_ranges_up_to_end().await?;
  info!("Ranges ready for transcript {}", transcript_id);

  run_post_speaker_segmentation(
    transcript_id,
    user_id,
    state,
    holder_initializer.clone(),
    media_file,
    insufficient_tokens,
    test_mode,
    false,
    timer,
  )
  .await
}

type TranscriptRow = (
  String,         // userId
  String,         // upload_kind
  String,         // aws_region
  Option<u64>,    // file_size
  NaiveDateTime,  // dateCreated
  Option<String>, // language
  Option<String>, // org_id
  i32,            // current_balance
);

pub async fn get_diarization_handler(
  TypedHeader(auth): TypedHeader<Authorization<Bearer>>,
  State(state): State<Arc<SharedRequestState>>,
  axum::extract::Query(GetDiarizationQueryParam {
    test,
    prodindev,
    afterlanguage,
  }): axum::extract::Query<GetDiarizationQueryParam>,
  Json(GetDiarizationBody { s3_audio_key }): Json<GetDiarizationBody>,
) -> Result<impl IntoResponse, StatusCode> {
  if auth.token() != env::var("UPLOAD_COMPLETE_WEBHOOK_SECRET").unwrap() {
    error!("Unauthorized get diarization handler");
    return Err(StatusCode::UNAUTHORIZED);
  }

  let timer = Arc::new(SpanTimer::new());
  timer.start(TimeSpanEvent::TotalTranscribe);
  timer.start(TimeSpanEvent::TotalTranscribePreview);
  timer.start(TimeSpanEvent::GetDiarization);
  timer.start(TimeSpanEvent::GetDiarizationPreview);

  let test_mode = test.is_some();
  if test_mode {
    warn!("IN TEST MODE!");
  }

  let prod_in_dev = prodindev.is_some();
  if prod_in_dev {
    warn!("IN PROD_IN_DEV MODE!");
  }

  // key has format "{test_}uploads/upload_<TRANSCRIPT_ID>"
  let transcript_id = s3_audio_key
    .split("_")
    .collect::<Vec<&str>>()
    .last()
    .ok_or(StatusCode::BAD_REQUEST)?
    .parse::<u64>()
    .map_err(|_| StatusCode::BAD_REQUEST)?;

  info!("Transcript id: {}", transcript_id);

  let mut conn = state
    .db
    .get_conn()
    .await
    .map_and_log_err("conn error", StatusCode::INTERNAL_SERVER_ERROR)?;

  timer.start(TimeSpanEvent::GetDiarizationInitialQuery);

  let rows: Vec<TranscriptRow> = conn
    .exec(
      r#"
        SELECT 
            t.userId,
            t.upload_kind,
            t.aws_region,
            t.file_size,
            t.dateCreated,
            t.language,
            t.org_id,
            CASE
              WHEN t.org_id IS NOT NULL THEN (SELECT SUM(p.token) FROM payments p WHERE p.org_id = t.org_id)
              ELSE (SELECT SUM(p.token) FROM payments p WHERE p.user_id = t.userId AND p.org_id IS NULL)
            END AS current_balance
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

  timer.stop(TimeSpanEvent::GetDiarizationInitialQuery);

  let (user_id, upload_kind, region, file_size, date_created, language, org_id, current_balance) =
    rows.first().cloned().ok_or(StatusCode::NOT_FOUND)?;

  let transcribe_started_datetime = Utc.from_utc_datetime(&date_created);
  info!("transcribe_started_millis: {}", transcribe_started_datetime);

  let already_happened = upload_already_happened(&mut conn, transcript_id)
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

  // We expect to call the API twice if we asked user to set a language.
  if already_happened && afterlanguage.is_none() {
    warn!("Upload already happened for transcript_id: {transcript_id}");
    return Err(StatusCode::CONFLICT);
  }

  task::spawn(async move {
    match process_diarization(
      transcript_id,
      user_id.clone(),
      org_id,
      upload_kind,
      s3_audio_key,
      state.clone(),
      current_balance,
      timer,
      region,
      file_size,
      transcribe_started_datetime,
      language,
      test_mode,
      prod_in_dev,
    )
    .await
    {
      Ok(_) => info!("Successfully processed diarization"),
      Err(e) => {
        error!("Failed to process diarization: {}", e);
        fail_job(transcript_id, 62, state, user_id, false)
          .await
          .unwrap_or_else(|e| {
            error!("Failed to fail job: {}", e);
          });
      }
    }
  });

  return Ok(axum::response::Json(GetDiarizationResponse {}));
}

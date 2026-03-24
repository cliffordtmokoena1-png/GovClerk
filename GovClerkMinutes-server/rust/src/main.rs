use aws_config::meta::region::RegionProviderChain;
use aws_sdk_s3::config::Credentials;
use aws_sdk_s3::Client;
use axum::extract::{State, TypedHeader};
use axum::headers::authorization::{Authorization, Bearer};
use axum::http::Request;
use axum::middleware::Next;
use axum::response::Response;
use axum::routing::get;
use axum::routing::method_routing::post;
use axum::{middleware, Router};
use create_minutes::create_minutes_handler;
use create_signin_token::create_signin_token;
use dotenv::dotenv;
use get_diarization::get_diarization_handler;
use get_pending_tasks::get_pending_tasks_handler;
use get_required_tokens::get_required_tokens_handler;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use monitor::monitor_handler;
use mysql::DbManager;
use mysql_async::params;
use mysql_async::prelude::{Query, WithParams, Queryable};
use python_process::PythonProcess;
use ratelimit::Ratelimiter;
use replicate_webhook::replicate_webhook_handler;
use reqwest::{header, Method, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::env;
use std::net::SocketAddr;
use std::sync::atomic::AtomicUsize;
use std::sync::Arc;
use std::time::Duration;
use std::collections::HashMap;
use structopt::StructOpt;
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::{error, info, warn};
use tracing_subscriber::prelude::*;
use tracing_subscriber::{EnvFilter, Layer, Registry};
use transcript::Transcript;

use crate::create_minutes::get_speakers;
use crate::instantly::add_instantly_lead;
use crate::posthog::PostHogEventType;
use regenerate_minutes::regenerate_minutes_handler;

mod regenerate_minutes; 
mod create_minutes;
mod create_signin_token;
mod error;
mod get_current_balance;
mod get_diarization;
mod get_pending_tasks;
mod get_required_tokens;
mod instantly;
mod monitor;
mod mysql;
mod posthog;
mod python_process;
mod rate_limiter;
mod replicate_webhook;
mod task_tracker;
mod transcript;
mod get_email;


#[derive(StructOpt, Debug, Copy, Clone)]
struct Opts {
  /// Uses replicate whisper instead of openai
  #[structopt(long = "clerk-test-mode")]
  clerk_test_mode: bool,
  /// Uses replicate whisper instead of openai
  #[structopt(long = "use-replicate-whisper")]
  _use_replicate_whisper: bool,
  /// Port to listen on
  #[structopt(long = "port")]
  port: Option<u16>,
  /// Don't start the server, just fail timed out, unfinished transcripts
  #[structopt(long = "only-reap")]
  only_reap: bool,

  #[structopt(long = "only-transcript")]
  only_transcript: bool,

  /// Ensure we only rely on 3rd party apis for whisper
  #[structopt(long = "dummy-whisper")]
  dummy_whisper: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct Claims {
  exp: usize,
  nbf: usize,
  sub: String,
}

#[derive(Clone)]
pub struct UserId(String);

async fn auth<B>(
  TypedHeader(auth): TypedHeader<Authorization<Bearer>>,
  State(state): State<Arc<SharedRequestState>>,
  mut request: Request<B>,
  next: Next<B>,
) -> Result<Response, StatusCode> {
  let public_key = match state.options.clerk_test_mode {
    true => {
      env::var("CLERK_TEST_JWT_PUBLIC_KEY").expect("CLERK_TEST_JWT_PUBLIC_KEY not found in .env")
    }
    false => env::var("CLERK_JWT_PUBLIC_KEY").expect("CLERK_JWT_PUBLIC_KEY not found in .env"),
  };

  let validation = Validation::new(Algorithm::RS256);

  let decoding_key = match DecodingKey::from_rsa_pem(public_key.as_bytes()) {
    Ok(key) => key,
    Err(err) => {
      error!("failed to decode jwt public key: {:?}", err);
      return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
  };

  let token = match decode::<Claims>(auth.token(), &decoding_key, &validation) {
    Ok(c) => c,
    Err(err) => match *err.kind() {
      _ => {
        error!("failed to decode jwt: {:?}", err);
        return Err(StatusCode::UNAUTHORIZED);
      }
    },
  };

  info!("User authenticated: {}", token.claims.sub);

  request.extensions_mut().insert(UserId(token.claims.sub));

  return Ok(next.run(request).await);
}

async fn run_transcript_reaper(state: Arc<SharedRequestState>) -> anyhow::Result<()> {
  let mut conn = state.db.get_conn().await?;
  let expired_ids = r"SELECT id, userId, upload_kind FROM transcripts WHERE transcribe_failed = 0 AND TIMESTAMPDIFF(HOUR, dateCreated, NOW()) >= 24 AND transcribe_paused != 1 AND transcribe_finished != 1"
    .map(&mut conn, |(id, user_id, upload_kind): (u64, String, String)| {
      return (id, user_id, upload_kind);
    })
    .await?;

  for (expired_id, user_id, upload_kind) in expired_ids {
    warn!("Reaping transcript {}", expired_id);
    r"UPDATE transcripts SET transcribe_failed = 69 WHERE id = :id"
      .with(params! {
        "id" => expired_id,
      })
      .ignore(&mut conn)
      .await?;

    PostHogEventType::TranscribeFailed.capture(
      user_id,
      json!({
        "transcript_id": expired_id,
        "error_code": 69,
        "was_reaped": true,
        "upload_kind": upload_kind,
      }),
    );
  }

  Ok(())
}

fn format_recording_length(tokens_required: i32) -> String {
  let hours = tokens_required / 60;
  let minutes = tokens_required % 60;

  if minutes < 15 {
      if hours == 1 {
          "over 1 hour".to_string()
      } else {
          format!("over {} hours", hours)
      }
  } else if minutes < 45 {
      format!("almost {}.5 hours", hours)
  } else {
      if hours == 0 {
          "almost 1 hour".to_string()
      } else {
          format!("almost {} hours", hours + 1)
      }
  }
}

async fn run_email_lead_adder(state: Arc<SharedRequestState>) -> anyhow::Result<()> {
  let mut conn = state.db.get_conn().await?;
  
  add_signup_no_upload_leads(&mut conn, &state).await?;
  add_paywall_abandonment_leads(&mut conn, &state).await?;
  
  Ok(())
}

async fn add_signup_no_upload_leads(conn: &mut mysql_async::Conn, state: &Arc<SharedRequestState>) -> anyhow::Result<()> {
  let leads_to_add: Vec<(u64, String, String, String, Option<u64>)> = conn
      .query(r"SELECT id, email, user_id, campaign, transcript_id FROM gc_emails WHERE TIMESTAMPDIFF(HOUR, created_at, NOW()) >= 48 AND should_email = 1 AND campaign = 'signup_no_upload'")
      .await?;
  
  for (id, email, user_id, campaign, transcript_id) in leads_to_add {
      warn!("adding lead to signup_no_upload campaign: {}", email);
      
      conn.exec_drop(r"UPDATE gc_emails SET should_email = 0 WHERE id = :id", params! { "id" => id }).await?;
      
      let mut variables = HashMap::new();
      let sign_in_token = create_signin_token(user_id.clone(), state.clone()).await?;
      variables.insert("signInToken".to_string(), sign_in_token.to_string());
      
      let campaign_id = std::env::var("INSTANTLY_CAMPAIGN_SIGNUP_NO_UPLOAD")
          .expect("Bad INSTANTLY_CAMPAIGN_SIGNUP_NO_UPLOAD");
      
      let response = match add_instantly_lead(email.clone(), campaign_id.clone(), variables).await {
          Ok(r) => r,
          Err(e) => {
              error!("failed to add lead to instantly: {:?}", e);
              PostHogEventType::EmailLeadAddFailed.capture(
                  user_id.to_string(),
                  json!({ "email": email, "instantly_err": e.to_string() })
              );
              continue;
          }
      };
      
      PostHogEventType::EmailLeadAdded.capture(
          user_id.to_string(),
          json!({ "email": email, "instantly_response": response, "campaign": campaign })
      );
  }
  
  Ok(())
}

async fn add_paywall_abandonment_leads(conn: &mut mysql_async::Conn, state: &Arc<SharedRequestState>) -> anyhow::Result<()> {
  let leads_to_add: Vec<(u64, String, String, String, Option<u64>)> = conn
      .query(r"SELECT id, email, user_id, campaign, transcript_id FROM gc_emails WHERE TIMESTAMPDIFF(HOUR, created_at, NOW()) >= 2 AND should_email = 1 AND campaign = 'paywall_abandonment'")
      .await?;
  
  for (id, email, user_id, campaign, transcript_id) in leads_to_add {
      let customer_exists: Option<u64> = conn.exec_first(r"SELECT id FROM gc_customers WHERE user_id = :user_id", params! { "user_id" => user_id.clone() }).await?;
        
      if customer_exists.is_some() {
          warn!("user {} already exists in gc_customers, skipping lead addition", user_id);
          continue;
      }
      warn!("adding lead to paywall_abandonment campaign: {}", email);
      
      conn.exec_drop(r"UPDATE gc_emails SET should_email = 0 WHERE id = :id", params! { "id" => id }).await?;
      
      let mut variables = HashMap::new();
      let sign_in_token = create_signin_token(user_id.clone(), state.clone()).await?;
      variables.insert("signInToken".to_string(), sign_in_token.to_string());
      
      let campaign_id = std::env::var("INSTANTLY_CAMPAIGN_PAYWALL_ABANDONERS")
          .expect("Bad INSTANTLY_CAMPAIGN_PAYWALL_ABANDONERS");
      
      let rows: Vec<i32> = conn.exec(r"SELECT credits_required FROM transcripts WHERE id = :transcript_id AND userId = :user_id", params! { "transcript_id" => transcript_id, "user_id" => user_id.clone() }).await?;
      
      if let Some(tokens_required) = rows.first() {
          let recording_length_snippet = format_recording_length(*tokens_required);
          variables.insert("recordingLengthSnippet".to_string(), recording_length_snippet);
      }
      
      let response = match add_instantly_lead(email.clone(), campaign_id.clone(), variables).await {
          Ok(r) => r,
          Err(e) => {
              error!("failed to add lead to instantly: {:?}", e);
              PostHogEventType::EmailLeadAddFailed.capture(
                  user_id.to_string(),
                  json!({ "email": email, "instantly_err": e.to_string() })
              );
              continue;
          }
      };
      
      PostHogEventType::EmailLeadAdded.capture(
          user_id.to_string(),
          json!({ "email": email, "instantly_response": response, "campaign": campaign })
      );
  }
  
  Ok(())
}

pub struct SharedRequestState {
  s3_client: Client,
  db: DbManager,
  options: Opts,
  pending_tasks_counter: Arc<AtomicUsize>,
  gpu_mutex: Mutex<()>,
  ffmpeg_semaphore: Arc<tokio::sync::Semaphore>,
  rate_limiter2: Ratelimiter,
  whisper_semaphore: Arc<tokio::sync::Semaphore>,
  python_process: Arc<Mutex<PythonProcess>>,
}

#[tokio::main]
async fn main() {
  let options = Opts::from_args();

  // Set up the file appender
  let file_appender = tracing_appender::rolling::daily(dirs::home_dir().unwrap(), "mg.log");
  let (non_blocking_file, guard) = tracing_appender::non_blocking(file_appender);

  // File layer
  let file_layer = tracing_subscriber::fmt::layer()
    .with_writer(non_blocking_file)
    .with_filter(EnvFilter::new("debug")); // Use `with_filter`

  // Console layer
  let std_layer = tracing_subscriber::fmt::layer().with_filter(EnvFilter::new("debug"));

  // Combine both layers with a Registry
  let subscriber = Registry::default().with(file_layer).with(std_layer);

  // Set the subscriber as global default
  subscriber.init();

  std::mem::forget(guard);

  tokio::process::Command::new("ffmpeg")
    .arg("-version")
    .output()
    .await
    .expect("failed to call ffmpeg, is it on the path?");

  if let Ok(env_path) = dotenv() {
    info!("Loaded .env file from: {:?}", env_path);
  } else {
    error!("No .env file found. You may need to copy over the .env file pulled from Vercel.");
    return;
  }

  let credentials = Credentials::new(
    env::var("AWS_ACCESS_KEY_ID").expect("AWS_ACCESS_KEY_ID not found in env"),
    env::var("AWS_SECRET_ACCESS_KEY").expect("AWS_SECRET_ACCESS_KEY not found in env"),
    None,
    None,         // Expiry time (optional)
    "myprovider", // Provider name
  );

  let region_provider = RegionProviderChain::default_provider().or_else("us-east-2");
  let config = aws_config::from_env()
    .credentials_provider(credentials)
    .region(region_provider)
    .load()
    .await;
  let s3_client = aws_sdk_s3::Client::new(&config);

  let rate_limiter2 = Ratelimiter::builder(4, Duration::from_secs(3))
    .initial_available(4)
    .max_tokens(80)
    .build()
    .unwrap();

  // TODO for gpu_mutex, only allows one gpu user but we can allow multiple.
  // Whisper large model requires 9591 MiB + maybe small amount for inference
  // Diarization model requires 2505 MiB
  // Total GPU memory on the A4500 is 20470 MiB, so room to always have everything loaded?

  let python_process = if options.dummy_whisper {
    python_process::PythonProcess::new_dummy().await.unwrap()
  } else {
    match python_process::PythonProcess::new(if cfg!(target_os = "macos") {
      "govclerk-minutes-server"
    } else {
      "gcenv"
    })
    .await
    {
      Ok(p) => p,
      Err(e) => {
        error!("Failed to start python process: {:?}", e);
        panic!("Failed to start python process: {:?}", e);
      }
    }
  };

  // TODO: test
  // info!("beginning transcription");
  // let x = python_process
  //   .transcribe("/Users/johnislarry/lexconvo2.m4a".to_string())
  //   .await
  //   .unwrap();
  // info!("transcription: {}", x);

  let shared_state = Arc::new(SharedRequestState {
    s3_client,
    db: DbManager::new(),
    options,
    pending_tasks_counter: Arc::new(AtomicUsize::new(0)),
    gpu_mutex: Mutex::new(()),
    rate_limiter2,
    whisper_semaphore: Arc::new(tokio::sync::Semaphore::new(80)),
    ffmpeg_semaphore: Arc::new(tokio::sync::Semaphore::new(num_cpus::get())),
    python_process: Arc::new(Mutex::new(python_process)),
  });

  if options.only_transcript {
    let transcript_id = 6974;
    let user_id = "user_2dVWGh46iAptwIz6J9qF2IjQHzM";
    let transcript = Transcript::from_db(
      &mut shared_state.db.get_conn().await.unwrap(),
      transcript_id,
      user_id,
    )
    .await
    .unwrap();

    let speakers = get_speakers(
      &mut shared_state.db.get_conn().await.unwrap(),
      transcript_id,
      &user_id,
    )
    .await
    .unwrap();

    let s = transcript
      .segments
      .iter()
      .filter_map(|segment| {
        if let None = &segment.transcript {
          // If no contents, skip.
          return None;
        }
        let mut name = &segment.speaker;
        if let Some(mapped_name) = speakers.get(&segment.speaker) {
          name = mapped_name;
        }
        let text = segment.transcript.as_ref().unwrap();
        return Some(format!("{}: {}", name, text));
      })
      .collect::<Vec<String>>()
      .join("\n");

    info!(s);
    return;
  }

  if options.only_reap {
    match run_transcript_reaper(shared_state.clone()).await {
      Ok(_) => info!("Transcript reaping completed successfully."),
      Err(e) => error!("Error during transcript reaping: {:?}", e),
    }

    match run_email_lead_adder(shared_state.clone()).await {
      Ok(_) => info!("email lead adder finished successfully."),
      Err(e) => error!("Error during email lead adder: {:?}", e),
    }

    return;
  }

  // Spawn a task for running the transcript reaper periodically
  let reaper_state = shared_state.clone();
  tokio::spawn(async move {
    loop {
      match run_transcript_reaper(reaper_state.clone()).await {
        Ok(_) => info!("Transcript reaping completed successfully."),
        Err(e) => error!("Error during transcript reaping: {:?}", e),
      }

      match run_email_lead_adder(reaper_state.clone()).await {
        Ok(_) => info!("email lead adder finished successfully."),
        Err(e) => error!("Error during email lead adder: {:?}", e),
      }

      tokio::time::sleep(Duration::from_secs(3600)).await;
    }
  });

  let replicate_webhook_router = Router::new()
    .route("/api/replicate-webhook", post(replicate_webhook_handler))
    .layer(
      CorsLayer::new()
        .allow_methods([Method::GET, Method::POST])
        .allow_origin(Any)
        .allow_headers(vec![header::AUTHORIZATION, header::CONTENT_TYPE]),
    );

  let create_minutes_router = Router::new()
    .route("/api/create-minutes", post(create_minutes_handler))
    .route_layer(middleware::from_fn_with_state(shared_state.clone(), auth))
    .layer(
      CorsLayer::new()
        .allow_methods([Method::POST])
        .allow_origin(Any)
        .allow_headers(vec![header::AUTHORIZATION, header::CONTENT_TYPE]),
    );
  
  let regenerate_minutes_router = Router::new()
    .route("/api/regenerate-minutes/:transcript_id", post(regenerate_minutes_handler)) 
    .route_layer(middleware::from_fn_with_state(shared_state.clone(), auth))
    .layer(
      CorsLayer::new()
        .allow_methods([Method::POST])
        .allow_origin(Any)
        .allow_headers(vec![header::AUTHORIZATION, header::CONTENT_TYPE]),
    );

  let get_required_tokens_router = Router::new()
    .route(
      "/api/get-required-tokens",
      post(get_required_tokens_handler),
    )
    .layer(
      CorsLayer::new()
        .allow_methods([Method::POST])
        .allow_origin(Any)
        .allow_headers(vec![header::AUTHORIZATION, header::CONTENT_TYPE]),
    );

  let get_pending_tasks_router = Router::new()
    .route("/api/get-pending-tasks", get(get_pending_tasks_handler))
    .layer(
      CorsLayer::new()
        .allow_methods([Method::GET])
        .allow_origin(Any)
        .allow_headers(vec![header::AUTHORIZATION, header::CONTENT_TYPE]),
    );

  let get_diarization_router = Router::new()
    .route("/api/get-diarization", post(get_diarization_handler))
    .layer(
      CorsLayer::new()
        .allow_methods([Method::POST])
        .allow_origin(Any)
        .allow_headers(vec![header::AUTHORIZATION, header::CONTENT_TYPE]),
    );

  let monitor_router = Router::new()
    .route("/api/monitor", get(monitor_handler))
    .layer(
      CorsLayer::new()
        .allow_methods([Method::GET])
        .allow_origin(Any),
    );

  let app = Router::new()
    .merge(replicate_webhook_router)
    .merge(create_minutes_router)
    .merge(regenerate_minutes_router)
    .merge(get_pending_tasks_router)
    .merge(get_required_tokens_router)
    .merge(get_diarization_router)
    .merge(monitor_router)
    .layer(TraceLayer::new_for_http())
    .with_state(shared_state);

  let port = match options.port {
    Some(p) => p,
    None => 8000,
  };

  axum::Server::bind(&SocketAddr::from(([0, 0, 0, 0], port)))
    .serve(app.into_make_service())
    .await
    .unwrap();
}

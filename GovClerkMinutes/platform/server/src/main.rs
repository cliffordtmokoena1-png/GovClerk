#![cfg_attr(feature = "fail-on-warnings", deny(warnings))]

use aws_sdk_s3::config::Credentials;
use aws_sdk_s3::Client;
use axum::routing::get;
use axum::routing::method_routing::post;
use axum::{middleware, Extension, Router};
use dotenv::dotenv;
use get_diarization::get_diarization_handler;
use get_pending_tasks::get_pending_tasks_handler;
use monitor::monitor_handler;
use mysql::DbManager;
use mysql_async::params;
use mysql_async::prelude::{Query, WithParams};
use reqwest::{header, Method, StatusCode};
use resume_transcribe::resume_transcribe_handler;
use serde::Deserialize;
use serde_json::json;
use std::env;
use std::net::SocketAddr;
use std::sync::atomic::AtomicUsize;
use std::sync::Arc;
use std::time::Duration;
use structopt::StructOpt;
use tokio::signal::unix::{signal, SignalKind};
use tokio::sync::Mutex;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::{error, info, warn};
use tracing_subscriber::prelude::*;
use tracing_subscriber::{EnvFilter, Layer, Registry};

use crate::convert_document::convert_document_handler;
use crate::create_agenda::create_agenda_handler;
use crate::cron::start_cron_job;
use crate::GovClerkMinutes_webhook::GcWebhookEvent;
use crate::posthog::check_feature_flag;
use crate::posthog::PostHogEventType;
use crate::process_custom_template::process_custom_template_handler;
use crate::python::PythonInterface;
use crate::websocket::manager::WebsocketManager;
use crash_handler::{find_and_log_tombstones, install_crash_handler};
use create_signin_token::create_auth_router;
use regenerate_agenda::regenerate_agenda_handler;
use regenerate_minutes::regenerate_minutes_handler;
use reqwest::Client as ReqwestClient;
use std::path::Path;
use tokio::process::Command;
use transcript_manager::TranscriptManager;

mod api_auth;
mod auth;
mod convert_document;
mod crash_handler;
mod create_agenda;
mod create_minutes;
mod create_signin_token;
mod cron;
mod dev;
mod error;
mod get_current_balance;
mod get_diarization;
mod get_email;
mod get_image_upload;
mod get_pending_tasks;
mod google;
mod html;
mod media_file;
mod minutes;
mod minutes_handler;
mod GovClerkMinutes_webhook;
mod monitor;
mod mysql;
mod pandoc;
mod posthog;
mod process_custom_template;
mod prompt_templates;
mod python;
mod rate_limiter;
mod regenerate_agenda;
mod regenerate_minutes;
mod resume_transcribe;
mod s3;
mod send_email;
mod span_timer;
mod speaker_identification;
mod speech;
mod task_tracker;
mod template_fetcher;
mod transcribed_ranges;
mod transcript;
mod transcript_manager;
mod upload_key;
mod utils;
mod websocket;
mod whatsapp;

#[cfg(test)]
pub mod tests;

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
}

#[derive(Clone)]
pub struct UserId(String);

#[derive(Deserialize)]
struct TunnelResponse {
  result: Vec<Tunnel>,
}

#[derive(Deserialize)]
struct Tunnel {
  name: String,
  status: String,
}

async fn run_transcript_reaper(state: Arc<SharedRequestState>) -> anyhow::Result<()> {
  let mut conn = state.db.get_conn().await?;
  // Check for timed out jobs. Wait longer for jobs started with the recorder.
  // Recordings can be 1+ hours long.
  let expired_ids = r"
    SELECT
      id,
      userId,
      upload_kind,
      file_size
    FROM transcripts
    WHERE transcribe_failed = 0
      AND (
        (recording_state = -1 AND TIMESTAMPDIFF(HOUR, dateCreated, NOW()) >= 1)
        OR
        (recording_state != -1 AND TIMESTAMPDIFF(HOUR, dateCreated, NOW()) >= 7)
      )
      AND transcribe_paused != 1
      AND transcribe_finished != 1
    "
  .map(
    &mut conn,
    |(id, user_id, upload_kind, file_size): (u64, String, String, Option<u64>)| {
      return (id, user_id, upload_kind, file_size);
    },
  )
  .await?;

  info!("Found {} expired transcripts", expired_ids.len());

  for (expired_id, user_id, upload_kind, file_size) in expired_ids {
    warn!("Reaping transcript {}", expired_id);

    let is_adaptive = check_feature_flag(&user_id, "adaptive-concurrency-features")
      .await
      .unwrap_or(false);
    r"UPDATE transcripts SET transcribe_failed = 69 WHERE id = :id"
      .with(params! {
          "id" => expired_id,
      })
      .ignore(&mut conn)
      .await?;

    PostHogEventType::TranscribeFailed.capture(
      user_id.clone(),
      json!({
          "transcript_id": expired_id,
          "error_code": 69,
          "was_reaped": true,
          "upload_kind": upload_kind,
          "isAdaptive": is_adaptive,
          "file_size": file_size,
      }),
    );
  }

  Ok(())
}

pub async fn start_cloudflared_if_needed() -> Result<(), anyhow::Error> {
  if cfg!(target_os = "macos") {
    warn!("Not starting cloudflared on macOS.");
    return Ok(());
  }

  let cf_account_id =
    env::var("CF_ACCOUNT_ID").expect("CF_ACCOUNT_ID not found in environment variables");
  let cf_api_key = env::var("CF_API_KEY").expect("CF_API_KEY not found in environment variables");
  let cf_daemon_key =
    env::var("CF_DAEMON_KEY").expect("CF_DAEMON_KEY not found in environment variables");

  let client = ReqwestClient::new();
  let tunnel_api_url = format!(
    "https://api.cloudflare.com/client/v4/accounts/{}/tunnels",
    cf_account_id
  );

  let response = client
    .get(&tunnel_api_url)
    .header("Authorization", format!("Bearer {}", cf_api_key))
    .header("Content-Type", "application/json")
    .send()
    .await?;

  if !response.status().is_success() {
    let error_text = response.text().await.unwrap_or_default();
    error!("Failed to fetch tunnel status: {}", error_text);
    return Err(anyhow::anyhow!(
      "Failed to fetch tunnel status from Cloudflare"
    ));
  }

  let tunnel_response: TunnelResponse = response.json().await?;
  let server_prod_tunnel = tunnel_response
    .result
    .iter()
    .find(|tunnel| tunnel.name == "server-prod");

  if let Some(tunnel) = server_prod_tunnel {
    if tunnel.status == "healthy" {
      error!("Cloudflare: 'server-prod' tunnel is already active.");
      return Ok(());
    } else {
      info!("'Cloudflare: server-prod' tunnel is not active. Proceeding with setup.");
      let install_status = Command::new("cloudflared")
        .arg("service")
        .arg("install")
        .arg(cf_daemon_key)
        .status()
        .await?;

      if install_status.success() {
        info!("Cloudflared service installed successfully.");
      } else {
        return Err(anyhow::anyhow!("Failed to install cloudflared service."));
      }
    }
  }

  Ok(())
}

pub struct SharedRequestState {
  s3_client: Client,
  s3_client_frankfurt: Client,
  db: DbManager,
  options: Opts,
  pending_tasks_counter: Arc<AtomicUsize>,
  python: Arc<Mutex<PythonInterface>>,
  transcript_manager: Arc<TranscriptManager>,
  websocket: Arc<Mutex<WebsocketManager>>,
}

async fn health_handler() -> StatusCode {
  StatusCode::OK
}

async fn shutdown_signal() {
  #[cfg(unix)]
  async fn sigterm() {
    let mut term = signal(SignalKind::terminate()).expect("failed to install SIGTERM handler");
    term.recv().await;
  }

  #[cfg(not(unix))]
  async fn sigterm() {
    // No-op on non-UNIX platforms
    futures::future::pending::<()>().await;
  }

  tokio::select! {
    _ = tokio::signal::ctrl_c() => {
      warn!("Received Ctrl-C (SIGINT). Shutting down gracefully...");
    }
    _ = sigterm() => {
      warn!("Received SIGTERM. Shutting down gracefully...");
    }
  }
}

#[tokio::main]
async fn main() {
  // This should be called early in the startup path
  install_crash_handler();

  let options = Opts::from_args();

  // Set up the file appender
  let file_appender = tracing_appender::rolling::daily(dirs::home_dir().unwrap(), "mg.log");
  let (non_blocking_file, guard) = tracing_appender::non_blocking(file_appender);

  // File layer with filter that sets hyper to warn level
  let file_layer = tracing_subscriber::fmt::layer()
    .with_writer(non_blocking_file)
    .with_filter(EnvFilter::new("debug,hyper=warn"));

  // Console layer with same filter
  let std_layer = tracing_subscriber::fmt::layer().with_filter(EnvFilter::new("debug,hyper=warn"));

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

  match dotenv() {
    Ok(env_path) => info!("Loaded .env file from: {:?}", env_path),
    Err(_) => warn!("No .env file found — relying on environment variables injected by the container runtime (RunPod/Docker)."),
  }

    if let Err(e) = start_cloudflared_if_needed().await { tracing::error!("Cloudflare setup failed (non-fatal): {:?}", e); }

    if let Err(e) = pandoc::reference::init() { tracing::error!("Pandoc init failed (non-fatal): {:?}", e); }
    if let Err(e) = crate::prompt_templates::init() { tracing::error!("Prompt templates init failed (non-fatal): {:?}", e); }

  let credentials = Credentials::new(
    env::var("AWS_ACCESS_KEY_ID").expect("AWS_ACCESS_KEY_ID not found in env"),
    env::var("AWS_SECRET_ACCESS_KEY").expect("AWS_SECRET_ACCESS_KEY not found in env"),
    None,
    None,         // Expiry time (optional)
    "myprovider", // Provider name
  );

  let config = aws_config::from_env()
    .credentials_provider(credentials.clone())
    .region("us-east-1")
    .endpoint_url("https://s3-accelerate.amazonaws.com")
    .load()
    .await;
  let s3_client = aws_sdk_s3::Client::new(&config);

  let config_frankfurt = aws_config::from_env()
    .credentials_provider(credentials.clone())
    .region("eu-central-1")
    .endpoint_url("https://s3-accelerate.amazonaws.com")
    .load()
    .await;
  let s3_client_frankfurt = aws_sdk_s3::Client::new(&config_frankfurt);

  let python_module_path = Path::new(if cfg!(target_os = "macos") {
    "platform/server/python"
  } else {
    "python"
  });
  let python_interface = match PythonInterface::new(python_module_path) {
    Ok(pi) => {
      info!("Successfully initialized Python interface!");
      pi
    }
    Err(e) => {
      error!("Failed to initialize Python interface: {:?}", e);
      return;
    }
  };

  let shared_state = Arc::new(SharedRequestState {
    s3_client,
    s3_client_frankfurt,
    db: DbManager::new(),
    options,
    pending_tasks_counter: Arc::new(AtomicUsize::new(0)),
    python: Arc::new(Mutex::new(python_interface)),
    transcript_manager: Arc::new(TranscriptManager::new()),
    websocket: Arc::new(Mutex::new(WebsocketManager::new())),
  });

  // Spawn a task for running the transcript reaper periodically
  let reaper_state = shared_state.clone();
  tokio::spawn(async move {
    loop {
      match find_and_log_tombstones(reaper_state.clone()).await {
        Ok(n) => info!("Logged {} Tombstones.", n),
        Err(e) => error!("Error during tombstone logging: {:?}", e),
      }

      match run_transcript_reaper(reaper_state.clone()).await {
        Ok(_) => info!("Transcript reaping completed successfully."),
        Err(e) => error!("Error during transcript reaping: {:?}", e),
      }

      tokio::time::sleep(Duration::from_secs(300)).await;
    }
  });

  start_cron_job(
    "renewal_token_granter",
    Duration::from_secs(60 * 60), // 1 hour
    async || GovClerkMinutes_webhook::send_request(GcWebhookEvent::CheckRenewToken).await,
  )
  .await;

  start_cron_job(
    "check_whatsapps",
    Duration::from_secs(60 * 10), // 10 minutes
    async || GovClerkMinutes_webhook::send_request(GcWebhookEvent::CheckWhatsapps).await,
  )
  .await;

  start_cron_job(
    "run_post_signup_tasks",
    Duration::from_secs(60 * 5), // 5 minutes
    async || GovClerkMinutes_webhook::send_request(GcWebhookEvent::RunPostSignupTasks).await,
  )
  .await;

  start_cron_job(
    "handle_paywall_abandoners",
    Duration::from_secs(60 * 5), // 5 minutes
    async || GovClerkMinutes_webhook::send_request(GcWebhookEvent::HandlePaywallAbandoners).await,
  )
  .await;

  let resume_transcribe_router = Router::new()
    .route("/api/resume-transcribe", post(resume_transcribe_handler))
    .layer(
      CorsLayer::new()
        .allow_methods([Method::GET, Method::POST])
        .allow_origin(Any)
        .allow_headers(vec![header::AUTHORIZATION, header::CONTENT_TYPE]),
    );

  let regenerate_minutes_router = Router::new()
    .route("/api/regenerate-minutes", post(regenerate_minutes_handler))
    .route_layer(middleware::from_fn_with_state(
      shared_state.clone(),
      auth::auth,
    ))
    .layer(
      CorsLayer::new()
        .allow_methods([Method::POST])
        .allow_origin(Any)
        .allow_headers(vec![header::AUTHORIZATION, header::CONTENT_TYPE]),
    )
    .layer(Extension(shared_state.clone()));

  let regenerate_agenda_router = Router::new()
    .route("/api/regenerate-agenda", post(regenerate_agenda_handler))
    .route_layer(middleware::from_fn_with_state(
      shared_state.clone(),
      auth::auth,
    ))
    .layer(
      CorsLayer::new()
        .allow_methods([Method::POST])
        .allow_origin(Any)
        .allow_headers(vec![header::AUTHORIZATION, header::CONTENT_TYPE]),
    )
    .layer(Extension(shared_state.clone()));

  let create_agenda_router = Router::new()
    .route("/api/create-agenda", post(create_agenda_handler))
    .route_layer(middleware::from_fn_with_state(
      shared_state.clone(),
      auth::auth,
    ))
    .layer(
      CorsLayer::new()
        .allow_methods([Method::POST])
        .allow_origin(Any)
        .allow_headers(vec![header::AUTHORIZATION, header::CONTENT_TYPE]),
    )
    .layer(Extension(shared_state.clone()));

  let convert_document_handler = Router::new()
    .route("/api/convert-document", post(convert_document_handler))
    .route_layer(middleware::from_fn_with_state(
      shared_state.clone(),
      auth::auth,
    ))
    .layer(axum::extract::DefaultBodyLimit::max(50 * 1024 * 1024))
    .layer(
      CorsLayer::new()
        .allow_methods([Method::POST])
        .allow_origin(Any)
        .allow_headers(vec![header::AUTHORIZATION, header::CONTENT_TYPE]),
    )
    .layer(Extension(shared_state.clone()));

  let process_custom_template_router = Router::new()
    .route(
      "/api/process-custom-template",
      post(process_custom_template_handler),
    )
    .layer(
      CorsLayer::new()
        .allow_methods([Method::POST, Method::OPTIONS])
        .allow_origin(Any)
        .allow_headers(Any)
        .expose_headers(Any),
    )
    .layer(Extension(shared_state.clone()));

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

  let websocket_router = Router::new()
    .route("/admin/ws", get(websocket::handler))
    .layer(Extension(shared_state.clone()));

  let new_whatsapp_router = Router::new()
    .route(
      "/admin/api/new-whatsapp",
      post(whatsapp::new_whatsapp_handler),
    )
    .route("/admin/api/call", post(whatsapp::call_handler))
    .route_layer(middleware::from_fn_with_state(
      shared_state.clone(),
      auth::admin_auth,
    ))
    .layer(Extension(shared_state.clone()))
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

  let health_app = Router::new()
    .route("/health", get(health_handler))
    .with_state(shared_state.clone());

  let main_app = Router::new()
    .merge(resume_transcribe_router)
    .merge(regenerate_minutes_router)
    .merge(regenerate_agenda_router)
    .merge(create_agenda_router)
    .merge(get_pending_tasks_router)
    .merge(get_diarization_router)
    .merge(convert_document_handler)
    .merge(process_custom_template_router)
    .merge(websocket_router)
    .merge(new_whatsapp_router)
    .merge(create_auth_router())
    .merge(monitor_router)
    .layer(TraceLayer::new_for_http())
    .with_state(shared_state);

  let app = Router::new().merge(health_app).merge(main_app);

  let port = options.port.unwrap_or(8000);

  axum::Server::try_bind(&SocketAddr::from(([0, 0, 0, 0], port)))
    .unwrap_or_else(|err| {
      error!("Failed to bind to port {}: {:?}", port, err);
      std::process::exit(1);
    })
    .serve(app.into_make_service())
    .with_graceful_shutdown(shutdown_signal())
    .await
    .unwrap();
}

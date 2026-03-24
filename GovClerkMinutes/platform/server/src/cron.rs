use std::{future::Future, time::Duration};
use tokio::task;
use tracing::{error, info};

/// Starts a cron job in a new thread
pub async fn start_cron_job<F, Fut>(name: &'static str, interval: Duration, job: F)
where
  F: Fn() -> Fut + Send + Sync + 'static,
  Fut: Future<Output = anyhow::Result<()>> + Send + 'static,
{
  task::spawn(async move {
    loop {
      match job().await {
        Ok(_) => info!("cronjob {} succeeded", name),
        Err(e) => error!("cronjob {} failed with error: {:?}", name, e),
      }
      tokio::time::sleep(interval).await;
    }
  });

  info!("Cron job started: {}", name);
}

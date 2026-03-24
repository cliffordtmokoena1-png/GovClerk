use futures::future::BoxFuture;
use std::sync::Arc;

use crate::posthog::PostHogEventType;
use crate::{
  minutes_handler::{get_step_state, save_step_state, MinutesPipelineStep, StepStatus},
  SharedRequestState,
};
use serde_json::json;
use std::time::Instant;
use tracing::info;

pub struct StepTimer {
  start: Instant,
}

impl StepTimer {
  pub fn start() -> Self {
    StepTimer {
      start: Instant::now(),
    }
  }
  pub fn elapsed_ms(&self) -> u128 {
    self.start.elapsed().as_millis()
  }
}

pub fn log_step_duration_to_posthog(
  user_id: &str,
  transcript_id: u64,
  step: &MinutesPipelineStep,
  duration_ms: u128,
) {
  PostHogEventType::CreateMinutesStarted.capture(
    user_id.to_string(),
    json!({
        "transcript_id": transcript_id,
        "step": format!("{:?}", step),
        "duration_ms": duration_ms,
    }),
  );
}

#[derive(Debug, Clone)]
pub struct Transcript(pub String);

#[derive(Debug, Clone)]
pub struct MeetingNotes(pub String);

#[derive(Debug, Clone)]
pub struct DraftMinutes(pub String);

#[derive(Debug, Clone)]
pub struct OracleFeedback(pub String);

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct FinalMinutes(pub String);

#[derive(Clone)]
pub struct Ctx<'a> {
  pub state: Arc<SharedRequestState>,
  pub user_id: &'a str,
  pub transcript_id: u64,
  pub upload_kind: &'a str,
  pub region: &'a str,
  pub test_mode: bool,
}

pub type StepFuture<'a, T> = BoxFuture<'a, anyhow::Result<T>>;

pub trait Step: Sync + Send + 'static {
  type In: Send + 'static;
  type Out: Send + 'static;

  fn name(&self) -> &'static str;

  fn pipeline_step(&self, _input: &Self::In) -> MinutesPipelineStep;

  fn load_cached<'a>(
    &'a self,
    _input: &'a Self::In,
    _ctx: &'a Ctx<'a>,
  ) -> StepFuture<'a, Option<Self::Out>> {
    Box::pin(async { Ok(None) })
  }

  fn run<'a>(&'a self, input: Self::In, ctx: &'a Ctx<'a>) -> StepFuture<'a, Self::Out>;

  // ---------- provided wrapper (DO NOT override) ----------------
  fn framework_run<'a>(&'a self, input: Self::In, ctx: &'a Ctx<'a>) -> StepFuture<'a, Self::Out> {
    Box::pin(async move {
      info!(
        "Running step: {} (transcript_id: {}, user_id: {})",
        self.name(),
        ctx.transcript_id,
        ctx.user_id
      );

      let mut conn = ctx.state.db.get_conn().await?;
      let transcript_id = ctx.transcript_id;
      let user_id = ctx.user_id;

      // 1‑‑ check previous status
      let step_enum = self.pipeline_step(&input);
      if let Ok(Some(StepStatus::Success)) =
        get_step_state(&mut conn, transcript_id, user_id, &step_enum).await
      {
        if let Some(cached) = self.load_cached(&input, ctx).await? {
          return Ok(cached);
        } else {
          return Err(anyhow::anyhow!(
            "Step {} already completed, but no cached output found",
            self.name()
          ));
        }
      }

      // 2‑‑ mark InProgress
      save_step_state(
        &mut conn,
        transcript_id,
        user_id,
        &step_enum,
        &StepStatus::InProgress,
      )
      .await
      .ok();

      // 3‑‑ execute
      let timer = StepTimer::start();
      let res = self.run(input, ctx).await;

      // 4‑‑ persist final status
      let final_status = match &res {
        Ok(_) => StepStatus::Success,
        Err(e) => StepStatus::Failed(format!("{:?}", e)),
      };
      save_step_state(&mut conn, transcript_id, user_id, &step_enum, &final_status)
        .await
        .ok();

      // 5‑‑ analytics
      log_step_duration_to_posthog(user_id, transcript_id, &step_enum, timer.elapsed_ms());
      res
    })
  }
}

pub struct Then<A, B> {
  pub a: A,
  pub b: B,
}
impl<A, B> Then<A, B> {
  pub fn new(a: A, b: B) -> Self {
    Self { a, b }
  }
}

impl<A, B> Step for Then<A, B>
where
  A: Step,
  B: Step<In = A::Out>,
{
  type In = A::In;
  type Out = B::Out;

  fn name(&self) -> &'static str {
    "Then"
  }

  fn pipeline_step(&self, _input: &Self::In) -> MinutesPipelineStep {
    unreachable!("Then is a pure combiner; it never touches step-state");
  }

  // Override framework wrapper – just run sub‑steps
  fn framework_run<'a>(&'a self, input: Self::In, ctx: &'a Ctx<'a>) -> StepFuture<'a, Self::Out> {
    Box::pin(async move {
      let mid = self.a.framework_run(input, ctx).await?;
      let out = self.b.framework_run(mid, ctx).await?;
      Ok(out)
    })
  }

  fn run<'a>(&'a self, _: Self::In, _: &'a Ctx<'a>) -> StepFuture<'a, Self::Out> {
    Box::pin(async {
      unreachable!(
        "`run` should never be invoked on Then; Plan drives the pipeline via `framework_run`"
      )
    })
  }
}

#[macro_export]
macro_rules! make_pipeline {
    ($s:expr $(,)?) => { $s };
    ($s1:expr, $($rest:expr),+ $(,)?) => {
        $crate::minutes::pipeline::Then::new(
            $s1,
            $crate::make_pipeline!($($rest),+)
        )
    };
}

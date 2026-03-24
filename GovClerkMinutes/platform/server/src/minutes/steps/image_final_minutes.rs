use crate::create_minutes::call_llm;
use crate::minutes::pipeline::Ctx;
use crate::minutes::pipeline::Step;
use crate::minutes::pipeline::StepFuture;
use crate::minutes_handler::MinutesPipelineStep;
use crate::prompt_templates::{
  render_image_final_minutes_prefix, render_image_final_minutes_system, ImageFinalMinutesPromptData,
};
use mysql_async::params;
use mysql_async::prelude::Query;
use mysql_async::prelude::WithParams;
use tracing::info;

pub struct ImageFinalMinutesStep;

impl Step for ImageFinalMinutesStep {
  type In = String; // Extracted text from images
  type Out = String; // Final meeting minutes markdown

  fn name(&self) -> &'static str {
    return "ImageFinalMinutes";
  }

  fn pipeline_step(&self, _input: &Self::In) -> MinutesPipelineStep {
    return MinutesPipelineStep::ImageFinalMinutes;
  }

  fn load_cached<'a>(
    &'a self,
    _input: &'a Self::In,
    ctx: &'a Ctx<'a>,
  ) -> StepFuture<'a, Option<Self::Out>> {
    Box::pin(async move {
      let mut conn = ctx.state.db.get_conn().await?;
      let user_id = ctx.user_id;
      let transcript_id = ctx.transcript_id;

      info!(
        "Querying for cached final image meeting minutes: transcript_id={transcript_id}, user_id={user_id}",
      );

      let result: Option<Option<String>> = "
        SELECT minutes 
        FROM minutes
        WHERE transcript_id = :transcript_id
        AND user_id = :user_id
        ORDER BY id DESC
        LIMIT 1;
      "
      .with(params! {
        "transcript_id" => transcript_id,
        "user_id" => user_id,
      })
      .first(&mut conn)
      .await?;

      match result {
        Some(Some(minutes)) if !minutes.is_empty() => {
          info!("Found meeting minutes in db for transcript_id={transcript_id}");
          Ok(Some(minutes))
        }
        _ => {
          info!("No meeting minutes found in db for transcript_id={transcript_id}");
          Ok(None)
        }
      }
    })
  }

  fn run<'a>(&'a self, input: Self::In, ctx: &'a Ctx<'a>) -> StepFuture<'a, Self::Out> {
    Box::pin(async move {
      let system_prompt = render_image_final_minutes_system()?;
      let prompt_data = ImageFinalMinutesPromptData {
        meeting_notes: input.clone(),
        upload_kind: Some(ctx.upload_kind.to_string()),
        is_audio_upload: ctx.upload_kind == "audio",
      };
      let user_prompt = render_image_final_minutes_prefix(&prompt_data)?;

      let messages = serde_json::json!([
        { "role":"system", "content": system_prompt },
        { "role":"user", "content": user_prompt }
      ]);

      let minutes = call_llm("google/gemini-2.5-pro".into(), 0.3, messages, Some(3))
        .await
        .map_err(|e| anyhow::anyhow!("LLM call failed: {:?}", e))?;

      let mut conn = ctx.state.db.get_conn().await?;
      "
      UPDATE minutes
      SET minutes = :minutes
      WHERE transcript_id = :transcript_id
      AND user_id = :user_id
      AND fast_mode = 0
      "
      .with(params! {
        "transcript_id" => ctx.transcript_id,
        "user_id" => ctx.user_id,
        "minutes" => &minutes,
      })
      .ignore(&mut conn)
      .await?;

      Ok(minutes)
    })
  }
}

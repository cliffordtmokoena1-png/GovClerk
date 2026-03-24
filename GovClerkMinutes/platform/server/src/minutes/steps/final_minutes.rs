use crate::{
  create_minutes::call_llm,
  minutes::pipeline::{
    Ctx, DraftMinutes, FinalMinutes, MeetingNotes, OracleFeedback, Step, StepFuture, Transcript,
  },
  minutes_handler::{update_minutes_field, MinutesPipelineStep},
  prompt_templates::{render_final_minutes, render_final_minutes_system, PromptData},
  template_fetcher::get_custom_template,
};
use mysql_async::params;
use tracing::info;

pub struct FinalMinutesStep;

impl Step for FinalMinutesStep {
  type In = (Transcript, MeetingNotes, DraftMinutes, OracleFeedback);
  type Out = FinalMinutes;

  fn name(&self) -> &'static str {
    "FinalMinutes"
  }

  fn pipeline_step(&self, _input: &Self::In) -> MinutesPipelineStep {
    MinutesPipelineStep::FinalMinutes
  }

  fn load_cached<'a>(
    &'a self,
    _input: &'a Self::In,
    ctx: &'a Ctx<'a>,
  ) -> StepFuture<'a, Option<Self::Out>> {
    Box::pin(async move {
      let mut conn = ctx.state.db.get_conn().await?;
      let rows: Option<String> = mysql_async::prelude::Queryable::exec_first(
        &mut conn,
        "
          SELECT minutes
          FROM minutes
          WHERE transcript_id = :transcript_id
          AND user_id = :user_id
          ORDER BY id DESC
          LIMIT 1
        ",
        params! {
          "transcript_id" => ctx.transcript_id,
          "user_id" => ctx.user_id,
        },
      )
      .await?;

      if let Some(m) = rows {
        if !m.trim().is_empty() {
          return Ok(Some(FinalMinutes(m)));
        }
      }
      Ok(None)
    })
  }

  fn run<'a>(
    &'a self,
    (Transcript(tr), MeetingNotes(notes), DraftMinutes(draft), OracleFeedback(fbk)): Self::In,
    ctx: &'a Ctx<'a>,
  ) -> StepFuture<'a, Self::Out> {
    Box::pin(async move {
      let mut conn = ctx.state.db.get_conn().await?;

      // Fetch custom template if exists
      let custom_template = get_custom_template(&mut conn, ctx.user_id).await?;

      if custom_template.is_some() {
        info!("Using custom template for transcript {}", ctx.transcript_id);
      }

      let prompt_data = PromptData {
        transcript: tr.clone(),
        meeting_notes: Some(notes.clone()),
        draft_minutes: Some(draft.clone()),
        oracle_feedback: Some(fbk.clone()),
        user_template: custom_template,
        upload_kind: Some(ctx.upload_kind.to_string()),
        is_audio_upload: ctx.upload_kind == "audio",
      };

      let system_prompt = render_final_minutes_system()?;
      let user_prompt = render_final_minutes(&prompt_data)?;

      let messages = serde_json::json!([
        { "role":"system", "content": system_prompt },
        { "role":"user", "content": user_prompt }
      ]);

      let final_mins = call_llm("google/gemini-2.5-pro".into(), 0.3, messages, Some(3))
        .await
        .map_err(|e| anyhow::anyhow!("LLM call failed: {:?}", e))?;

      update_minutes_field(
        &mut conn,
        ctx.transcript_id,
        ctx.user_id,
        "minutes",
        &final_mins,
      )
      .await
      .ok();

      Ok(FinalMinutes(final_mins))
    })
  }
}

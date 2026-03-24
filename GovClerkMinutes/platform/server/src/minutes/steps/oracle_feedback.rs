use crate::{
  create_minutes::{call_llm, get_oracle_feedback},
  minutes::pipeline::{
    Ctx, DraftMinutes, MeetingNotes, OracleFeedback, Step, StepFuture, Transcript,
  },
  minutes_handler::{update_minutes_field, MinutesPipelineStep},
  prompt_templates::{render_oracle_feedback, render_oracle_feedback_system, PromptData},
};

pub struct OracleFeedbackStep;

impl Step for OracleFeedbackStep {
  type In = (Transcript, MeetingNotes, DraftMinutes);
  type Out = (Transcript, MeetingNotes, DraftMinutes, OracleFeedback);

  fn name(&self) -> &'static str {
    "OracleFeedback"
  }

  fn pipeline_step(&self, _input: &Self::In) -> MinutesPipelineStep {
    MinutesPipelineStep::OracleFeedback
  }

  // ---------- resume support -----------------------------------
  fn load_cached<'a>(
    &'a self,
    input: &'a Self::In,
    ctx: &'a Ctx<'a>,
  ) -> StepFuture<'a, Option<Self::Out>> {
    Box::pin(async move {
      let mut conn = ctx.state.db.get_conn().await?;
      if let Some(fbk) = get_oracle_feedback(&mut conn, ctx.transcript_id, ctx.user_id).await? {
        if !fbk.is_empty() {
          return Ok(Some((
            input.0.clone(),
            input.1.clone(),
            input.2.clone(),
            OracleFeedback(fbk),
          )));
        }
      }
      Ok(None)
    })
  }

  fn run<'a>(
    &'a self,
    (Transcript(tr), MeetingNotes(notes), DraftMinutes(draft)): Self::In,
    ctx: &'a Ctx<'a>,
  ) -> StepFuture<'a, Self::Out> {
    Box::pin(async move {
      let mut conn = ctx.state.db.get_conn().await?;

      let prompt_data = PromptData {
        transcript: tr.clone(),
        meeting_notes: Some(notes.clone()),
        draft_minutes: Some(draft.clone()),
        oracle_feedback: None,
        user_template: None,
        upload_kind: Some(ctx.upload_kind.to_string()),
        is_audio_upload: ctx.upload_kind == "audio",
      };

      let system_prompt = render_oracle_feedback_system()?;
      let user_prompt = render_oracle_feedback(&prompt_data)?;

      let messages = serde_json::json!([
          { "role":"system", "content": system_prompt },
          { "role":"user", "content": user_prompt }
      ]);

      let fbk = call_llm("google/gemini-2.5-pro".into(), 0.3, messages, Some(3))
        .await
        .map_err(|e| anyhow::anyhow!("LLM call failed: {:?}", e))?;

      update_minutes_field(
        &mut conn,
        ctx.transcript_id,
        ctx.user_id,
        "oracle_feedback",
        &fbk,
      )
      .await
      .ok();

      return Ok((
        Transcript(tr),
        MeetingNotes(notes),
        DraftMinutes(draft),
        OracleFeedback(fbk),
      ));
    })
  }
}

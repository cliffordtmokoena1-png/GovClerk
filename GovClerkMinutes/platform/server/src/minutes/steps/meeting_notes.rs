use crate::create_minutes::call_llm;
use crate::create_minutes::get_meeting_notes;
use crate::minutes::pipeline::Ctx;
use crate::minutes::pipeline::MeetingNotes;
use crate::minutes::pipeline::Step;
use crate::minutes::pipeline::StepFuture;
use crate::minutes::pipeline::Transcript;
use crate::minutes_handler::update_minutes_field;
use crate::minutes_handler::MinutesPipelineStep;
use crate::prompt_templates::PromptData;

pub struct MeetingNotesStep;

impl Step for MeetingNotesStep {
  type In = Transcript;
  type Out = (Transcript, MeetingNotes);

  fn name(&self) -> &'static str {
    "MeetingNotes"
  }

  fn pipeline_step(&self, _input: &Self::In) -> MinutesPipelineStep {
    MinutesPipelineStep::MeetingNotes
  }

  // ---------- resume support -----------------------------------
  fn load_cached<'a>(
    &'a self,
    input: &'a Self::In,
    ctx: &'a Ctx<'a>,
  ) -> StepFuture<'a, Option<Self::Out>> {
    Box::pin(async move {
      let mut conn = ctx.state.db.get_conn().await?;
      if let Some(notes) = get_meeting_notes(&mut conn, ctx.transcript_id, ctx.user_id).await? {
        if !notes.is_empty() {
          return Ok(Some((input.clone(), MeetingNotes(notes))));
        }
      }
      Ok(None)
    })
  }

  fn run<'a>(&'a self, Transcript(t): Self::In, ctx: &'a Ctx<'a>) -> StepFuture<'a, Self::Out> {
    Box::pin(async move {
      let mut conn = ctx.state.db.get_conn().await?;

      let prompt_data = PromptData {
        transcript: t.clone(),
        meeting_notes: None,
        draft_minutes: None,
        oracle_feedback: None,
        user_template: None,
        upload_kind: Some(ctx.upload_kind.to_string()),
        is_audio_upload: ctx.upload_kind == "audio",
      };

      let system_prompt = crate::prompt_templates::render_meeting_notes_system()?;
      let user_prompt = crate::prompt_templates::render_meeting_notes(&prompt_data)?;

      let messages = serde_json::json!([
          { "role":"system", "content": system_prompt },
          { "role":"user", "content": user_prompt }
      ]);

      let notes = call_llm("google/gemini-2.5-pro".into(), 0.2, messages, Some(3))
        .await
        .map_err(|e| anyhow::anyhow!("LLM call failed: {:?}", e))?;

      update_minutes_field(&mut conn, ctx.transcript_id, ctx.user_id, "outline", &notes)
        .await
        .ok();

      Ok((Transcript(t), MeetingNotes(notes)))
    })
  }
}

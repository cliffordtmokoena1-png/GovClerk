use crate::{
  create_minutes::call_llm,
  minutes::pipeline::{Ctx, DraftMinutes, MeetingNotes, Step, StepFuture, Transcript},
  minutes_handler::{update_minutes_field, MinutesPipelineStep},
  prompt_templates::{render_final_minutes_system, render_first_draft, PromptData},
  template_fetcher::get_custom_template,
};
use mysql_async::{params, prelude::Queryable};
use tracing::info;

pub struct FirstDraftStep;

impl Step for FirstDraftStep {
  type In = (Transcript, MeetingNotes);
  type Out = (Transcript, MeetingNotes, DraftMinutes);

  fn name(&self) -> &'static str {
    "FirstDraft"
  }

  fn pipeline_step(&self, _input: &Self::In) -> MinutesPipelineStep {
    MinutesPipelineStep::FirstDraft
  }

  fn load_cached<'a>(
    &'a self,
    input: &'a Self::In,
    ctx: &'a Ctx<'a>,
  ) -> StepFuture<'a, Option<Self::Out>> {
    Box::pin(async move {
      let mut conn = ctx.state.db.get_conn().await?;

      let first_draft: Option<Option<String>> = conn
        .exec_first(
          "
            SELECT first_draft
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

      match first_draft {
        Some(Some(draft)) => {
          info!(
            "Found first draft in db for transcript_id={}",
            ctx.transcript_id
          );
          return Ok(Some((
            input.0.clone(),
            input.1.clone(),
            DraftMinutes(draft),
          )));
        }
        _ => {
          info!(
            "No first draft found in db for transcript_id={}",
            ctx.transcript_id
          );
          return Ok(None);
        }
      };
    })
  }

  fn run<'a>(
    &'a self,
    (Transcript(tr), MeetingNotes(notes)): Self::In,
    ctx: &'a Ctx<'a>,
  ) -> StepFuture<'a, Self::Out> {
    Box::pin(async move {
      let mut conn = ctx.state.db.get_conn().await?;

      let custom_template = get_custom_template(&mut conn, ctx.user_id).await?;

      if custom_template.is_some() {
        info!(
          "Using custom template for first draft (transcript {})",
          ctx.transcript_id
        );
      }

      let prompt_data = PromptData {
        transcript: tr.clone(),
        meeting_notes: Some(notes.clone()),
        draft_minutes: None,
        oracle_feedback: None,
        user_template: custom_template,
        upload_kind: Some(ctx.upload_kind.to_string()),
        is_audio_upload: ctx.upload_kind == "audio",
      };

      let system_prompt = render_final_minutes_system()?;
      let user_prompt = render_first_draft(&prompt_data)?;

      let messages = serde_json::json!([
          { "role":"system", "content": system_prompt },
          { "role":"user", "content": user_prompt }
      ]);

      let draft = call_llm("google/gemini-2.5-pro".into(), 0.3, messages, Some(3))
        .await
        .map_err(|e| anyhow::anyhow!("LLM call failed: {:?}", e))?;

      update_minutes_field(
        &mut conn,
        ctx.transcript_id,
        ctx.user_id,
        "first_draft",
        &draft,
      )
      .await
      .ok();

      return Ok((Transcript(tr), MeetingNotes(notes), DraftMinutes(draft)));
    })
  }
}

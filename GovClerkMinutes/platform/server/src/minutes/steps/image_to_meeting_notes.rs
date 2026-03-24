use crate::create_minutes::call_llm;
use crate::get_image_upload::get_image_upload_as_data_urls;
use crate::minutes::pipeline::Ctx;
use crate::minutes::pipeline::Step;
use crate::minutes::pipeline::StepFuture;
use crate::minutes_handler::MinutesPipelineStep;
use crate::prompt_templates::{
  render_image_to_meeting_notes_prefix, render_image_to_meeting_notes_system,
};
use mysql_async::params;
use mysql_async::prelude::Query;
use mysql_async::prelude::WithParams;
use serde_json::json;
use tracing::info;

pub struct ImageToMeetingNotesStep;

impl Step for ImageToMeetingNotesStep {
  type In = ();
  type Out = String; // Meeting notes from image-to-text conversion

  fn name(&self) -> &'static str {
    return "ImageToMeetingNotes";
  }

  fn pipeline_step(&self, _input: &Self::In) -> MinutesPipelineStep {
    return MinutesPipelineStep::ImageToMeetingNotes;
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
        "Querying for cached image meeting notes: transcript_id={transcript_id}, user_id={user_id}",
      );

      let result: Option<Option<String>> = "
        SELECT outline
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
        Some(Some(notes)) if !notes.is_empty() => {
          info!("Found meeting notes in db for transcript_id={transcript_id}");
          Ok(Some(notes))
        }
        _ => {
          info!("No meeting notes found in db for transcript_id={transcript_id}");
          Ok(None)
        }
      }
    })
  }

  fn run<'a>(&'a self, _input: Self::In, ctx: &'a Ctx<'a>) -> StepFuture<'a, Self::Out> {
    Box::pin(async move {
      let image_urls = get_image_upload_as_data_urls(
        ctx.state.clone(),
        ctx.transcript_id,
        ctx.region,
        ctx.test_mode,
      )
      .await?;

      info!(
        "Got {} image URLs for transcript_id={}",
        image_urls.len(),
        ctx.transcript_id
      );

      let system_prompt = render_image_to_meeting_notes_system()?;
      let prefix_prompt = render_image_to_meeting_notes_prefix()?;

      let mut content = vec![json!({
          "type": "text",
          "text": prefix_prompt,
      })];

      content.extend(image_urls.iter().map(|url| {
        json!({
            "type": "image_url",
            "image_url": { "url": url }
        })
      }));

      let messages = json!([
          { "role": "system", "content": system_prompt },
          {
              "role": "user",
              "content": content
          }
      ]);

      let notes = call_llm("google/gemini-2.5-pro".into(), 0.2, messages, Some(3))
        .await
        .map_err(|e| anyhow::anyhow!("LLM call failed: {:?}", e))?;

      let mut conn = ctx.state.db.get_conn().await?;
      "
      UPDATE minutes
      SET outline = :outline
      WHERE transcript_id = :transcript_id
      AND user_id = :user_id
      AND fast_mode = 0
      "
      .with(params! {
        "transcript_id" => ctx.transcript_id,
        "user_id" => ctx.user_id,
        "outline" => &notes,
      })
      .ignore(&mut conn)
      .await?;

      Ok(notes)
    })
  }
}

use crate::create_minutes::call_llm;
use crate::minutes::pipeline::Ctx;
use crate::minutes::pipeline::FinalMinutes;
use crate::minutes::pipeline::Step;
use crate::minutes::pipeline::StepFuture;
use crate::minutes_handler::MinutesPipelineStep;
use crate::prompt_templates::{
  render_final_minutes_system, render_regenerate_with_feedback, RegeneratePromptData,
};
use mysql_async::params;
use mysql_async::prelude::Query;
use mysql_async::prelude::WithParams;
use serde_json::json;

#[derive(Debug, Clone)]
pub struct RegenerationStepInput {
  pub context: String,
  pub step: MinutesPipelineStep,
  pub pending_minutes_id: usize,
}

pub struct RegenerateStep;

impl Step for RegenerateStep {
  type In = RegenerationStepInput;
  type Out = FinalMinutes;

  fn name(&self) -> &'static str {
    "Regenerate"
  }

  fn pipeline_step(&self, input: &Self::In) -> MinutesPipelineStep {
    return input.step.clone();
  }

  fn run<'a>(&'a self, input: Self::In, ctx: &'a Ctx<'a>) -> StepFuture<'a, Self::Out> {
    Box::pin(async move {
      let mut conn = ctx.state.db.get_conn().await?;

      let include_speaker_label_guidance = ctx.upload_kind == "audio";

      let prompt_data = RegeneratePromptData {
        regeneration_context: input.context.clone(),
        include_speaker_label_guidance,
      };

      let system_prompt = render_final_minutes_system()?;
      let user_prompt = render_regenerate_with_feedback(&prompt_data)?;

      let messages = vec![
        json!({
          "role": "system",
          "content": system_prompt,
        }),
        json!({
          "role": "user",
          "content": user_prompt,
        }),
      ];

      let minutes_content = call_llm(
        "google/gemini-2.5-pro".to_owned(),
        0.3,
        serde_json::Value::Array(messages),
        Some(3),
      )
      .await
      .map_err(|e| anyhow::anyhow!("Error calling LLM: {:?}", e))?;

      "
      UPDATE minutes
      SET minutes = :minutes
      WHERE id = :id;
      "
      .with(params! {
        "minutes" => &minutes_content,
        "id" => input.pending_minutes_id,
      })
      .ignore(&mut conn)
      .await?;

      return Ok(FinalMinutes(minutes_content));
    })
  }
}

use handlebars::Handlebars;
use serde::Serialize;
use std::sync::OnceLock;

#[derive(Serialize, Debug, Clone)]
pub struct PromptData {
  pub transcript: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub meeting_notes: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub draft_minutes: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub oracle_feedback: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub user_template: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub upload_kind: Option<String>,
  pub is_audio_upload: bool,
}

#[derive(Serialize, Debug, Clone)]
pub struct RegeneratePromptData {
  pub regeneration_context: String,
  pub include_speaker_label_guidance: bool,
}

#[derive(Serialize, Debug, Clone)]
pub struct FinetunedPromptData {
  pub transcript: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub upload_kind: Option<String>,
  pub is_audio_upload: bool,
}

#[derive(Serialize, Debug, Clone)]
pub struct ImageFinalMinutesPromptData {
  pub meeting_notes: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub upload_kind: Option<String>,
  pub is_audio_upload: bool,
}

#[derive(Serialize, Debug, Clone)]
pub struct AgendaPromptData {
  pub source_text: String,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub title: Option<String>,
  pub current_date: String,
}

#[derive(Serialize, Debug, Clone)]
pub struct RegenerateAgendaPromptData {
  pub regeneration_context: String,
}

static RENDERER: OnceLock<Handlebars<'static>> = OnceLock::new();

/// Initialize the prompt renderer (idempotent).
/// Call this once during server startup.
pub fn init() -> anyhow::Result<()> {
  if RENDERER.get().is_some() {
    return Ok(());
  }

  let mut hb = Handlebars::new();

  // Register shared final minutes instructions as a partial
  hb.register_partial(
    "shared_minutes_intro",
    include_str!("../../assets/prompts/shared/_shared_minutes_intro.hbs"),
  )?;
  hb.register_partial(
    "minutes_context_sections",
    include_str!("../../assets/prompts/shared/_minutes_context_sections.hbs"),
  )?;
  hb.register_partial(
    "minutes_prompt_base",
    include_str!("../../assets/prompts/shared/_minutes_prompt_base.hbs"),
  )?;
  hb.register_partial(
    "shared_final_minutes_instructions",
    include_str!("../../assets/prompts/shared/_shared_final_minutes_instructions.hbs"),
  )?;
  hb.register_partial(
    "shared_minutes_guidelines",
    include_str!("../../assets/prompts/shared/_shared_minutes_guidelines.hbs"),
  )?;

  hb.register_template_string(
    "meeting_notes_system",
    include_str!("../../assets/prompts/system/meeting_notes_system.hbs"),
  )?;
  hb.register_template_string(
    "meeting_notes",
    include_str!("../../assets/prompts/steps/meeting_notes.hbs"),
  )?;
  hb.register_template_string(
    "oracle_feedback_system",
    include_str!("../../assets/prompts/system/oracle_feedback_system.hbs"),
  )?;
  hb.register_template_string(
    "first_draft",
    include_str!("../../assets/prompts/steps/first_draft.hbs"),
  )?;
  hb.register_template_string(
    "oracle_feedback",
    include_str!("../../assets/prompts/steps/oracle_feedback.hbs"),
  )?;
  hb.register_template_string(
    "final_minutes_system",
    include_str!("../../assets/prompts/system/final_minutes_system.hbs"),
  )?;
  hb.register_template_string(
    "final_minutes",
    include_str!("../../assets/prompts/steps/final_minutes.hbs"),
  )?;
  hb.register_template_string(
    "regenerate_with_feedback",
    include_str!("../../assets/prompts/steps/regenerate_with_feedback.hbs"),
  )?;
  hb.register_template_string(
    "finetuned_minutes_prefix",
    include_str!("../../assets/prompts/steps/finetuned_minutes_prefix.hbs"),
  )?;
  hb.register_template_string(
    "image_to_meeting_notes_system",
    include_str!("../../assets/prompts/system/image_to_meeting_notes_system.hbs"),
  )?;
  hb.register_template_string(
    "image_to_meeting_notes_prefix",
    include_str!("../../assets/prompts/steps/image_to_meeting_notes_prefix.hbs"),
  )?;
  hb.register_template_string(
    "image_final_minutes_system",
    include_str!("../../assets/prompts/system/image_final_minutes_system.hbs"),
  )?;
  hb.register_template_string(
    "image_final_minutes_prefix",
    include_str!("../../assets/prompts/steps/image_final_minutes_prefix.hbs"),
  )?;
  hb.register_template_string(
    "create_agenda_system",
    include_str!("../../assets/prompts/system/create_agenda_system.hbs"),
  )?;
  hb.register_template_string(
    "create_agenda",
    include_str!("../../assets/prompts/steps/create_agenda.hbs"),
  )?;
  hb.register_template_string(
    "regenerate_agenda",
    include_str!("../../assets/prompts/steps/regenerate_agenda.hbs"),
  )?;

  hb.register_helper("eq", Box::new(eq_helper));

  let _ = RENDERER.set(hb);
  Ok(())
}

fn renderer() -> &'static Handlebars<'static> {
  RENDERER
    .get()
    .expect("prompt_templates::init() must be called at server startup")
}

pub fn render_meeting_notes(data: &PromptData) -> anyhow::Result<String> {
  renderer()
    .render("meeting_notes", data)
    .map_err(|e| anyhow::anyhow!("Failed to render meeting_notes template: {}", e))
}

pub fn render_meeting_notes_system() -> anyhow::Result<String> {
  renderer()
    .render("meeting_notes_system", &())
    .map_err(|e| anyhow::anyhow!("Failed to render meeting_notes_system template: {}", e))
}

pub fn render_first_draft(data: &PromptData) -> anyhow::Result<String> {
  renderer()
    .render("first_draft", data)
    .map_err(|e| anyhow::anyhow!("Failed to render first_draft template: {}", e))
}

pub fn render_oracle_feedback(data: &PromptData) -> anyhow::Result<String> {
  renderer()
    .render("oracle_feedback", data)
    .map_err(|e| anyhow::anyhow!("Failed to render oracle_feedback template: {}", e))
}

pub fn render_oracle_feedback_system() -> anyhow::Result<String> {
  renderer()
    .render("oracle_feedback_system", &())
    .map_err(|e| anyhow::anyhow!("Failed to render oracle_feedback_system template: {}", e))
}

pub fn render_final_minutes(data: &PromptData) -> anyhow::Result<String> {
  renderer()
    .render("final_minutes", data)
    .map_err(|e| anyhow::anyhow!("Failed to render final_minutes template: {}", e))
}

pub fn render_final_minutes_system() -> anyhow::Result<String> {
  renderer()
    .render("final_minutes_system", &())
    .map_err(|e| anyhow::anyhow!("Failed to render final_minutes_system template: {}", e))
}

pub fn render_regenerate_with_feedback(data: &RegeneratePromptData) -> anyhow::Result<String> {
  renderer()
    .render("regenerate_with_feedback", data)
    .map_err(|e| anyhow::anyhow!("Failed to render regenerate_with_feedback template: {}", e))
}

pub fn render_finetuned_minutes_prefix(data: &FinetunedPromptData) -> anyhow::Result<String> {
  renderer()
    .render("finetuned_minutes_prefix", data)
    .map_err(|e| anyhow::anyhow!("Failed to render finetuned_minutes_prefix template: {}", e))
}

pub fn render_image_to_meeting_notes_system() -> anyhow::Result<String> {
  renderer()
    .render("image_to_meeting_notes_system", &())
    .map_err(|e| {
      anyhow::anyhow!(
        "Failed to render image_to_meeting_notes_system template: {}",
        e
      )
    })
}

pub fn render_image_to_meeting_notes_prefix() -> anyhow::Result<String> {
  renderer()
    .render("image_to_meeting_notes_prefix", &())
    .map_err(|e| {
      anyhow::anyhow!(
        "Failed to render image_to_meeting_notes_prefix template: {}",
        e
      )
    })
}

pub fn render_image_final_minutes_system() -> anyhow::Result<String> {
  renderer()
    .render("image_final_minutes_system", &())
    .map_err(|e| {
      anyhow::anyhow!(
        "Failed to render image_final_minutes_system template: {}",
        e
      )
    })
}

pub fn render_image_final_minutes_prefix(
  data: &ImageFinalMinutesPromptData,
) -> anyhow::Result<String> {
  renderer()
    .render("image_final_minutes_prefix", data)
    .map_err(|e| {
      anyhow::anyhow!(
        "Failed to render image_final_minutes_prefix template: {}",
        e
      )
    })
}

pub fn render_create_agenda_system() -> anyhow::Result<String> {
  renderer()
    .render("create_agenda_system", &())
    .map_err(|e| anyhow::anyhow!("Failed to render create_agenda_system template: {}", e))
}

pub fn render_create_agenda(data: &AgendaPromptData) -> anyhow::Result<String> {
  renderer()
    .render("create_agenda", data)
    .map_err(|e| anyhow::anyhow!("Failed to render create_agenda template: {}", e))
}

pub fn render_regenerate_agenda(data: &RegenerateAgendaPromptData) -> anyhow::Result<String> {
  renderer()
    .render("regenerate_agenda", data)
    .map_err(|e| anyhow::anyhow!("Failed to render regenerate_agenda template: {}", e))
}

fn eq_helper(
  h: &handlebars::Helper,
  _: &Handlebars,
  _: &handlebars::Context,
  _: &mut handlebars::RenderContext,
  out: &mut dyn handlebars::Output,
) -> handlebars::HelperResult {
  let param1 = h.param(0).and_then(|v| v.value().as_str());
  let param2 = h.param(1).and_then(|v| v.value().as_str());

  let result = param1 == param2;
  out.write(&result.to_string())?;
  Ok(())
}

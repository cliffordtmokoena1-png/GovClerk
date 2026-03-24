use mysql_async::{prelude::Queryable, Conn};
use tracing::{info, warn};

/// Fetches the user's selected template from GC_templating table
///
/// Flow:
/// 1. Check GC_settings for selected-template-id
/// 2. Query GC_templating for that template (both user templates and default templates)
/// 3. Return template content or None if default GovClerkMinutes template
///
pub async fn get_custom_template(conn: &mut Conn, user_id: &str) -> anyhow::Result<Option<String>> {
  info!("Checking for selected template: user_id={}", user_id);

  // Get selected template ID from settings
  let selected_template_id: Option<String> = conn
    .exec_first(
      "SELECT setting_value FROM GC_settings WHERE user_id = ? AND setting_key = 'selected-template-id'",
      (user_id,),
    )
    .await?
    .and_then(|json_str: String| {
      serde_json::from_str::<String>(&json_str).ok()
    });

  let template_id = match selected_template_id {
    Some(id) => id,
    None => {
      info!(
        "No template selected in settings for user {}, using default",
        user_id
      );
      return Ok(None);
    }
  };

  info!("User {} has selected template: {}", user_id, template_id);

  // Special case: if it's the default GovClerkMinutes template, don't fetch from DB
  if template_id == "GovClerkMinutes-template" {
    info!("Using default GovClerkMinutes template (no custom content needed)");
    return Ok(None);
  }

  let template_content: Option<String> = conn
    .exec_first(
      "SELECT content FROM GC_templating 
       WHERE template_id = ? 
       AND (user_id = ? OR user_id IS NULL)
       LIMIT 1",
      (&template_id, user_id),
    )
    .await?;

  match template_content {
    Some(content) => {
      info!(
        "Successfully fetched template {} for user {} ({} bytes)",
        template_id,
        user_id,
        content.len()
      );
      Ok(Some(content))
    }
    None => {
      warn!(
        "Template {} not found for user {} in GC_templating table",
        template_id, user_id
      );
      Ok(None)
    }
  }
}

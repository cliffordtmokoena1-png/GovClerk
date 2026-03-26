use crate::{auth, pandoc, s3, SharedRequestState};
use axum::{
  extract::{State, TypedHeader},
  headers::authorization::{Authorization, Bearer},
  http::StatusCode,
  response::{IntoResponse, Json},
  Json as AxumJson,
};
use mysql_async::prelude::*;
use reqwest::Client;
use serde::Deserialize;
use serde_json::json;
use std::env;
use std::sync::Arc;
use tracing::{error, info, warn};

const MAX_FILES: usize = 10;
const MAX_FILE_SIZE: usize = 20 * 1024 * 1024; // 20 MB per file
const DEFAULT_REGION: &str = "us-east-1";

#[derive(serde::Serialize)]
pub struct ProcessTemplateResponse {
  success: bool,
  #[serde(rename = "templateId")]
  template_id: String,
}

#[derive(Deserialize, Clone)]
struct TemplateReferenceDescriptor {
  key: String,
  #[serde(default)]
  file_name: Option<String>,
  #[serde(default)]
  content_type: Option<String>,
}

#[derive(Deserialize)]
pub(crate) struct ProcessTemplateRequest {
  #[serde(rename = "templateId")]
  template_id: String,
  #[serde(default)]
  region: Option<String>,
  references: Vec<TemplateReferenceDescriptor>,
}

pub async fn process_custom_template_handler(
  TypedHeader(auth_header): TypedHeader<Authorization<Bearer>>,
  State(state): State<Arc<SharedRequestState>>,
  AxumJson(payload): AxumJson<ProcessTemplateRequest>,
) -> Result<impl IntoResponse, StatusCode> {
  // Manually authenticate to get user_id (needed because Multipart + Extension don't work well together)
  let user =
    auth::authenticate_bearer_token(auth_header.token()).map_err(|_| StatusCode::UNAUTHORIZED)?;
  let user_id = user.user_id;

  let template_id = payload.template_id.clone();
  if !template_id.starts_with("custom-") {
    error!("Invalid template id format: {}", template_id);
    return Err(StatusCode::BAD_REQUEST);
  }

  let references = payload.references;
  if references.is_empty() {
    error!("No references provided for template processing");
    return Err(StatusCode::BAD_REQUEST);
  }

  if references.len() > MAX_FILES {
    error!("Too many references provided: {}", references.len());
    return Err(StatusCode::BAD_REQUEST);
  }

  let region = payload.region.unwrap_or_else(|| DEFAULT_REGION.to_string());

  // Download referenced files from S3
  let mut files: Vec<(String, Vec<u8>)> = Vec::with_capacity(references.len());

  for (index, reference) in references.iter().enumerate() {
    info!(
      sample_number = index + 1,
      key = %reference.key,
      region = %region,
      file_name = reference.file_name.as_deref().unwrap_or("unknown"),
      content_type = reference.content_type.as_deref().unwrap_or("unknown"),
      "Fetching template reference from S3"
    );

    let object = s3::get_object(state.clone(), region.clone(), reference.key.clone())
      .await
      .map_err(|error| {
        error!(
          key = %reference.key,
          region = %region,
          "Failed to fetch template reference from S3: {:?}",
          error
        );
        StatusCode::INTERNAL_SERVER_ERROR
      })?;

    let data = object
      .body
      .collect()
      .await
      .map_err(|error| {
        error!(
          key = %reference.key,
          region = %region,
          "Failed to read S3 body for template reference: {:?}",
          error
        );
        StatusCode::INTERNAL_SERVER_ERROR
      })?
      .into_bytes()
      .to_vec();

    if data.len() > MAX_FILE_SIZE {
      error!(
        key = %reference.key,
        bytes = data.len(),
        "Template reference exceeds per-file limit"
      );
      return Err(StatusCode::PAYLOAD_TOO_LARGE);
    }

    let filename = reference
      .file_name
      .clone()
      .unwrap_or_else(|| format!("sample_{}.md", index + 1));

    info!(
      sample_number = index + 1,
      key = %reference.key,
      file_name = %filename,
      bytes = data.len(),
      "Fetched template reference from S3"
    );

    files.push((filename, data));
  }

  info!(
    "Processing {} template files for user {}",
    files.len(),
    user_id
  );

  // Extract text from all files in parallel
  let extraction_tasks: Vec<_> = files
    .into_iter()
    .map(|(filename, bytes)| {
      tokio::spawn(async move {
        let result = extract_text_from_file(&filename, &bytes).await;
        (filename, result)
      })
    })
    .collect();

  // Wait for all extractions to complete
  let mut sample_texts = Vec::new();
  for task in extraction_tasks {
    match task.await {
      Ok((filename, Ok(text))) => {
        info!("Extracted {} chars from {}", text.len(), filename);
        sample_texts.push(text);
      }
      Ok((filename, Err(e))) => {
        warn!("Failed to extract text from {}: {}", filename, e);
      }
      Err(e) => {
        error!("Task join error: {}", e);
      }
    }
  }

  if sample_texts.is_empty() {
    error!("Failed to extract text from any file");
    return Err(StatusCode::INTERNAL_SERVER_ERROR);
  }

  // Generate template using AI
  let generated = match generate_template_from_samples(&sample_texts).await {
    Ok(result) => result,
    Err(e) => {
      error!("Failed to generate template: {}", e);
      return Err(StatusCode::INTERNAL_SERVER_ERROR);
    }
  };

  info!(
    "Generated template: name='{}', {} chars content, {} chars preview",
    generated.name,
    generated.content.len(),
    generated.preview.len()
  );

  let reference_keys: Vec<String> = references.into_iter().map(|r| r.key).collect();

  let reference_keys_json = match serde_json::to_string(&reference_keys) {
    Ok(json) => json,
    Err(error) => {
      error!("Failed to serialize reference keys: {}", error);
      "[]".to_string()
    }
  };

  // Insert into GC_templating table
  let mut conn = state
    .db
    .get_conn()
    .await
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

  let advantages_json = match serde_json::to_string(&generated.advantages) {
    Ok(value) => value,
    Err(e) => {
      error!("Failed to serialize template advantages: {}", e);
      "[]".to_string()
    }
  };

  conn
    .exec_drop(
      "
      INSERT INTO GC_templating (
        template_id,
        user_id,
        is_default,
        name,
        description,
        category,
        content,
        preview,
        use_case,
        advantages,
        reference_s3_keys
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ",
      (
        &template_id,
        &user_id,
        false,
        &generated.name,
        &generated.description,
        "meeting-minutes",
        &generated.content,
        &generated.preview,
        &generated.use_case,
        &advantages_json,
        &reference_keys_json,
      ),
    )
    .await
    .map_err(|e| {
      error!("Failed to insert template: {}", e);
      StatusCode::INTERNAL_SERVER_ERROR
    })?;

  // Auto-select the new template by updating GC_settings
  conn
    .exec_drop(
      "
      INSERT INTO GC_settings (user_id, setting_key, setting_value)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        setting_value = VALUES(setting_value),
        updated_at = CURRENT_TIMESTAMP
    ",
      (
        &user_id,
        "selected-template-id",
        json!(&template_id).to_string(),
      ),
    )
    .await
    .map_err(|e| {
      error!("Failed to update settings: {}", e);
      StatusCode::INTERNAL_SERVER_ERROR
    })?;

  info!(
    "Successfully created and selected template {} for user {}",
    template_id, user_id
  );

  Ok(Json(ProcessTemplateResponse {
    success: true,
    template_id,
  }))
}

async fn extract_text_from_file(filename: &str, bytes: &[u8]) -> anyhow::Result<String> {
  let extension = filename.rsplit('.').next().unwrap_or("").to_lowercase();

  info!(file = filename, %extension, size_bytes = bytes.len(), "Extracting text from template sample");

  match extension.as_str() {
    "txt" => {
      // Plain text - just convert to string
      Ok(String::from_utf8_lossy(bytes).to_string())
    }
    "pdf" | "doc" | "docx" => {
      // Use pandoc to convert to markdown
      let input_format = pandoc::InputFormat::from_extension(&extension)?;
      info!(file = filename, %extension, "Invoking pandoc conversion for template sample");
      let markdown = pandoc::convert(bytes.to_vec(), pandoc::OutputFormat::Markdown, input_format)
        .await
        .map_err(|error| {
          error!(file = filename, %extension, error = %error, "Pandoc conversion failed for template sample");
          error
        })?;
      info!(
        file = filename,
        %extension,
        markdown_bytes = markdown.len(),
        "Pandoc conversion succeeded for template sample"
      );
      Ok(String::from_utf8_lossy(&markdown).to_string())
    }
    _ => Err(anyhow::anyhow!("Unsupported file type: {}", extension)),
  }
}

struct GeneratedTemplate {
  content: String,
  preview: String,
  name: String,
  description: String,
  use_case: String,
  advantages: Vec<String>,
}

#[derive(Deserialize)]
struct TemplateGenerationResponse {
  template_markdown: String,
  template_name: String,
  template_description: String,
  template_use_case: String,
  template_advantages: Vec<String>,
}

async fn generate_template_from_samples(samples: &[String]) -> anyhow::Result<GeneratedTemplate> {
  let openai_key =
    env::var("OPENAI_KEY").map_err(|_| anyhow::anyhow!("OPENAI_KEY not found in environment"))?;

  let http_client = Client::new();

  // Combine all samples with separators
  let combined_samples = samples
    .iter()
    .enumerate()
    .map(|(i, text)| format!("=== SAMPLE {} ===\n{}\n", i + 1, text))
    .collect::<Vec<_>>()
    .join("\n");

  let system_prompt = r#"You are an expert at analyzing meeting minutes and creating templates. 
Your task is to analyze the provided meeting minute samples and generate a standardized markdown template that captures their common structure, formatting patterns, and style.

The template should:
1. Use speaker label placeholders like {{A}}, {{B}}, {{C}} for anonymity
2. Include common sections identified from the samples (e.g., Attendees, Agenda, Decisions, Action Items)
3. Follow the formatting style from the samples (bullet points, numbering, headers)
4. Use [placeholder text] for variable content
5. Be comprehensive but flexible

After the template content, add a separator line "--- GUIDELINES ---" followed by specific guidelines for how to generate minutes using this template. The guidelines should describe:
- The tone and style observed in the samples
- How to structure discussions and decisions
- Any unique formatting patterns
- Special sections or requirements

Generate additional metadata that will help users identify the template:
- A concise template_name (max 60 characters) summarizing the meeting style
- A short template_description (max 160 characters) in sentence case describing what the template covers
- A one-sentence template_use_case describing the best-fit scenario (start with a verb like "Use this for...")
- Between two and four template_advantages highlighting unique reasons to use the template. Each advantage must be under 120 characters.

Return a JSON object that strictly follows the provided schema. Do not include any additional keys."#;

  let user_prompt = format!(
    "Analyze these meeting minute samples and create a standardized template:\n\n{}\n\n\
    Generate a markdown template that captures the common structure and style.",
    combined_samples
  );

  let messages = json!([
    {"role": "system", "content": system_prompt},
    {"role": "user", "content": user_prompt}
  ]);

  info!(
    "Calling OpenAI to generate template from {} samples",
    samples.len()
  );

  let response = http_client
    .post("https://api.openai.com/v1/chat/completions")
    .header("Authorization", format!("Bearer {}", openai_key))
    .json(&json!({
      "model": "gpt-4o",
      "messages": messages,
      "temperature": 0.3,
      "max_tokens": 4000,
      "response_format": {
        "type": "json_schema",
        "json_schema": {
          "name": "template_generation",
          "schema": {
            "type": "object",
            "properties": {
              "template_markdown": {"type": "string", "minLength": 100},
              "template_name": {"type": "string", "minLength": 5, "maxLength": 120},
              "template_description": {"type": "string", "minLength": 20, "maxLength": 220},
              "template_use_case": {"type": "string", "minLength": 15, "maxLength": 220},
              "template_advantages": {
                "type": "array",
                "minItems": 2,
                "maxItems": 5,
                "items": {
                  "type": "string",
                  "minLength": 10,
                  "maxLength": 200
                }
              }
            },
            "required": [
              "template_markdown",
              "template_name",
              "template_description",
              "template_use_case",
              "template_advantages"
            ],
            "additionalProperties": false
          },
          "strict": true
        }
      }
    }))
    .send()
    .await?;

  if !response.status().is_success() {
    let status = response.status();
    let error_text = response.text().await.unwrap_or_default();
    error!("OpenAI API error {}: {}", status, error_text);
    return Err(anyhow::anyhow!("OpenAI API request failed: {}", status));
  }

  let response_json: serde_json::Value = response.json().await?;

  let message_content = response_json["choices"][0]["message"]["content"]
    .as_str()
    .ok_or_else(|| anyhow::anyhow!("No content in OpenAI response"))?;

  let parsed: TemplateGenerationResponse = serde_json::from_str(message_content).map_err(|e| {
    error!("Failed to parse OpenAI structured output: {}", e);
    anyhow::anyhow!("Failed to parse template generation response")
  })?;

  let trimmed_markdown = parsed.template_markdown.trim().to_string();

  // Generate a preview (first 500 chars before guidelines)
  let preview = if let Some(guidelines_pos) = trimmed_markdown.find("--- GUIDELINES ---") {
    let preview_text = &trimmed_markdown[..guidelines_pos];
    preview_text.chars().take(500).collect::<String>()
  } else {
    trimmed_markdown.chars().take(500).collect::<String>()
  };

  let advantages: Vec<String> = parsed
    .template_advantages
    .into_iter()
    .filter_map(|advantage| {
      let trimmed = advantage.trim();
      if trimmed.is_empty() {
        None
      } else {
        Some(trimmed.to_string())
      }
    })
    .collect();

  Ok(GeneratedTemplate {
    content: trimmed_markdown,
    preview,
    name: parsed.template_name.trim().to_string(),
    description: parsed.template_description.trim().to_string(),
    use_case: parsed.template_use_case.trim().to_string(),
    advantages: if advantages.is_empty() {
      vec![
        "Tailored to your meeting style".to_string(),
        "Based on your uploaded samples".to_string(),
      ]
    } else {
      advantages
    },
  })
}

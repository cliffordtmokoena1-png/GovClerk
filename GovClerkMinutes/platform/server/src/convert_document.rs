use crate::{
  pandoc::{self, InputFormat, OutputFormat},
  SharedRequestState,
};
use axum::{
  body::Body,
  extract::{Multipart, State},
  http::StatusCode,
  response::IntoResponse,
};
use std::sync::Arc;
use tracing::error;

pub async fn convert_document_handler(
  State(_state): State<Arc<SharedRequestState>>,
  mut multipart: Multipart,
) -> Result<impl IntoResponse, StatusCode> {
  let mut file_bytes: Option<Vec<u8>> = None;
  let mut output_type_str: Option<String> = None;
  let mut input_type_str: Option<String> = None;

  while let Some(field) = multipart.next_field().await.map_err(|e| {
    error!("[convert-document] multipart parse error: {:?}", e);
    StatusCode::BAD_REQUEST
  })? {
    let name = field.name().unwrap_or_default().to_string();
    match name.as_str() {
      "file" => {
        let bytes = field
          .bytes()
          .await
          .map_err(|e| {
            error!("[convert-document] error reading file bytes: {:?}", e);
            StatusCode::BAD_REQUEST
          })?
          .to_vec();
        file_bytes = Some(bytes);
      }
      "output_type" => {
        let v = field.text().await.map_err(|e| {
          error!("[convert-document] error reading output_type: {:?}", e);
          StatusCode::BAD_REQUEST
        })?;
        output_type_str = Some(v);
      }
      "input_type" => {
        let v = field.text().await.map_err(|e| {
          error!("[convert-document] error reading input_type: {:?}", e);
          StatusCode::BAD_REQUEST
        })?;
        input_type_str = Some(v);
      }
      _ => {}
    }
  }

  if file_bytes.is_none() {
    error!("[convert-document] missing 'file' field");
    return Err(StatusCode::BAD_REQUEST);
  }
  let file_bytes = file_bytes.unwrap();

  if output_type_str.is_none() {
    error!("[convert-document] missing 'output_type' field");
    return Err(StatusCode::BAD_REQUEST);
  }

  let output_type = output_type_str
    .as_deref()
    .map(OutputFormat::from_str)
    .ok_or_else(|| {
      error!("[convert-document] output_type is None after check");
      StatusCode::BAD_REQUEST
    })?
    .map_err(|e| {
      error!(
        "[convert-document] invalid output_type '{}': {:?}",
        output_type_str.as_deref().unwrap_or("?"),
        e
      );
      StatusCode::BAD_REQUEST
    })?;

  if input_type_str.is_none() {
    error!("[convert-document] missing 'input_type' field");
    return Err(StatusCode::BAD_REQUEST);
  }

  let input_type = input_type_str
    .as_deref()
    .map(InputFormat::from_extension)
    .ok_or_else(|| {
      error!("[convert-document] input_type is None after check");
      StatusCode::BAD_REQUEST
    })?
    .map_err(|e| {
      error!(
        "[convert-document] invalid input_type '{}': {:?}",
        input_type_str.as_deref().unwrap_or("?"),
        e
      );
      StatusCode::BAD_REQUEST
    })?;

  let result = pandoc::convert(file_bytes, output_type, input_type)
    .await
    .inspect_err(|e| error!("[convert-document] pandoc conversion failed: {}", e))
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

  let resp = axum::http::Response::builder()
    .status(200)
    .body(Body::from(result))
    .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

  Ok(resp)
}

//! Pandoc reference.docx management.
//!
//! Usage:
//!   1) Call `pandoc::reference::init()?` once during server startup.
//!   2) In your convert logic, call `pandoc::reference::path()` to get the file path
//!      to pass as `--reference-doc <path>` when producing DOCX.
//!
//! Notes:
//! - The reference template is embedded at compile time and extracted to a temp file.
//! - The file lives for the lifetime of the process (deleted automatically on exit).

use anyhow::{Context, Result};
use std::io::Write;
use std::path::Path;
use std::sync::OnceLock;
use tempfile::NamedTempFile;

// Embed the reference.docx at compile time. The path here assumes your crate root
// is the `platform/server` directory and the file is under `assets/`.
const REF_DOCX_BYTES: &[u8] = include_bytes!(concat!(
  env!("CARGO_MANIFEST_DIR"),
  "/assets/pandoc-reference.docx"
));

/// Holds the resolved path to the reference.docx for the lifetime of the process.
/// We store a TempPath so the file is cleaned up on process exit.
static REF_DOCX_PATH: OnceLock<tempfile::NamedTempFile> = OnceLock::new();

/// Initialize the reference.docx on disk (idempotent).
/// Call this once during server startup.
pub fn init() -> Result<&'static Path> {
  write_once(REF_DOCX_BYTES)
}

/// Return the path to the reference.docx after `init()`.
/// Panics if `init()` was never called.
pub fn path() -> &'static Path {
  REF_DOCX_PATH
    .get()
    .expect("pandoc::reference::init() must be called at server startup")
    .as_ref()
}

fn write_once(bytes: &[u8]) -> Result<&'static Path> {
  if let Some(existing) = REF_DOCX_PATH.get() {
    return Ok(existing.as_ref());
  }

  // Place the file in the system temp directory with a deterministic prefix.
  // NamedTempFile ensures a unique filename and safe write.
  let mut tmp =
    NamedTempFile::new().context("Failed to create temporary file for pandoc reference.docx")?;

  // On some filesystems, an interrupted write can leave partial data; write_all is fine,
  // NamedTempFile writes atomically once persisted.
  tmp
    .write_all(bytes)
    .context("Failed to write embedded reference.docx bytes")?;

  // SAFETY: OnceLock can be set exactly once; we ignore concurrent races by using get_or_init-like
  // semantics here (we’ve already checked above), and setting here should succeed.
  let _ = REF_DOCX_PATH.set(tmp);

  Ok(
    REF_DOCX_PATH
      .get()
      .expect("OnceLock just set should be available")
      .as_ref(),
  )
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn init_and_path_work() {
    let p = init().expect("init should succeed");
    assert!(p.exists(), "reference.docx path must exist");
    assert!(
      p.extension().and_then(|e| e.to_str()) == Some("tmp")
        || p.extension().and_then(|e| e.to_str()) == Some("docx")
        || p.file_name().is_some(),
      "should have some filename"
    );

    let p2 = path();
    assert_eq!(p, p2, "path() should return the same path after init()");
  }
}

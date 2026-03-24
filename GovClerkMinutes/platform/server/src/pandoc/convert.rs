use crate::pandoc;
use crate::pandoc::InputFormat;
use crate::pandoc::OutputFormat;
use anyhow::{Context, Result};
use std::process::Stdio;
use tokio::io::AsyncWriteExt;
use tokio::process::Command;

/// Convert an input document (bytes) to a target type using Pandoc.
/// - input: document bytes
/// - to_type: desired output type.
/// - from_type: specify the input type.
///
/// No intermediate files are written; all I/O is in-memory.
pub async fn convert<I>(input: I, to_type: OutputFormat, from_type: InputFormat) -> Result<Vec<u8>>
where
  I: AsRef<[u8]>,
{
  let mut cmd = Command::new("pandoc");
  cmd.args([
    "-f",
    from_type.as_pandoc_source(),
    "-t",
    to_type.as_pandoc_target(),
    // For PDF output, ignored for other formats
    "--variable",
    "geometry:margin=1in",
    "--pdf-engine",
    pandoc::pdf::get_pdflatex_path(),
  ]);

  // For DOCX output, ignored for other formats
  if to_type == OutputFormat::Docx {
    cmd.arg("--reference-doc").arg(pandoc::reference::path());
  }

  let mut child = cmd
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()
    .context("Failed to spawn pandoc process. Is pandoc installed and in PATH?")?;

  {
    let mut stdin = child.stdin.take().context("Failed to open pandoc stdin")?;
    stdin
      .write_all(input.as_ref())
      .await
      .context("Failed to write input to pandoc stdin")?;
    // Explicitly close stdin to signal EOF.
    drop(stdin);
  }

  let output = child
    .wait_with_output()
    .await
    .context("Failed to run pandoc")?;

  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr);
    return Err(anyhow::anyhow!(format!("Pandoc failed: {}", stderr.trim())));
  }

  return Ok(output.stdout);
}

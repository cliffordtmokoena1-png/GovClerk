use serde_json::{json, Value};
use std::process::Stdio;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::Command;
use tracing::{error, warn};

pub struct PythonProcess {
  stdin: tokio::process::ChildStdin,
  stdout: BufReader<tokio::process::ChildStdout>,
}

impl PythonProcess {
  pub async fn new_dummy() -> tokio::io::Result<Self> {
    let mut child = Command::new("echo")
      .stdin(Stdio::piped())
      .stdout(Stdio::piped())
      .spawn()?;

    warn!("Created dummy python process");

    Ok(PythonProcess {
      stdin: child.stdin.take().expect("Failed to get stdin"),
      stdout: BufReader::new(child.stdout.take().expect("Failed to get stdout")),
    })
  }

  pub async fn new(conda_env: &str) -> tokio::io::Result<Self> {
    let mut child = match Command::new("conda")
      .arg("run")
      .arg("--live-stream")
      .arg("-n")
      .arg(conda_env)
      .arg("python")
      .arg("-u")
      .arg("main.py")
      .current_dir("whisper-process")
      .stdin(Stdio::piped())
      .stdout(Stdio::piped())
      .stderr(Stdio::inherit())
      .spawn()
    {
      Ok(child) => child,
      Err(e) => {
        error!("Failed to execute subprocess: {}", e);
        panic!("failed to execute subprocess: {}", e);
      }
    };

    let stdin = child.stdin.take().expect("Failed to open stdin");
    let stdout = child.stdout.take().expect("Failed to open stdout");

    let reader = BufReader::new(stdout);

    Ok(PythonProcess {
      stdin,
      stdout: reader,
    })
  }

  /// Transcribes a message using the Python process which runs the whisper model
  pub async fn transcribe(&mut self, filepath: String) -> tokio::io::Result<String> {
    self
      .stdin
      .write_all(
        serde_json::to_string(&json!({
          "command": "transcribe",
          "filepath": filepath,
        }))?
        .as_bytes(),
      )
      .await?;

    self.stdin.write_all(b"\n").await?;

    let mut line = String::new();
    self.stdout.read_line(&mut line).await?;

    // parse json object like {response: "text"} or {"error": "text"}
    let v: Value = serde_json::from_str(&line)?;
    match v["response"].as_str() {
      None => {
        warn!("Python process returned error: {}", v["error"]);
        return Err(tokio::io::Error::new(
          tokio::io::ErrorKind::Other,
          v["error"].as_str().unwrap(),
        ));
      }
      Some(s) => return Ok(s.to_string()),
    };
  }
}

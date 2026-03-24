use pyo3::prelude::*;
use pyo3::types::{PyBytes, PyList, PyModule};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DetectedLanguage {
  pub language: String,
  pub confidence: f64,
  pub probs: HashMap<String, f64>,
}

pub struct PythonInterface {
  instance: Py<PyAny>,   // PythonInterface instance
  _module: Py<PyModule>, // keep module alive
}

impl PythonInterface {
  pub fn new(module_search_dir: &Path) -> anyhow::Result<Self> {
    let (instance, module) = Python::attach(|py| -> PyResult<(Py<PyAny>, Py<PyModule>)> {
      let sys = py.import("sys")?;
      let module_dir = module_search_dir.to_string_lossy().to_string();

      let binding = sys.getattr("path")?;
      let path = binding.downcast::<PyList>()?;
      path.insert(0, module_dir.as_str())?;

      let m = py.import("main")?;
      let cls = m.getattr("PythonInterface")?;

      let inst = cls.call0()?;
      Ok((inst.unbind(), m.unbind()))
    })?;

    Ok(Self {
      instance,
      _module: module,
    })
  }

  pub fn detect_language(&self, audio_bytes: &[u8]) -> anyhow::Result<DetectedLanguage> {
    Python::attach(|py| -> PyResult<DetectedLanguage> {
      let py_bytes = PyBytes::new(py, audio_bytes);
      let inst = self.instance.bind(py);
      let func = inst.getattr("detect_language")?;
      let ret = func.call1((py_bytes,))?; // Bound<'py, PyAny>
      let language: String = ret.get_item("language")?.extract()?;
      let confidence: f64 = ret.get_item("confidence")?.extract()?;
      let probs: HashMap<String, f64> = ret.get_item("probs")?.extract()?;
      Ok(DetectedLanguage {
        language,
        confidence,
        probs,
      })
    })
    .map_err(|e| anyhow::anyhow!(e.to_string()))
  }

  pub fn get_speaker_embedding(&self, segments: &[Vec<u8>]) -> anyhow::Result<Option<Vec<f64>>> {
    Python::attach(|py| -> PyResult<Option<Vec<f64>>> {
      let py_segments = PyList::empty(py);
      for segment in segments {
        let py_bytes = PyBytes::new(py, segment);
        py_segments.append(py_bytes)?;
      }
      let inst = self.instance.bind(py);
      let func = inst.getattr("get_speaker_embedding")?;
      let ret = func.call1((py_segments,))?; // Bound<'py, PyAny>
      let embedding: Option<Vec<f64>> = ret.extract()?;
      Ok(embedding)
    })
    .map_err(|e| anyhow::anyhow!(e.to_string()))
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use crate::media_file::MediaFile;
  use anyhow::Result;
  use std::path::Path;

  #[tokio::test]
  async fn test_detect_language() -> Result<()> {
    dotenv::dotenv().ok();

    // Download and cache an audio sample from S3, similar to media_file tests
    let asset_path = crate::tests::utils::download_and_cache_s3_asset("lexconvo2.m4a").await?;
    let file = tokio::fs::File::open(&asset_path).await?;
    let media_file = MediaFile::init(file).await?;
    let bytes = media_file.slice(0.0, media_file.duration)?;

    // Relative path from the CWD of the rust process (for tests, this is not the repo root)
    let python_module_path = Path::new("python");
    let iface = PythonInterface::new(python_module_path)?;

    // Detect language from bytes
    let result = iface.detect_language(&bytes)?;

    // Basic sanity assertions
    assert!(!result.language.is_empty(), "language should not be empty");
    assert!(
      (0.0..=1.0).contains(&result.confidence),
      "confidence out of range"
    );

    Ok(())
  }

  #[tokio::test]
  async fn test_get_speaker_embedding_from_segments() -> Result<()> {
    dotenv::dotenv().ok();

    // Download and cache an audio sample from S3
    let asset_path = crate::tests::utils::download_and_cache_s3_asset("lexconvo2.m4a").await?;
    let file = tokio::fs::File::open(&asset_path).await?;
    let media_file = MediaFile::init(file).await?;

    // Prepare a few short WAV segments (e.g., 3 segments of 2 seconds each)
    let seg_len = 2.0f64;
    let mut segments: Vec<Vec<u8>> = Vec::new();
    let mut t = 0.0f64;
    while t + seg_len <= media_file.duration && segments.len() < 3 {
      let bytes = media_file.slice(t, t + seg_len)?;
      if !bytes.is_empty() {
        segments.push(bytes);
      }
      t += seg_len;
    }

    // Ensure we have at least one segment to process
    assert!(!segments.is_empty(), "no audio segments prepared");

    // Relative path from the CWD of the rust process (for tests, this is not the repo root)
    let python_module_path = Path::new("python");
    let iface = PythonInterface::new(python_module_path)?;

    // Get speaker embedding from segments
    let embedding = iface.get_speaker_embedding(&segments)?;
    assert!(embedding.is_some(), "embedding should not be None");

    let embedding = embedding.unwrap();
    dbg!(&embedding);

    // Basic sanity assertions
    assert!(!embedding.is_empty(), "embedding should not be empty");
    assert!(
      embedding.iter().all(|v| v.is_finite()),
      "embedding contains non-finite values"
    );

    Ok(())
  }
}

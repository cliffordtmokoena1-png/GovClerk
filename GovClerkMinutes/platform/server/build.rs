fn get_libdir(pyo3_py: &str) -> String {
  use std::path::Path;
  let python_path = Path::new(pyo3_py);
  let libdir = match python_path.parent().and_then(|p| p.parent()) {
    Some(parent) => parent.join("lib").to_string_lossy().to_string(),
    None => {
      panic!("Failed to determine libdir from PYO3_PYTHON={}", pyo3_py);
    }
  };
  libdir
}

fn is_ci() -> bool {
  std::env::var_os("GITHUB_ACTIONS").is_some() || std::env::var_os("CI").is_some()
}

fn handle_pyo3_py(pyo3_py: &str) {
  // Emit an error if it looks like we’re not using the conda env
  // (this is just a heuristic to catch common mistakes)
  if !pyo3_py.contains("miniconda") && !is_ci() {
    panic!(
      "PYO3_PYTHON={} does not seem to be from a conda environment.",
      pyo3_py
    );
  }
  let libdir = get_libdir(pyo3_py);
  println!("cargo:rustc-link-arg=-Wl,-rpath,{}", libdir);
}

fn main() {
  // Re-run if these change (helps local dev)
  println!("cargo:rerun-if-env-changed=PYO3_PYTHON");

  match std::env::var("PYO3_PYTHON") {
    Ok(val) => handle_pyo3_py(&val),
    Err(_) => {
      println!("cargo:warning=PYO3_PYTHON not set; PyO3 will pick python on PATH");
    }
  };
}

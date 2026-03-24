pub fn get_pdflatex_path() -> &'static str {
  if cfg!(target_os = "macos") {
    "/usr/local/texlive/2025basic/bin/universal-darwin/pdflatex"
  } else {
    "/usr/bin/pdflatex"
  }
}

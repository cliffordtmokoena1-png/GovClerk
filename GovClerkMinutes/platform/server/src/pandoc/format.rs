/// Supported output types for Pandoc.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum OutputFormat {
  Docx,
  Odt,
  Markdown,
  Html,
  Pdf,
  Rtf,
  PlainText,
}

impl OutputFormat {
  pub fn from_str(s: &str) -> anyhow::Result<Self> {
    match s {
      "docx" => Ok(Self::Docx),
      "odt" => Ok(Self::Odt),
      "markdown" => Ok(Self::Markdown),
      "html" => Ok(Self::Html),
      "pdf" => Ok(Self::Pdf),
      "rtf" => Ok(Self::Rtf),
      "plain" => Ok(Self::PlainText),
      _ => Err(anyhow::anyhow!("Unknown output format: {}", s)),
    }
  }

  // String representation suitable for pandoc's -t flag.
  pub fn as_pandoc_target(&self) -> &'static str {
    match self {
      OutputFormat::Docx => "docx",
      OutputFormat::Odt => "odt",
      OutputFormat::Markdown => "markdown",
      OutputFormat::Html => "html",
      OutputFormat::Pdf => "pdf",
      OutputFormat::Rtf => "rtf",
      OutputFormat::PlainText => "plain",
    }
  }
}

impl std::fmt::Display for OutputFormat {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    f.write_str(self.as_pandoc_target())
  }
}

impl AsRef<str> for OutputFormat {
  fn as_ref(&self) -> &str {
    self.as_pandoc_target()
  }
}

#[derive(Debug, Clone, Copy)]
pub enum InputFormat {
  GithubFlavoredMarkdown,
  Html,
  Docx,
  Odt,
  Rtf,
  Epub,
  Latex,
  Csv,
  Tsv,
}

impl InputFormat {
  /// Map common file extensions (no leading dot) to Pandoc input formats.
  pub fn from_extension(ext: &str) -> anyhow::Result<Self> {
    // Normalize to lower case and strip leading dot if present.
    let e = ext
      .trim()
      .to_lowercase()
      .trim_start_matches('.')
      .to_string();

    match e.as_str() {
      // Markdown / many markup-like formats
      "md" | "markdown" | "mmd" | "gfm" | "dj" | "creole" | "mediawiki" | "wiki" | "twiki"
      | "tikiwiki" | "muse" | "org" | "pod" | "rst" | "textile" | "typ" => {
        Ok(Self::GithubFlavoredMarkdown)
      }

      // HTML
      "html" | "htm" => Ok(Self::Html),

      // Word formats
      "docx" | "doc" => Ok(Self::Docx),

      // ODT
      "odt" => Ok(Self::Odt),

      // RTF
      "rtf" => Ok(Self::Rtf),

      // LaTeX
      "tex" => Ok(Self::Latex),

      // EPUB and similar e-book formats
      "epub" | "fb2" => Ok(Self::Epub),

      // XML-ish / document interchange formats / weird ones - treat as HTML input for now
      "opml" | "xml" | "docbook" | "jats" | "endnotexml" | "bits" | "json" | "csljson" | "bib"
      | "ris" | "haddock" | "man" | "mdoc" => Ok(Self::Html),

      // CSV / TSV
      "csv" => Ok(Self::Csv),
      "tsv" => Ok(Self::Tsv),

      _ => Err(anyhow::anyhow!("Unknown input format: {}", ext)),
    }
  }

  // String representation suitable for pandoc's -f flag.
  pub fn as_pandoc_source(&self) -> &'static str {
    match self {
      InputFormat::GithubFlavoredMarkdown => "gfm",
      InputFormat::Html => "html",
      InputFormat::Docx => "docx",
      InputFormat::Odt => "odt",
      InputFormat::Rtf => "rtf",
      InputFormat::Epub => "epub",
      InputFormat::Latex => "latex",
      InputFormat::Csv => "csv",
      InputFormat::Tsv => "tsv",
    }
  }
}

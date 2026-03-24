use anyhow::anyhow;
use regex::RegexBuilder;

pub(super) fn resolve_punctuation(text: String, bare_words: Vec<String>) -> anyhow::Result<String> {
  let punctuation = "[^A-Za-z0-9\\s]";
  let maybe_punctuation = format!("{}*", punctuation);
  let whitespace = "\\s+";
  let start_pattern = format!("({}|{}{}|^)", punctuation, whitespace, maybe_punctuation);
  let end_pattern = format!("({}|{}{}|$)", punctuation, maybe_punctuation, whitespace);
  let word_boundary = format!(
    "({}|{}{}{})",
    punctuation, maybe_punctuation, whitespace, maybe_punctuation,
  );
  let inner_pattern = bare_words.join(&word_boundary);
  let pattern = format!("({}{}{})", start_pattern, inner_pattern, end_pattern);

  let re = RegexBuilder::new(&pattern)
    .size_limit(40 * 1024 * 1024)
    .build()
    .map_err(|e| anyhow!("Invalid regex: {}", e))?;

  if let Some(mat) = re.find(&text) {
    Ok(mat.as_str().trim().to_string())
  } else {
    Err(anyhow!(
      "No match found for pattern: {} in text: {}",
      pattern,
      text
    ))
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn test_resolve_punctuation_oclock() {
    let text = "I've got a hard stop at one o'clock. I did explain".to_string();
    let bare_words = ["at", "one", "o", "clock", "I"]
      .iter()
      .map(|s| s.to_string())
      .collect();
    let result = resolve_punctuation(text, bare_words);
    assert_eq!(result.unwrap(), "at one o'clock. I".to_string());
  }

  #[test]
  fn test_resolve_punctuation_cutoff_number() {
    let text = "them to basically make a decision $1,000 check".to_string();
    let bare_words = ["decision", "1"].iter().map(|s| s.to_string()).collect();
    let result = resolve_punctuation(text, bare_words);
    assert_eq!(result.unwrap(), "decision $1,".to_string());
  }

  #[test]
  fn test_resolve_punctuation_apostrophe() {
    let text = "That's what I'm talking about".to_string();
    let bare_words = vec!["That's".to_string(), "what".to_string(), "I'm".to_string()];
    let result = resolve_punctuation(text, bare_words);
    assert_eq!(result.unwrap(), "That's what I'm".to_string());
  }

  #[test]
  fn test_resolve_punctuation_empty_bare_words() {
    let text = "The price is $3.5 billion, in total.".to_string();
    let bare_words = vec!["3".to_string(), "5".to_string(), "billion".to_string()];
    let result = resolve_punctuation(text, bare_words);
    assert_eq!(result.unwrap(), "$3.5 billion,".to_string());
  }

  #[test]
  fn test_resolve_punctuation_exact_match() {
    let text = "The price is $3.5 billion, in total.".to_string();
    let bare_words = vec!["3".to_string(), "5".to_string(), "billion".to_string()];
    let result = resolve_punctuation(text, bare_words);
    assert_eq!(result.unwrap(), "$3.5 billion,".to_string());
  }

  #[test]
  fn test_resolve_punctuation_with_prefix_match_middle() {
    let text = "Now smythe Batman is, the Batman! My guy".to_string();
    let bare_words = vec!["the".to_string(), "Batman".to_string()];
    let result = resolve_punctuation(text, bare_words);
    assert_eq!(result.unwrap(), "the Batman!".to_string());
  }

  #[test]
  fn test_resolve_punctuation_with_prefix_match() {
    let text = "Now smythe Batman is, the Batman!".to_string();
    let bare_words = vec!["the".to_string(), "Batman".to_string()];
    let result = resolve_punctuation(text, bare_words);
    assert_eq!(result.unwrap(), "the Batman!".to_string());
  }

  #[test]
  fn test_resolve_punctuation_with_extra_punctuation() {
    let text = "Hello, world! This is a test.".to_string();
    let bare_words = vec!["Hello".to_string(), "world".to_string()];
    let result = resolve_punctuation(text, bare_words);
    assert_eq!(result.unwrap(), "Hello, world!".to_string());
  }

  #[test]
  fn test_resolve_punctuation_no_match() {
    let text = "There is no match here.".to_string();
    let bare_words = vec!["nonexistent".to_string()];
    let result = resolve_punctuation(text, bare_words);
    assert!(result.is_err());
  }

  #[test]
  fn test_resolve_punctuation_extra_words_in_between() {
    let text = "This is a string and I like it".to_string();
    let bare_words = vec![
      "This".to_string(),
      "a".to_string(),
      "and".to_string(),
      "it".to_string(),
    ];
    let result = resolve_punctuation(text, bare_words);
    assert!(result.is_err());
  }
}

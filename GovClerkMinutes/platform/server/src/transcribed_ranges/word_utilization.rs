use serde::Serialize;
use std::collections::HashSet;

use super::holder::CompositeIndex;

#[derive(Debug, Serialize)]
pub struct WordUtilizationMetrics {
  pub total_words: usize,
  pub used_words: usize,
  pub missed_words: usize,
  pub utilization_rate: f64,
}

#[derive(Debug, Serialize)]
pub struct WordUsageTracker {
  used_indices: HashSet<CompositeIndex>,
}

impl WordUsageTracker {
  pub fn new() -> Self {
    Self {
      used_indices: HashSet::new(),
    }
  }

  pub fn calculate_metrics_from_tracker(&self, total_words: usize) -> WordUtilizationMetrics {
    let used_words = self.used_indices.len();
    let missed_words = total_words.saturating_sub(used_words);
    let utilization_rate = if total_words > 0 {
      used_words as f64 / total_words as f64
    } else {
      0.0
    };

    WordUtilizationMetrics {
      total_words,
      used_words,
      missed_words,
      utilization_rate,
    }
  }

  pub fn mark_word_used(&mut self, index: CompositeIndex) -> bool {
    self.used_indices.insert(index)
  }

  pub fn is_word_used(&self, index: &CompositeIndex) -> bool {
    self.used_indices.contains(index)
  }
}

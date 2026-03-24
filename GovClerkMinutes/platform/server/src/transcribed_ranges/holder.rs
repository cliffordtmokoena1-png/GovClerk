use super::{resolve_punctuation::resolve_punctuation, word_utilization::WordUsageTracker};
use crate::speech::range::{Range, Source, Word};
use crate::transcript::Segment;
use crate::utils::time::seconds_to_timestamp;
use serde::{Deserialize, Serialize};
use tracing::warn;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct CompositeIndex {
  range_index: usize,
  word_index: usize,
}

#[derive(Debug, Serialize)]
pub struct Holder {
  pub step: f64,
  pub ranges: Vec<Option<Range>>,
  pub words: Vec<CompositeIndex>,
  pub word_usage: WordUsageTracker,
}

impl Holder {
  /// Get a snippet of speech as text from the given range in the input media file.
  /// Assumes that prepare_for_search() has been called.  If not, this will not work.
  pub fn get_segment(&mut self, start: f64, end: f64) -> anyhow::Result<Option<String>> {
    let start_index = self
      .words
      .binary_search_by(
        |&CompositeIndex {
           range_index,
           word_index,
         }| {
          let word = &self.ranges[range_index]
            .as_ref()
            .expect("range must be Some")
            .words
            .as_ref()
            .expect("words must be Some")[word_index];
          return word.start.partial_cmp(&start).unwrap();
        },
      )
      .unwrap_or_else(|index| if index > 0 { index - 1 } else { 0 });

    // Vec of (range_index, words) tuples.
    // We track which words correspond to which range so we can resolve punctuation.
    let mut range_words: Vec<(usize, Vec<String>)> = Vec::new();

    for index in &self.words[start_index..] {
      let word = {
        let word = self.get_word(index)?;
        if word.end < start {
          continue;
        }
        if word.start > end {
          break;
        }
        word.word.clone()
      };

      self.word_usage.mark_word_used(index.clone());

      if let Some((range_index, words)) = range_words.last_mut() {
        if *range_index == index.range_index {
          words.push(word);
          continue;
        }
      }

      range_words.push((index.range_index, vec![word]));
    }

    if range_words.is_empty() {
      return Ok(Some("".to_string()));
    }

    let mut resolved = String::new();
    for (range_idx, words) in range_words {
      let range = self.ranges[range_idx]
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("range index out of bounds: {}", range_idx))?;

      let fragment = match range.source {
        Some(Source::OpenAI) => resolve_punctuation(range.text.clone(), words)?,
        Some(Source::Groq) | Some(Source::GoogleCloud) | Some(Source::Scribe) | None => {
          if range.source.is_none() {
            warn!(
              "Whisper source not found in range {}, defaulting to simple word join.",
              range_idx
            );
          }
          words.join(" ")
        }
      };

      if !resolved.is_empty() {
        resolved.push(' ');
      }
      resolved.push_str(&fragment);
    }

    Ok(Some(resolved))
  }

  /// Private constructor.
  /// Use TranscribedRangeHolderInitializer to create a new TranscribedRangeHolder.
  pub(super) fn new(step: f64, duration: f64) -> Self {
    // Preallocate space for each range to avoid sorting
    let ranges = (0..(duration / step).ceil() as usize)
      .map(|_| None)
      .collect::<Vec<Option<Range>>>();

    return Self {
      step,
      ranges,
      words: Vec::new(),
      word_usage: WordUsageTracker::new(),
    };
  }

  pub(super) fn add(&mut self, index: usize, range: Range) {
    self.ranges[index] = Some(range);
  }

  /// This must be called or get_segment() won't work.
  /// It can be called when only the first N ranges are filled in, but will only
  /// support searches inside those ranges.
  ///
  /// This is responsible for building an index to quickly access segments by time.
  /// It also "rebases" the time stamps in each Segment to be relative to the start of the file
  /// instead of start of range.
  pub(super) fn prepare_for_search(&mut self) -> anyhow::Result<()> {
    let step = self.step;
    let words: Vec<CompositeIndex> = self
      .ranges
      .iter_mut()
      .enumerate()
      .take_while(|(_, range)| range.is_some())
      .flat_map(|(range_index, range)| {
        let range = range.as_mut().unwrap();
        if let Some(words) = range.words.as_mut() {
          words
            .iter_mut()
            .enumerate()
            .map(move |(word_index, word)| {
              // Rebase the start and end times so binary search works
              word.start += step * range_index as f64;
              word.end += step * range_index as f64;
              return CompositeIndex {
                range_index,
                word_index,
              };
            })
            .collect::<Vec<_>>()
        } else {
          // Skip ranges with no words
          Vec::new()
        }
      })
      .collect();

    self.words = words;

    if self.words.is_empty() {
      return Ok(());
    }

    // We cannot simply sort by start time because the Whisper model lovingly
    // returns words out of order sometimes.  Usually this happens within a few
    // 1/100ths of a second, so the unordered words are close together.  We need
    // to make sure the list is sorted so binary search works, and we need to
    // make sure the words are kept in the order the model gives us so we can
    // resolve punctuation (it is the speaking order).
    // We are going to "sort" the words by setting the out of order words' start
    // timestamps equal to eachother because they are "close enough".

    let mut words_to_update = vec![];
    for i in 1..self.words.len() {
      let prev_index = &self.words[i - 1];
      let cur_index = &self.words[i];
      let prev_word = self.get_word(prev_index)?;
      let cur_word = self.get_word(cur_index)?;
      if prev_word.start > cur_word.start {
        warn!(
          "Found out of order words from whisper: {:?} {:?}",
          prev_word, cur_word
        );
        words_to_update.push((cur_index.clone(), prev_word.start));
      }
    }

    for (index, start) in words_to_update {
      self.set_word_start(&index, start)?;
    }

    return Ok(());
  }

  pub fn get_word(
    &self,
    &CompositeIndex {
      range_index,
      word_index,
    }: &CompositeIndex,
  ) -> anyhow::Result<&Word> {
    let range = self
      .ranges
      .get(range_index)
      .ok_or_else(|| anyhow::anyhow!("range index out of bounds: {}", range_index))?
      .as_ref()
      .ok_or_else(|| anyhow::anyhow!("range is None"))?;

    let words = range
      .words
      .as_ref()
      .ok_or_else(|| anyhow::anyhow!("words is None"))?;

    words
      .get(word_index)
      .ok_or_else(|| anyhow::anyhow!("word index out of bounds: {}", word_index))
  }

  fn set_word_start(
    &mut self,
    &CompositeIndex {
      range_index,
      word_index,
    }: &CompositeIndex,
    start: f64,
  ) -> anyhow::Result<()> {
    let range = self
      .ranges
      .get_mut(range_index)
      .ok_or_else(|| anyhow::anyhow!("range index out of bounds: {}", range_index))?
      .as_mut()
      .ok_or_else(|| anyhow::anyhow!("range is None"))?;

    let words = range
      .words
      .as_mut()
      .ok_or_else(|| anyhow::anyhow!("words is None"))?;

    let word = words
      .get_mut(word_index)
      .ok_or_else(|| anyhow::anyhow!("word index out of bounds: {}", word_index))?;

    word.start = start;
    return Ok(());
  }

  /// Return all orphaned segments of unused words (UNASSIGNED_X).
  pub fn get_orphaned_segments(&self) -> Vec<Segment> {
    let mut orphan_segs = Vec::new();
    let mut open_group: Option<(f64, f64, Vec<String>)> = None;
    let mut group_counter = 1;

    // helper to flush and reset the open group
    let mut flush = |group: Option<(f64, f64, Vec<String>)>| {
      if let Some((start, end, words)) = group {
        orphan_segs.push(Segment {
          start: seconds_to_timestamp(start),
          stop: seconds_to_timestamp(end),
          speaker: format!("UNASSIGNED_{}", group_counter),
          transcript: Some(words.join(" ")),
        });
        group_counter += 1;
      }
    };

    for comp_idx in &self.words {
      if !self.word_usage.is_word_used(comp_idx) {
        let w = self.get_word(comp_idx).expect("invalid word index");
        if let Some((_, end, words)) = open_group.as_mut() {
          *end = w.end;
          words.push(w.word.clone());
        } else {
          open_group = Some((w.start, w.end, vec![w.word.clone()]));
        }
      } else {
        // flush current group
        flush(open_group.take());
      }
    }

    // flush last group if any
    flush(open_group.take());

    orphan_segs
  }
}

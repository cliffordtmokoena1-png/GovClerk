use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

pub struct TaskTracker {
  pub counter: Arc<AtomicUsize>,
}

impl TaskTracker {
  pub fn new(counter: Arc<AtomicUsize>) -> Self {
    counter.fetch_add(1, Ordering::SeqCst);
    Self { counter }
  }
}

impl Drop for TaskTracker {
  fn drop(&mut self) {
    self.counter.fetch_sub(1, Ordering::SeqCst);
  }
}

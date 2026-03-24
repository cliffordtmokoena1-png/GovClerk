use std::sync::Arc;

use tokio::sync::Mutex;
use tokio::sync::Semaphore;

pub struct RateLimiter {
  remaining: Mutex<usize>, // protects concurrent access to the remaining count
  semaphore: Semaphore,    // controls the number of concurrent requests
}

pub struct RateLimitGuard {
  rate_limiter: Arc<RateLimiter>,
  remaining_requests: Option<usize>,
}

impl RateLimiter {}

impl RateLimitGuard {}

impl Drop for RateLimitGuard {
  fn drop(&mut self) {
    let rate_limiter = self.rate_limiter.clone();
    let remaining_requests = self.remaining_requests;

    // Spawn an async task to handle the asynchronous work
    tokio::spawn(async move {
      if let Some(remaining) = remaining_requests {
        let mut remaining_lock = rate_limiter.remaining.lock().await;
        *remaining_lock = remaining;
      }
      // Always add back a permit, whether or not `remaining_requests` was set
      rate_limiter.semaphore.add_permits(1);
    });
  }
}
// impl Drop for RateLimitGuard {
//   fn drop(&mut self) {
//     if let Some(remaining) = self.remaining_requests {
//       let mut remaining_lock = self.rate_limiter.remaining.blocking_lock();
//       *remaining_lock = remaining;
//       self.rate_limiter.semaphore.add_permits(1);
//     } else {
//       // If `remaining_requests` was not set, simply add back a permit
//       self.rate_limiter.semaphore.add_permits(1);
//     }
//   }
// }

// impl RateLimiter {
//   pub fn new(limit: usize) -> Self {
//     RateLimiter {
//       remaining: Mutex::new(limit),
//       semaphore: Semaphore::new(limit),
//     }
//   }

//   // Call this function before making a request
//   pub async fn acquire(&self) {
//     loop {
//       let permit = self
//         .semaphore
//         .acquire()
//         .await
//         .expect("Failed to acquire semaphore");
//       let mut remaining = self.remaining.lock().await;

//       if *remaining == 0 {
//         *remaining = 1; // Allow for one request to go through so we don't starve

//         drop(remaining); // release the lock before sleeping
//         drop(permit); // release the permit before sleeping
//         sleep(Duration::from_secs(5)).await; // wait for the rate limit to reset
//                                              // After waiting, the loop will continue and try acquiring again
//       } else {
//         *remaining -= 1;
//         break; // Successfully acquired the permit, exit the loop
//       }
//     }
//   }

//   // Call this function after getting the rate limit remaining from the response
//   pub async fn release(&self, remaining_from_response: usize) {
//     let mut remaining = self.remaining.lock().await;
//     *remaining = remaining_from_response;
//     self.semaphore.add_permits(1);
//   }
// }

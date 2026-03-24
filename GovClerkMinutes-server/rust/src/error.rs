use http::StatusCode;
use std::fmt::Debug;
use tracing::error;

pub trait LogError<T, E: Debug> {
    fn map_and_log_err(self, msg: &str, status: StatusCode) -> Result<T, StatusCode>;
}

impl<T, E: Debug> LogError<T, E> for Result<T, E> {
    fn map_and_log_err(self, msg: &str, status: StatusCode) -> Result<T, StatusCode> {
        self.map_err(|e| {
            error!("{} *** {:?}", msg, e);
            return status;
        })
    }
}

use axum::extract::ws;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", content = "data", rename_all = "snake_case")]
pub enum Message {
  // Heartbeat from client
  Ping {
    ts: Option<u64>,
  },
  Pong {
    ts: Option<u64>,
  },
  // Error message from server
  Error {
    message: String,
  },
  // Broadcast: a new WhatsApp-related event occurred (no payload for now)
  NewWhatsapp,
  // Broadcast: a call-related event (connect/status), includes kind and full value object
  Call {
    kind: String,
    value: serde_json::Value,
  },
}

impl From<Message> for ws::Message {
  fn from(msg: Message) -> Self {
    match serde_json::to_string(&msg) {
      Ok(s) => ws::Message::Text(s),
      Err(e) => {
        let err_msg = Message::Error {
          message: format!("serialization failed: {}", e),
        };
        return ws::Message::Text(err_msg.to_json_string().unwrap_or_default());
      }
    }
  }
}

impl Message {
  pub fn try_from_str(s: &str) -> Result<Self, serde_json::Error> {
    serde_json::from_str(s)
  }

  pub fn to_json_string(&self) -> Result<String, serde_json::Error> {
    serde_json::to_string(self)
  }
}

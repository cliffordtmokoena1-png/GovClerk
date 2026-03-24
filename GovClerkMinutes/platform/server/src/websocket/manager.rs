use crate::websocket::message::Message;
use std::collections::HashMap;
use tokio::sync::mpsc::UnboundedSender;
use tracing::error;
use tracing::info;
use uuid::Uuid;

#[derive(Hash, Eq, PartialEq, Clone, Debug)]
pub struct ConnectionId(String);

pub struct WebsocketManager {
  clients: HashMap<ConnectionId, (String, UnboundedSender<Message>)>,
}

impl WebsocketManager {
  pub fn new() -> Self {
    Self {
      clients: HashMap::new(),
    }
  }

  pub fn add_client(&mut self, user_id: String, tx: UnboundedSender<Message>) -> ConnectionId {
    info!("Added client {} (total {})", user_id, self.clients.len());
    let conn_id = ConnectionId(Uuid::new_v4().to_string());
    self.clients.insert(conn_id.clone(), (user_id, tx));
    return conn_id;
  }

  pub fn remove_client(&mut self, conn_id: &ConnectionId) {
    info!(
      "Removed connection {:?} (total {})",
      conn_id,
      self.clients.len()
    );
    self.clients.remove(conn_id);
  }

  pub async fn broadcast(&self, msg: Message) {
    info!(
      "Broadcasting websocket message to {} clients",
      self.clients.len()
    );

    for (user_id, tx) in self.clients.values() {
      match tx.send(msg.clone()) {
        Ok(_) => {}
        Err(err) => {
          error!(
            "Failed to send websocket message to user {} with err {}",
            user_id, err
          );
        }
      };
    }
  }
}

use crate::auth::{self, User};
use crate::websocket::message::Message;
use crate::SharedRequestState;
use axum::{
  extract::{
    ws::{Message as WsMessage, WebSocket, WebSocketUpgrade},
    Query, State,
  },
  response::IntoResponse,
};
use futures::{SinkExt, StreamExt};
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{error, info, warn};

async fn handle_socket(socket: WebSocket, state: Arc<SharedRequestState>, user_id: String) {
  let (tx, mut rx) = mpsc::unbounded_channel::<Message>();

  let conn_id = {
    let mut ws = state.websocket.lock().await;
    ws.add_client(user_id.clone(), tx.clone())
  };

  info!("WS connected for {user_id}");

  let (mut sender, mut receiver) = socket.split();

  // server -> client messages
  let mut send_task = tokio::spawn(async move {
    while let Some(msg) = rx.recv().await {
      if let Err(err) = sender.send(msg.into()).await {
        error!("Failed to send websocket message: {}", err);
        break;
      }
    }
  });

  // client -> server messages
  let mut recv_task = tokio::spawn({
    let user_id = user_id.clone();
    async move {
      while let Some(Ok(msg)) = receiver.next().await {
        match msg {
          WsMessage::Text(text) => match Message::try_from_str(&text) {
            Ok(parsed) => match parsed {
              Message::Ping { .. } => {
                let ts = Some(chrono::Utc::now().timestamp_millis() as u64);
                let _ = tx.send(Message::Pong { ts });
              }
              other => {
                info!("Received WS message from {}: {:?}", user_id, other);
              }
            },
            Err(err) => {
              error!("Failed to parse WS message from {}: {}", user_id, err);
            }
          },
          WsMessage::Close(frame) => {
            info!("WS closed: {:?} from {}", frame, user_id);
            break;
          }
          WsMessage::Binary(_) | WsMessage::Pong(_) | WsMessage::Ping(_) => {
            // Ignore these.  Ping and Pong are handled by tungstenite.
          }
        }
      }
    }
  });

  // When either task ends, we abort the others and cleanup
  tokio::select! {
    res = &mut send_task => {
      if let Err(err) = res { error!("WS send task error: {}", err); }
      recv_task.abort();
    },
    res = &mut recv_task => {
      if let Err(err) = res { error!("WS recv task error: {}", err); }
      send_task.abort();
    },
  }

  {
    let mut ws = state.websocket.lock().await;
    ws.remove_client(&conn_id);
    warn!("WS disconnected: {}", user_id);
  }
}

#[derive(serde::Deserialize)]
pub struct WebSocketQueryParam {
  pub token: String,
}

pub async fn handler(
  ws: WebSocketUpgrade,
  State(state): State<Arc<SharedRequestState>>,
  Query(WebSocketQueryParam { token }): Query<WebSocketQueryParam>,
) -> impl IntoResponse {
  match auth::authenticate_any_token(&token) {
    Ok(User {
      user_id,
      role: Some(r),
    }) if r == "admin" => ws.on_upgrade(move |socket| handle_socket(socket, state, user_id)),
    Ok(_) => {
      error!("WebSocket auth failed: insufficient role");
      axum::http::StatusCode::UNAUTHORIZED.into_response()
    }
    Err(status) => {
      error!("WebSocket auth failed: {}", status);
      axum::http::StatusCode::BAD_REQUEST.into_response()
    }
  }
}

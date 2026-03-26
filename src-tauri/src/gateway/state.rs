use std::{
    collections::{BTreeSet, HashMap},
    sync::{Arc, Mutex},
};

use futures_util::stream::SplitSink;
use serde_json::Value;
use tokio::{
    net::TcpStream,
    sync::{oneshot, Mutex as AsyncMutex},
};
use tokio_tungstenite::{tungstenite::Message, MaybeTlsStream, WebSocketStream};

use crate::gateway::{
    endpoint::GatewayEndpoint,
    errors::GatewayError,
    types::GatewayStatusSnapshot,
};

pub type GatewaySocket = WebSocketStream<MaybeTlsStream<TcpStream>>;
pub type GatewaySocketWriter = SplitSink<GatewaySocket, Message>;
pub type GatewayPendingRequestResult = Result<Value, GatewayError>;
type GatewayPendingRequests = Arc<Mutex<HashMap<String, oneshot::Sender<GatewayPendingRequestResult>>>>;

pub struct GatewayActiveConnection {
    pub session_id: String,
    pub endpoint: GatewayEndpoint,
    pub writer: Arc<AsyncMutex<GatewaySocketWriter>>,
    pending_requests: GatewayPendingRequests,
    available_methods: Arc<BTreeSet<String>>,
}

impl GatewayActiveConnection {
    pub fn new(
        session_id: String,
        endpoint: GatewayEndpoint,
        writer: Arc<AsyncMutex<GatewaySocketWriter>>,
        available_methods: Vec<String>,
    ) -> Self {
        Self {
            session_id,
            endpoint,
            writer,
            pending_requests: Arc::new(Mutex::new(HashMap::new())),
            available_methods: Arc::new(available_methods.into_iter().collect()),
        }
    }

    pub fn supports_method(&self, method: &str) -> bool {
        self.available_methods.is_empty() || self.available_methods.contains(method)
    }

    pub fn register_pending_request(
        &self,
        request_id: String,
    ) -> oneshot::Receiver<GatewayPendingRequestResult> {
        let (tx, rx) = oneshot::channel();
        self.pending_requests
            .lock()
            .expect("gateway pending request lock poisoned")
            .insert(request_id, tx);
        rx
    }

    pub fn resolve_pending_request(
        &self,
        request_id: &str,
        result: GatewayPendingRequestResult,
    ) -> bool {
        let pending = self
            .pending_requests
            .lock()
            .expect("gateway pending request lock poisoned")
            .remove(request_id);
        if let Some(sender) = pending {
            let _ = sender.send(result);
            true
        } else {
            false
        }
    }

    pub fn remove_pending_request(&self, request_id: &str) -> bool {
        self.pending_requests
            .lock()
            .expect("gateway pending request lock poisoned")
            .remove(request_id)
            .is_some()
    }

    pub fn reject_all_pending_requests(&self, error: GatewayError) {
        let mut pending = self
            .pending_requests
            .lock()
            .expect("gateway pending request lock poisoned");
        for (_, sender) in pending.drain() {
            let _ = sender.send(Err(error.clone()));
        }
    }
}

impl Clone for GatewayActiveConnection {
    fn clone(&self) -> Self {
        Self {
            session_id: self.session_id.clone(),
            endpoint: self.endpoint.clone(),
            writer: Arc::clone(&self.writer),
            pending_requests: Arc::clone(&self.pending_requests),
            available_methods: Arc::clone(&self.available_methods),
        }
    }
}

struct GatewayStateInner {
    snapshot: Mutex<GatewayStatusSnapshot>,
    session: AsyncMutex<Option<GatewayActiveConnection>>,
}

#[derive(Clone)]
pub struct GatewayAppState {
    inner: Arc<GatewayStateInner>,
}

impl Default for GatewayAppState {
    fn default() -> Self {
        Self {
            inner: Arc::new(GatewayStateInner {
                snapshot: Mutex::new(GatewayStatusSnapshot::idle()),
                session: AsyncMutex::new(None),
            }),
        }
    }
}

impl GatewayAppState {
    pub fn snapshot(&self) -> GatewayStatusSnapshot {
        self.inner
            .snapshot
            .lock()
            .expect("gateway snapshot lock poisoned")
            .clone()
    }

    pub fn replace_snapshot(&self, snapshot: GatewayStatusSnapshot) {
        *self
            .inner
            .snapshot
            .lock()
            .expect("gateway snapshot lock poisoned") = snapshot;
    }

    pub async fn session(&self) -> Option<GatewayActiveConnection> {
        self.inner.session.lock().await.clone()
    }

    pub async fn replace_session(
        &self,
        session: Option<GatewayActiveConnection>,
    ) -> Option<GatewayActiveConnection> {
        let mut guard = self.inner.session.lock().await;
        std::mem::replace(&mut *guard, session)
    }

    pub async fn take_session(&self) -> Option<GatewayActiveConnection> {
        self.replace_session(None).await
    }

    pub async fn clear_session_for_id(&self, session_id: &str) -> bool {
        let mut guard = self.inner.session.lock().await;
        let should_clear = guard
            .as_ref()
            .map(|session| session.session_id == session_id)
            .unwrap_or(false);
        if should_clear {
            *guard = None;
        }
        should_clear
    }
}

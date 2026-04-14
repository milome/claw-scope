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
    store::{load_advanced_connection_config, resolve_store_paths},
    endpoint::GatewayEndpoint,
    errors::GatewayError,
    types::{GatewayAdvancedConnectionConfig, GatewayAgentMemoryTimelineResult, GatewayStatusSnapshot},
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
    active_session_id: Mutex<Option<String>>,
    sessions: AsyncMutex<HashMap<String, GatewayActiveConnection>>,
    snapshots: Mutex<HashMap<String, GatewayStatusSnapshot>>,
    timeline_probe_cache: Mutex<HashMap<String, CachedTimelineProbeResult>>,
    advanced_config: Mutex<GatewayAdvancedConnectionConfig>,
}

#[derive(Clone)]
struct CachedTimelineProbeResult {
    result: GatewayAgentMemoryTimelineResult,
    expires_at_ms: u64,
}

#[derive(Clone)]
pub struct GatewayAppState {
    inner: Arc<GatewayStateInner>,
}

impl Default for GatewayAppState {
    fn default() -> Self {
        let paths = resolve_store_paths();
        let advanced_config =
            load_advanced_connection_config(&paths).ok().flatten().unwrap_or(GatewayAdvancedConnectionConfig {
                timeout_ms: 30_000,
                heartbeat_ms: 5_000,
                proxy_url: None,
            });
        Self {
            inner: Arc::new(GatewayStateInner {
                snapshot: Mutex::new(GatewayStatusSnapshot::idle()),
                active_session_id: Mutex::new(None),
                sessions: AsyncMutex::new(HashMap::new()),
                snapshots: Mutex::new(HashMap::new()),
                timeline_probe_cache: Mutex::new(HashMap::new()),
                advanced_config: Mutex::new(advanced_config),
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
        if snapshot.is_active {
            let mut snapshots = self
                .inner
                .snapshots
                .lock()
                .expect("gateway snapshots lock poisoned");
            for existing in snapshots.values_mut() {
                existing.is_active = false;
            }
            if let Some(session_id) = snapshot.session_id.as_ref() {
                snapshots.insert(session_id.clone(), snapshot.clone());
            }
        } else if let Some(session_id) = snapshot.session_id.as_ref() {
            self.inner
                .snapshots
                .lock()
                .expect("gateway snapshots lock poisoned")
                .insert(session_id.clone(), snapshot.clone());
        }
        *self
            .inner
            .snapshot
            .lock()
            .expect("gateway snapshot lock poisoned") = snapshot;
    }

    pub async fn session(&self) -> Option<GatewayActiveConnection> {
        let active_session_id = self
            .inner
            .active_session_id
            .lock()
            .expect("active gateway session lock poisoned")
            .clone();
        let guard = self.inner.sessions.lock().await;
        if let Some(active_session_id) = active_session_id {
            if let Some(session) = guard.get(&active_session_id) {
                return Some(session.clone());
            }
        }

        guard.values().next().cloned()
    }

    pub async fn session_by_id(&self, session_id: &str) -> Option<GatewayActiveConnection> {
        self.inner.sessions.lock().await.get(session_id).cloned()
    }

    pub async fn session_for_selector(&self, selector: Option<&str>) -> Option<GatewayActiveConnection> {
        match selector {
            Some(session_id) if !session_id.trim().is_empty() => self.session_by_id(session_id).await,
            _ => self.session().await,
        }
    }

    pub async fn replace_session(
        &self,
        session: Option<GatewayActiveConnection>,
    ) -> Option<GatewayActiveConnection> {
        match session {
            Some(session) => {
                let session_id = session.session_id.clone();
                let previous = self
                    .inner
                    .sessions
                    .lock()
                    .await
                    .insert(session_id.clone(), session);
                *self
                    .inner
                    .active_session_id
                    .lock()
                    .expect("active gateway session lock poisoned") = Some(session_id);
                let active_session_id = self.active_session_id();
                let mut snapshots = self
                    .inner
                    .snapshots
                    .lock()
                    .expect("gateway snapshots lock poisoned");
                for (candidate_id, snapshot) in snapshots.iter_mut() {
                    snapshot.is_active = active_session_id.as_deref() == Some(candidate_id.as_str());
                }
                previous
            }
            None => {
                let active_session_id = self
                    .inner
                    .active_session_id
                    .lock()
                    .expect("active gateway session lock poisoned")
                    .clone();
                if let Some(active_session_id) = active_session_id {
                    let previous = self.inner.sessions.lock().await.remove(&active_session_id);
                    *self
                        .inner
                        .active_session_id
                        .lock()
                        .expect("active gateway session lock poisoned") = None;
                    previous
                } else {
                    None
                }
            }
        }
    }

    pub async fn take_session(&self) -> Option<GatewayActiveConnection> {
        self.replace_session(None).await
    }

    pub async fn clear_session_for_id(&self, session_id: &str) -> bool {
        let removed = self.inner.sessions.lock().await.remove(session_id).is_some();
        if removed {
            self.inner
                .snapshots
                .lock()
                .expect("gateway snapshots lock poisoned")
                .remove(session_id);
            let mut active = self
                .inner
                .active_session_id
                .lock()
                .expect("active gateway session lock poisoned");
            if active.as_deref() == Some(session_id) {
                *active = self
                    .inner
                    .sessions
                    .blocking_lock()
                    .keys()
                    .next()
                    .cloned();
                if let Some(next_session_id) = active.clone() {
                    if let Some(next_snapshot) = self
                        .inner
                        .snapshots
                        .lock()
                        .expect("gateway snapshots lock poisoned")
                        .get(&next_session_id)
                        .cloned()
                    {
                        *self
                            .inner
                            .snapshot
                            .lock()
                            .expect("gateway snapshot lock poisoned") = next_snapshot;
                    }
                } else {
                    *self
                        .inner
                        .snapshot
                        .lock()
                        .expect("gateway snapshot lock poisoned") = GatewayStatusSnapshot::idle();
                }
            }
        }
        removed
    }

    pub fn snapshots(&self) -> Vec<GatewayStatusSnapshot> {
        self.inner
            .snapshots
            .lock()
            .expect("gateway snapshots lock poisoned")
            .values()
            .cloned()
            .collect()
    }

    pub fn active_session_id(&self) -> Option<String> {
        self.inner
            .active_session_id
            .lock()
            .expect("active gateway session lock poisoned")
            .clone()
    }

    pub fn set_active_session_id(&self, session_id: Option<String>) {
        *self
            .inner
            .active_session_id
            .lock()
            .expect("active gateway session lock poisoned") = session_id.clone();

        {
            let mut snapshots = self
                .inner
                .snapshots
                .lock()
                .expect("gateway snapshots lock poisoned");
            for (candidate_id, snapshot) in snapshots.iter_mut() {
                snapshot.is_active = session_id.as_deref() == Some(candidate_id.as_str());
            }
        }

        if let Some(session_id) = session_id {
            if let Some(snapshot) = self
                .inner
                .snapshots
                .lock()
                .expect("gateway snapshots lock poisoned")
                .get(&session_id)
                .cloned()
            {
                *self
                    .inner
                    .snapshot
                    .lock()
                    .expect("gateway snapshot lock poisoned") = snapshot;
            }
        }
    }

    pub fn load_timeline_probe_cache(
        &self,
        cache_key: &str,
        now_ms: u64,
    ) -> Option<GatewayAgentMemoryTimelineResult> {
        let mut guard = self
            .inner
            .timeline_probe_cache
            .lock()
            .expect("timeline probe cache lock poisoned");
        let cached = guard.get(cache_key).cloned();
        match cached {
            Some(entry) if entry.expires_at_ms > now_ms => Some(entry.result),
            Some(_) => {
                guard.remove(cache_key);
                None
            }
            None => None,
        }
    }

    pub fn store_timeline_probe_cache(
        &self,
        cache_key: String,
        result: GatewayAgentMemoryTimelineResult,
        expires_at_ms: u64,
    ) {
        self.inner
            .timeline_probe_cache
            .lock()
            .expect("timeline probe cache lock poisoned")
            .insert(
                cache_key,
                CachedTimelineProbeResult {
                    result,
                    expires_at_ms,
                },
            );
    }

    pub fn clear_timeline_probe_cache(&self) {
        self.inner
            .timeline_probe_cache
            .lock()
            .expect("timeline probe cache lock poisoned")
            .clear();
    }

    pub fn advanced_config(&self) -> GatewayAdvancedConnectionConfig {
        self.inner
            .advanced_config
            .lock()
            .expect("gateway advanced config lock poisoned")
            .clone()
    }

    pub fn replace_advanced_config(&self, config: GatewayAdvancedConnectionConfig) {
        *self
            .inner
            .advanced_config
            .lock()
            .expect("gateway advanced config lock poisoned") = config;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::gateway::types::{
        GatewayAgentFileEntry, GatewayAgentMemoryTimelineDiagnostics,
        GatewayAgentMemoryTimelineProbeStatus, GatewayAgentMemoryTimelineProbeSummary,
        GatewayAgentMemoryTimelineResult, GatewayAgentMemoryTimelineSource,
        GatewayConnectionPhase,
    };

    fn sample_timeline_result() -> GatewayAgentMemoryTimelineResult {
        GatewayAgentMemoryTimelineResult {
            agent_id: "main".to_string(),
            workspace: "~/.openclaw/workspace-main".to_string(),
            source: GatewayAgentMemoryTimelineSource::RemoteProbe,
            entries: vec![GatewayAgentFileEntry {
                name: "memory/2026-03-28.md".to_string(),
                path: "~/.openclaw/workspace-main/memory/2026-03-28.md".to_string(),
                missing: false,
                size: Some(128),
                updated_at_ms: None,
                content: None,
            }],
            diagnostics: GatewayAgentMemoryTimelineDiagnostics {
                gateway_visible_files_count: 0,
                gateway_visible_root_docs_count: 0,
                gateway_visible_daily_count: 0,
                gateway_only_returned_root_docs: false,
                local_scan_directory: None,
                local_scan_files_count: 0,
                local_scan_skipped_count: 0,
            },
            probe: Some(GatewayAgentMemoryTimelineProbeSummary {
                start_date: "2026-03-22".to_string(),
                end_date: "2026-03-28".to_string(),
                attempted_days: 7,
                hit_days: 1,
                miss_days: 6,
                skipped_days: 0,
                timeout_days: 0,
                error_days: 0,
                retry_days: 0,
                retry_recovered_days: 0,
                days: Vec::new(),
                status: GatewayAgentMemoryTimelineProbeStatus::Complete,
                cached: false,
                last_error_category: None,
                last_error_code: None,
                last_error_message: None,
            }),
        }
    }

    #[test]
    fn timeline_probe_cache_returns_fresh_entries_only() {
        let state = GatewayAppState::default();
        let cache_key = "gateway|main|workspace|2026-03-22|2026-03-28";

        state.store_timeline_probe_cache(
            cache_key.to_string(),
            sample_timeline_result(),
            1_500,
        );

        assert!(state
            .load_timeline_probe_cache(cache_key, 1_000)
            .is_some());
        assert!(state
            .load_timeline_probe_cache(cache_key, 2_000)
            .is_none());
    }

    #[test]
    fn clearing_timeline_probe_cache_drops_cached_entries() {
        let state = GatewayAppState::default();
        let cache_key = "gateway|main|workspace|2026-03-22|2026-03-28";

        state.store_timeline_probe_cache(
            cache_key.to_string(),
            sample_timeline_result(),
            5_000,
        );
        state.clear_timeline_probe_cache();

        assert!(state
            .load_timeline_probe_cache(cache_key, 1_000)
            .is_none());
    }

    #[test]
    fn snapshot_registry_switches_active_session_truthfully() {
        let state = GatewayAppState::default();

        state.replace_snapshot(GatewayStatusSnapshot {
            session_id: Some("ws://node-a:18789".to_string()),
            phase: GatewayConnectionPhase::Connected,
            gateway_origin: Some("ws://node-a:18789".to_string()),
            is_active: true,
            device_id: None,
            granted_role: None,
            granted_scopes: vec![],
            last_error: None,
            is_paired: true,
            can_retry_with_device_token: false,
        });

        state.replace_snapshot(GatewayStatusSnapshot {
            session_id: Some("ws://node-b:18789".to_string()),
            phase: GatewayConnectionPhase::Connected,
            gateway_origin: Some("ws://node-b:18789".to_string()),
            is_active: false,
            device_id: None,
            granted_role: None,
            granted_scopes: vec![],
            last_error: None,
            is_paired: true,
            can_retry_with_device_token: false,
        });

        assert_eq!(state.snapshots().len(), 2);

        state.set_active_session_id(Some("ws://node-a:18789".to_string()));
        assert_eq!(state.active_session_id().as_deref(), Some("ws://node-a:18789"));
        let snapshots = state.snapshots();
        assert_eq!(snapshots.iter().filter(|snapshot| snapshot.is_active).count(), 1);
    }
}

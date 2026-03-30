use serde::{Deserialize, Serialize};

use crate::gateway::errors::GatewayErrorSummary;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GatewayAuthMode {
    #[serde(alias = "none")]
    PairedDevice,
    Token,
    Password,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayConnectConfig {
    pub gateway_url: String,
    pub auth_mode: GatewayAuthMode,
    pub auth_secret: Option<String>,
    pub role: String,
    pub scopes: Vec<String>,
    pub profile_label: Option<String>,
}

impl Default for GatewayConnectConfig {
    fn default() -> Self {
        Self {
            gateway_url: "http://127.0.0.1:18789".to_string(),
            auth_mode: GatewayAuthMode::PairedDevice,
            auth_secret: None,
            role: "operator".to_string(),
            scopes: vec!["operator.admin".to_string()],
            profile_label: None,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GatewayConnectionPhase {
    Idle,
    ResolvingEndpoint,
    OpeningSocket,
    WaitingForChallenge,
    SendingConnect,
    WaitingForApproval,
    Connected,
    Reconnecting,
    Disconnected,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayStatusSnapshot {
    pub phase: GatewayConnectionPhase,
    pub gateway_origin: Option<String>,
    pub device_id: Option<String>,
    pub granted_role: Option<String>,
    pub granted_scopes: Vec<String>,
    pub last_error: Option<GatewayErrorSummary>,
    pub is_paired: bool,
    pub can_retry_with_device_token: bool,
}

impl GatewayStatusSnapshot {
    pub fn idle() -> Self {
        Self {
            phase: GatewayConnectionPhase::Idle,
            gateway_origin: None,
            device_id: None,
            granted_role: None,
            granted_scopes: Vec::new(),
            last_error: None,
            is_paired: false,
            can_retry_with_device_token: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentIdentitySummary {
    pub name: Option<String>,
    pub theme: Option<String>,
    pub emoji: Option<String>,
    pub avatar: Option<String>,
    pub avatar_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentSummary {
    pub id: String,
    pub name: Option<String>,
    pub identity: Option<GatewayAgentIdentitySummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentIdentityResult {
    pub agent_id: String,
    pub name: Option<String>,
    pub avatar: Option<String>,
    pub emoji: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentFileEntry {
    pub name: String,
    pub path: String,
    pub missing: bool,
    pub size: Option<u64>,
    pub updated_at_ms: Option<u64>,
    pub content: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentFileGetResult {
    pub agent_id: String,
    pub workspace: String,
    pub file: GatewayAgentFileEntry,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayMemorySharedAgentSummary {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentMemoryDiagnostics {
    pub memory_search_enabled: bool,
    pub backend: String,
    pub provider: Option<String>,
    pub embedding_model: Option<String>,
    pub builtin_store_path: String,
    pub sources: Vec<String>,
    pub extra_paths: Vec<String>,
    pub session_memory_enabled: bool,
    pub qmd_active: bool,
    pub qmd_home: Option<String>,
    pub qmd_paths: Vec<String>,
    pub qmd_sessions_enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentMemoryResult {
    pub agent_id: String,
    pub workspace: String,
    pub documents: Vec<GatewayAgentFileEntry>,
    pub shared_agents: Vec<GatewayMemorySharedAgentSummary>,
    pub diagnostics: Option<GatewayAgentMemoryDiagnostics>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GatewayAgentMemorySearchSourceKind {
    RootMemory,
    DailyMemory,
    WorkspaceMarkdown,
    ExtraPath,
    SessionTranscript,
    Unknown,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GatewayAgentMemorySearchOpenTarget {
    Documents,
    Footprints,
    DetailSheet,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentMemorySearchDiagnostics {
    pub available: bool,
    pub provider: Option<String>,
    pub sources: Vec<String>,
    pub session_memory_enabled: bool,
    pub store_driver: String,
    pub store_path: String,
    pub backend: String,
    pub advice: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentMemoryStatusSource {
    pub source: String,
    pub indexed_files: Option<u64>,
    pub total_files: Option<u64>,
    pub chunks: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentMemoryStatusResult {
    pub agent_id: String,
    pub provider: Option<String>,
    pub requested_provider: Option<String>,
    pub model: Option<String>,
    pub embeddings_available: Option<bool>,
    pub embeddings_error: Option<String>,
    pub indexed_files: Option<u64>,
    pub total_files: Option<u64>,
    pub chunks: Option<u64>,
    pub by_source: Vec<GatewayAgentMemoryStatusSource>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentMemoryRuntimeStatusSourceCount {
    pub source: String,
    pub files: u64,
    pub chunks: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentMemoryRuntimeStatusCore {
    pub backend: String,
    pub files: u64,
    pub total_files: Option<u64>,
    pub chunks: u64,
    pub dirty: bool,
    pub workspace_dir: Option<String>,
    pub db_path: Option<String>,
    pub provider: String,
    pub model: Option<String>,
    pub requested_provider: String,
    pub sources: Vec<String>,
    pub extra_paths: Vec<String>,
    pub source_counts: Vec<GatewayAgentMemoryRuntimeStatusSourceCount>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentMemoryRuntimeStatusResult {
    pub agent_id: String,
    pub embedding_ok: bool,
    pub embedding_error: Option<String>,
    pub vector_ok: bool,
    pub status: GatewayAgentMemoryRuntimeStatusCore,
    pub raw_payload: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentMemorySearchEntry {
    pub id: String,
    pub path: String,
    pub snippet: String,
    pub score: Option<f64>,
    pub line_start: Option<u64>,
    pub line_end: Option<u64>,
    pub source_kind: GatewayAgentMemorySearchSourceKind,
    pub open_target: GatewayAgentMemorySearchOpenTarget,
    pub canonical_document_name: Option<String>,
    pub timeline_entry_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentMemorySearchResult {
    pub agent_id: String,
    pub query: String,
    pub executed_at_ms: u64,
    pub diagnostics: GatewayAgentMemorySearchDiagnostics,
    pub results: Vec<GatewayAgentMemorySearchEntry>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GatewayAgentMemoryTimelineSource {
    LocalWorkspace,
    RemoteProbe,
    Unavailable,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GatewayAgentMemoryTimelineAccessReason {
    WorkspaceLocalAndReadable,
    WorkspaceRemoteOrNotReadable,
    WorkspaceMissing,
    GatewayNotConnected,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentMemoryTimelineAccessResult {
    pub agent_id: String,
    pub workspace: String,
    pub mode: GatewayAgentMemoryTimelineSource,
    pub reason: GatewayAgentMemoryTimelineAccessReason,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentMemoryTimelineDiagnostics {
    pub gateway_visible_files_count: usize,
    pub gateway_visible_root_docs_count: usize,
    pub gateway_visible_daily_count: usize,
    pub gateway_only_returned_root_docs: bool,
    pub local_scan_directory: Option<String>,
    pub local_scan_files_count: usize,
    pub local_scan_skipped_count: usize,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum GatewayAgentMemoryTimelineProbeStatus {
    #[default]
    Complete,
    Empty,
    Partial,
    Timeout,
    Error,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum GatewayAgentMemoryTimelineProbeDayStatus {
    Hit,
    Miss,
    Timeout,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentMemoryTimelineProbeDayResult {
    pub date: String,
    pub name: String,
    pub status: GatewayAgentMemoryTimelineProbeDayStatus,
    #[serde(default)]
    pub retried: bool,
    #[serde(default)]
    pub recovered_after_retry: bool,
    #[serde(default)]
    pub error_category: Option<String>,
    #[serde(default)]
    pub error_code: Option<String>,
    #[serde(default)]
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentMemoryTimelineProbeSummary {
    pub start_date: String,
    pub end_date: String,
    pub attempted_days: usize,
    pub hit_days: usize,
    pub miss_days: usize,
    pub skipped_days: usize,
    #[serde(default)]
    pub timeout_days: usize,
    #[serde(default)]
    pub error_days: usize,
    #[serde(default)]
    pub retry_days: usize,
    #[serde(default)]
    pub retry_recovered_days: usize,
    #[serde(default)]
    pub days: Vec<GatewayAgentMemoryTimelineProbeDayResult>,
    #[serde(default)]
    pub status: GatewayAgentMemoryTimelineProbeStatus,
    #[serde(default)]
    pub cached: bool,
    #[serde(default)]
    pub last_error_category: Option<String>,
    #[serde(default)]
    pub last_error_code: Option<String>,
    #[serde(default)]
    pub last_error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentMemoryTimelineResult {
    pub agent_id: String,
    pub workspace: String,
    pub source: GatewayAgentMemoryTimelineSource,
    pub entries: Vec<GatewayAgentFileEntry>,
    pub diagnostics: GatewayAgentMemoryTimelineDiagnostics,
    pub probe: Option<GatewayAgentMemoryTimelineProbeSummary>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentSettingsResult {
    pub agent_id: String,
    pub workspace: Option<String>,
    pub model: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayAgentsListResult {
    pub default_id: String,
    pub main_key: String,
    pub scope: String,
    pub agents: Vec<GatewayAgentSummary>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn gateway_connect_config_serializes() {
        let json = serde_json::to_string(&GatewayConnectConfig::default()).expect("serialize config");
        assert!(json.contains("gatewayUrl"));
        assert!(json.contains("paired_device"));
        assert!(json.contains("operator.admin"));
    }

    #[test]
    fn legacy_none_auth_mode_deserializes_as_paired_device() {
        let config: GatewayConnectConfig = serde_json::from_value(json!({
            "gatewayUrl": "http://127.0.0.1:18789",
            "authMode": "none",
            "authSecret": null,
            "role": "operator",
            "scopes": ["operator.admin"],
            "profileLabel": null
        }))
        .expect("deserialize legacy auth mode");

        assert_eq!(config.auth_mode, GatewayAuthMode::PairedDevice);
    }

    #[test]
    fn idle_snapshot_has_idle_phase() {
        let snapshot = GatewayStatusSnapshot::idle();
        assert_eq!(snapshot.phase, GatewayConnectionPhase::Idle);
        assert!(snapshot.gateway_origin.is_none());
        assert!(snapshot.last_error.is_none());
    }

    #[test]
    fn agents_list_result_deserializes_from_gateway_shape() {
        let result: GatewayAgentsListResult = serde_json::from_value(json!({
            "defaultId": "main",
            "mainKey": "global",
            "scope": "global",
            "agents": [
                {
                    "id": "main",
                    "name": "Main",
                    "identity": {
                        "name": "Main",
                        "theme": "default",
                        "emoji": "lobster"
                    }
                }
            ]
        }))
        .expect("deserialize agents list");

        assert_eq!(result.default_id, "main");
        assert_eq!(result.agents.len(), 1);
        assert_eq!(
            result.agents[0]
                .identity
                .as_ref()
                .and_then(|identity| identity.emoji.as_deref()),
            Some("lobster")
        );
    }

    #[test]
    fn agent_identity_result_deserializes_from_gateway_shape() {
        let result: GatewayAgentIdentityResult = serde_json::from_value(json!({
            "agentId": "main",
            "name": "Main",
            "avatar": "https://example.com/avatar.png",
            "emoji": "🦞"
        }))
        .expect("deserialize agent identity");

        assert_eq!(result.agent_id, "main");
        assert_eq!(result.name.as_deref(), Some("Main"));
        assert_eq!(result.emoji.as_deref(), Some("🦞"));
    }

    #[test]
    fn agent_file_get_result_deserializes_from_gateway_shape() {
        let result: GatewayAgentFileGetResult = serde_json::from_value(json!({
            "agentId": "main",
            "workspace": "~/.openclaw/workspace",
            "file": {
                "name": "SOUL.md",
                "path": "~/.openclaw/workspace/SOUL.md",
                "missing": false,
                "size": 128,
                "updatedAtMs": 1700000000000_u64,
                "content": "# Soul"
            }
        }))
        .expect("deserialize agent file get");

        assert_eq!(result.agent_id, "main");
        assert_eq!(result.file.name, "SOUL.md");
        assert_eq!(result.file.updated_at_ms, Some(1700000000000_u64));
    }

    #[test]
    fn agent_memory_result_deserializes_from_gateway_shape() {
        let result: GatewayAgentMemoryResult = serde_json::from_value(json!({
            "agentId": "main",
            "workspace": "~/.openclaw/workspace",
            "documents": [
                {
                    "name": "MEMORY.md",
                    "path": "~/.openclaw/workspace/MEMORY.md",
                    "missing": false,
                    "content": "# Memory"
                },
                {
                    "name": "memory.md",
                    "path": "~/.openclaw/workspace/memory.md",
                    "missing": true,
                    "content": null
                }
            ],
            "sharedAgents": [
                {
                    "id": "writer",
                    "name": "Writer"
                }
            ]
        }))
        .expect("deserialize agent memory result");

        assert_eq!(result.workspace, "~/.openclaw/workspace");
        assert_eq!(result.documents.len(), 2);
        assert_eq!(result.shared_agents.len(), 1);
        assert_eq!(result.shared_agents[0].id, "writer");
    }

    #[test]
    fn agent_memory_timeline_result_deserializes_from_gateway_shape() {
        let result: GatewayAgentMemoryTimelineResult = serde_json::from_value(json!({
            "agentId": "main",
            "workspace": "~/.openclaw/workspace",
            "source": "local_workspace",
            "entries": [
                {
                    "name": "memory/2026-03-27.md",
                    "path": "~/.openclaw/workspace/memory/2026-03-27.md",
                    "missing": false,
                    "size": 256,
                    "updatedAtMs": 1700000000000_u64
                }
            ],
            "diagnostics": {
                "gatewayVisibleFilesCount": 2,
                "gatewayVisibleRootDocsCount": 1,
                "gatewayVisibleDailyCount": 1,
                "gatewayOnlyReturnedRootDocs": false,
                "localScanDirectory": "~/.openclaw/workspace/memory",
                "localScanFilesCount": 3,
                "localScanSkippedCount": 2
            },
            "probe": {
                "startDate": "2026-03-22",
                "endDate": "2026-03-28",
                "attemptedDays": 7,
                "hitDays": 2,
                "missDays": 4,
                "skippedDays": 1,
                "retryDays": 1,
                "retryRecoveredDays": 1,
                "days": [
                    {
                        "date": "2026-03-27",
                        "name": "memory/2026-03-27.md",
                        "status": "hit",
                        "retried": false,
                        "recoveredAfterRetry": false
                    },
                    {
                        "date": "2026-03-26",
                        "name": "memory/2026-03-26.md",
                        "status": "timeout",
                        "retried": true,
                        "recoveredAfterRetry": false,
                        "errorCode": "SOCKET_ERROR"
                    }
                ]
            }
        }))
        .expect("deserialize agent memory timeline result");

        assert_eq!(result.workspace, "~/.openclaw/workspace");
        assert_eq!(result.source, GatewayAgentMemoryTimelineSource::LocalWorkspace);
        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].name, "memory/2026-03-27.md");
        assert_eq!(result.diagnostics.gateway_visible_files_count, 2);
        assert_eq!(result.diagnostics.gateway_visible_daily_count, 1);
        assert_eq!(
            result.diagnostics.local_scan_directory.as_deref(),
            Some("~/.openclaw/workspace/memory")
        );
        assert_eq!(result.diagnostics.local_scan_files_count, 3);
        assert_eq!(result.diagnostics.local_scan_skipped_count, 2);
        let probe = result.probe.expect("probe summary");
        assert_eq!(probe.start_date, "2026-03-22");
        assert_eq!(probe.retry_days, 1);
        assert_eq!(probe.days.len(), 2);
    }

    #[test]
    fn agent_memory_timeline_access_result_deserializes_from_gateway_shape() {
        let result: GatewayAgentMemoryTimelineAccessResult = serde_json::from_value(json!({
            "agentId": "main",
            "workspace": "~/.openclaw/workspace",
            "mode": "remote_probe",
            "reason": "workspace_remote_or_not_readable"
        }))
        .expect("deserialize agent memory timeline access result");

        assert_eq!(result.agent_id, "main");
        assert_eq!(result.mode, GatewayAgentMemoryTimelineSource::RemoteProbe);
        assert_eq!(
            result.reason,
            GatewayAgentMemoryTimelineAccessReason::WorkspaceRemoteOrNotReadable
        );
    }
}


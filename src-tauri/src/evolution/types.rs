use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EvolutionTemplateKind {
    Conservative,
    Aggressive,
    KnowledgeInjection,
    CustomTemplate,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EvolutionOperationStatus {
    Success,
    Failed,
    Cancelled,
    RolledBack,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EvolutionRuntimeState {
    PreviewReady,
    Running,
    Succeeded,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EvolutionRuntimePhase {
    PreviewReady,
    ValidatingPreview,
    Snapshotting,
    ApplyingChanges,
    Reindexing,
    Finalizing,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EvolutionOperationKind {
    Execute,
    Rollback,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EvolutionOperationType {
    Optimize,
    InjectKnowledge,
    CustomTransform,
    RestoreSnapshot,
}

fn default_operation_type() -> EvolutionOperationType {
    EvolutionOperationType::Optimize
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvolutionKnowledgeInjectionInput {
    pub source_ref: String,
    #[serde(default)]
    pub additional_source_refs: Vec<String>,
    pub knowledge_body: String,
    #[serde(default)]
    pub capability_tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvolutionCustomTemplateInput {
    pub source_ref: String,
    #[serde(default)]
    pub additional_source_refs: Vec<String>,
    pub script_body: String,
    #[serde(default)]
    pub capability_tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvolutionPreviewChange {
    pub id: String,
    pub group: String,
    #[serde(rename = "type")]
    pub change_type: String,
    pub title: String,
    pub desc: String,
    pub impact: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvolutionPreviewResult {
    pub operation_id: String,
    pub agent_id: String,
    pub node_label: String,
    pub template: EvolutionTemplateKind,
    #[serde(default = "default_operation_type")]
    pub operation_type: EvolutionOperationType,
    pub source_document: String,
    pub risk_level: String,
    #[serde(default)]
    pub requires_confirmation: bool,
    #[serde(default)]
    pub unsafe_apply: bool,
    #[serde(default)]
    pub unsafe_reasons: Vec<String>,
    #[serde(default)]
    pub source_ref: Option<String>,
    #[serde(default)]
    pub source_refs: Vec<String>,
    #[serde(default)]
    pub capability_tags: Vec<String>,
    pub changes: Vec<EvolutionPreviewChange>,
    pub bytes_before: usize,
    pub bytes_after: usize,
    pub snapshot_id: String,
    pub created_at_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvolutionHistoryEntry {
    pub operation_id: String,
    pub operation_kind: EvolutionOperationKind,
    pub status: EvolutionOperationStatus,
    pub agent_id: String,
    pub node_label: String,
    pub template: EvolutionTemplateKind,
    #[serde(default = "default_operation_type")]
    pub operation_type: EvolutionOperationType,
    pub snapshot_id: String,
    pub source_document: String,
    #[serde(default)]
    pub source_ref: Option<String>,
    #[serde(default)]
    pub source_refs: Vec<String>,
    #[serde(default)]
    pub capability_tags: Vec<String>,
    pub summary: String,
    pub bytes_before: usize,
    pub bytes_after: usize,
    #[serde(default)]
    pub duration_ms: Option<u64>,
    pub created_at_ms: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvolutionExecuteResult {
    pub operation_id: String,
    pub snapshot_id: String,
    pub history_entry: EvolutionHistoryEntry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvolutionRollbackResult {
    pub operation_id: String,
    pub restored_snapshot_id: String,
    pub history_entry: EvolutionHistoryEntry,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvolutionOperationStatusSnapshot {
    pub operation_id: String,
    pub agent_id: String,
    pub node_label: String,
    pub template: EvolutionTemplateKind,
    #[serde(default = "default_operation_type")]
    pub operation_type: EvolutionOperationType,
    pub source_document: String,
    pub snapshot_id: String,
    pub risk_level: String,
    #[serde(default)]
    pub source_ref: Option<String>,
    #[serde(default)]
    pub source_refs: Vec<String>,
    #[serde(default)]
    pub capability_tags: Vec<String>,
    pub runtime_state: EvolutionRuntimeState,
    pub phase: EvolutionRuntimePhase,
    pub progress_pct: u8,
    pub message: String,
    pub can_cancel: bool,
    pub preview_stale: bool,
    pub conflict_detected: bool,
    pub override_applied: bool,
    pub active_conflict_operation_id: Option<String>,
    pub updated_at_ms: i64,
    pub created_at_ms: i64,
    pub history_entry: Option<EvolutionHistoryEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvolutionSnapshotRecord {
    pub snapshot_id: String,
    pub agent_id: String,
    pub node_label: String,
    pub source_document: String,
    pub content: String,
    pub created_at_ms: i64,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvolutionAuditEntry {
    pub operation_id: String,
    pub operation_kind: EvolutionOperationKind,
    pub status: EvolutionOperationStatus,
    pub agent_id: String,
    pub node_label: String,
    pub template: EvolutionTemplateKind,
    pub operation_type: EvolutionOperationType,
    pub snapshot_id: String,
    pub source_document: String,
    pub risk_level: String,
    pub source_ref: Option<String>,
    #[serde(default)]
    pub source_refs: Vec<String>,
    #[serde(default)]
    pub preflight_blocked: bool,
    #[serde(default)]
    pub blocked_reason_code: Option<String>,
    #[serde(default)]
    pub override_applied: bool,
    #[serde(default)]
    pub override_reason_code: Option<String>,
    pub capability_tags: Vec<String>,
    pub message: String,
    pub started_at_ms: i64,
    pub ended_at_ms: i64,
    pub duration_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvolutionMetricBucket {
    pub key: String,
    pub count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EvolutionAuditSummary {
    pub agent_id: String,
    pub total_operations: usize,
    pub success_count: usize,
    pub failed_count: usize,
    pub cancelled_count: usize,
    pub rolled_back_count: usize,
    pub high_risk_count: usize,
    pub unsafe_blocked_count: usize,
    pub preflight_blocked_count: usize,
    pub override_count: usize,
    pub last_24h_operations: usize,
    pub last_24h_failures: usize,
    pub last_24h_blocked: usize,
    pub last_7d_operations: usize,
    pub last_7d_failures: usize,
    pub last_7d_overrides: usize,
    pub average_duration_ms: Option<u64>,
    pub status_breakdown: Vec<EvolutionMetricBucket>,
    pub template_breakdown: Vec<EvolutionMetricBucket>,
    pub operation_type_breakdown: Vec<EvolutionMetricBucket>,
    pub blocked_reason_breakdown: Vec<EvolutionMetricBucket>,
    pub recent_daily_breakdown: Vec<EvolutionMetricBucket>,
    pub recent_entries: Vec<EvolutionAuditEntry>,
}

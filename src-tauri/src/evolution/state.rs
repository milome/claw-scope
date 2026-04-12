use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
};

use tokio::sync::Mutex;

use crate::evolution::types::{EvolutionOperationStatusSnapshot, EvolutionPreviewResult, EvolutionRuntimeState};

#[derive(Debug, Clone)]
pub struct PendingEvolutionOperation {
    pub preview: EvolutionPreviewResult,
    pub original_content: String,
    pub next_content: String,
}

#[derive(Debug)]
pub struct RuntimeEvolutionOperation {
    pub status: Arc<Mutex<EvolutionOperationStatusSnapshot>>,
    cancel_requested: Arc<AtomicBool>,
}

impl RuntimeEvolutionOperation {
    pub fn new(snapshot: EvolutionOperationStatusSnapshot) -> Self {
        Self {
            status: Arc::new(Mutex::new(snapshot)),
            cancel_requested: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn request_cancel(&self) {
        self.cancel_requested.store(true, Ordering::SeqCst);
    }

    pub fn is_cancel_requested(&self) -> bool {
        self.cancel_requested.load(Ordering::SeqCst)
    }
}

#[derive(Debug, Default, Clone)]
pub struct EvolutionAppState {
    pending: Arc<Mutex<HashMap<String, PendingEvolutionOperation>>>,
    runtime: Arc<Mutex<HashMap<String, Arc<RuntimeEvolutionOperation>>>>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum EvolutionRuntimeConflictKind {
    AgentRuntimeConflict,
    SourceDocumentConflict,
    SourceRefConflict,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct EvolutionRuntimeConflict {
    pub operation_id: String,
    pub kind: EvolutionRuntimeConflictKind,
    pub overlapping_source_refs: Vec<String>,
}

impl EvolutionAppState {
    pub async fn insert_pending(&self, operation: PendingEvolutionOperation) {
        self.pending
            .lock()
            .await
            .insert(operation.preview.operation_id.clone(), operation);
    }

    pub async fn take_pending(&self, operation_id: &str) -> Option<PendingEvolutionOperation> {
        self.pending.lock().await.remove(operation_id)
    }

    pub async fn insert_runtime(
        &self,
        snapshot: EvolutionOperationStatusSnapshot,
    ) -> Arc<RuntimeEvolutionOperation> {
        let operation_id = snapshot.operation_id.clone();
        let operation = Arc::new(RuntimeEvolutionOperation::new(snapshot));
        self.runtime
            .lock()
            .await
            .insert(operation_id, Arc::clone(&operation));
        operation
    }

    pub async fn runtime_operation(
        &self,
        operation_id: &str,
    ) -> Option<Arc<RuntimeEvolutionOperation>> {
        self.runtime.lock().await.get(operation_id).cloned()
    }

    pub async fn runtime_status_snapshot(
        &self,
        operation_id: &str,
    ) -> Option<EvolutionOperationStatusSnapshot> {
        let operation = self.runtime_operation(operation_id).await?;
        Some(operation.status.lock().await.clone())
    }

    pub async fn find_running_conflict_for_preview(
        &self,
        preview: &EvolutionPreviewResult,
        ignore_operation_id: &str,
    ) -> Option<EvolutionRuntimeConflict> {
        let operations = {
            let runtime = self.runtime.lock().await;
            runtime.values().cloned().collect::<Vec<_>>()
        };

        for operation in operations {
            let snapshot = operation.status.lock().await.clone();
            if snapshot.operation_id == ignore_operation_id {
                continue;
            }
            if snapshot.agent_id == preview.agent_id && snapshot.runtime_state == EvolutionRuntimeState::Running {
                let overlapping_source_refs = preview
                    .source_refs
                    .iter()
                    .filter(|source_ref| {
                        snapshot
                            .source_refs
                            .iter()
                            .any(|current| current.eq_ignore_ascii_case(source_ref))
                    })
                    .cloned()
                    .collect::<Vec<_>>();
                let kind = if !overlapping_source_refs.is_empty() {
                    EvolutionRuntimeConflictKind::SourceRefConflict
                } else if snapshot.source_document == preview.source_document {
                    EvolutionRuntimeConflictKind::SourceDocumentConflict
                } else {
                    EvolutionRuntimeConflictKind::AgentRuntimeConflict
                };
                return Some(EvolutionRuntimeConflict {
                    operation_id: snapshot.operation_id,
                    kind,
                    overlapping_source_refs,
                });
            }
        }
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    use crate::evolution::types::{
        EvolutionOperationStatusSnapshot, EvolutionOperationType, EvolutionRuntimePhase,
        EvolutionRuntimeState, EvolutionTemplateKind,
    };

    fn runtime_snapshot(operation_id: &str, agent_id: &str) -> EvolutionOperationStatusSnapshot {
        EvolutionOperationStatusSnapshot {
            operation_id: operation_id.to_string(),
            agent_id: agent_id.to_string(),
            node_label: agent_id.to_string(),
            template: EvolutionTemplateKind::Conservative,
            operation_type: EvolutionOperationType::Optimize,
            source_document: "MEMORY.md".to_string(),
            snapshot_id: format!("snap-{operation_id}"),
            risk_level: "low".to_string(),
            source_ref: None,
            source_refs: Vec::new(),
            capability_tags: Vec::new(),
            runtime_state: EvolutionRuntimeState::Running,
            phase: EvolutionRuntimePhase::ValidatingPreview,
            progress_pct: 5,
            message: "testing".to_string(),
            message_i18n: None,
            can_cancel: true,
            preview_stale: false,
            conflict_detected: false,
            override_applied: false,
            active_conflict_operation_id: None,
            updated_at_ms: 1,
            created_at_ms: 1,
            history_entry: None,
        }
    }

    #[tokio::test]
    async fn insert_runtime_exposes_status_snapshot() {
        let state = EvolutionAppState::default();
        state.insert_runtime(runtime_snapshot("op-a", "agent-a")).await;

        let snapshot = state
            .runtime_status_snapshot("op-a")
            .await
            .expect("status snapshot");
        assert_eq!(snapshot.operation_id, "op-a");
        assert_eq!(snapshot.agent_id, "agent-a");
        assert_eq!(snapshot.runtime_state, EvolutionRuntimeState::Running);
    }

    #[tokio::test]
    async fn detects_running_conflict_for_same_agent() {
        let state = EvolutionAppState::default();
        state.insert_runtime(runtime_snapshot("op-a", "agent-a")).await;
        state.insert_runtime(runtime_snapshot("op-b", "agent-b")).await;
        let preview = EvolutionPreviewResult {
            operation_id: "op-z".to_string(),
            agent_id: "agent-a".to_string(),
            node_label: "agent-a".to_string(),
            template: EvolutionTemplateKind::Conservative,
            operation_type: EvolutionOperationType::Optimize,
            source_document: "MEMORY.md".to_string(),
            snapshot_id: "snap-z".to_string(),
            risk_level: "low".to_string(),
            requires_confirmation: false,
            unsafe_apply: false,
            unsafe_reasons: Vec::new(),
            source_ref: None,
            source_refs: Vec::new(),
            capability_tags: Vec::new(),
            created_at_ms: 1,
            changes: Vec::new(),
            bytes_before: 0,
            bytes_after: 0,
        };

        let conflict = state
            .find_running_conflict_for_preview(&preview, "op-z")
            .await
            .expect("expected conflict");
        assert_eq!(conflict.operation_id, "op-a");
        assert_eq!(conflict.kind, EvolutionRuntimeConflictKind::SourceDocumentConflict);

        let no_conflict = state
            .find_running_conflict_for_preview(&preview, "op-a")
            .await;
        assert!(no_conflict.is_none());
    }

    #[tokio::test]
    async fn detects_source_ref_runtime_conflict() {
        let state = EvolutionAppState::default();
        let mut snapshot = runtime_snapshot("op-a", "agent-a");
        snapshot.source_refs = vec!["doc://ops-playbook".to_string()];
        state.insert_runtime(snapshot).await;
        let preview = EvolutionPreviewResult {
            operation_id: "op-z".to_string(),
            agent_id: "agent-a".to_string(),
            node_label: "agent-a".to_string(),
            template: EvolutionTemplateKind::KnowledgeInjection,
            operation_type: EvolutionOperationType::InjectKnowledge,
            source_document: "MEMORY.md".to_string(),
            snapshot_id: "snap-z".to_string(),
            risk_level: "medium".to_string(),
            requires_confirmation: false,
            unsafe_apply: false,
            unsafe_reasons: Vec::new(),
            source_ref: Some("doc://ops-playbook".to_string()),
            source_refs: vec!["doc://ops-playbook".to_string()],
            capability_tags: vec!["memory".to_string()],
            created_at_ms: 1,
            changes: Vec::new(),
            bytes_before: 0,
            bytes_after: 0,
        };

        let conflict = state
            .find_running_conflict_for_preview(&preview, "op-z")
            .await
            .expect("expected source ref conflict");
        assert_eq!(conflict.kind, EvolutionRuntimeConflictKind::SourceRefConflict);
        assert_eq!(conflict.overlapping_source_refs, vec!["doc://ops-playbook"]);
    }

    #[tokio::test]
    async fn request_cancel_sets_cancel_flag() {
        let state = EvolutionAppState::default();
        let runtime = state.insert_runtime(runtime_snapshot("op-a", "agent-a")).await;
        assert!(!runtime.is_cancel_requested());
        runtime.request_cancel();
        assert!(runtime.is_cancel_requested());
    }
}

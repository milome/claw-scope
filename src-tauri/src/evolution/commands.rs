use std::{
    collections::{BTreeMap, HashSet},
    sync::Arc,
    time::Duration,
};

use chrono::{Duration as ChronoDuration, TimeZone, Utc};
use rand::RngCore;
use serde::Deserialize;
use tauri::{AppHandle, Emitter, Runtime, State};
use tokio::time::sleep;

use crate::{
    evolution::{
        state::{EvolutionAppState, PendingEvolutionOperation, RuntimeEvolutionOperation},
        state::EvolutionRuntimeConflictKind,
        store::{
            append_audit, append_history, load_audit, load_history, load_snapshot,
            store_snapshot, EvolutionStorePaths,
        },
        types::{
            EvolutionAuditEntry, EvolutionAuditSummary, EvolutionExecuteResult,
            EvolutionCustomTemplateInput, EvolutionHistoryEntry, EvolutionLocalizedMessage,
            EvolutionKnowledgeInjectionInput, EvolutionMetricBucket, EvolutionOperationKind,
            EvolutionOperationStatus, EvolutionOperationStatusSnapshot, EvolutionOperationType,
            EvolutionPreviewChange, EvolutionPreviewResult, EvolutionRollbackResult,
            EvolutionRuntimePhase, EvolutionRuntimeState, EvolutionSnapshotRecord,
            EvolutionTemplateKind,
        },
    },
    gateway::{
        connector,
        errors::GatewayErrorSummary,
        state::GatewayAppState,
        types::GatewayAgentFileEntry,
    },
};

const EVOLUTION_STATUS_EVENT: &str = "evolution://status";
const EVOLUTION_CANCEL_WINDOW_MS: u64 = 320;

#[derive(Debug, Deserialize)]
#[serde(tag = "mode", rename_all = "snake_case")]
enum DeclarativeCustomTemplateScript {
    AppendBlock {
        title: Option<String>,
        content: String,
    },
    ReplaceText {
        find_text: String,
        replace_text: String,
        max_replacements: Option<usize>,
    },
    RemoveBlocksBySourceRef {
        source_ref: String,
    },
    DedupeLines,
}

#[tauri::command]
pub async fn evolution_preview(
    gateway_state: State<'_, GatewayAppState>,
    evolution_state: State<'_, EvolutionAppState>,
    agent_id: String,
    node_label: String,
    template: EvolutionTemplateKind,
    knowledge_input: Option<EvolutionKnowledgeInjectionInput>,
    custom_input: Option<EvolutionCustomTemplateInput>,
) -> Result<EvolutionPreviewResult, GatewayErrorSummary> {
    let memory = connector::agent_memory_get(gateway_state.inner().clone(), None, &agent_id)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))?;
    let source_document = resolve_source_document(&memory.documents).ok_or_else(|| {
        GatewayErrorSummary::new(
            "protocol",
            Some("EVOLUTION_MEMORY_NOT_FOUND".to_string()),
            "未找到可用于 Evolution 的 MEMORY 文档。".to_string(),
            false,
            Some("请确认目标 agent 暴露了 MEMORY.md 或 memory.md。".to_string()),
        )
    })?;

    let original_content = source_document.content.clone().unwrap_or_default();
    let knowledge_input = prepare_knowledge_input(template.clone(), knowledge_input)?;
    let custom_input = prepare_custom_input(template.clone(), custom_input)?;
    let (next_content, changes, risk_level) = build_preview_payload(
        original_content.as_str(),
        &template,
        source_document.name.as_str(),
        knowledge_input.as_ref(),
        custom_input.as_ref(),
    );
    let (requires_confirmation, unsafe_apply, unsafe_reasons) = derive_preview_safety(
        template.clone(),
        original_content.as_str(),
        &risk_level,
        knowledge_input.as_ref(),
        custom_input.as_ref(),
    );

    if original_content == next_content {
        return Err(GatewayErrorSummary::new(
            "protocol",
            Some("EVOLUTION_NO_ACTIONABLE_DIFF".to_string()),
            "当前目标文档未产生可执行差异。".to_string(),
            false,
            Some("请切换模板、连接真实目标节点，或先让文档产生可整理内容。".to_string()),
        ));
    }

    let preview = EvolutionPreviewResult {
        operation_id: random_id("evo-op"),
        agent_id: agent_id.clone(),
        node_label,
        template: template.clone(),
        operation_type: operation_type_for_template(&template),
        source_document: source_document.name.clone(),
        risk_level,
        requires_confirmation,
        unsafe_apply,
        unsafe_reasons,
        source_ref: knowledge_input
            .as_ref()
            .map(|input| input.source_ref.clone())
            .or_else(|| custom_input.as_ref().map(|input| input.source_ref.clone())),
        source_refs: knowledge_input
            .as_ref()
            .map(|input| collect_source_refs(input.source_ref.as_str(), &input.additional_source_refs))
            .or_else(|| {
                custom_input
                    .as_ref()
                    .map(|input| collect_source_refs(input.source_ref.as_str(), &input.additional_source_refs))
            })
            .unwrap_or_default(),
        capability_tags: knowledge_input
            .as_ref()
            .map(|input| input.capability_tags.clone())
            .or_else(|| custom_input.as_ref().map(|input| input.capability_tags.clone()))
            .unwrap_or_default(),
        changes,
        bytes_before: original_content.len(),
        bytes_after: next_content.len(),
        snapshot_id: random_id("evo-snap"),
        created_at_ms: Utc::now().timestamp_millis(),
    };

    evolution_state
        .insert_pending(PendingEvolutionOperation {
            preview: preview.clone(),
            original_content,
            next_content,
        })
        .await;

    Ok(preview)
}

#[tauri::command]
pub async fn evolution_execute_start(
    app: AppHandle,
    gateway_state: State<'_, GatewayAppState>,
    evolution_state: State<'_, EvolutionAppState>,
    operation_id: String,
    override_risk_ack: Option<bool>,
) -> Result<EvolutionOperationStatusSnapshot, GatewayErrorSummary> {
    start_execute_operation(
        app,
        gateway_state.inner().clone(),
        evolution_state.inner().clone(),
        operation_id.as_str(),
        override_risk_ack.unwrap_or(false),
    )
    .await
}

#[tauri::command]
pub async fn evolution_operation_status(
    evolution_state: State<'_, EvolutionAppState>,
    operation_id: String,
) -> Result<EvolutionOperationStatusSnapshot, GatewayErrorSummary> {
    evolution_state
        .runtime_status_snapshot(operation_id.as_str())
        .await
        .ok_or_else(|| {
            GatewayErrorSummary::new(
                "protocol",
                Some("EVOLUTION_OPERATION_STATUS_NOT_FOUND".to_string()),
                "未找到对应的 Evolution 运行状态。".to_string(),
                false,
                Some("请重新执行 Analyze & Preview，或刷新当前页面。".to_string()),
            )
        })
}

#[tauri::command]
pub async fn evolution_cancel(
    app: AppHandle,
    evolution_state: State<'_, EvolutionAppState>,
    operation_id: String,
) -> Result<EvolutionOperationStatusSnapshot, GatewayErrorSummary> {
    cancel_operation(app, evolution_state.inner().clone(), operation_id.as_str()).await
}

async fn cancel_operation<R: Runtime>(
    app: AppHandle<R>,
    evolution_state: EvolutionAppState,
    operation_id: &str,
) -> Result<EvolutionOperationStatusSnapshot, GatewayErrorSummary> {
    let operation = evolution_state
        .runtime_operation(operation_id)
        .await
        .ok_or_else(|| {
            GatewayErrorSummary::new(
                "protocol",
                Some("EVOLUTION_OPERATION_STATUS_NOT_FOUND".to_string()),
                "未找到对应的 Evolution 运行状态。".to_string(),
                false,
                Some("请刷新页面后重试。".to_string()),
            )
        })?;

    let next_snapshot = {
        let mut status = operation.status.lock().await;
        if matches!(
            status.runtime_state,
            EvolutionRuntimeState::Succeeded
                | EvolutionRuntimeState::Failed
                | EvolutionRuntimeState::Cancelled
        ) {
            return Ok(status.clone());
        }
        if !status.can_cancel {
            return Err(GatewayErrorSummary::new(
                "protocol",
                Some("EVOLUTION_CANCEL_NOT_ALLOWED".to_string()),
                "当前阶段已进入不可取消区间。".to_string(),
                false,
                Some("请等待当前执行完成后查看结果或使用回滚。".to_string()),
            ));
        }
        operation.request_cancel();
        status.can_cancel = false;
        status.message = "已收到取消请求，正在等待安全中止点。".to_string();
        status.message_i18n = Some(localized_message(
            "evo.message.runtime.cancelRequested",
            Vec::new(),
        ));
        status.updated_at_ms = Utc::now().timestamp_millis();
        status.clone()
    };
    emit_status(&app, &next_snapshot);
    Ok(next_snapshot)
}

#[tauri::command]
pub async fn evolution_execute(
    app: AppHandle,
    gateway_state: State<'_, GatewayAppState>,
    evolution_state: State<'_, EvolutionAppState>,
    operation_id: String,
) -> Result<EvolutionExecuteResult, GatewayErrorSummary> {
    let snapshot = start_execute_operation(
        app,
        gateway_state.inner().clone(),
        evolution_state.inner().clone(),
        operation_id.as_str(),
        true,
    )
    .await?;

    loop {
        sleep(Duration::from_millis(150)).await;
        let current = evolution_state
            .runtime_status_snapshot(snapshot.operation_id.as_str())
            .await
            .ok_or_else(|| {
                GatewayErrorSummary::new(
                    "protocol",
                    Some("EVOLUTION_OPERATION_STATUS_NOT_FOUND".to_string()),
                    "未找到对应的 Evolution 运行状态。".to_string(),
                    false,
                    Some("请重新执行 Analyze & Preview。".to_string()),
                )
            })?;

        match current.runtime_state {
            EvolutionRuntimeState::Succeeded => {
                let history_entry = current.history_entry.clone().ok_or_else(|| {
                    GatewayErrorSummary::new(
                        "protocol",
                        Some("EVOLUTION_HISTORY_ENTRY_MISSING".to_string()),
                        "Evolution 执行已完成，但缺少历史记录。".to_string(),
                        false,
                        Some("请检查 history 存储逻辑。".to_string()),
                    )
                })?;
                return Ok(EvolutionExecuteResult {
                    operation_id: current.operation_id,
                    snapshot_id: current.snapshot_id,
                    history_entry,
                });
            }
            EvolutionRuntimeState::Failed => {
                return Err(GatewayErrorSummary::new(
                    "protocol",
                    Some("EVOLUTION_EXECUTION_FAILED".to_string()),
                    current.message,
                    false,
                    Some("请检查当前 preview 是否已失效，或查看右侧历史与错误信息。".to_string()),
                ));
            }
            EvolutionRuntimeState::Cancelled => {
                return Err(GatewayErrorSummary::new(
                    "protocol",
                    Some("EVOLUTION_EXECUTION_CANCELLED".to_string()),
                    current.message,
                    false,
                    Some("当前操作已取消，请重新执行 Analyze & Preview 后再试。".to_string()),
                ));
            }
            EvolutionRuntimeState::PreviewReady | EvolutionRuntimeState::Running => continue,
        }
    }
}

#[tauri::command]
pub async fn evolution_history_list(
    agent_id: String,
) -> Result<Vec<EvolutionHistoryEntry>, GatewayErrorSummary> {
    let store_paths = EvolutionStorePaths::resolve();
    let mut history =
        load_history(&store_paths).map_err(|error| GatewayErrorSummary::from_error(&error))?;
    history.retain(|entry| entry.agent_id == agent_id);
    history.sort_by_key(|entry| std::cmp::Reverse(entry.created_at_ms));
    Ok(history)
}

#[tauri::command]
pub async fn evolution_audit_summary(
    agent_id: String,
) -> Result<EvolutionAuditSummary, GatewayErrorSummary> {
    let store_paths = EvolutionStorePaths::resolve();
    let mut audit =
        load_audit(&store_paths).map_err(|error| GatewayErrorSummary::from_error(&error))?;
    audit.retain(|entry| entry.agent_id == agent_id);
    audit.sort_by_key(|entry| std::cmp::Reverse(entry.ended_at_ms));
    Ok(summarize_audit_entries(agent_id, audit))
}

#[tauri::command]
pub async fn evolution_rollback(
    gateway_state: State<'_, GatewayAppState>,
    agent_id: String,
    snapshot_id: String,
) -> Result<EvolutionRollbackResult, GatewayErrorSummary> {
    let store_paths = EvolutionStorePaths::resolve();
    let started_at_ms = Utc::now().timestamp_millis();
    let snapshot = load_snapshot(&store_paths, snapshot_id.as_str())
        .map_err(|error| GatewayErrorSummary::from_error(&error))?;

    if snapshot.agent_id != agent_id {
        return Err(GatewayErrorSummary::new(
            "protocol",
            Some("EVOLUTION_SNAPSHOT_AGENT_MISMATCH".to_string()),
            "所选快照不属于当前 agent。".to_string(),
            false,
            Some("请刷新历史列表后重试。".to_string()),
        ));
    }

    connector::agent_memory_set(
        gateway_state.inner().clone(),
        None,
        agent_id.as_str(),
        snapshot.source_document.as_str(),
        snapshot.content.as_str(),
    )
    .await
    .map_err(|error| GatewayErrorSummary::from_error(&error))?;

    let _ = connector::agent_memory_index(
        gateway_state.inner().clone(),
        None,
        agent_id.as_str(),
        true,
    )
        .await;

    let rollback_message_i18n = localized_message(
        "evo.message.rollback.restored",
        vec![snapshot.snapshot_id.clone()],
    );
    let history_entry = EvolutionHistoryEntry {
        operation_id: random_id("evo-rb"),
        operation_kind: EvolutionOperationKind::Rollback,
        status: EvolutionOperationStatus::RolledBack,
        agent_id,
        node_label: snapshot.node_label.clone(),
        template: EvolutionTemplateKind::Conservative,
        operation_type: EvolutionOperationType::RestoreSnapshot,
        snapshot_id: snapshot.snapshot_id.clone(),
        source_document: snapshot.source_document.clone(),
        source_ref: None,
        source_refs: Vec::new(),
        capability_tags: Vec::new(),
        summary: format!("rollback restored snapshot {}", snapshot.snapshot_id),
        summary_i18n: Some(rollback_message_i18n.clone()),
        bytes_before: snapshot.content.len(),
        bytes_after: snapshot.content.len(),
        duration_ms: Some((Utc::now().timestamp_millis() - started_at_ms).max(0) as u64),
        created_at_ms: Utc::now().timestamp_millis(),
    };
    append_history(&store_paths, &history_entry)
        .map_err(|error| GatewayErrorSummary::from_error(&error))?;
    append_audit(
        &store_paths,
        &EvolutionAuditEntry {
            operation_id: history_entry.operation_id.clone(),
            operation_kind: EvolutionOperationKind::Rollback,
            status: EvolutionOperationStatus::RolledBack,
            agent_id: history_entry.agent_id.clone(),
            node_label: history_entry.node_label.clone(),
            template: history_entry.template.clone(),
            operation_type: EvolutionOperationType::RestoreSnapshot,
            snapshot_id: history_entry.snapshot_id.clone(),
            source_document: history_entry.source_document.clone(),
            risk_level: "rollback".to_string(),
            source_ref: None,
            source_refs: Vec::new(),
            preflight_blocked: false,
            blocked_reason_code: None,
            override_applied: false,
            override_reason_code: None,
            capability_tags: Vec::new(),
            message: history_entry.summary.clone(),
            message_i18n: Some(rollback_message_i18n),
            started_at_ms,
            ended_at_ms: history_entry.created_at_ms,
            duration_ms: history_entry.duration_ms.unwrap_or_default(),
        },
    )
    .map_err(|error| GatewayErrorSummary::from_error(&error))?;

    Ok(EvolutionRollbackResult {
        operation_id: history_entry.operation_id.clone(),
        restored_snapshot_id: snapshot.snapshot_id,
        history_entry,
    })
}

async fn start_execute_operation<R: Runtime>(
    app: AppHandle<R>,
    gateway_state: GatewayAppState,
    evolution_state: EvolutionAppState,
    operation_id: &str,
    override_risk_ack: bool,
) -> Result<EvolutionOperationStatusSnapshot, GatewayErrorSummary> {
    let pending = evolution_state
        .take_pending(operation_id)
        .await
        .ok_or_else(|| {
            GatewayErrorSummary::new(
                "protocol",
                Some("EVOLUTION_PENDING_OPERATION_NOT_FOUND".to_string()),
                "未找到可执行的 Evolution 预览结果。".to_string(),
                false,
                Some("请先重新执行 Analyze & Preview。".to_string()),
            )
        })?;

    if pending.preview.unsafe_apply {
        let store_paths = EvolutionStorePaths::resolve();
        let unsafe_reason = if pending.preview.unsafe_reasons.is_empty() {
            "当前 preview 被标记为 unsafe apply。".to_string()
        } else {
            pending.preview.unsafe_reasons.join(" ")
        };
        let unsafe_message_i18n = localized_message(
            "evo.message.preflight.unsafeApply",
            vec![unsafe_reason.clone()],
        );
        let _ = append_audit(
            &store_paths,
            &build_preflight_blocked_audit_entry(
                &pending.preview,
                unsafe_reason.as_str(),
                Some(unsafe_message_i18n),
                "EVOLUTION_UNSAFE_APPLY_BLOCKED",
            ),
        );
        evolution_state.insert_pending(pending).await;
        return Err(GatewayErrorSummary::new(
            "protocol",
            Some("EVOLUTION_UNSAFE_APPLY_BLOCKED".to_string()),
            unsafe_reason,
            false,
            Some("请调整模板输入后重新执行 Analyze & Preview。".to_string()),
        ));
    }

    if pending.preview.requires_confirmation && !override_risk_ack {
        let store_paths = EvolutionStorePaths::resolve();
        let message = "高风险进化尚未确认，当前不允许直接执行。";
        let _ = append_audit(
            &store_paths,
            &build_preflight_blocked_audit_entry(
                &pending.preview,
                message,
                Some(localized_message(
                    "evo.message.preflight.confirmationRequired",
                    Vec::new(),
                )),
                "EVOLUTION_HIGH_RISK_CONFIRMATION_REQUIRED",
            ),
        );
        evolution_state.insert_pending(pending).await;
        return Err(GatewayErrorSummary::new(
            "protocol",
            Some("EVOLUTION_HIGH_RISK_CONFIRMATION_REQUIRED".to_string()),
            message.to_string(),
            false,
            Some("请先完成高风险确认，再重新执行。".to_string()),
        ));
    }

    if let Some(conflict) = evolution_state
        .find_running_conflict_for_preview(&pending.preview, pending.preview.operation_id.as_str())
        .await
    {
        let store_paths = EvolutionStorePaths::resolve();
        let (blocked_reason_code, message, message_i18n) = match conflict.kind {
            EvolutionRuntimeConflictKind::SourceRef => (
                "EVOLUTION_RUNTIME_SOURCE_REF_CONFLICT",
                format!(
                    "当前节点已有运行中的 Evolution 正在占用本次来源引用 {}，阻断本次预检执行：{}",
                    conflict.overlapping_source_refs.join(", "),
                    conflict.operation_id
                ),
                localized_message(
                    "evo.message.preflight.runtimeSourceRefConflict",
                    vec![
                        conflict.overlapping_source_refs.join(", "),
                        conflict.operation_id.clone(),
                    ],
                ),
            ),
            EvolutionRuntimeConflictKind::SourceDocument => (
                "EVOLUTION_RUNTIME_SOURCE_DOCUMENT_CONFLICT",
                format!(
                    "当前节点已有运行中的 Evolution 正在占用目标文档 {}，阻断本次预检执行：{}",
                    pending.preview.source_document,
                    conflict.operation_id
                ),
                localized_message(
                    "evo.message.preflight.runtimeSourceDocumentConflict",
                    vec![
                        pending.preview.source_document.clone(),
                        conflict.operation_id.clone(),
                    ],
                ),
            ),
            EvolutionRuntimeConflictKind::AgentRuntime => (
                "EVOLUTION_RUNTIME_AGENT_CONFLICT",
                format!(
                    "当前节点已有 Evolution 操作正在执行，阻断本次预检执行：{}",
                    conflict.operation_id
                ),
                localized_message(
                    "evo.message.preflight.runtimeAgentConflict",
                    vec![conflict.operation_id.clone()],
                ),
            ),
        };
        let _ = append_audit(
            &store_paths,
            &build_preflight_blocked_audit_entry(
                &pending.preview,
                message.as_str(),
                Some(message_i18n),
                blocked_reason_code,
            ),
        );
        evolution_state.insert_pending(pending).await;
        return Err(GatewayErrorSummary::new(
            "protocol",
            Some(blocked_reason_code.to_string()),
            message,
            true,
            Some(format!(
                "请等待正在运行的操作完成，或取消该操作后再试：{}",
                conflict.operation_id
            )),
        ));
    }

    let current_content = load_current_source_content(
        gateway_state.clone(),
        pending.preview.agent_id.as_str(),
        pending.preview.source_document.as_str(),
    )
    .await?;

    if current_content != pending.original_content {
        let store_paths = EvolutionStorePaths::resolve();
        let (blocked_reason_code, message, message_i18n) = classify_preflight_drift(
            &pending.preview,
            pending.original_content.as_str(),
            current_content.as_str(),
            pending.next_content.as_str(),
        );
        let _ = append_audit(
            &store_paths,
            &build_preflight_blocked_audit_entry(
                &pending.preview,
                message.as_str(),
                Some(message_i18n),
                blocked_reason_code,
            ),
        );
        return Err(GatewayErrorSummary::new(
            "protocol",
            Some(blocked_reason_code.to_string()),
            message,
            false,
            Some("请重新执行 Analyze & Preview，确认最新差异后再执行。".to_string()),
        ));
    }

    let now = Utc::now().timestamp_millis();
    let initial_snapshot = EvolutionOperationStatusSnapshot {
        operation_id: pending.preview.operation_id.clone(),
        agent_id: pending.preview.agent_id.clone(),
        node_label: pending.preview.node_label.clone(),
        template: pending.preview.template.clone(),
        operation_type: pending.preview.operation_type.clone(),
        source_document: pending.preview.source_document.clone(),
        snapshot_id: pending.preview.snapshot_id.clone(),
        risk_level: pending.preview.risk_level.clone(),
        source_ref: pending.preview.source_ref.clone(),
        source_refs: pending.preview.source_refs.clone(),
        capability_tags: pending.preview.capability_tags.clone(),
        runtime_state: EvolutionRuntimeState::Running,
        phase: EvolutionRuntimePhase::ValidatingPreview,
        progress_pct: 5,
        message: "已完成预览校验，准备进入执行阶段。".to_string(),
        message_i18n: Some(localized_message("evo.message.runtime.validated", Vec::new())),
        can_cancel: true,
        preview_stale: false,
        conflict_detected: false,
        override_applied: override_risk_ack,
        active_conflict_operation_id: None,
        updated_at_ms: now,
        created_at_ms: now,
        history_entry: None,
    };
    let runtime = evolution_state.insert_runtime(initial_snapshot.clone()).await;
    emit_status(&app, &initial_snapshot);

    let background_app = app.clone();
    let background_gateway = gateway_state.clone();
    let background_evolution = evolution_state.clone();
    tokio::spawn(async move {
        execute_operation_task(
            background_app,
            background_gateway,
            background_evolution,
            pending,
            runtime,
        )
        .await;
    });

    Ok(initial_snapshot)
}

async fn execute_operation_task<R: Runtime>(
    app: AppHandle<R>,
    gateway_state: GatewayAppState,
    evolution_state: EvolutionAppState,
    pending: PendingEvolutionOperation,
    runtime: Arc<RuntimeEvolutionOperation>,
) {
    let store_paths = EvolutionStorePaths::resolve();
    let started_at_ms = { runtime.status.lock().await.created_at_ms };
    let override_applied = { runtime.status.lock().await.override_applied };

    update_runtime_status(
        &app,
        &runtime,
        RuntimeStatusUpdate {
            phase: EvolutionRuntimePhase::Snapshotting,
            progress_pct: 20,
            message: "正在创建回滚快照。",
            message_i18n: Some(localized_message("evo.message.runtime.snapshotting", Vec::new())),
            can_cancel: true,
            history_entry: None,
        },
    )
    .await;
    sleep(Duration::from_millis(EVOLUTION_CANCEL_WINDOW_MS)).await;
    if runtime.is_cancel_requested() {
        let history_entry = build_terminal_history_entry(
            &pending.preview,
            EvolutionOperationStatus::Cancelled,
            "cancelled before apply",
            Some(localized_message(
                "evo.message.execute.cancelled.beforeApply",
                Vec::new(),
            )),
            pending.preview.bytes_before,
            pending.preview.bytes_before,
            Some(elapsed_ms(started_at_ms)),
        );
        let _ = append_history(&store_paths, &history_entry);
        let _ = append_audit(
            &store_paths,
            &build_audit_entry(
                &pending.preview,
                &history_entry,
                "已在应用变更前取消本次 Evolution。",
                Some(localized_message(
                    "evo.message.execute.cancelled.beforeApply",
                    Vec::new(),
                )),
                started_at_ms,
                override_applied,
            ),
        );
        let _ = set_terminal_status(
            &app,
            &runtime,
            EvolutionRuntimeState::Cancelled,
            EvolutionRuntimePhase::Cancelled,
            "已在应用变更前取消本次 Evolution。",
            Some(localized_message(
                "evo.message.execute.cancelled.beforeApply",
                Vec::new(),
            )),
            Some(history_entry),
        )
        .await;
        return;
    }

    let snapshot = EvolutionSnapshotRecord {
        snapshot_id: pending.preview.snapshot_id.clone(),
        agent_id: pending.preview.agent_id.clone(),
        node_label: pending.preview.node_label.clone(),
        source_document: pending.preview.source_document.clone(),
        content: pending.original_content.clone(),
        created_at_ms: Utc::now().timestamp_millis(),
        reason: format!("execute:{:?}", pending.preview.template),
    };
    if let Err(error) = store_snapshot(&store_paths, &snapshot) {
        let error_message = error.to_string();
        let history_entry = build_terminal_history_entry(
            &pending.preview,
            EvolutionOperationStatus::Failed,
            format!("failed to create snapshot: {error}").as_str(),
            Some(localized_message(
                "evo.message.execute.failed.snapshotCreate",
                vec![error_message.clone()],
            )),
            pending.preview.bytes_before,
            pending.preview.bytes_before,
            Some(elapsed_ms(started_at_ms)),
        );
        let _ = append_history(&store_paths, &history_entry);
        let _ = append_audit(
            &store_paths,
            &build_audit_entry(
                &pending.preview,
                &history_entry,
                "创建回滚快照失败，执行已终止。",
                Some(localized_message(
                    "evo.message.execute.failed.snapshotCreate",
                    vec![error_message.clone()],
                )),
                started_at_ms,
                override_applied,
            ),
        );
        let _ = set_terminal_status(
            &app,
            &runtime,
            EvolutionRuntimeState::Failed,
            EvolutionRuntimePhase::Failed,
            "创建回滚快照失败，执行已终止。",
            Some(localized_message(
                "evo.message.execute.failed.snapshotCreate",
                vec![error_message],
            )),
            Some(history_entry),
        )
        .await;
        return;
    }

    update_runtime_status(
        &app,
        &runtime,
        RuntimeStatusUpdate {
            phase: EvolutionRuntimePhase::ApplyingChanges,
            progress_pct: 55,
            message: "正在写入进化后的文档内容。",
            message_i18n: Some(localized_message("evo.message.runtime.applyingChanges", Vec::new())),
            can_cancel: false,
            history_entry: None,
        },
    )
    .await;
    sleep(Duration::from_millis(EVOLUTION_CANCEL_WINDOW_MS)).await;
    if runtime.is_cancel_requested() {
        let history_entry = build_terminal_history_entry(
            &pending.preview,
            EvolutionOperationStatus::Cancelled,
            "cancelled after snapshot, before apply",
            Some(localized_message(
                "evo.message.execute.cancelled.beforeWrite",
                Vec::new(),
            )),
            pending.preview.bytes_before,
            pending.preview.bytes_before,
            Some(elapsed_ms(started_at_ms)),
        );
        let _ = append_history(&store_paths, &history_entry);
        let _ = append_audit(
            &store_paths,
            &build_audit_entry(
                &pending.preview,
                &history_entry,
                "已在写入变更前取消本次 Evolution。",
                Some(localized_message(
                    "evo.message.execute.cancelled.beforeWrite",
                    Vec::new(),
                )),
                started_at_ms,
                override_applied,
            ),
        );
        let _ = set_terminal_status(
            &app,
            &runtime,
            EvolutionRuntimeState::Cancelled,
            EvolutionRuntimePhase::Cancelled,
            "已在写入变更前取消本次 Evolution。",
            Some(localized_message(
                "evo.message.execute.cancelled.beforeWrite",
                Vec::new(),
            )),
            Some(history_entry),
        )
        .await;
        return;
    }

    if let Err(error) = connector::agent_memory_set(
        gateway_state.clone(),
        None,
        pending.preview.agent_id.as_str(),
        pending.preview.source_document.as_str(),
        pending.next_content.as_str(),
    )
    .await
    {
        let error_message = error.to_string();
        let history_entry = build_terminal_history_entry(
            &pending.preview,
            EvolutionOperationStatus::Failed,
            format!("failed during apply: {error}").as_str(),
            Some(localized_message(
                "evo.message.execute.failed.apply",
                vec![error_message.clone()],
            )),
            pending.preview.bytes_before,
            pending.preview.bytes_before,
            Some(elapsed_ms(started_at_ms)),
        );
        let _ = append_history(&store_paths, &history_entry);
        let _ = append_audit(
            &store_paths,
            &build_audit_entry(
                &pending.preview,
                &history_entry,
                "写入目标文档失败，Evolution 已终止。",
                Some(localized_message(
                    "evo.message.execute.failed.applyWriteTarget",
                    Vec::new(),
                )),
                started_at_ms,
                override_applied,
            ),
        );
        let _ = set_terminal_status(
            &app,
            &runtime,
            EvolutionRuntimeState::Failed,
            EvolutionRuntimePhase::Failed,
            "写入目标文档失败，Evolution 已终止。",
            Some(localized_message(
                "evo.message.execute.failed.applyWriteTarget",
                Vec::new(),
            )),
            Some(history_entry),
        )
        .await;
        return;
    }

    update_runtime_status(
        &app,
        &runtime,
        RuntimeStatusUpdate {
            phase: EvolutionRuntimePhase::Reindexing,
            progress_pct: 80,
            message: "正在触发索引刷新与后处理。",
            message_i18n: Some(localized_message("evo.message.runtime.reindexing", Vec::new())),
            can_cancel: false,
            history_entry: None,
        },
    )
    .await;
    sleep(Duration::from_millis(EVOLUTION_CANCEL_WINDOW_MS)).await;

    let index_warning = connector::agent_memory_index(
        gateway_state.clone(),
        None,
        pending.preview.agent_id.as_str(),
        true,
    )
    .await
    .err()
    .map(|error| error.to_string());

    update_runtime_status(
        &app,
        &runtime,
        RuntimeStatusUpdate {
            phase: EvolutionRuntimePhase::Finalizing,
            progress_pct: 95,
            message: "正在收尾并写入历史记录。",
            message_i18n: Some(localized_message("evo.message.runtime.finalizing", Vec::new())),
            can_cancel: false,
            history_entry: None,
        },
    )
    .await;

    let ended_at_ms = Utc::now().timestamp_millis();
    let duration_ms = (ended_at_ms - started_at_ms).max(0) as u64;
    let (summary, summary_i18n) = build_success_summary(&pending.preview, index_warning.as_deref());

    let history_entry = EvolutionHistoryEntry {
        operation_id: pending.preview.operation_id.clone(),
        operation_kind: EvolutionOperationKind::Execute,
        status: EvolutionOperationStatus::Success,
        agent_id: pending.preview.agent_id.clone(),
        node_label: pending.preview.node_label.clone(),
        template: pending.preview.template.clone(),
        operation_type: pending.preview.operation_type.clone(),
        snapshot_id: pending.preview.snapshot_id.clone(),
        source_document: pending.preview.source_document.clone(),
        source_ref: pending.preview.source_ref.clone(),
        source_refs: pending.preview.source_refs.clone(),
        capability_tags: pending.preview.capability_tags.clone(),
        summary,
        summary_i18n: Some(summary_i18n),
        bytes_before: pending.preview.bytes_before,
        bytes_after: pending.preview.bytes_after,
        duration_ms: Some(duration_ms),
        created_at_ms: ended_at_ms,
    };
    if let Err(error) = append_history(&store_paths, &history_entry) {
        let error_message = error.to_string();
        let failure_entry = build_terminal_history_entry(
            &pending.preview,
            EvolutionOperationStatus::Failed,
            format!("failed to append history: {error}").as_str(),
            Some(localized_message(
                "evo.message.execute.failed.historyAppend",
                vec![error_message.clone()],
            )),
            pending.preview.bytes_before,
            pending.preview.bytes_after,
            Some(elapsed_ms(started_at_ms)),
        );
        let _ = append_history(&store_paths, &failure_entry);
        let _ = append_audit(
            &store_paths,
            &build_audit_entry(
                &pending.preview,
                &failure_entry,
                "Evolution 已写入文档，但写入历史记录失败。",
                Some(localized_message(
                    "evo.message.execute.failed.historyAppendAudit",
                    Vec::new(),
                )),
                started_at_ms,
                override_applied,
            ),
        );
        let _ = set_terminal_status(
            &app,
            &runtime,
            EvolutionRuntimeState::Failed,
            EvolutionRuntimePhase::Failed,
            "Evolution 已写入文档，但写入历史记录失败。",
            Some(localized_message(
                "evo.message.execute.failed.historyAppendAudit",
                Vec::new(),
            )),
            Some(failure_entry),
        )
        .await;
        return;
    }

    let _ = append_audit(
        &store_paths,
        &build_audit_entry(
            &pending.preview,
            &history_entry,
            "Evolution 执行完成。",
            Some(localized_message("evo.message.execute.completed", Vec::new())),
            started_at_ms,
            override_applied,
        ),
    );

    let _ = set_terminal_status(
        &app,
        &runtime,
        EvolutionRuntimeState::Succeeded,
        EvolutionRuntimePhase::Completed,
        "Evolution 执行完成。",
        Some(localized_message("evo.message.execute.completed", Vec::new())),
        Some(history_entry),
    )
    .await;
    let _ = evolution_state;
}

fn build_preview_payload(
    original_content: &str,
    template: &EvolutionTemplateKind,
    source_document: &str,
    knowledge_input: Option<&EvolutionKnowledgeInjectionInput>,
    custom_input: Option<&EvolutionCustomTemplateInput>,
) -> (String, Vec<EvolutionPreviewChange>, String) {
    match template {
        EvolutionTemplateKind::Conservative => {
            build_conservative_preview(original_content, source_document)
        }
        EvolutionTemplateKind::Aggressive => {
            build_aggressive_preview(original_content, source_document)
        }
        EvolutionTemplateKind::KnowledgeInjection => {
            build_knowledge_injection_preview(
                original_content,
                source_document,
                knowledge_input.expect("knowledge injection input required"),
            )
        }
        EvolutionTemplateKind::CustomTemplate => build_custom_template_preview(
            original_content,
            source_document,
            custom_input.expect("custom template input required"),
        ),
    }
}

fn prepare_knowledge_input(
    template: EvolutionTemplateKind,
    knowledge_input: Option<EvolutionKnowledgeInjectionInput>,
) -> Result<Option<EvolutionKnowledgeInjectionInput>, GatewayErrorSummary> {
    if template != EvolutionTemplateKind::KnowledgeInjection {
        return Ok(None);
    }

    let Some(mut input) = knowledge_input else {
        return Err(GatewayErrorSummary::new(
            "protocol",
            Some("EVOLUTION_KNOWLEDGE_INPUT_REQUIRED".to_string()),
            "知识注入模板缺少必要输入。".to_string(),
            false,
            Some("请填写来源引用、能力标签和知识内容后再执行 Analyze & Preview。".to_string()),
        ));
    };

    input.source_ref = input.source_ref.trim().to_string();
    input.additional_source_refs = sanitize_source_refs(input.additional_source_refs);
    input.additional_source_refs.retain(|value| !value.eq_ignore_ascii_case(&input.source_ref));
    input.knowledge_body = input.knowledge_body.trim().to_string();
    input.capability_tags = sanitize_capability_tags(input.capability_tags);

    if input.source_ref.is_empty() || input.knowledge_body.is_empty() {
        return Err(GatewayErrorSummary::new(
            "protocol",
            Some("EVOLUTION_KNOWLEDGE_INPUT_INVALID".to_string()),
            "知识注入模板需要非空的来源引用和知识内容。".to_string(),
            false,
            Some("请至少填写来源引用和正文内容。".to_string()),
        ));
    }

    Ok(Some(input))
}

fn sanitize_capability_tags(tags: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();
    for tag in tags {
        let tag = tag.trim().to_string();
        if tag.is_empty() {
            continue;
        }
        if seen.insert(tag.to_lowercase()) {
            normalized.push(tag);
        }
    }
    normalized
}

fn sanitize_source_refs(source_refs: Vec<String>) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();
    for value in source_refs {
        let value = value.trim().to_string();
        if value.is_empty() {
            continue;
        }
        if seen.insert(value.to_lowercase()) {
            normalized.push(value);
        }
    }
    normalized
}

fn collect_source_refs(primary_source_ref: &str, additional_source_refs: &[String]) -> Vec<String> {
    let mut seen = HashSet::new();
    let mut normalized = Vec::new();
    for value in std::iter::once(primary_source_ref.to_string())
        .chain(additional_source_refs.iter().cloned())
    {
        let value = value.trim().to_string();
        if value.is_empty() {
            continue;
        }
        if seen.insert(value.to_lowercase()) {
            normalized.push(value);
        }
    }
    normalized
}

fn find_duplicate_source_refs(original_content: &str, source_refs: &[String]) -> Vec<String> {
    source_refs
        .iter()
        .filter(|source_ref| original_content.contains(source_ref.as_str()))
        .cloned()
        .collect()
}

fn summarize_source_refs(source_refs: &[String], fallback: Option<&str>) -> String {
    if let Some(first) = source_refs.first() {
        if source_refs.len() > 1 {
            format!("{first} (+{} more refs)", source_refs.len() - 1)
        } else {
            first.clone()
        }
    } else {
        fallback.unwrap_or("unknown source").to_string()
    }
}

fn classify_preflight_drift(
    preview: &EvolutionPreviewResult,
    original_content: &str,
    current_content: &str,
    next_content: &str,
) -> (&'static str, String, EvolutionLocalizedMessage) {
    if current_content == next_content {
        return (
            "EVOLUTION_ALREADY_APPLIED",
            "当前目标文档已经等于本次 preview 的目标结果，说明该 Evolution 结果已被应用。".to_string(),
            localized_message("evo.message.preflight.alreadyApplied", Vec::new()),
        );
    }

    let conflicting_refs = preview
        .source_refs
        .iter()
        .filter(|source_ref| {
            !original_content.contains(source_ref.as_str()) && current_content.contains(source_ref.as_str())
        })
        .cloned()
        .collect::<Vec<_>>();
    if !conflicting_refs.is_empty() {
        return (
            "EVOLUTION_SOURCE_REF_CONFLICT",
            format!(
                "当前 preview 已失效，目标文档在预览后出现了本次来源引用 {}，存在外部写入或重复应用风险。",
                conflicting_refs.join(", ")
            ),
            localized_message(
                "evo.message.preflight.sourceRefConflict",
                vec![conflicting_refs.join(", ")],
            ),
        );
    }

    (
        "EVOLUTION_PREVIEW_STALE",
        "当前 preview 已失效，目标文档在预览后发生了变化。".to_string(),
        localized_message("evo.message.preflight.previewStale", Vec::new()),
    )
}

fn prepare_custom_input(
    template: EvolutionTemplateKind,
    custom_input: Option<EvolutionCustomTemplateInput>,
) -> Result<Option<EvolutionCustomTemplateInput>, GatewayErrorSummary> {
    if template != EvolutionTemplateKind::CustomTemplate {
        return Ok(None);
    }

    let Some(mut input) = custom_input else {
        return Err(GatewayErrorSummary::new(
            "protocol",
            Some("EVOLUTION_CUSTOM_TEMPLATE_INPUT_REQUIRED".to_string()),
            "自定义模板缺少必要输入。".to_string(),
            false,
            Some("请填写来源引用、能力标签和脚本内容后再执行 Analyze & Preview。".to_string()),
        ));
    };

    input.source_ref = input.source_ref.trim().to_string();
    input.additional_source_refs = sanitize_source_refs(input.additional_source_refs);
    input.additional_source_refs.retain(|value| !value.eq_ignore_ascii_case(&input.source_ref));
    input.script_body = input.script_body.trim().to_string();
    input.capability_tags = sanitize_capability_tags(input.capability_tags);

    if input.source_ref.is_empty() || input.script_body.is_empty() {
        return Err(GatewayErrorSummary::new(
            "protocol",
            Some("EVOLUTION_CUSTOM_TEMPLATE_INPUT_INVALID".to_string()),
            "自定义模板需要非空的来源引用与脚本内容。".to_string(),
            false,
            Some("请至少填写来源引用与 script body。".to_string()),
        ));
    }

    if input.script_body.len() > 4096 {
        return Err(GatewayErrorSummary::new(
            "protocol",
            Some("EVOLUTION_CUSTOM_TEMPLATE_TOO_LARGE".to_string()),
            "自定义模板脚本超过安全上限。".to_string(),
            false,
            Some("当前 declarative sandbox 仅允许 4 KB 以内脚本。".to_string()),
        ));
    }

    let parsed = serde_json::from_str::<DeclarativeCustomTemplateScript>(input.script_body.as_str())
        .map_err(|error| {
            GatewayErrorSummary::new(
                "protocol",
                Some("EVOLUTION_CUSTOM_TEMPLATE_PARSE_FAILED".to_string()),
                format!("自定义模板脚本解析失败：{error}"),
                false,
                Some(
                    "当前 declarative sandbox 仅接受 JSON 脚本，mode 允许 append_block / replace_text / dedupe_lines / remove_blocks_by_source_ref。"
                        .to_string(),
                ),
            )
        })?;

    match parsed {
        DeclarativeCustomTemplateScript::AppendBlock { ref content, .. } => {
            if content.trim().is_empty() || content.len() > 2000 {
                return Err(GatewayErrorSummary::new(
                    "protocol",
                    Some("EVOLUTION_CUSTOM_TEMPLATE_APPEND_INVALID".to_string()),
                    "append_block 模式需要 1-2000 字符的 content。".to_string(),
                    false,
                    Some("请缩短 content 或补全缺失内容。".to_string()),
                ));
            }
        }
        DeclarativeCustomTemplateScript::ReplaceText {
            ref find_text,
            ref replace_text,
            max_replacements,
        } => {
            let allowed = max_replacements.unwrap_or(1);
            if find_text.trim().is_empty()
                || replace_text.is_empty()
                || allowed == 0
                || allowed > 5
            {
                return Err(GatewayErrorSummary::new(
                    "protocol",
                    Some("EVOLUTION_CUSTOM_TEMPLATE_REPLACE_INVALID".to_string()),
                    "replace_text 模式需要非空 find_text / replace_text，且 max_replacements 范围必须在 1-5。".to_string(),
                    false,
                    Some("请修正 replace_text 脚本参数。".to_string()),
                ));
            }
        }
        DeclarativeCustomTemplateScript::RemoveBlocksBySourceRef { ref source_ref } => {
            if source_ref.trim().is_empty() {
                return Err(GatewayErrorSummary::new(
                    "protocol",
                    Some("EVOLUTION_CUSTOM_TEMPLATE_REMOVE_INVALID".to_string()),
                    "remove_blocks_by_source_ref 模式需要非空 source_ref。".to_string(),
                    false,
                    Some("请补全 source_ref。".to_string()),
                ));
            }
        }
        DeclarativeCustomTemplateScript::DedupeLines => {}
    }

    Ok(Some(input))
}

fn operation_type_for_template(template: &EvolutionTemplateKind) -> EvolutionOperationType {
    match template {
        EvolutionTemplateKind::KnowledgeInjection => EvolutionOperationType::InjectKnowledge,
        EvolutionTemplateKind::CustomTemplate => EvolutionOperationType::CustomTransform,
        EvolutionTemplateKind::Conservative | EvolutionTemplateKind::Aggressive => {
            EvolutionOperationType::Optimize
        }
    }
}

fn derive_preview_safety(
    template: EvolutionTemplateKind,
    original_content: &str,
    risk_level: &str,
    knowledge_input: Option<&EvolutionKnowledgeInjectionInput>,
    custom_input: Option<&EvolutionCustomTemplateInput>,
) -> (bool, bool, Vec<String>) {
    let mut reasons = Vec::new();
    let mut requires_confirmation = risk_level == "high";
    let mut unsafe_apply = false;

    match template {
        EvolutionTemplateKind::Aggressive => {
            reasons.push(
                "当前模板会执行更激进的结构裁剪，因此必须先完成高风险确认。"
                    .to_string(),
            );
        }
        EvolutionTemplateKind::KnowledgeInjection => {
            if let Some(input) = knowledge_input {
                let source_refs =
                    collect_source_refs(input.source_ref.as_str(), &input.additional_source_refs);
                let duplicate_refs = find_duplicate_source_refs(original_content, &source_refs);
                if !duplicate_refs.is_empty() {
                    unsafe_apply = true;
                    reasons.push(
                        format!(
                            "来源引用 {} 已存在于目标文档，继续注入会产生重复知识块，当前执行被阻断。",
                            duplicate_refs.join(", ")
                        ),
                    );
                }
                if input.knowledge_body.len() > 1600 {
                    requires_confirmation = true;
                    reasons.push("知识正文体积较大，建议在确认后再执行。".to_string());
                }
            }
        }
        EvolutionTemplateKind::CustomTemplate => {
            if let Some(input) = custom_input {
                let source_refs =
                    collect_source_refs(input.source_ref.as_str(), &input.additional_source_refs);
                let script = parse_custom_template_script(input);
                match script {
                    DeclarativeCustomTemplateScript::AppendBlock { .. } => {
                        let duplicate_refs =
                            find_duplicate_source_refs(original_content, &source_refs);
                        if !duplicate_refs.is_empty() {
                            unsafe_apply = true;
                            reasons.push(
                                format!(
                                    "来源引用 {} 已存在于目标文档，append_block 会重复追加同源块，当前执行被阻断。",
                                    duplicate_refs.join(", ")
                                ),
                            );
                        }
                    }
                    DeclarativeCustomTemplateScript::ReplaceText {
                        find_text,
                        max_replacements,
                        ..
                    } => {
                        let hits = original_content.matches(find_text.trim()).count();
                        if hits == 0 {
                            unsafe_apply = true;
                            reasons.push(
                                "replace_text 未命中任何文本，当前执行会被阻断。".to_string(),
                            );
                        } else if hits > max_replacements.unwrap_or(1).clamp(1, 5) {
                            requires_confirmation = true;
                            reasons.push(
                                "replace_text 命中次数超过安全阈值，必须先完成高风险确认。".to_string(),
                            );
                        }
                    }
                    DeclarativeCustomTemplateScript::RemoveBlocksBySourceRef { source_ref } => {
                        if !original_content.contains(source_ref.trim()) {
                            unsafe_apply = true;
                            reasons.push(
                                format!(
                                    "remove_blocks_by_source_ref 未找到目标来源 {}，当前执行会被阻断。",
                                    source_ref
                                ),
                            );
                        }
                    }
                    DeclarativeCustomTemplateScript::DedupeLines => {}
                }
            }
        }
        EvolutionTemplateKind::Conservative => {}
    }

    (requires_confirmation, unsafe_apply, reasons)
}

fn build_conservative_preview(
    original_content: &str,
    source_document: &str,
) -> (String, Vec<EvolutionPreviewChange>, String) {
    let mut changes = Vec::new();
    let mut next_lines = Vec::new();
    let mut previous_normalized: Option<String> = None;
    let mut collapsed_blank_lines = 0usize;
    let mut removed_duplicate_lines = 0usize;
    let mut inserted_audit_marker = false;

    for raw_line in original_content.lines() {
        let normalized = raw_line.trim_end().to_string();
        let is_blank = normalized.trim().is_empty();
        if is_blank {
            if previous_normalized.as_deref() == Some("") {
                collapsed_blank_lines += 1;
                continue;
            }
            previous_normalized = Some(String::new());
            next_lines.push(String::new());
            continue;
        }

        if previous_normalized.as_deref() == Some(normalized.as_str()) {
            removed_duplicate_lines += 1;
            continue;
        }

        previous_normalized = Some(normalized.clone());
        next_lines.push(normalized);
    }

    let mut next_content = next_lines.join("\n");
    if next_content == original_content {
        inserted_audit_marker = true;
        next_content.push_str("\n\n<!-- claw-scope:evolution conservative audit -->\n");
    }

    if collapsed_blank_lines > 0 {
        changes.push(EvolutionPreviewChange {
            id: random_id("chg"),
            group: "modify".to_string(),
            change_type: "update".to_string(),
            title: format!("Normalize spacing in {}", source_document),
            desc: format!("Collapsed {} redundant blank lines.", collapsed_blank_lines),
            impact: "Lower visual noise while preserving content order.".to_string(),
        });
    }
    if removed_duplicate_lines > 0 {
        changes.push(EvolutionPreviewChange {
            id: random_id("chg"),
            group: "add".to_string(),
            change_type: "update".to_string(),
            title: format!("Deduplicate repeated lines in {}", source_document),
            desc: format!("Removed {} consecutive duplicate lines.", removed_duplicate_lines),
            impact: "Safer read path with less repetition.".to_string(),
        });
    }
    if inserted_audit_marker {
        changes.push(EvolutionPreviewChange {
            id: random_id("chg"),
            group: "add".to_string(),
            change_type: "insert".to_string(),
            title: "Attach evolution audit marker".to_string(),
            desc: "Inserted a reversible audit marker because no other conservative diff was available.".to_string(),
            impact:
                "Guarantees a traceable execution snapshot without changing semantic prose."
                    .to_string(),
        });
    }

    (next_content, changes, "low".to_string())
}

fn build_aggressive_preview(
    original_content: &str,
    source_document: &str,
) -> (String, Vec<EvolutionPreviewChange>, String) {
    let (conservative_content, mut changes, _) =
        build_conservative_preview(original_content, source_document);
    let mut seen = HashSet::new();
    let mut removed_global_duplicates = 0usize;
    let mut next_lines = Vec::new();

    for line in conservative_content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            next_lines.push(String::new());
            continue;
        }
        if seen.insert(trimmed.to_string()) {
            next_lines.push(line.to_string());
        } else {
            removed_global_duplicates += 1;
        }
    }

    let mut next_content = next_lines.join("\n");
    if next_content == conservative_content {
        next_content.push_str("\n<!-- claw-scope:evolution aggressive audit -->\n");
    }

    changes.insert(
        0,
        EvolutionPreviewChange {
            id: random_id("chg"),
            group: "high-risk".to_string(),
            change_type: "delete".to_string(),
            title: format!("Prune repeated branches in {}", source_document),
            desc: if removed_global_duplicates > 0 {
                format!(
                    "Removed {} repeated non-empty lines across the full document.",
                    removed_global_duplicates
                )
            } else {
                "No repeated branches found, so the aggressive lane attached a managed audit marker."
                    .to_string()
            },
            impact: "May change the long-tail wording users rely on for historical recall."
                .to_string(),
        },
    );

    (next_content, changes, "high".to_string())
}

fn build_knowledge_injection_preview(
    original_content: &str,
    source_document: &str,
    input: &EvolutionKnowledgeInjectionInput,
) -> (String, Vec<EvolutionPreviewChange>, String) {
    let source_refs = collect_source_refs(input.source_ref.as_str(), &input.additional_source_refs);
    let duplicate_refs = find_duplicate_source_refs(original_content, &source_refs);
    let elevated_risk = !duplicate_refs.is_empty() || input.knowledge_body.len() > 1600;
    let tag_line = if input.capability_tags.is_empty() {
        "none".to_string()
    } else {
        input.capability_tags.join(", ")
    };
    let additional_sources_line = if input.additional_source_refs.is_empty() {
        "none".to_string()
    } else {
        input.additional_source_refs.join(", ")
    };
    let injected_block = format!(
        "\n\n<!-- claw-scope:evolution knowledge-injection start source:{source} -->\n## Injected Knowledge · {source}\n- Source Refs: {source_refs}\n- Additional Sources: {additional_sources}\n- Capability Tags: {tags}\n- Imported By: Evolution Knowledge Injection\n\n{body}\n<!-- claw-scope:evolution knowledge-injection end -->\n",
        source = input.source_ref,
        source_refs = source_refs.join(", "),
        additional_sources = additional_sources_line,
        tags = tag_line,
        body = input.knowledge_body
    );
    let next_content = format!(
        "{}{}",
        original_content.trim_end_matches('\n'),
        injected_block
    );

    let preview_changes = vec![
        EvolutionPreviewChange {
            id: random_id("chg"),
            group: if elevated_risk {
                "high-risk".to_string()
            } else {
                "add".to_string()
            },
            change_type: "insert".to_string(),
            title: format!("Inject knowledge package into {}", source_document),
            desc: format!(
                "Append a managed knowledge block from {} provenance ref(s).",
                source_refs.len()
            ),
            impact: if !duplicate_refs.is_empty() {
                format!(
                    "The source ref already exists in the target document ({}), so this injection now requires explicit high-risk confirmation.",
                    duplicate_refs.join(", ")
                )
            } else {
                "Adds new capability context while preserving existing memory structure."
                    .to_string()
            },
        },
        EvolutionPreviewChange {
            id: random_id("chg"),
            group: "modify".to_string(),
            change_type: "update".to_string(),
            title: "Register capability tags".to_string(),
            desc: format!(
                "Expose {} capability tags and {} provenance refs for later traceability.",
                input.capability_tags.len(),
                source_refs.len()
            ),
            impact: if input.capability_tags.is_empty() {
                "Traceability remains available, but capability classification stays minimal."
                    .to_string()
            } else {
                format!("Operator audit can group this injection under: {}.", tag_line)
            },
        },
    ];

    (
        next_content,
        preview_changes,
        if elevated_risk {
            "high".to_string()
        } else {
            "medium".to_string()
        },
    )
}

fn build_custom_template_preview(
    original_content: &str,
    source_document: &str,
    input: &EvolutionCustomTemplateInput,
) -> (String, Vec<EvolutionPreviewChange>, String) {
    let script = parse_custom_template_script(input);

    match script {
        DeclarativeCustomTemplateScript::AppendBlock { title, content } => {
            let source_refs =
                collect_source_refs(input.source_ref.as_str(), &input.additional_source_refs);
            let duplicate_refs = find_duplicate_source_refs(original_content, &source_refs);
            let trimmed_content = content.trim();
            let block_title = title
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .unwrap_or("Custom Template Block");
            let marker = format!(
                "<!-- claw-scope:evolution custom-template source:{} -->",
                input.source_ref
            );
            let block = format!(
                "\n\n{marker}\n## {title}\n- Capability Tags: {tags}\n- Source Ref: {source}\n- Source Refs: {source_refs}\n- Additional Sources: {additional_sources}\n\n{content}\n",
                marker = marker,
                title = block_title,
                tags = if input.capability_tags.is_empty() {
                    "none".to_string()
                } else {
                    input.capability_tags.join(", ")
                },
                source = input.source_ref,
                source_refs = source_refs.join(", "),
                additional_sources = if input.additional_source_refs.is_empty() {
                    "none".to_string()
                } else {
                    input.additional_source_refs.join(", ")
                },
                content = trimmed_content
            );
            let next_content = format!(
                "{}{}",
                original_content.trim_end_matches('\n'),
                block
            );
            let duplicate_source = !duplicate_refs.is_empty();
            let risk_level = if duplicate_source || trimmed_content.len() > 1200 {
                "high"
            } else {
                "medium"
            };
            let changes = vec![
                EvolutionPreviewChange {
                    id: random_id("chg"),
                    group: if risk_level == "high" {
                        "high-risk".to_string()
                    } else {
                        "add".to_string()
                    },
                    change_type: "insert".to_string(),
                    title: format!("Append custom block into {}", source_document),
                    desc: format!(
                        "Append a managed custom block titled '{}' from {} provenance ref(s).",
                        block_title,
                        source_refs.len()
                    ),
                    impact: if duplicate_source {
                        format!(
                            "Source ref already exists in the document ({}), so this append needs explicit confirmation.",
                            duplicate_refs.join(", ")
                        )
                    } else {
                        "Adds a user-authored custom block under the declarative sandbox."
                            .to_string()
                    },
                },
            ];
            (next_content, changes, risk_level.to_string())
        }
        DeclarativeCustomTemplateScript::ReplaceText {
            find_text,
            replace_text,
            max_replacements,
        } => {
            let needle = find_text.trim();
            let replacement = replace_text.trim();
            let allowed = max_replacements.unwrap_or(1).clamp(1, 5);
            let occurrences = original_content.matches(needle).count();
            let replace_count = occurrences.min(allowed);
            let next_content = if replace_count == 0 {
                original_content.to_string()
            } else {
                original_content.replacen(needle, replacement, allowed)
            };
            let risk_level = if occurrences > 1 || replacement.len() > 800 {
                "high"
            } else {
                "medium"
            };
            let changes = vec![EvolutionPreviewChange {
                id: random_id("chg"),
                group: if risk_level == "high" {
                    "high-risk".to_string()
                } else {
                    "modify".to_string()
                },
                change_type: "update".to_string(),
                title: format!("Replace exact text in {}", source_document),
                desc: if replace_count == 0 {
                    "No exact matches were found for the requested replace_text script."
                        .to_string()
                } else {
                    format!(
                        "Replace '{}' with '{}' up to {} time(s).",
                        needle, replacement, allowed
                    )
                },
                impact: if occurrences > 1 {
                    "The target appears multiple times, so this custom replacement is treated as high risk."
                        .to_string()
                } else {
                    "Bounded exact-text replacement within the declarative sandbox."
                        .to_string()
                },
            }];
            (next_content, changes, risk_level.to_string())
        }
        DeclarativeCustomTemplateScript::RemoveBlocksBySourceRef { source_ref } => {
            let marker = format!(
                "<!-- claw-scope:evolution custom-template source:{} -->",
                source_ref.trim()
            );
            let mut removed = false;
            let mut next_lines = Vec::new();
            let mut skipping = false;
            for line in original_content.lines() {
                if line.contains(marker.as_str()) {
                    skipping = true;
                    removed = true;
                    continue;
                }
                if skipping && line.trim().is_empty() {
                    skipping = false;
                    continue;
                }
                if skipping {
                    continue;
                }
                next_lines.push(line.to_string());
            }
            let next_content = next_lines.join("\n");
            let changes = vec![EvolutionPreviewChange {
                id: random_id("chg"),
                group: if removed {
                    "modify".to_string()
                } else {
                    "high-risk".to_string()
                },
                change_type: if removed {
                    "delete".to_string()
                } else {
                    "update".to_string()
                },
                title: "Remove custom block by source ref".to_string(),
                desc: if removed {
                    format!("Remove the managed block linked to {}.", source_ref)
                } else {
                    format!(
                        "No managed block linked to {} was found, so this custom removal is blocked.",
                        source_ref
                    )
                },
                impact: if removed {
                    "Prunes a previously injected custom block under declarative sandbox control."
                        .to_string()
                } else {
                    "Current document does not contain the requested managed block."
                        .to_string()
                },
            }];
            (
                next_content,
                changes,
                if removed {
                    "medium".to_string()
                } else {
                    "high".to_string()
                },
            )
        }
        DeclarativeCustomTemplateScript::DedupeLines => {
            let (next_content, mut changes, _) =
                build_conservative_preview(original_content, source_document);
            changes.insert(
                0,
                EvolutionPreviewChange {
                    id: random_id("chg"),
                    group: "modify".to_string(),
                    change_type: "update".to_string(),
                    title: "Run custom dedupe_lines script".to_string(),
                    desc: format!(
                        "Apply declarative custom template from {} using the safe dedupe_lines mode.",
                        input.source_ref
                    ),
                    impact: "Reuses the bounded conservative dedupe pipeline under custom control."
                        .to_string(),
                },
            );
            (next_content, changes, "low".to_string())
        }
    }
}

fn parse_custom_template_script(
    input: &EvolutionCustomTemplateInput,
) -> DeclarativeCustomTemplateScript {
    serde_json::from_str::<DeclarativeCustomTemplateScript>(input.script_body.as_str())
        .expect("validated custom template script should parse")
}

async fn load_current_source_content(
    gateway_state: GatewayAppState,
    agent_id: &str,
    source_document: &str,
) -> Result<String, GatewayErrorSummary> {
    let memory = connector::agent_memory_get(gateway_state, None, agent_id)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))?;
    let document = memory
        .documents
        .iter()
        .find(|document| document.name == source_document)
        .ok_or_else(|| {
            GatewayErrorSummary::new(
                "protocol",
                Some("EVOLUTION_SOURCE_DOCUMENT_MISSING".to_string()),
                "执行前未找到原始 preview 对应的文档。".to_string(),
                false,
                Some("请重新执行 Analyze & Preview。".to_string()),
            )
        })?;
    Ok(document.content.clone().unwrap_or_default())
}

fn resolve_source_document(documents: &[GatewayAgentFileEntry]) -> Option<&GatewayAgentFileEntry> {
    documents
        .iter()
        .find(|document| !document.missing && document.content.as_ref().is_some())
}

fn build_success_summary(
    preview: &EvolutionPreviewResult,
    index_warning: Option<&str>,
) -> (String, EvolutionLocalizedMessage) {
    let (base, message_i18n) = match preview.operation_type {
        EvolutionOperationType::CustomTransform => {
            let source_summary =
                summarize_source_refs(&preview.source_refs, preview.source_ref.as_deref());
            (
                format!(
                    "custom template from {} · {} bytes → {} bytes ({})",
                    source_summary, preview.bytes_before, preview.bytes_after, preview.risk_level
                ),
                localized_message(
                    "evo.message.execute.success.custom",
                    vec![
                        source_summary,
                        preview.bytes_before.to_string(),
                        preview.bytes_after.to_string(),
                        preview.risk_level.clone(),
                    ],
                ),
            )
        }
        EvolutionOperationType::InjectKnowledge => {
            let source_summary =
                summarize_source_refs(&preview.source_refs, preview.source_ref.as_deref());
            (
                format!(
                    "injected knowledge from {} · {} bytes → {} bytes ({})",
                    source_summary, preview.bytes_before, preview.bytes_after, preview.risk_level
                ),
                localized_message(
                    "evo.message.execute.success.inject",
                    vec![
                        source_summary,
                        preview.bytes_before.to_string(),
                        preview.bytes_after.to_string(),
                        preview.risk_level.clone(),
                    ],
                ),
            )
        }
        EvolutionOperationType::Optimize | EvolutionOperationType::RestoreSnapshot => (
            format!(
                "{} bytes → {} bytes ({})",
                preview.bytes_before, preview.bytes_after, preview.risk_level
            ),
            localized_message(
                "evo.message.execute.success.optimize",
                vec![
                    preview.bytes_before.to_string(),
                    preview.bytes_after.to_string(),
                    preview.risk_level.clone(),
                ],
            ),
        ),
    };

    if let Some(warning) = index_warning {
        let key = match preview.operation_type {
            EvolutionOperationType::InjectKnowledge => "evo.message.execute.success.inject.indexWarning",
            EvolutionOperationType::CustomTransform => "evo.message.execute.success.custom.indexWarning",
            EvolutionOperationType::Optimize | EvolutionOperationType::RestoreSnapshot => {
                "evo.message.execute.success.optimize.indexWarning"
            }
        };
        let mut args = message_i18n.args.clone();
        args.push(warning.to_string());
        (
            format!("{base} · index warning: {warning}"),
            localized_message(key, args),
        )
    } else {
        (base, message_i18n)
    }
}

fn localized_message(key: &str, args: Vec<String>) -> EvolutionLocalizedMessage {
    EvolutionLocalizedMessage {
        key: key.to_string(),
        args,
    }
}

fn build_audit_entry(
    preview: &EvolutionPreviewResult,
    history_entry: &EvolutionHistoryEntry,
    message: &str,
    message_i18n: Option<EvolutionLocalizedMessage>,
    started_at_ms: i64,
    override_applied: bool,
) -> EvolutionAuditEntry {
    EvolutionAuditEntry {
        operation_id: history_entry.operation_id.clone(),
        operation_kind: history_entry.operation_kind.clone(),
        status: history_entry.status.clone(),
        agent_id: history_entry.agent_id.clone(),
        node_label: history_entry.node_label.clone(),
        template: history_entry.template.clone(),
        operation_type: history_entry.operation_type.clone(),
        snapshot_id: history_entry.snapshot_id.clone(),
        source_document: history_entry.source_document.clone(),
        risk_level: preview.risk_level.clone(),
        source_ref: history_entry.source_ref.clone(),
        source_refs: history_entry.source_refs.clone(),
        preflight_blocked: false,
        blocked_reason_code: None,
        override_applied,
        override_reason_code: if override_applied {
            Some("EVOLUTION_HIGH_RISK_CONFIRMATION_OVERRIDE".to_string())
        } else {
            None
        },
        capability_tags: history_entry.capability_tags.clone(),
        message: message.to_string(),
        message_i18n,
        started_at_ms,
        ended_at_ms: history_entry.created_at_ms,
        duration_ms: history_entry.duration_ms.unwrap_or_else(|| elapsed_ms(started_at_ms)),
    }
}

fn build_preflight_blocked_audit_entry(
    preview: &EvolutionPreviewResult,
    message: &str,
    message_i18n: Option<EvolutionLocalizedMessage>,
    blocked_reason_code: &str,
) -> EvolutionAuditEntry {
    let now = Utc::now().timestamp_millis();
    EvolutionAuditEntry {
        operation_id: preview.operation_id.clone(),
        operation_kind: EvolutionOperationKind::Execute,
        status: EvolutionOperationStatus::Failed,
        agent_id: preview.agent_id.clone(),
        node_label: preview.node_label.clone(),
        template: preview.template.clone(),
        operation_type: preview.operation_type.clone(),
        snapshot_id: preview.snapshot_id.clone(),
        source_document: preview.source_document.clone(),
        risk_level: preview.risk_level.clone(),
        source_ref: preview.source_ref.clone(),
        source_refs: preview.source_refs.clone(),
        preflight_blocked: true,
        blocked_reason_code: Some(blocked_reason_code.to_string()),
        override_applied: false,
        override_reason_code: None,
        capability_tags: preview.capability_tags.clone(),
        message: message.to_string(),
        message_i18n,
        started_at_ms: now,
        ended_at_ms: now,
        duration_ms: 0,
    }
}

fn summarize_audit_entries(
    agent_id: String,
    audit: Vec<EvolutionAuditEntry>,
) -> EvolutionAuditSummary {
    let mut success_count = 0usize;
    let mut failed_count = 0usize;
    let mut cancelled_count = 0usize;
    let mut rolled_back_count = 0usize;
    let mut high_risk_count = 0usize;
    let mut unsafe_blocked_count = 0usize;
    let mut preflight_blocked_count = 0usize;
    let mut override_count = 0usize;
    let mut last_24h_operations = 0usize;
    let mut last_24h_failures = 0usize;
    let mut last_24h_blocked = 0usize;
    let mut last_7d_operations = 0usize;
    let mut last_7d_failures = 0usize;
    let mut last_7d_overrides = 0usize;
    let mut duration_total = 0u64;
    let mut duration_count = 0u64;
    let mut status_breakdown = BTreeMap::<String, usize>::new();
    let mut template_breakdown = BTreeMap::<String, usize>::new();
    let mut operation_type_breakdown = BTreeMap::<String, usize>::new();
    let mut blocked_reason_breakdown = BTreeMap::<String, usize>::new();
    let now = Utc::now();
    let cutoff_24h = now - ChronoDuration::hours(24);
    let cutoff_7d = now - ChronoDuration::days(7);
    let mut recent_daily_breakdown = BTreeMap::<String, usize>::new();
    for offset in (0..7).rev() {
        let key = (now - ChronoDuration::days(offset)).format("%Y-%m-%d").to_string();
        recent_daily_breakdown.insert(key, 0);
    }

    for entry in &audit {
        let ended_at = Utc.timestamp_millis_opt(entry.ended_at_ms).single();
        match entry.status {
            EvolutionOperationStatus::Success => success_count += 1,
            EvolutionOperationStatus::Failed => failed_count += 1,
            EvolutionOperationStatus::Cancelled => cancelled_count += 1,
            EvolutionOperationStatus::RolledBack => rolled_back_count += 1,
        }
        if entry.risk_level == "high" {
            high_risk_count += 1;
        }
        if entry.preflight_blocked {
            preflight_blocked_count += 1;
            if let Some(code) = entry.blocked_reason_code.as_ref() {
                *blocked_reason_breakdown.entry(code.clone()).or_default() += 1;
            }
        }
        if entry.override_applied {
            override_count += 1;
        }
        if let Some(ended_at) = ended_at {
            if ended_at >= cutoff_24h {
                last_24h_operations += 1;
                if entry.status == EvolutionOperationStatus::Failed {
                    last_24h_failures += 1;
                }
                if entry.preflight_blocked {
                    last_24h_blocked += 1;
                }
            }
            if ended_at >= cutoff_7d {
                last_7d_operations += 1;
                if entry.status == EvolutionOperationStatus::Failed {
                    last_7d_failures += 1;
                }
                if entry.override_applied {
                    last_7d_overrides += 1;
                }
                let date_key = ended_at.format("%Y-%m-%d").to_string();
                if let Some(bucket) = recent_daily_breakdown.get_mut(date_key.as_str()) {
                    *bucket += 1;
                }
            }
        }
        if entry.blocked_reason_code.as_deref() == Some("EVOLUTION_UNSAFE_APPLY_BLOCKED")
            || entry.message.contains("阻断")
            || entry.message.contains("unsafe")
        {
            unsafe_blocked_count += 1;
        }
        duration_total = duration_total.saturating_add(entry.duration_ms);
        duration_count = duration_count.saturating_add(1);
        *status_breakdown
            .entry(status_key(&entry.status))
            .or_default() += 1;
        *template_breakdown
            .entry(template_key(&entry.template))
            .or_default() += 1;
        *operation_type_breakdown
            .entry(operation_type_key(&entry.operation_type))
            .or_default() += 1;
    }

    EvolutionAuditSummary {
        agent_id,
        total_operations: audit.len(),
        success_count,
        failed_count,
        cancelled_count,
        rolled_back_count,
        high_risk_count,
        unsafe_blocked_count,
        preflight_blocked_count,
        override_count,
        last_24h_operations,
        last_24h_failures,
        last_24h_blocked,
        last_7d_operations,
        last_7d_failures,
        last_7d_overrides,
        average_duration_ms: duration_total.checked_div(duration_count),
        status_breakdown: status_breakdown
            .into_iter()
            .map(|(key, count)| EvolutionMetricBucket { key, count })
            .collect(),
        template_breakdown: template_breakdown
            .into_iter()
            .map(|(key, count)| EvolutionMetricBucket { key, count })
            .collect(),
        operation_type_breakdown: operation_type_breakdown
            .into_iter()
            .map(|(key, count)| EvolutionMetricBucket { key, count })
            .collect(),
        blocked_reason_breakdown: blocked_reason_breakdown
            .into_iter()
            .map(|(key, count)| EvolutionMetricBucket { key, count })
            .collect(),
        recent_daily_breakdown: recent_daily_breakdown
            .into_iter()
            .map(|(key, count)| EvolutionMetricBucket { key, count })
            .collect(),
        recent_entries: audit.into_iter().take(8).collect(),
    }
}

fn elapsed_ms(started_at_ms: i64) -> u64 {
    (Utc::now().timestamp_millis() - started_at_ms).max(0) as u64
}

fn template_key(template: &EvolutionTemplateKind) -> String {
    match template {
        EvolutionTemplateKind::Conservative => "conservative".to_string(),
        EvolutionTemplateKind::Aggressive => "aggressive".to_string(),
        EvolutionTemplateKind::KnowledgeInjection => "knowledge_injection".to_string(),
        EvolutionTemplateKind::CustomTemplate => "custom_template".to_string(),
    }
}

fn operation_type_key(operation_type: &EvolutionOperationType) -> String {
    match operation_type {
        EvolutionOperationType::Optimize => "optimize".to_string(),
        EvolutionOperationType::InjectKnowledge => "inject_knowledge".to_string(),
        EvolutionOperationType::CustomTransform => "custom_transform".to_string(),
        EvolutionOperationType::RestoreSnapshot => "restore_snapshot".to_string(),
    }
}

fn status_key(status: &EvolutionOperationStatus) -> String {
    match status {
        EvolutionOperationStatus::Success => "success".to_string(),
        EvolutionOperationStatus::Failed => "failed".to_string(),
        EvolutionOperationStatus::Cancelled => "cancelled".to_string(),
        EvolutionOperationStatus::RolledBack => "rolled_back".to_string(),
    }
}

struct RuntimeStatusUpdate {
    phase: EvolutionRuntimePhase,
    progress_pct: u8,
    message: &'static str,
    message_i18n: Option<EvolutionLocalizedMessage>,
    can_cancel: bool,
    history_entry: Option<EvolutionHistoryEntry>,
}

async fn update_runtime_status<R: Runtime>(
    app: &AppHandle<R>,
    runtime: &Arc<RuntimeEvolutionOperation>,
    update: RuntimeStatusUpdate,
) -> EvolutionOperationStatusSnapshot {
    let next_snapshot = {
        let mut status = runtime.status.lock().await;
        status.runtime_state = EvolutionRuntimeState::Running;
        status.phase = update.phase;
        status.progress_pct = update.progress_pct;
        status.message = update.message.to_string();
        status.message_i18n = update.message_i18n;
        status.can_cancel = update.can_cancel;
        status.updated_at_ms = Utc::now().timestamp_millis();
        if let Some(entry) = update.history_entry {
            status.history_entry = Some(entry);
        }
        status.clone()
    };
    emit_status(app, &next_snapshot);
    next_snapshot
}

async fn set_terminal_status<R: Runtime>(
    app: &AppHandle<R>,
    runtime: &Arc<RuntimeEvolutionOperation>,
    runtime_state: EvolutionRuntimeState,
    phase: EvolutionRuntimePhase,
    message: &str,
    message_i18n: Option<EvolutionLocalizedMessage>,
    history_entry: Option<EvolutionHistoryEntry>,
) -> EvolutionOperationStatusSnapshot {
    let next_snapshot = {
        let mut status = runtime.status.lock().await;
        status.runtime_state = runtime_state;
        status.phase = phase;
        status.progress_pct = 100;
        status.message = message.to_string();
        status.message_i18n = message_i18n;
        status.can_cancel = false;
        status.updated_at_ms = Utc::now().timestamp_millis();
        status.history_entry = history_entry;
        status.clone()
    };
    emit_status(app, &next_snapshot);
    next_snapshot
}

fn build_terminal_history_entry(
    preview: &EvolutionPreviewResult,
    status: EvolutionOperationStatus,
    summary: &str,
    summary_i18n: Option<EvolutionLocalizedMessage>,
    bytes_before: usize,
    bytes_after: usize,
    duration_ms: Option<u64>,
) -> EvolutionHistoryEntry {
    EvolutionHistoryEntry {
        operation_id: preview.operation_id.clone(),
        operation_kind: EvolutionOperationKind::Execute,
        status,
        agent_id: preview.agent_id.clone(),
        node_label: preview.node_label.clone(),
        template: preview.template.clone(),
        operation_type: preview.operation_type.clone(),
        snapshot_id: preview.snapshot_id.clone(),
        source_document: preview.source_document.clone(),
        source_ref: preview.source_ref.clone(),
        source_refs: preview.source_refs.clone(),
        capability_tags: preview.capability_tags.clone(),
        summary: summary.to_string(),
        summary_i18n,
        bytes_before,
        bytes_after,
        duration_ms,
        created_at_ms: Utc::now().timestamp_millis(),
    }
}

fn emit_status<R: Runtime>(app: &AppHandle<R>, snapshot: &EvolutionOperationStatusSnapshot) {
    let _ = app.emit(EVOLUTION_STATUS_EVENT, snapshot);
}

fn random_id(prefix: &str) -> String {
    let mut bytes = [0_u8; 8];
    rand::thread_rng().fill_bytes(&mut bytes);
    format!(
        "{}-{}",
        prefix,
        bytes.iter()
            .map(|byte| format!("{byte:02x}"))
            .collect::<String>()
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn knowledge_input_is_trimmed_and_deduplicated() {
        let input = EvolutionKnowledgeInjectionInput {
            source_ref: "  spec://memory-search-v1  ".to_string(),
            additional_source_refs: vec![
                " doc://team-playbook ".to_string(),
                "spec://memory-search-v1".to_string(),
                "DOC://TEAM-PLAYBOOK".to_string(),
                "spec://appendix".to_string(),
            ],
            knowledge_body: "  memory search requires embeddings  ".to_string(),
            capability_tags: vec![
                "memory".to_string(),
                " search ".to_string(),
                "Memory".to_string(),
            ],
        };

        let normalized = prepare_knowledge_input(
            EvolutionTemplateKind::KnowledgeInjection,
            Some(input),
        )
        .expect("normalized")
        .expect("knowledge input");

        assert_eq!(normalized.source_ref, "spec://memory-search-v1");
        assert_eq!(
            normalized.additional_source_refs,
            vec!["doc://team-playbook", "spec://appendix"]
        );
        assert_eq!(normalized.knowledge_body, "memory search requires embeddings");
        assert_eq!(normalized.capability_tags, vec!["memory", "search"]);
    }

    #[test]
    fn knowledge_injection_preview_builds_managed_block() {
        let input = EvolutionKnowledgeInjectionInput {
            source_ref: "doc://ops-playbook".to_string(),
            additional_source_refs: vec!["doc://team-playbook".to_string()],
            knowledge_body: "Use memory_search before local fallback.".to_string(),
            capability_tags: vec!["memory".to_string(), "search".to_string()],
        };

        let (next_content, changes, risk_level) = build_knowledge_injection_preview(
            "# MEMORY\n",
            "MEMORY.md",
            &input,
        );

        assert!(next_content.contains("Injected Knowledge · doc://ops-playbook"));
        assert!(next_content.contains("Source Refs: doc://ops-playbook, doc://team-playbook"));
        assert!(next_content.contains("Use memory_search before local fallback."));
        assert_eq!(risk_level, "medium");
        assert_eq!(changes.len(), 2);
    }

    #[test]
    fn duplicate_knowledge_source_is_high_risk() {
        let input = EvolutionKnowledgeInjectionInput {
            source_ref: "doc://ops-playbook".to_string(),
            additional_source_refs: vec!["doc://team-playbook".to_string()],
            knowledge_body: "Use memory_search before local fallback.".to_string(),
            capability_tags: vec!["memory".to_string()],
        };

        let (_next_content, changes, risk_level) = build_knowledge_injection_preview(
            "existing doc://ops-playbook marker",
            "MEMORY.md",
            &input,
        );

        assert_eq!(risk_level, "high");
        assert_eq!(changes[0].group, "high-risk");
    }

    #[test]
    fn custom_template_append_block_builds_managed_preview() {
        let input = EvolutionCustomTemplateInput {
            source_ref: "custom://playbook".to_string(),
            additional_source_refs: vec!["custom://shared-playbook".to_string()],
            script_body: r#"{"mode":"append_block","title":"Custom Block","content":"Append this safely."}"#.to_string(),
            capability_tags: vec!["custom".to_string(), "safe".to_string()],
        };

        let (next_content, changes, risk_level) = build_custom_template_preview(
            "# MEMORY",
            "MEMORY.md",
            &input,
        );

        assert!(next_content.contains("Custom Block"));
        assert!(next_content.contains("custom://playbook"));
        assert!(next_content.contains("Source Refs: custom://playbook, custom://shared-playbook"));
        assert_eq!(risk_level, "medium");
        assert!(changes[0].title.contains("Append custom block"));
    }

    #[test]
    fn custom_template_remove_mode_removes_managed_block() {
        let input = EvolutionCustomTemplateInput {
            source_ref: "custom://playbook".to_string(),
            additional_source_refs: vec!["custom://remove-contract".to_string()],
            script_body: r#"{"mode":"remove_blocks_by_source_ref","source_ref":"custom://playbook"}"#.to_string(),
            capability_tags: vec!["custom".to_string(), "cleanup".to_string()],
        };

        let original = "# MEMORY\n\n<!-- claw-scope:evolution custom-template source:custom://playbook -->\n## Custom Block\n- Capability Tags: custom, safe\n- Source Ref: custom://playbook\n- Source Refs: custom://playbook, custom://shared-playbook\n- Additional Sources: custom://shared-playbook\n\nAppend this safely.\n";
        let (next_content, changes, risk_level) = build_custom_template_preview(
            original,
            "MEMORY.md",
            &input,
        );

        assert!(!next_content.contains("custom://playbook -->"));
        assert_eq!(risk_level, "medium");
        assert_eq!(changes[0].change_type, "delete");
    }

    #[test]
    fn duplicate_knowledge_source_sets_unsafe_apply() {
        let input = EvolutionKnowledgeInjectionInput {
            source_ref: "doc://ops-playbook".to_string(),
            additional_source_refs: vec!["doc://shared-playbook".to_string()],
            knowledge_body: "Use memory_search before local fallback.".to_string(),
            capability_tags: vec!["memory".to_string()],
        };

        let (requires_confirmation, unsafe_apply, reasons) = derive_preview_safety(
            EvolutionTemplateKind::KnowledgeInjection,
            "existing doc://shared-playbook marker",
            "high",
            Some(&input),
            None,
        );

        assert!(requires_confirmation);
        assert!(unsafe_apply);
        assert!(reasons.iter().any(|reason| reason.contains("doc://shared-playbook")));
    }

    #[test]
    fn success_summary_marks_injection_source() {
        let preview = EvolutionPreviewResult {
            operation_id: "op-a".to_string(),
            agent_id: "agent-a".to_string(),
            node_label: "agent-a".to_string(),
            template: EvolutionTemplateKind::KnowledgeInjection,
            operation_type: EvolutionOperationType::InjectKnowledge,
            source_document: "MEMORY.md".to_string(),
            risk_level: "medium".to_string(),
            requires_confirmation: false,
            unsafe_apply: false,
            unsafe_reasons: Vec::new(),
            source_ref: Some("doc://ops-playbook".to_string()),
            source_refs: vec![
                "doc://ops-playbook".to_string(),
                "doc://team-playbook".to_string(),
            ],
            capability_tags: vec!["memory".to_string()],
            changes: Vec::new(),
            bytes_before: 100,
            bytes_after: 180,
            snapshot_id: "snap-a".to_string(),
            created_at_ms: 1,
        };

        let (summary, summary_i18n) = build_success_summary(&preview, None);
        assert!(summary.contains("injected knowledge from doc://ops-playbook (+1 more refs)"));
        assert_eq!(summary_i18n.key, "evo.message.execute.success.inject");
    }

    #[test]
    fn preflight_blocked_audit_entry_marks_reason_code() {
        let preview = EvolutionPreviewResult {
            operation_id: "op-blocked".to_string(),
            agent_id: "agent-a".to_string(),
            node_label: "agent-a".to_string(),
            template: EvolutionTemplateKind::CustomTemplate,
            operation_type: EvolutionOperationType::CustomTransform,
            source_document: "MEMORY.md".to_string(),
            risk_level: "medium".to_string(),
            requires_confirmation: false,
            unsafe_apply: true,
            unsafe_reasons: vec!["unsafe".to_string()],
            source_ref: Some("custom://playbook".to_string()),
            source_refs: vec!["custom://playbook".to_string()],
            capability_tags: vec!["custom".to_string()],
            changes: Vec::new(),
            bytes_before: 100,
            bytes_after: 120,
            snapshot_id: "snap-blocked".to_string(),
            created_at_ms: 1,
        };

        let entry = build_preflight_blocked_audit_entry(
            &preview,
            "unsafe blocked",
            Some(localized_message(
                "evo.message.preflight.unsafeApply",
                vec!["unsafe blocked".to_string()],
            )),
            "EVOLUTION_UNSAFE_APPLY_BLOCKED",
        );

        assert!(entry.preflight_blocked);
        assert_eq!(
            entry.blocked_reason_code.as_deref(),
            Some("EVOLUTION_UNSAFE_APPLY_BLOCKED")
        );
        assert!(!entry.override_applied);
        assert_eq!(entry.status, EvolutionOperationStatus::Failed);
    }

    #[test]
    fn summarize_audit_entries_tracks_preflight_blocked_counts() {
        let blocked = EvolutionAuditEntry {
            operation_id: "op-blocked".to_string(),
            operation_kind: EvolutionOperationKind::Execute,
            status: EvolutionOperationStatus::Failed,
            agent_id: "agent-a".to_string(),
            node_label: "agent-a".to_string(),
            template: EvolutionTemplateKind::KnowledgeInjection,
            operation_type: EvolutionOperationType::InjectKnowledge,
            snapshot_id: "snap-a".to_string(),
            source_document: "MEMORY.md".to_string(),
            risk_level: "high".to_string(),
            source_ref: Some("doc://ops-playbook".to_string()),
            source_refs: vec!["doc://ops-playbook".to_string()],
            preflight_blocked: true,
            blocked_reason_code: Some("EVOLUTION_PREVIEW_STALE".to_string()),
            override_applied: false,
            override_reason_code: None,
            capability_tags: vec!["memory".to_string()],
            message: "当前 preview 已失效，目标文档在预览后发生了变化。".to_string(),
            message_i18n: Some(localized_message(
                "evo.message.preflight.previewStale",
                Vec::new(),
            )),
            started_at_ms: 1,
            ended_at_ms: 1,
            duration_ms: 0,
        };
        let success = EvolutionAuditEntry {
            operation_id: "op-success".to_string(),
            operation_kind: EvolutionOperationKind::Execute,
            status: EvolutionOperationStatus::Success,
            agent_id: "agent-a".to_string(),
            node_label: "agent-a".to_string(),
            template: EvolutionTemplateKind::Conservative,
            operation_type: EvolutionOperationType::Optimize,
            snapshot_id: "snap-b".to_string(),
            source_document: "MEMORY.md".to_string(),
            risk_level: "low".to_string(),
            source_ref: None,
            source_refs: Vec::new(),
            preflight_blocked: false,
            blocked_reason_code: None,
            override_applied: true,
            override_reason_code: Some("EVOLUTION_HIGH_RISK_CONFIRMATION_OVERRIDE".to_string()),
            capability_tags: Vec::new(),
            message: "Evolution 执行完成。".to_string(),
            message_i18n: Some(localized_message("evo.message.execute.completed", Vec::new())),
            started_at_ms: 2,
            ended_at_ms: 4,
            duration_ms: 2,
        };

        let summary = summarize_audit_entries("agent-a".to_string(), vec![blocked, success]);

        assert_eq!(summary.total_operations, 2);
        assert_eq!(summary.preflight_blocked_count, 1);
        assert_eq!(summary.override_count, 1);
        assert_eq!(summary.high_risk_count, 1);
        assert_eq!(summary.blocked_reason_breakdown.len(), 1);
        assert_eq!(summary.blocked_reason_breakdown[0].key, "EVOLUTION_PREVIEW_STALE");
        assert_eq!(summary.blocked_reason_breakdown[0].count, 1);
    }

    #[test]
    fn build_audit_entry_marks_override_usage() {
        let preview = EvolutionPreviewResult {
            operation_id: "op-override".to_string(),
            agent_id: "agent-a".to_string(),
            node_label: "agent-a".to_string(),
            template: EvolutionTemplateKind::Aggressive,
            operation_type: EvolutionOperationType::Optimize,
            source_document: "MEMORY.md".to_string(),
            risk_level: "high".to_string(),
            requires_confirmation: true,
            unsafe_apply: false,
            unsafe_reasons: Vec::new(),
            source_ref: None,
            source_refs: Vec::new(),
            capability_tags: Vec::new(),
            changes: Vec::new(),
            bytes_before: 100,
            bytes_after: 80,
            snapshot_id: "snap-override".to_string(),
            created_at_ms: 1,
        };
        let history_entry = EvolutionHistoryEntry {
            operation_id: "op-override".to_string(),
            operation_kind: EvolutionOperationKind::Execute,
            status: EvolutionOperationStatus::Success,
            agent_id: "agent-a".to_string(),
            node_label: "agent-a".to_string(),
            template: EvolutionTemplateKind::Aggressive,
            operation_type: EvolutionOperationType::Optimize,
            snapshot_id: "snap-override".to_string(),
            source_document: "MEMORY.md".to_string(),
            source_ref: None,
            source_refs: Vec::new(),
            capability_tags: Vec::new(),
            summary: "done".to_string(),
            summary_i18n: Some(localized_message("evo.message.execute.completed", Vec::new())),
            bytes_before: 100,
            bytes_after: 80,
            duration_ms: Some(10),
            created_at_ms: 10,
        };

        let entry = build_audit_entry(
            &preview,
            &history_entry,
            "Evolution 执行完成。",
            Some(localized_message("evo.message.execute.completed", Vec::new())),
            1,
            true,
        );

        assert!(entry.override_applied);
        assert_eq!(
            entry.override_reason_code.as_deref(),
            Some("EVOLUTION_HIGH_RISK_CONFIRMATION_OVERRIDE")
        );
    }

    #[test]
    fn summarize_audit_entries_tracks_recent_trends() {
        let now = Utc::now().timestamp_millis();
        let recent = EvolutionAuditEntry {
            operation_id: "op-recent".to_string(),
            operation_kind: EvolutionOperationKind::Execute,
            status: EvolutionOperationStatus::Failed,
            agent_id: "agent-a".to_string(),
            node_label: "agent-a".to_string(),
            template: EvolutionTemplateKind::Aggressive,
            operation_type: EvolutionOperationType::Optimize,
            snapshot_id: "snap-r".to_string(),
            source_document: "MEMORY.md".to_string(),
            risk_level: "high".to_string(),
            source_ref: None,
            source_refs: Vec::new(),
            preflight_blocked: true,
            blocked_reason_code: Some("EVOLUTION_RUNTIME_AGENT_CONFLICT".to_string()),
            override_applied: true,
            override_reason_code: Some("EVOLUTION_HIGH_RISK_CONFIRMATION_OVERRIDE".to_string()),
            capability_tags: Vec::new(),
            message: "recent".to_string(),
            message_i18n: None,
            started_at_ms: now - 50,
            ended_at_ms: now,
            duration_ms: 50,
        };

        let summary = summarize_audit_entries("agent-a".to_string(), vec![recent]);

        assert_eq!(summary.last_24h_operations, 1);
        assert_eq!(summary.last_24h_failures, 1);
        assert_eq!(summary.last_24h_blocked, 1);
        assert_eq!(summary.last_7d_operations, 1);
        assert_eq!(summary.last_7d_failures, 1);
        assert_eq!(summary.last_7d_overrides, 1);
        assert_eq!(summary.recent_daily_breakdown.len(), 7);
        assert!(summary.recent_daily_breakdown.iter().any(|bucket| bucket.count == 1));
    }

    #[test]
    fn classify_preflight_drift_detects_already_applied() {
        let preview = EvolutionPreviewResult {
            operation_id: "op-applied".to_string(),
            agent_id: "agent-a".to_string(),
            node_label: "agent-a".to_string(),
            template: EvolutionTemplateKind::KnowledgeInjection,
            operation_type: EvolutionOperationType::InjectKnowledge,
            source_document: "MEMORY.md".to_string(),
            risk_level: "medium".to_string(),
            requires_confirmation: false,
            unsafe_apply: false,
            unsafe_reasons: Vec::new(),
            source_ref: Some("doc://ops-playbook".to_string()),
            source_refs: vec!["doc://ops-playbook".to_string()],
            capability_tags: vec!["memory".to_string()],
            changes: Vec::new(),
            bytes_before: 100,
            bytes_after: 120,
            snapshot_id: "snap-a".to_string(),
            created_at_ms: 1,
        };

        let (code, message, message_i18n) =
            classify_preflight_drift(&preview, "before", "after", "after");

        assert_eq!(code, "EVOLUTION_ALREADY_APPLIED");
        assert!(message.contains("已经等于本次 preview 的目标结果"));
        assert_eq!(message_i18n.key, "evo.message.preflight.alreadyApplied");
    }

    #[test]
    fn classify_preflight_drift_detects_source_ref_conflict() {
        let preview = EvolutionPreviewResult {
            operation_id: "op-conflict".to_string(),
            agent_id: "agent-a".to_string(),
            node_label: "agent-a".to_string(),
            template: EvolutionTemplateKind::CustomTemplate,
            operation_type: EvolutionOperationType::CustomTransform,
            source_document: "MEMORY.md".to_string(),
            risk_level: "medium".to_string(),
            requires_confirmation: false,
            unsafe_apply: false,
            unsafe_reasons: Vec::new(),
            source_ref: Some("custom://playbook".to_string()),
            source_refs: vec![
                "custom://playbook".to_string(),
                "custom://shared-playbook".to_string(),
            ],
            capability_tags: vec!["custom".to_string()],
            changes: Vec::new(),
            bytes_before: 100,
            bytes_after: 120,
            snapshot_id: "snap-b".to_string(),
            created_at_ms: 1,
        };

        let (code, message, message_i18n) = classify_preflight_drift(
            &preview,
            "before",
            "before\ncustom://shared-playbook",
            "after",
        );

        assert_eq!(code, "EVOLUTION_SOURCE_REF_CONFLICT");
        assert!(message.contains("custom://shared-playbook"));
        assert_eq!(message_i18n.key, "evo.message.preflight.sourceRefConflict");
    }
}

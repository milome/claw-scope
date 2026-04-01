use std::{
    fs,
    process::Command,
    path::{Path, PathBuf},
    sync::Arc,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use chrono::{NaiveDate, Utc};
use futures_util::{stream::SplitStream, SinkExt, StreamExt};
use rand::RngCore;
use serde::Deserialize;
use serde_json::{json, Map, Value};
use tokio::{sync::Mutex as AsyncMutex, time::timeout};
use tokio_tungstenite::{connect_async, tungstenite::Message};

use crate::gateway::{
    auth::{select_connect_auth, validate_connect_auth_config, SelectedConnectAuth},
    device_identity::GatewayDeviceIdentity,
    endpoint::{GatewayEndpoint, GatewayTransportKind},
    errors::{GatewayError, GatewayErrorSummary},
    protocol::{
        extract_connect_challenge_nonce, parse_connect_error_recovery, parse_inbound_frame,
        ConnectClientInfo, ConnectParams, HelloOk, InboundFrame, RequestFrame,
        CONNECT_ERROR_AUTH_TOKEN_MISMATCH, CONNECT_ERROR_PAIRING_REQUIRED,
        CONNECT_EVENT_CHALLENGE, DEFAULT_CLIENT_ID, DEFAULT_CLIENT_MODE,
        DEFAULT_DEVICE_FAMILY, PROTOCOL_VERSION,
    },
    signer::{sign_connect_device, DeviceSignatureContext},
    state::{GatewayActiveConnection, GatewayAppState, GatewaySocket, GatewaySocketWriter},
    store::{
        load_device_auth_token, normalize_role, normalize_scopes, resolve_store_paths,
        store_device_auth_token,
    },
    types::{
        GatewayAgentFileEntry, GatewayAgentFileGetResult, GatewayAgentIdentityResult,
        GatewayAgentMemoryIndexResult,
        GatewayAgentMemoryDiagnostics, GatewayAgentMemoryResult,
        GatewayAgentMemoryRuntimeStatusCore, GatewayAgentMemoryRuntimeStatusResult,
        GatewayAgentMemoryRuntimeStatusSourceCount, GatewayAgentMemoryStatusResult,
        GatewayAgentMemoryStatusSource,
        GatewayAgentMemorySearchDiagnostics, GatewayAgentMemorySearchEntry,
        GatewayAgentMemorySearchOpenTarget, GatewayAgentMemorySearchResult,
        GatewayAgentMemorySearchSourceKind,
        GatewayAgentMemoryTimelineAccessReason, GatewayAgentMemoryTimelineAccessResult,
        GatewayAgentMemoryTimelineDiagnostics, GatewayAgentMemoryTimelineProbeDayResult,
        GatewayAgentMemoryTimelineProbeDayStatus, GatewayAgentMemoryTimelineProbeStatus,
        GatewayAgentMemoryTimelineProbeSummary, GatewayAgentMemoryTimelineResult,
        GatewayAgentMemoryTimelineSource,
        GatewayAgentSettingsResult, GatewayAgentsListResult, GatewayConnectConfig,
        GatewayConnectionPhase, GatewayMemorySharedAgentSummary, GatewayStatusSnapshot,
    },
};

const CONNECT_CHALLENGE_TIMEOUT: Duration = Duration::from_secs(10);
const CONNECT_RESPONSE_TIMEOUT: Duration = Duration::from_secs(15);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(15);
const REMOTE_TIMELINE_PROBE_WAIT_TIMEOUT: Duration = Duration::from_secs(20);
const REMOTE_TIMELINE_PROBE_REQUEST_TIMEOUT: Duration = Duration::from_secs(25);
const REMOTE_TIMELINE_PROBE_RETRY_WAIT_TIMEOUT: Duration = Duration::from_secs(35);
const REMOTE_TIMELINE_PROBE_RETRY_REQUEST_TIMEOUT: Duration = Duration::from_secs(40);
const REMOTE_TIMELINE_ENTRY_WAIT_TIMEOUT: Duration = Duration::from_secs(60);
const REMOTE_TIMELINE_ENTRY_REQUEST_TIMEOUT: Duration = Duration::from_secs(65);
const REMOTE_TIMELINE_PROBE_MAX_DAYS: i64 = 31;
const REMOTE_TIMELINE_PROBE_CACHE_TTL: Duration = Duration::from_secs(120);
const REMOTE_MEMORY_SEARCH_WAIT_TIMEOUT: Duration = Duration::from_secs(60);
const REMOTE_MEMORY_SEARCH_REQUEST_TIMEOUT: Duration = Duration::from_secs(65);
const APP_VERSION: &str = env!("CARGO_PKG_VERSION");

type GatewaySocketReader = SplitStream<GatewaySocket>;

pub async fn connect(
    state: GatewayAppState,
    config: GatewayConnectConfig,
) -> Result<GatewayStatusSnapshot, GatewayError> {
    validate_connect_auth_config(&config)?;
    let endpoint = GatewayEndpoint::from_config(&config)?;
    state.clear_timeline_probe_cache();

    if let Some(existing) = state.take_session().await {
        existing.reject_all_pending_requests(GatewayError::Transport {
            message: "gateway session replaced by a new connection attempt".to_string(),
        });
        close_connection_writer(&existing).await;
    }
    let role = normalize_role(&config.role);
    let scopes = normalize_scopes(&config.scopes);
    let store_paths = resolve_store_paths();
    let identity = GatewayDeviceIdentity::load_or_create(&store_paths)?;

    state.replace_snapshot(snapshot_for_phase(
        &endpoint,
        &identity.device_id,
        GatewayConnectionPhase::ResolvingEndpoint,
    ));

    let normalized_config = GatewayConnectConfig {
        role: role.clone(),
        scopes: scopes.clone(),
        ..config.clone()
    };
    let stored_device_token = load_device_auth_token(
        &store_paths,
        &identity.device_id,
        &endpoint.origin_key,
        &role,
        &scopes,
    )?;

    let mut retry_with_stored_device_token = false;
    let (writer, reader, hello) = loop {
        let selected_auth = select_connect_auth(
            &normalized_config,
            stored_device_token.as_ref(),
            retry_with_stored_device_token,
        );
        match perform_handshake(
            &state,
            &endpoint,
            &identity,
            &role,
            &scopes,
            &selected_auth,
        )
        .await
        {
            Ok(result) => break result,
            Err(error)
                if should_retry_with_stored_device_token(
                    &endpoint,
                    &normalized_config,
                    &selected_auth,
                    &error,
                    retry_with_stored_device_token,
                ) =>
            {
                retry_with_stored_device_token = true;
            }
            Err(error) => {
                state.replace_snapshot(failure_snapshot(&endpoint, &identity.device_id, &error));
                return Err(error);
            }
        }
    };

    if let Some(auth) = hello.auth.as_ref() {
        store_device_auth_token(
            &store_paths,
            &identity.device_id,
            &endpoint.origin_key,
            &auth.role,
            &auth.device_token,
            &auth.scopes,
        )?;
    }

    let session_id = random_hex_id();
    let writer = Arc::new(AsyncMutex::new(writer));
    let active_connection = GatewayActiveConnection::new(
        session_id.clone(),
        endpoint.clone(),
        Arc::clone(&writer),
        hello.features.methods.clone(),
    );
    let replaced = state.replace_session(Some(active_connection.clone())).await;
    if let Some(previous) = replaced {
        previous.reject_all_pending_requests(GatewayError::Transport {
            message: "gateway session replaced by a newer live session".to_string(),
        });
        close_connection_writer(&previous).await;
    }
    spawn_connection_reader(state.clone(), active_connection, reader);

    let snapshot = GatewayStatusSnapshot {
        phase: GatewayConnectionPhase::Connected,
        gateway_origin: Some(endpoint.origin_key.clone()),
        device_id: Some(identity.device_id.clone()),
        granted_role: Some(
            hello
                .auth
                .as_ref()
                .map(|auth| auth.role.clone())
                .unwrap_or(role),
        ),
        granted_scopes: hello
            .auth
            .as_ref()
            .map(|auth| auth.scopes.clone())
            .unwrap_or(scopes),
        last_error: None,
        is_paired: true,
        can_retry_with_device_token: false,
    };
    state.replace_snapshot(snapshot.clone());
    Ok(snapshot)
}

pub async fn disconnect(state: GatewayAppState) -> Result<GatewayStatusSnapshot, GatewayError> {
    state.clear_timeline_probe_cache();
    if let Some(existing) = state.take_session().await {
        existing.reject_all_pending_requests(GatewayError::Transport {
            message: "gateway disconnected".to_string(),
        });
        close_connection_writer(&existing).await;
    }

    let mut snapshot = state.snapshot();
    snapshot.phase = GatewayConnectionPhase::Disconnected;
    snapshot.granted_role = None;
    snapshot.granted_scopes.clear();
    snapshot.last_error = None;
    snapshot.is_paired = false;
    snapshot.can_retry_with_device_token = false;
    state.replace_snapshot(snapshot.clone());
    Ok(snapshot)
}

pub async fn agents_list(state: GatewayAppState) -> Result<GatewayAgentsListResult, GatewayError> {
    let value = request_json(
        state,
        "agents.list",
        Some(Value::Object(Map::new())),
    )
    .await?;
    serde_json::from_value(value).map_err(|error| GatewayError::Protocol {
        message: format!("failed decoding agents.list payload: {error}"),
    })
}

pub async fn agent_identity_get(
    state: GatewayAppState,
    agent_id: &str,
) -> Result<GatewayAgentIdentityResult, GatewayError> {
    let value = request_json(
        state,
        "agent.identity.get",
        Some(json!({ "agentId": agent_id })),
    )
    .await?;
    serde_json::from_value(value).map_err(|error| GatewayError::Protocol {
        message: format!("failed decoding agent.identity.get payload: {error}"),
    })
}

pub async fn agent_soul_get(
    state: GatewayAppState,
    agent_id: &str,
) -> Result<GatewayAgentFileGetResult, GatewayError> {
    agent_file_get(state, agent_id, "SOUL.md").await
}

pub async fn agent_file_read(
    state: GatewayAppState,
    agent_id: &str,
    name: &str,
) -> Result<GatewayAgentFileGetResult, GatewayError> {
    agent_file_get(state, agent_id, name).await
}

pub async fn agent_workspace_identity_get(
    state: GatewayAppState,
    agent_id: &str,
) -> Result<GatewayAgentFileGetResult, GatewayError> {
    agent_file_get(state, agent_id, "IDENTITY.md").await
}

pub async fn agent_memory_get(
    state: GatewayAppState,
    agent_id: &str,
) -> Result<GatewayAgentMemoryResult, GatewayError> {
    let agents = agents_list(state.clone()).await?;
    let primary_document = agent_file_get(state.clone(), agent_id, "MEMORY.md").await?;
    let legacy_document = agent_file_get(state.clone(), agent_id, "memory.md").await?;
    let mut workspace = resolve_memory_workspace(
        primary_document.workspace.as_str(),
        legacy_document.workspace.as_str(),
    );
    let config = request_json(
        state.clone(),
        "config.get",
        Some(Value::Object(Map::new())),
    )
    .await
    .ok()
    .and_then(|value| parse_gateway_config(value).ok());
    if workspace.trim().is_empty() {
        if let Some(config) = config.as_ref() {
            if let Some(config_workspace) =
                resolve_agent_workspace(config, agent_id, &agents.default_id)
            {
                workspace = config_workspace;
            }
        }
    }
    let shared_agents =
        resolve_shared_workspace_agents(state.clone(), &agents, agent_id, workspace.as_str()).await;
    let diagnostics = config.as_ref().map(|config| {
        resolve_agent_memory_diagnostics(config, agent_id, &agents.default_id, workspace.as_str())
    });

    Ok(GatewayAgentMemoryResult {
        agent_id: agent_id.to_string(),
        workspace,
        documents: order_memory_root_documents(vec![primary_document.file, legacy_document.file]),
        shared_agents,
        diagnostics,
    })
}

pub async fn agent_memory_search(
    state: GatewayAppState,
    agent_id: &str,
    query: &str,
    max_results: Option<usize>,
    source_filter: Option<&str>,
) -> Result<GatewayAgentMemorySearchResult, GatewayError> {
    let memory = agent_memory_get(state.clone(), agent_id).await?;
    let query = query.trim().to_string();
    let diagnostics = build_agent_memory_search_diagnostics(memory.diagnostics.as_ref());
    if query.is_empty() {
        return Ok(GatewayAgentMemorySearchResult {
            agent_id: agent_id.to_string(),
            query,
            executed_at_ms: current_timestamp_ms(),
            diagnostics,
            results: Vec::new(),
        });
    }

    if !diagnostics.available {
        return Ok(GatewayAgentMemorySearchResult {
            agent_id: agent_id.to_string(),
            query,
            executed_at_ms: current_timestamp_ms(),
            diagnostics,
            results: Vec::new(),
        });
    }

    let result_limit = normalize_memory_search_max_results(max_results);
    let normalized_source_filter = normalize_memory_search_source_filter(source_filter);
    let prompt = build_memory_search_prompt(
        query.as_str(),
        result_limit,
        normalized_source_filter.as_deref(),
    );
    let session = create_remote_probe_session(state.clone(), agent_id).await?;
    let session_key = session.key.clone();

    let search_result = async {
        let send_response = send_remote_probe_session_message(
            state.clone(),
            session_key.as_str(),
            prompt.as_str(),
            REMOTE_MEMORY_SEARCH_REQUEST_TIMEOUT,
        )
        .await?;

        if let RemoteProbeSendDisposition::Wait(run_id) =
            resolve_remote_probe_send_disposition(send_response, "memory_search")?
        {
            wait_for_remote_probe_run(
                state.clone(),
                run_id.as_str(),
                REMOTE_MEMORY_SEARCH_WAIT_TIMEOUT,
                REMOTE_MEMORY_SEARCH_REQUEST_TIMEOUT,
            )
            .await?;
        }

        let messages = request_session_messages(state.clone(), session_key.as_str()).await?;
        let reply = parse_remote_memory_search_reply_from_messages(messages.as_slice())?;
        let mut results = reply
            .results
            .into_iter()
            .enumerate()
            .map(|(index, entry)| {
                normalize_remote_memory_search_entry(
                    memory.workspace.as_str(),
                    memory.diagnostics.as_ref(),
                    entry,
                    index,
                )
            })
            .collect::<Vec<_>>();

        if let Some(filter) = normalized_source_filter.as_deref() {
            results.retain(|entry| matches_memory_search_source_filter(entry, filter));
        }
        results.truncate(result_limit);

        Ok(GatewayAgentMemorySearchResult {
            agent_id: agent_id.to_string(),
            query: query.clone(),
            executed_at_ms: current_timestamp_ms(),
            diagnostics,
            results,
        })
    }
    .await;

    delete_remote_probe_session(state, session_key.as_str()).await;
    search_result
}

pub async fn agent_memory_status(
    state: GatewayAppState,
    agent_id: &str,
) -> Result<GatewayAgentMemoryStatusResult, GatewayError> {
    let value = request_json(
        state,
        "doctor.memory.status",
        Some(json!({
            "agentId": agent_id,
            "deep": true,
            "index": true,
        })),
    )
    .await?;

    let payload: GatewayMemoryStatusResponse =
        serde_json::from_value(value).map_err(|error| GatewayError::Protocol {
            message: format!("failed decoding doctor.memory.status payload: {error}"),
        })?;

    let indexed = payload.indexed;
    let by_source = payload
        .by_source
        .unwrap_or_default()
        .into_iter()
        .filter_map(|entry| {
            let source = entry.source?.trim().to_string();
            if source.is_empty() {
                return None;
            }

            Some(GatewayAgentMemoryStatusSource {
                source,
                indexed_files: entry.indexed_files,
                total_files: entry.total_files,
                chunks: entry.chunks,
            })
        })
        .collect::<Vec<_>>();

    Ok(GatewayAgentMemoryStatusResult {
        agent_id: agent_id.to_string(),
        provider: normalize_optional_string(payload.provider),
        requested_provider: normalize_optional_string(payload.requested_provider),
        model: normalize_optional_string(payload.model),
        embeddings_available: payload
            .embeddings
            .as_deref()
            .map(|value| value.eq_ignore_ascii_case("available")),
        embeddings_error: normalize_optional_string(payload.embeddings_error),
        indexed_files: indexed.as_ref().and_then(|value| value.indexed_files),
        total_files: indexed.as_ref().and_then(|value| value.total_files),
        chunks: indexed.as_ref().and_then(|value| value.chunks),
        by_source,
    })
}

pub async fn agent_memory_runtime_status(
    state: GatewayAppState,
    agent_id: &str,
) -> Result<GatewayAgentMemoryRuntimeStatusResult, GatewayError> {
    // Local-only enhancement.
    // This bridge shells out to the local `openclaw` CLI and therefore only works
    // for same-machine sessions. Remote/LAN gateway sessions must not rely on it.
    let endpoint = state
        .session()
        .await
        .map(|session| session.endpoint.transport)
        .ok_or_else(|| GatewayError::Transport {
            message: "gateway not connected".to_string(),
        })?;
    if endpoint != GatewayTransportKind::LocalLoopback {
        return Err(GatewayError::NotImplemented {
            feature: "local-only memory runtime status bridge for remote gateway sessions".to_string(),
        });
    }

    let output = Command::new("openclaw")
        .args(["memory", "status", "--json", "--deep", "--agent", agent_id])
        .output()
        .map_err(|error| GatewayError::Transport {
            message: format!("failed to run local openclaw CLI: {error}"),
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(GatewayError::Transport {
            message: if stderr.is_empty() {
                format!("local openclaw CLI exited with status {}", output.status)
            } else {
                format!("local openclaw CLI failed: {stderr}")
            },
        });
    }

    let stdout = String::from_utf8(output.stdout).map_err(|error| GatewayError::Protocol {
        message: format!("failed decoding local openclaw CLI output: {error}"),
    })?;
    let raw_payload = stdout.trim().to_string();
    let payload: CliMemoryStatusPayload =
        serde_json::from_str(raw_payload.as_str()).map_err(|error| GatewayError::Protocol {
            message: format!("failed decoding local openclaw memory status json: {error}"),
        })?;

    let source_counts = payload
        .by_source
        .clone()
        .unwrap_or_default()
        .into_iter()
        .filter_map(|entry| {
            let source = entry.source?.trim().to_string();
            if source.is_empty() {
                return None;
            }
            Some(GatewayAgentMemoryRuntimeStatusSourceCount {
                source,
                files: entry.indexed_files.unwrap_or(0),
                chunks: entry.chunks.unwrap_or(0),
            })
        })
        .collect::<Vec<_>>();

    let config_value = request_json(state.clone(), "config.get", Some(Value::Object(Map::new()))).await?;
    let config = parse_gateway_config(config_value)?;
    let agents = agents_list(state.clone()).await?;
    let default_id = agents.default_id.clone();
    let memory = agent_memory_get(state, agent_id).await?;
    let workspace_dir = if memory.workspace.trim().is_empty() {
        resolve_agent_workspace(&config, agent_id, &default_id)
    } else {
        Some(memory.workspace.clone())
    };

    let normalized_provider = normalize_optional_string(payload.provider.clone());
    let normalized_requested_provider = normalize_optional_string(payload.requested_provider.clone());
    let normalized_model = normalize_optional_string(payload.model.clone());

    Ok(GatewayAgentMemoryRuntimeStatusResult {
        agent_id: agent_id.to_string(),
        embedding_ok: payload
            .embeddings
            .as_deref()
            .map(|value| value.eq_ignore_ascii_case("ready") || value.eq_ignore_ascii_case("available"))
            .unwrap_or(false),
        embedding_error: normalize_optional_string(payload.embeddings_error),
        vector_ok: payload.indexed.as_ref().and_then(|item| item.chunks).unwrap_or(0) > 0,
        status: GatewayAgentMemoryRuntimeStatusCore {
            backend: memory
                .diagnostics
                .as_ref()
                .map(|item| item.backend.clone())
                .unwrap_or_else(|| "unknown".to_string()),
            files: payload.indexed.as_ref().and_then(|item| item.indexed_files).unwrap_or(0),
            total_files: payload.indexed.as_ref().and_then(|item| item.total_files),
            chunks: payload.indexed.as_ref().and_then(|item| item.chunks).unwrap_or(0),
            dirty: false,
            workspace_dir,
            db_path: memory
                .diagnostics
                .as_ref()
                .map(|item| item.builtin_store_path.clone()),
            provider: normalized_provider
                .clone()
                .unwrap_or_else(|| "unknown".to_string()),
            model: normalized_model,
            requested_provider: normalized_requested_provider
                .or_else(|| normalized_provider)
                .unwrap_or_else(|| "unknown".to_string()),
            sources: memory
                .diagnostics
                .as_ref()
                .map(|item| item.sources.clone())
                .unwrap_or_default(),
            extra_paths: memory
                .diagnostics
                .as_ref()
                .map(|item| item.extra_paths.clone())
                .unwrap_or_default(),
            source_counts,
        },
        raw_payload,
    })
}

pub async fn agent_memory_index(
    state: GatewayAppState,
    agent_id: &str,
    force: bool,
) -> Result<GatewayAgentMemoryIndexResult, GatewayError> {
    let endpoint = state
        .session()
        .await
        .map(|session| session.endpoint.transport)
        .ok_or_else(|| GatewayError::Transport {
            message: "gateway not connected".to_string(),
        })?;
    if endpoint != GatewayTransportKind::LocalLoopback {
        return Err(GatewayError::NotImplemented {
            feature: "local-only memory index bridge for remote gateway sessions".to_string(),
        });
    }

    let mut command = Command::new("openclaw");
    command.args(["memory", "index", "--agent", agent_id]);
    if force {
        command.arg("--force");
    }

    let output = command.output().map_err(|error| GatewayError::Transport {
        message: format!("failed to run local openclaw CLI: {error}"),
    })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(GatewayError::Transport {
            message: if stderr.is_empty() {
                format!("local openclaw CLI exited with status {}", output.status)
            } else {
                format!("local openclaw CLI failed: {stderr}")
            },
        });
    }

    let stdout = String::from_utf8(output.stdout).map_err(|error| GatewayError::Protocol {
        message: format!("failed decoding local openclaw CLI output: {error}"),
    })?;

    Ok(GatewayAgentMemoryIndexResult {
        agent_id: agent_id.to_string(),
        forced: force,
        stdout: stdout.trim().to_string(),
    })
}

pub async fn agent_memory_timeline_get(
    state: GatewayAppState,
    agent_id: &str,
) -> Result<GatewayAgentMemoryTimelineResult, GatewayError> {
    agent_memory_timeline_local_scan(state, agent_id).await
}

pub async fn agent_memory_timeline_access_resolve(
    state: GatewayAppState,
    agent_id: &str,
) -> Result<GatewayAgentMemoryTimelineAccessResult, GatewayError> {
    if state.snapshot().phase != GatewayConnectionPhase::Connected {
        return Ok(GatewayAgentMemoryTimelineAccessResult {
            agent_id: agent_id.to_string(),
            workspace: String::new(),
            mode: GatewayAgentMemoryTimelineSource::Unavailable,
            reason: GatewayAgentMemoryTimelineAccessReason::GatewayNotConnected,
        });
    }

    let memory = agent_memory_get(state, agent_id).await?;
    let workspace = memory.workspace.trim().to_string();
    if workspace.is_empty() {
        return Ok(GatewayAgentMemoryTimelineAccessResult {
            agent_id: agent_id.to_string(),
            workspace,
            mode: GatewayAgentMemoryTimelineSource::Unavailable,
            reason: GatewayAgentMemoryTimelineAccessReason::WorkspaceMissing,
        });
    }

    let local_workspace_path = expand_workspace_path(workspace.as_str());
    let access = resolve_memory_timeline_access(local_workspace_path.as_path(), true)?;

    Ok(GatewayAgentMemoryTimelineAccessResult {
        agent_id: agent_id.to_string(),
        workspace,
        mode: access.mode,
        reason: access.reason,
    })
}

pub async fn agent_memory_timeline_local_scan(
    state: GatewayAppState,
    agent_id: &str,
) -> Result<GatewayAgentMemoryTimelineResult, GatewayError> {
    let access = agent_memory_timeline_access_resolve(state, agent_id).await?;
    let empty_diagnostics = GatewayAgentMemoryTimelineDiagnostics {
        gateway_visible_files_count: 0,
        gateway_visible_root_docs_count: 0,
        gateway_visible_daily_count: 0,
        gateway_only_returned_root_docs: false,
        local_scan_directory: None,
        local_scan_files_count: 0,
        local_scan_skipped_count: 0,
    };

    let resolved_access = resolve_memory_timeline_access(
        expand_workspace_path(access.workspace.as_str()).as_path(),
        true,
    )?;
    let Some(local_workspace_path) = resolved_access.local_workspace_path else {
        return Ok(GatewayAgentMemoryTimelineResult {
            agent_id: agent_id.to_string(),
            workspace: access.workspace,
            source: resolved_access.mode,
            entries: Vec::new(),
            diagnostics: empty_diagnostics,
            probe: None,
        });
    };

    let scan = scan_local_memory_timeline_entries(local_workspace_path.as_path())?;
    Ok(GatewayAgentMemoryTimelineResult {
        agent_id: agent_id.to_string(),
        workspace: access.workspace,
        source: GatewayAgentMemoryTimelineSource::LocalWorkspace,
        entries: scan.entries,
        diagnostics: GatewayAgentMemoryTimelineDiagnostics {
            local_scan_directory: Some(scan.local_scan_directory),
            local_scan_files_count: scan.local_scan_files_count,
            local_scan_skipped_count: scan.local_scan_skipped_count,
            ..empty_diagnostics
        },
        probe: None,
    })
}

pub async fn agent_memory_timeline_remote_probe(
    state: GatewayAppState,
    agent_id: &str,
    start_date: &str,
    end_date: &str,
) -> Result<GatewayAgentMemoryTimelineResult, GatewayError> {
    let access = agent_memory_timeline_access_resolve(state.clone(), agent_id).await?;
    let workspace = access.workspace.clone();
    let gateway_origin = state.snapshot().gateway_origin;
    let names = build_timeline_probe_date_names(start_date, end_date)?;
    let cache_key = build_remote_probe_cache_key(
        gateway_origin.as_deref(),
        agent_id,
        workspace.as_str(),
        start_date,
        end_date,
    );
    let now_ms = now_unix_timestamp_ms();
    if let Some(mut cached_result) = state.load_timeline_probe_cache(cache_key.as_str(), now_ms) {
        if let Some(probe) = cached_result.probe.as_mut() {
            probe.cached = true;
        }
        return Ok(cached_result);
    }

    let result = run_remote_timeline_probe(
        state.clone(),
        agent_id,
        workspace.as_str(),
        names,
        Some((start_date.to_string(), end_date.to_string())),
    )
    .await?;
    if result
        .probe
        .as_ref()
        .map(|probe| should_cache_remote_probe_result(&probe.status))
        .unwrap_or(false)
    {
        state.store_timeline_probe_cache(
            cache_key,
            result.clone(),
            now_ms.saturating_add(REMOTE_TIMELINE_PROBE_CACHE_TTL.as_millis() as u64),
        );
    }

    Ok(result)
}

pub async fn agent_memory_timeline_remote_probe_dates(
    state: GatewayAppState,
    agent_id: &str,
    dates: &[String],
) -> Result<GatewayAgentMemoryTimelineResult, GatewayError> {
    let access = agent_memory_timeline_access_resolve(state.clone(), agent_id).await?;
    let workspace = access.workspace.clone();
    let names = build_timeline_probe_date_names_from_dates(dates)?;

    run_remote_timeline_probe(state, agent_id, workspace.as_str(), names, None).await
}

pub async fn agent_memory_timeline_entry_get(
    state: GatewayAppState,
    agent_id: &str,
    name: &str,
) -> Result<GatewayAgentFileGetResult, GatewayError> {
    agent_memory_timeline_entry_read(state, agent_id, name).await
}

pub async fn agent_memory_timeline_entry_read(
    state: GatewayAppState,
    agent_id: &str,
    name: &str,
) -> Result<GatewayAgentFileGetResult, GatewayError> {
    let access = agent_memory_timeline_access_resolve(state.clone(), agent_id).await?;
    let resolved_access = resolve_memory_timeline_access(
        expand_workspace_path(access.workspace.as_str()).as_path(),
        true,
    )?;
    let file = if let Some(local_workspace_path) = resolved_access.local_workspace_path {
        read_local_memory_timeline_entry(local_workspace_path.as_path(), name)?
    } else {
        remote_read_memory_timeline_entry(
            state.clone(),
            agent_id,
            access.workspace.as_str(),
            name,
            true,
        )
        .await?
    };

    Ok(GatewayAgentFileGetResult {
        agent_id: agent_id.to_string(),
        workspace: access.workspace,
        file,
    })
}

pub async fn agent_settings_get(
    state: GatewayAppState,
    agent_id: &str,
) -> Result<GatewayAgentSettingsResult, GatewayError> {
    let agents = agents_list(state.clone()).await?;
    let workspace = agent_workspace_identity_get(state.clone(), agent_id).await?;
    let config_value = request_json(
        state,
        "config.get",
        Some(Value::Object(Map::new())),
    )
    .await?;
    let config = parse_gateway_config(config_value)?;

    Ok(GatewayAgentSettingsResult {
        agent_id: agent_id.to_string(),
        workspace: normalize_optional_string(Some(workspace.workspace)),
        model: resolve_agent_model(&config, agent_id, &agents.default_id),
    })
}

pub async fn agent_workspace_identity_set(
    state: GatewayAppState,
    agent_id: &str,
    content: &str,
) -> Result<(), GatewayError> {
    agent_file_set(state, agent_id, "IDENTITY.md", content).await
}

pub async fn agent_soul_set(
    state: GatewayAppState,
    agent_id: &str,
    content: &str,
) -> Result<(), GatewayError> {
    agent_file_set(state, agent_id, "SOUL.md", content).await
}

pub async fn agent_memory_set(
    state: GatewayAppState,
    agent_id: &str,
    name: &str,
    content: &str,
) -> Result<(), GatewayError> {
    agent_file_set(state, agent_id, normalize_memory_root_document_name(name)?, content).await
}

async fn agent_file_get(
    state: GatewayAppState,
    agent_id: &str,
    name: &str,
) -> Result<GatewayAgentFileGetResult, GatewayError> {
    let value = request_json(
        state,
        "agents.files.get",
        Some(json!({ "agentId": agent_id, "name": name })),
    )
    .await?;
    serde_json::from_value(value).map_err(|error| GatewayError::Protocol {
        message: format!("failed decoding agents.files.get payload for {name}: {error}"),
    })
}

#[derive(Debug)]
struct ResolvedMemoryTimelineAccess {
    mode: GatewayAgentMemoryTimelineSource,
    reason: GatewayAgentMemoryTimelineAccessReason,
    local_workspace_path: Option<PathBuf>,
}

#[derive(Debug)]
struct LocalMemoryTimelineScan {
    entries: Vec<GatewayAgentFileEntry>,
    local_scan_directory: String,
    local_scan_files_count: usize,
    local_scan_skipped_count: usize,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GatewaySessionCreateResponse {
    key: String,
    run_started: Option<bool>,
    run_id: Option<String>,
    run_error: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GatewaySessionSendResponse {
    run_id: Option<String>,
    status: Option<String>,
    error: Option<String>,
    summary: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GatewayAgentWaitResponse {
    status: String,
    error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GatewaySessionMessagesResponse {
    messages: Vec<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GatewayMemoryStatusResponse {
    provider: Option<String>,
    requested_provider: Option<String>,
    model: Option<String>,
    embeddings: Option<String>,
    embeddings_error: Option<String>,
    indexed: Option<GatewayMemoryStatusIndexed>,
    by_source: Option<Vec<GatewayMemoryStatusBySource>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GatewayMemoryStatusIndexed {
    indexed_files: Option<u64>,
    total_files: Option<u64>,
    chunks: Option<u64>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GatewayMemoryStatusBySource {
    source: Option<String>,
    indexed_files: Option<u64>,
    total_files: Option<u64>,
    chunks: Option<u64>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CliMemoryStatusPayload {
    provider: Option<String>,
    requested_provider: Option<String>,
    model: Option<String>,
    embeddings: Option<String>,
    embeddings_error: Option<String>,
    indexed: Option<GatewayMemoryStatusIndexed>,
    by_source: Option<Vec<GatewayMemoryStatusBySource>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteTimelineProbeReply {
    name: String,
    missing: bool,
    #[serde(default)]
    text_length: Option<usize>,
    #[serde(default)]
    content_preview: Option<String>,
    #[serde(default)]
    content: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteMemorySearchReply {
    #[serde(default)]
    results: Vec<RemoteMemorySearchReplyEntry>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RemoteMemorySearchReplyEntry {
    path: String,
    #[serde(default)]
    snippet: Option<String>,
    #[serde(default)]
    score: Option<f64>,
    #[serde(default)]
    line_start: Option<u64>,
    #[serde(default)]
    line_end: Option<u64>,
}

#[derive(Debug, PartialEq, Eq)]
enum RemoteProbeSendDisposition {
    Wait(String),
    Completed,
}

async fn agent_file_set(
    state: GatewayAppState,
    agent_id: &str,
    name: &str,
    content: &str,
) -> Result<(), GatewayError> {
    request_json(
        state,
        "agents.files.set",
        Some(json!({
            "agentId": agent_id,
            "name": name,
            "content": content,
        })),
    )
    .await?;
    Ok(())
}

fn expand_workspace_path(workspace: &str) -> PathBuf {
    let trimmed = workspace.trim();
    if trimmed.is_empty() {
        return PathBuf::new();
    }

    if trimmed == "~" {
        return current_user_home_dir().unwrap_or_else(|| PathBuf::from(trimmed));
    }

    if let Some(suffix) = trimmed
        .strip_prefix("~/")
        .or_else(|| trimmed.strip_prefix("~\\"))
    {
        if let Some(home_dir) = current_user_home_dir() {
            return home_dir.join(suffix);
        }
    }

    PathBuf::from(trimmed)
}

fn current_user_home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(PathBuf::from))
}

fn current_timestamp_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

fn resolve_memory_search_store_driver(
    diagnostics: Option<&GatewayAgentMemoryDiagnostics>,
) -> String {
    if diagnostics.is_some_and(|value| value.qmd_active) {
        "qmd".to_string()
    } else {
        "sqlite".to_string()
    }
}

fn build_agent_memory_search_diagnostics(
    diagnostics: Option<&GatewayAgentMemoryDiagnostics>,
) -> GatewayAgentMemorySearchDiagnostics {
    match diagnostics {
        Some(diagnostics) => GatewayAgentMemorySearchDiagnostics {
            available: diagnostics.memory_search_enabled,
            provider: diagnostics.provider.clone(),
            sources: diagnostics.sources.clone(),
            session_memory_enabled: diagnostics.session_memory_enabled,
            store_driver: resolve_memory_search_store_driver(Some(diagnostics)),
            store_path: diagnostics.builtin_store_path.clone(),
            backend: diagnostics.backend.clone(),
            advice: Some(if diagnostics.memory_search_enabled {
                "Semantic memory search is available through the current gateway session."
                    .to_string()
            } else {
                "memory_search is currently unavailable for this agent. Check memorySearch settings and the embedding provider on the OpenClaw host.".to_string()
            }),
        },
        None => GatewayAgentMemorySearchDiagnostics {
            available: false,
            provider: None,
            sources: Vec::new(),
            session_memory_enabled: false,
            store_driver: "sqlite".to_string(),
            store_path: String::new(),
            backend: "unknown".to_string(),
            advice: Some(
                "Memory search diagnostics are not available from the current gateway session yet."
                    .to_string(),
            ),
        },
    }
}

fn normalize_memory_search_max_results(max_results: Option<usize>) -> usize {
    max_results.unwrap_or(8).clamp(1, 20)
}

fn normalize_memory_search_source_filter(source_filter: Option<&str>) -> Option<String> {
    source_filter
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.to_ascii_lowercase())
        .filter(|value| {
            matches!(
                value.as_str(),
                "root_memory"
                    | "daily_memory"
                    | "workspace_markdown"
                    | "extra_path"
                    | "session_transcript"
            )
        })
}

fn build_memory_search_prompt(
    query: &str,
    max_results: usize,
    source_filter: Option<&str>,
) -> String {
    let filter_clause = source_filter.map_or_else(
        || "No source filter is applied. Search across all available memory sources.".to_string(),
        |filter| {
            format!(
                "Apply this source filter after using memory_search and only keep matching hits: {filter}.\n\
Supported filters: root_memory, daily_memory, workspace_markdown, extra_path, session_transcript."
            )
        },
    );

    format!(
        "Use memory_search to search the agent memory for this query:\n{query}\n\n\
Return exactly one JSON object and nothing else.\n\
{{\"results\":[{{\"path\":\"~/.openclaw/workspace-main/MEMORY.md\",\"snippet\":\"relevant excerpt\",\"score\":0.91,\"lineStart\":12,\"lineEnd\":18}}]}}\n\n\
Rules:\n\
- You must call memory_search.\n\
- Return at most {max_results} results.\n\
- Use the exact path returned by memory_search for each hit.\n\
- snippet must be a concise relevant excerpt from the matched document.\n\
- score may be null if the tool does not expose one.\n\
- lineStart and lineEnd may be null if unavailable.\n\
- If there are no matches, return {{\"results\":[]}}.\n\
- Do not wrap the JSON in markdown fences.\n\
- Do not add commentary before or after the JSON.\n\
- {filter_clause}"
    )
}

fn normalize_remote_memory_search_entry(
    workspace: &str,
    diagnostics: Option<&GatewayAgentMemoryDiagnostics>,
    entry: RemoteMemorySearchReplyEntry,
    index: usize,
) -> GatewayAgentMemorySearchEntry {
    let path = entry.path.trim().to_string();
    let source_kind = resolve_memory_search_source_kind(
        path.as_str(),
        workspace,
        diagnostics,
    );
    let open_target = resolve_memory_search_open_target(source_kind);
    let canonical_document_name = match source_kind {
        GatewayAgentMemorySearchSourceKind::RootMemory => {
            resolve_memory_search_root_document_name(path.as_str())
        }
        _ => None,
    };
    let timeline_entry_name = match source_kind {
        GatewayAgentMemorySearchSourceKind::DailyMemory => {
            resolve_memory_search_timeline_entry_name(path.as_str())
        }
        _ => None,
    };
    let stable_line = entry.line_start.or(entry.line_end).unwrap_or_default();

    GatewayAgentMemorySearchEntry {
        id: format!("{path}#{stable_line}:{index}"),
        path,
        snippet: entry.snippet.unwrap_or_default().trim().to_string(),
        score: entry.score,
        line_start: entry.line_start,
        line_end: entry.line_end,
        source_kind,
        open_target,
        canonical_document_name,
        timeline_entry_name,
    }
}

fn resolve_memory_search_source_kind(
    path: &str,
    workspace: &str,
    diagnostics: Option<&GatewayAgentMemoryDiagnostics>,
) -> GatewayAgentMemorySearchSourceKind {
    let normalized_path = path.trim().replace('\\', "/");
    if normalized_path.is_empty() {
        return GatewayAgentMemorySearchSourceKind::Unknown;
    }

    if normalized_path == "MEMORY.md"
        || normalized_path == "memory.md"
        || normalized_path.ends_with("/MEMORY.md")
        || normalized_path.ends_with("/memory.md")
    {
        return GatewayAgentMemorySearchSourceKind::RootMemory;
    }

    if resolve_memory_search_timeline_entry_name(normalized_path.as_str()).is_some() {
        return GatewayAgentMemorySearchSourceKind::DailyMemory;
    }

    if normalized_path.contains("/sessions/") {
        return GatewayAgentMemorySearchSourceKind::SessionTranscript;
    }

    let workspace_prefix = workspace.trim().replace('\\', "/");
    if !workspace_prefix.is_empty()
        && normalized_path.starts_with(workspace_prefix.as_str())
        && normalized_path.ends_with(".md")
    {
        return GatewayAgentMemorySearchSourceKind::WorkspaceMarkdown;
    }

    if diagnostics.is_some_and(|value| {
        value.extra_paths.iter().chain(value.qmd_paths.iter()).any(|candidate| {
            let normalized_candidate = candidate.trim().replace('\\', "/");
            !normalized_candidate.is_empty()
                && (normalized_path.contains(normalized_candidate.as_str())
                    || normalized_path.starts_with(normalized_candidate.as_str()))
        })
    }) {
        return GatewayAgentMemorySearchSourceKind::ExtraPath;
    }

    if normalized_path.ends_with(".md") {
        GatewayAgentMemorySearchSourceKind::WorkspaceMarkdown
    } else {
        GatewayAgentMemorySearchSourceKind::Unknown
    }
}

fn resolve_memory_search_open_target(
    source_kind: GatewayAgentMemorySearchSourceKind,
) -> GatewayAgentMemorySearchOpenTarget {
    match source_kind {
        GatewayAgentMemorySearchSourceKind::RootMemory => {
            GatewayAgentMemorySearchOpenTarget::Documents
        }
        GatewayAgentMemorySearchSourceKind::DailyMemory => {
            GatewayAgentMemorySearchOpenTarget::Footprints
        }
        GatewayAgentMemorySearchSourceKind::WorkspaceMarkdown
        | GatewayAgentMemorySearchSourceKind::ExtraPath
        | GatewayAgentMemorySearchSourceKind::SessionTranscript
        | GatewayAgentMemorySearchSourceKind::Unknown => {
            GatewayAgentMemorySearchOpenTarget::DetailSheet
        }
    }
}

fn resolve_memory_search_root_document_name(path: &str) -> Option<String> {
    let normalized_path = path.trim().replace('\\', "/");
    if normalized_path == "MEMORY.md" || normalized_path.ends_with("/MEMORY.md") {
        Some("MEMORY.md".to_string())
    } else if normalized_path == "memory.md" || normalized_path.ends_with("/memory.md") {
        Some("memory.md".to_string())
    } else {
        None
    }
}

fn resolve_memory_search_timeline_entry_name(path: &str) -> Option<String> {
    let normalized_path = path.trim().replace('\\', "/");
    if is_daily_memory_entry_name(normalized_path.as_str()) {
        return Some(normalized_path);
    }
    let marker = "/memory/";
    let marker_index = normalized_path.rfind(marker)?;
    let suffix = &normalized_path[marker_index + 1..];
    is_daily_memory_entry_name(suffix).then(|| suffix.to_string())
}

fn matches_memory_search_source_filter(
    entry: &GatewayAgentMemorySearchEntry,
    source_filter: &str,
) -> bool {
    matches!(
        (source_filter, entry.source_kind),
        ("root_memory", GatewayAgentMemorySearchSourceKind::RootMemory)
            | ("daily_memory", GatewayAgentMemorySearchSourceKind::DailyMemory)
            | (
                "workspace_markdown",
                GatewayAgentMemorySearchSourceKind::WorkspaceMarkdown
            )
            | ("extra_path", GatewayAgentMemorySearchSourceKind::ExtraPath)
            | (
                "session_transcript",
                GatewayAgentMemorySearchSourceKind::SessionTranscript
            )
    )
}

fn resolve_memory_timeline_access(
    workspace_path: &Path,
    is_connected: bool,
) -> Result<ResolvedMemoryTimelineAccess, GatewayError> {
    if !is_connected {
        return Ok(ResolvedMemoryTimelineAccess {
            mode: GatewayAgentMemoryTimelineSource::Unavailable,
            reason: GatewayAgentMemoryTimelineAccessReason::GatewayNotConnected,
            local_workspace_path: None,
        });
    }

    if workspace_path.as_os_str().is_empty() {
        return Ok(ResolvedMemoryTimelineAccess {
            mode: GatewayAgentMemoryTimelineSource::Unavailable,
            reason: GatewayAgentMemoryTimelineAccessReason::WorkspaceMissing,
            local_workspace_path: None,
        });
    }

    match fs::metadata(workspace_path) {
        Ok(metadata) if metadata.is_dir() => Ok(ResolvedMemoryTimelineAccess {
            mode: GatewayAgentMemoryTimelineSource::LocalWorkspace,
            reason: GatewayAgentMemoryTimelineAccessReason::WorkspaceLocalAndReadable,
            local_workspace_path: Some(workspace_path.to_path_buf()),
        }),
        Ok(_) | Err(_) => Ok(ResolvedMemoryTimelineAccess {
            mode: GatewayAgentMemoryTimelineSource::RemoteProbe,
            reason: GatewayAgentMemoryTimelineAccessReason::WorkspaceRemoteOrNotReadable,
            local_workspace_path: None,
        }),
    }
}

fn scan_local_memory_timeline_entries(
    workspace_path: &Path,
) -> Result<LocalMemoryTimelineScan, GatewayError> {
    let memory_dir = workspace_path.join("memory");
    if !memory_dir.exists() {
        return Ok(LocalMemoryTimelineScan {
            entries: Vec::new(),
            local_scan_directory: memory_dir.display().to_string(),
            local_scan_files_count: 0,
            local_scan_skipped_count: 0,
        });
    }

    let mut entries = Vec::new();
    let mut local_scan_files_count = 0;
    let mut local_scan_skipped_count = 0;
    let read_dir = fs::read_dir(&memory_dir).map_err(|error| GatewayError::Transport {
        message: format!(
            "failed reading local memory directory {}: {error}",
            memory_dir.display()
        ),
    })?;

    for item in read_dir {
        let item = item.map_err(|error| GatewayError::Transport {
            message: format!(
                "failed iterating local memory directory {}: {error}",
                memory_dir.display()
            ),
        })?;
        let path = item.path();
        let metadata = item.metadata().map_err(|error| GatewayError::Transport {
            message: format!(
                "failed reading local memory metadata {}: {error}",
                path.display()
            ),
        })?;

        if !metadata.is_file() {
            continue;
        }

        local_scan_files_count += 1;
        let file_name = item.file_name().to_string_lossy().to_string();
        let timeline_name = format!("memory/{file_name}");
        if !is_daily_memory_entry_name(timeline_name.as_str()) {
            local_scan_skipped_count += 1;
            continue;
        }

        entries.push(GatewayAgentFileEntry {
            name: timeline_name,
            path: path.display().to_string(),
            missing: false,
            size: Some(metadata.len()),
            updated_at_ms: file_metadata_updated_at_ms(&metadata),
            content: None,
        });
    }

    Ok(LocalMemoryTimelineScan {
        entries: order_daily_memory_entries(entries),
        local_scan_directory: memory_dir.display().to_string(),
        local_scan_files_count,
        local_scan_skipped_count,
    })
}

fn read_local_memory_timeline_entry(
    workspace_path: &Path,
    name: &str,
) -> Result<GatewayAgentFileEntry, GatewayError> {
    let normalized_name = normalize_memory_timeline_entry_name(name)?;
    let file_path = workspace_path
        .join("memory")
        .join(normalized_name.trim_start_matches("memory/"));
    if !file_path.exists() {
        return Ok(GatewayAgentFileEntry {
            name: normalized_name,
            path: file_path.display().to_string(),
            missing: true,
            size: None,
            updated_at_ms: None,
            content: None,
        });
    }

    let metadata = fs::metadata(&file_path).map_err(|error| GatewayError::Transport {
        message: format!(
            "failed reading local memory metadata {}: {error}",
            file_path.display()
        ),
    })?;
    let content = fs::read_to_string(&file_path).map_err(|error| GatewayError::Transport {
        message: format!(
            "failed reading local memory file {}: {error}",
            file_path.display()
        ),
    })?;

    Ok(GatewayAgentFileEntry {
        name: normalized_name,
        path: file_path.display().to_string(),
        missing: false,
        size: Some(metadata.len()),
        updated_at_ms: file_metadata_updated_at_ms(&metadata),
        content: Some(content),
    })
}

fn build_timeline_probe_date_names(
    start_date: &str,
    end_date: &str,
) -> Result<Vec<String>, GatewayError> {
    let parsed_start_date = parse_timeline_probe_date(start_date, "start")?;
    let parsed_end_date = parse_timeline_probe_date(end_date, "end")?;

    if parsed_start_date > parsed_end_date {
        return Err(GatewayError::Protocol {
            message: format!(
                "invalid remote probe range: start date {start_date} is after end date {end_date}"
            ),
        });
    }

    let total_days = (parsed_end_date - parsed_start_date).num_days() + 1;
    if total_days > REMOTE_TIMELINE_PROBE_MAX_DAYS {
        return Err(GatewayError::Protocol {
            message: format!(
                "remote probe range too large: {total_days} days exceeds the {REMOTE_TIMELINE_PROBE_MAX_DAYS}-day limit"
            ),
        });
    }

    let mut names = Vec::with_capacity(total_days as usize);
    let mut current_date = parsed_end_date;
    while current_date >= parsed_start_date {
        names.push(format!("memory/{}.md", current_date.format("%Y-%m-%d")));
        current_date -= chrono::Duration::days(1);
    }

    Ok(names)
}

fn parse_timeline_probe_date(value: &str, label: &str) -> Result<NaiveDate, GatewayError> {
    NaiveDate::parse_from_str(value, "%Y-%m-%d").map_err(|error| GatewayError::Protocol {
        message: format!("invalid remote probe {label} date {value}: {error}"),
    })
}

fn timeline_probe_entry_name_from_date(date: NaiveDate) -> String {
    format!("memory/{}.md", date.format("%Y-%m-%d"))
}

fn timeline_probe_date_from_name(name: &str) -> String {
    name.trim()
        .strip_prefix("memory/")
        .unwrap_or(name.trim())
        .strip_suffix(".md")
        .unwrap_or(name.trim())
        .to_string()
}

fn resolve_timeline_probe_bounds(names: &[String]) -> (String, String) {
    let mut dates = names
        .iter()
        .map(|name| timeline_probe_date_from_name(name))
        .collect::<Vec<_>>();
    dates.sort();
    let start_date = dates.first().cloned().unwrap_or_default();
    let end_date = dates.last().cloned().unwrap_or_default();
    (start_date, end_date)
}

fn build_timeline_probe_date_names_from_dates(dates: &[String]) -> Result<Vec<String>, GatewayError> {
    if dates.is_empty() {
        return Err(GatewayError::Protocol {
            message: "remote probe requires at least one canonical date".to_string(),
        });
    }

    if dates.len() as i64 > REMOTE_TIMELINE_PROBE_MAX_DAYS {
        return Err(GatewayError::Protocol {
            message: format!(
                "remote probe date list too large: {} days exceeds the {REMOTE_TIMELINE_PROBE_MAX_DAYS}-day limit",
                dates.len()
            ),
        });
    }

    let mut parsed_dates = dates
        .iter()
        .map(|date| parse_timeline_probe_date(date, "explicit"))
        .collect::<Result<Vec<_>, _>>()?;
    parsed_dates.sort();
    parsed_dates.dedup();
    parsed_dates.reverse();

    Ok(parsed_dates
        .into_iter()
        .map(timeline_probe_entry_name_from_date)
        .collect())
}

#[derive(Debug, Clone)]
enum RemoteTimelineProbeOutcome {
    Hit,
    Miss,
    Timeout(GatewayErrorSummary),
    Error(GatewayErrorSummary),
}

impl RemoteTimelineProbeOutcome {
    fn error_summary(&self) -> Option<&GatewayErrorSummary> {
        match self {
            Self::Timeout(summary) | Self::Error(summary) => Some(summary),
            Self::Hit | Self::Miss => None,
        }
    }
}

#[derive(Debug, Clone)]
struct RemoteTimelineProbeAttempt {
    name: String,
    date: String,
    outcome: RemoteTimelineProbeOutcome,
    file: Option<GatewayAgentFileEntry>,
    retried: bool,
    recovered_after_retry: bool,
}

impl RemoteTimelineProbeAttempt {
    fn from_file(name: &str, file: GatewayAgentFileEntry, retried: bool) -> Self {
        let missing = file.missing;
        Self {
            name: name.to_string(),
            date: timeline_probe_date_from_name(name),
            outcome: if missing {
                RemoteTimelineProbeOutcome::Miss
            } else {
                RemoteTimelineProbeOutcome::Hit
            },
            file: (!missing).then_some(file),
            retried,
            recovered_after_retry: retried,
        }
    }

    fn from_error(name: &str, error: &GatewayError, retried: bool) -> Self {
        Self {
            name: name.to_string(),
            date: timeline_probe_date_from_name(name),
            outcome: classify_remote_timeline_probe_error(error),
            file: None,
            retried,
            recovered_after_retry: false,
        }
    }

    fn error_summary(&self) -> Option<&GatewayErrorSummary> {
        self.outcome.error_summary()
    }

    fn hit_file(&self) -> Option<&GatewayAgentFileEntry> {
        self.file.as_ref()
    }

    fn day_result(&self) -> GatewayAgentMemoryTimelineProbeDayResult {
        let (status, error_summary) = match &self.outcome {
            RemoteTimelineProbeOutcome::Hit => (GatewayAgentMemoryTimelineProbeDayStatus::Hit, None),
            RemoteTimelineProbeOutcome::Miss => {
                (GatewayAgentMemoryTimelineProbeDayStatus::Miss, None)
            }
            RemoteTimelineProbeOutcome::Timeout(summary) => {
                (GatewayAgentMemoryTimelineProbeDayStatus::Timeout, Some(summary))
            }
            RemoteTimelineProbeOutcome::Error(summary) => {
                (GatewayAgentMemoryTimelineProbeDayStatus::Error, Some(summary))
            }
        };

        GatewayAgentMemoryTimelineProbeDayResult {
            date: self.date.clone(),
            name: self.name.clone(),
            status,
            retried: self.retried,
            recovered_after_retry: self.recovered_after_retry,
            error_category: error_summary.map(|summary| summary.category.clone()),
            error_code: error_summary.and_then(|summary| summary.code.clone()),
            error_message: error_summary.map(|summary| summary.message.clone()),
        }
    }
}

fn is_remote_timeline_probe_timeout(error: &GatewayError) -> bool {
    match error {
        GatewayError::Transport { message } => message.to_ascii_lowercase().contains("timed out"),
        _ => false,
    }
}

fn build_remote_probe_cache_key(
    gateway_origin: Option<&str>,
    agent_id: &str,
    workspace: &str,
    start_date: &str,
    end_date: &str,
) -> String {
    format!(
        "{}|{}|{}|{}|{}",
        gateway_origin.unwrap_or_default(),
        agent_id.trim(),
        workspace.trim(),
        start_date.trim(),
        end_date.trim()
    )
}

fn now_unix_timestamp_ms() -> u64 {
    system_time_to_unix_ms(SystemTime::now()).unwrap_or_default()
}

fn should_cache_remote_probe_result(status: &GatewayAgentMemoryTimelineProbeStatus) -> bool {
    matches!(
        status,
        GatewayAgentMemoryTimelineProbeStatus::Complete
            | GatewayAgentMemoryTimelineProbeStatus::Empty
            | GatewayAgentMemoryTimelineProbeStatus::Partial
    )
}

fn build_remote_probe_summary(
    results: &[RemoteTimelineProbeAttempt],
) -> GatewayAgentMemoryTimelineProbeSummary {
    let days = results
        .iter()
        .map(RemoteTimelineProbeAttempt::day_result)
        .collect::<Vec<_>>();
    let attempted_days = results.len();
    let hit_days = results
        .iter()
        .filter(|result| matches!(result.outcome, RemoteTimelineProbeOutcome::Hit))
        .count();
    let miss_days = results
        .iter()
        .filter(|result| matches!(result.outcome, RemoteTimelineProbeOutcome::Miss))
        .count();
    let timeout_days = results
        .iter()
        .filter(|result| matches!(result.outcome, RemoteTimelineProbeOutcome::Timeout(_)))
        .count();
    let error_days = results
        .iter()
        .filter(|result| matches!(result.outcome, RemoteTimelineProbeOutcome::Error(_)))
        .count();
    let retry_days = results.iter().filter(|result| result.retried).count();
    let retry_recovered_days = results
        .iter()
        .filter(|result| result.recovered_after_retry)
        .count();
    let skipped_days = timeout_days + error_days;
    let last_error = results.iter().rev().find_map(RemoteTimelineProbeAttempt::error_summary);

    let status = if timeout_days > 0 && timeout_days == attempted_days {
        GatewayAgentMemoryTimelineProbeStatus::Timeout
    } else if error_days > 0 && error_days == attempted_days {
        GatewayAgentMemoryTimelineProbeStatus::Error
    } else if skipped_days > 0 {
        GatewayAgentMemoryTimelineProbeStatus::Partial
    } else if hit_days == 0 {
        GatewayAgentMemoryTimelineProbeStatus::Empty
    } else {
        GatewayAgentMemoryTimelineProbeStatus::Complete
    };

    GatewayAgentMemoryTimelineProbeSummary {
        start_date: String::new(),
        end_date: String::new(),
        attempted_days,
        hit_days,
        miss_days,
        skipped_days,
        timeout_days,
        error_days,
        retry_days,
        retry_recovered_days,
        days,
        status,
        cached: false,
        last_error_category: last_error.map(|summary| summary.category.clone()),
        last_error_code: last_error.and_then(|summary| summary.code.clone()),
        last_error_message: last_error.map(|summary| summary.message.clone()),
    }
}

fn format_memory_timeline_entry_path(workspace: &str, name: &str) -> String {
    let trimmed_workspace = workspace.trim().trim_end_matches(['/', '\\']);
    if trimmed_workspace.is_empty() {
        return name.to_string();
    }

    format!("{trimmed_workspace}/{name}")
}

fn build_remote_probe_prompt(name: &str, include_content: bool) -> String {
    if include_content {
        return format!(
            "Use memory_get to read exactly this workspace memory file: {name}\n\n\
Return exactly one JSON object and nothing else.\n\
{{\"name\":\"{name}\",\"missing\":false,\"textLength\":123,\"content\":\"full file text\"}}\n\n\
Rules:\n\
- You must use memory_get.\n\
- If the file is missing or only whitespace, return {{\"name\":\"{name}\",\"missing\":true,\"textLength\":0,\"content\":\"\"}}.\n\
- If the file exists, content must contain the full file text with no summarization.\n\
- Do not wrap the JSON in markdown fences.\n\
- Do not add any commentary before or after the JSON."
        );
    }

    format!(
        "Use memory_get to read exactly this workspace memory file: {name}\n\n\
Return exactly one JSON object and nothing else.\n\
{{\"name\":\"{name}\",\"missing\":false,\"textLength\":123,\"contentPreview\":\"first line\"}}\n\n\
Rules:\n\
- You must use memory_get.\n\
- If the file is missing or only whitespace, return {{\"name\":\"{name}\",\"missing\":true,\"textLength\":0,\"contentPreview\":\"\"}}.\n\
- If the file exists, textLength must be the full character count and contentPreview must be the first non-empty line.\n\
- Do not wrap the JSON in markdown fences.\n\
- Do not add any commentary before or after the JSON."
    )
}

async fn run_remote_timeline_probe(
    state: GatewayAppState,
    agent_id: &str,
    workspace: &str,
    names: Vec<String>,
    bounds: Option<(String, String)>,
) -> Result<GatewayAgentMemoryTimelineResult, GatewayError> {
    let mut probe_results = Vec::with_capacity(names.len());
    let mut entries = Vec::new();

    for name in names {
        let attempt = remote_probe_timeline_entry_with_retry(
            state.clone(),
            agent_id,
            workspace,
            name.as_str(),
        )
        .await;

        if let Some(file) = attempt.hit_file().cloned() {
            entries.push(file);
        }

        probe_results.push(attempt);
    }

    let mut probe = build_remote_probe_summary(&probe_results);
    let (start_date, end_date) = bounds.unwrap_or_else(|| resolve_timeline_probe_bounds(
        &probe_results
            .iter()
            .map(|result| result.name.clone())
            .collect::<Vec<_>>(),
    ));
    probe.start_date = start_date;
    probe.end_date = end_date;

    Ok(GatewayAgentMemoryTimelineResult {
        agent_id: agent_id.to_string(),
        workspace: workspace.to_string(),
        source: GatewayAgentMemoryTimelineSource::RemoteProbe,
        entries,
        diagnostics: GatewayAgentMemoryTimelineDiagnostics {
            gateway_visible_files_count: 0,
            gateway_visible_root_docs_count: 0,
            gateway_visible_daily_count: 0,
            gateway_only_returned_root_docs: false,
            local_scan_directory: None,
            local_scan_files_count: 0,
            local_scan_skipped_count: 0,
        },
        probe: Some(probe),
    })
}

async fn create_remote_probe_session(
    state: GatewayAppState,
    agent_id: &str,
) -> Result<GatewaySessionCreateResponse, GatewayError> {
    let value = request_json(
        state,
        "sessions.create",
        Some(json!({
            "agentId": agent_id,
        })),
    )
    .await?;

    serde_json::from_value(value).map_err(|error| GatewayError::Protocol {
        message: format!("failed decoding sessions.create payload: {error}"),
    })
}

async fn send_remote_probe_session_message(
    state: GatewayAppState,
    session_key: &str,
    prompt: &str,
    request_timeout: Duration,
) -> Result<GatewaySessionSendResponse, GatewayError> {
    let value = request_json_with_timeout(
        state,
        "sessions.send",
        Some(json!({
            "key": session_key,
            "message": prompt,
            "idempotencyKey": random_hex_id(),
        })),
        request_timeout,
    )
    .await?;

    serde_json::from_value(value).map_err(|error| GatewayError::Protocol {
        message: format!("failed decoding sessions.send payload: {error}"),
    })
}

fn resolve_remote_probe_send_disposition(
    response: GatewaySessionSendResponse,
    name: &str,
) -> Result<RemoteProbeSendDisposition, GatewayError> {
    let GatewaySessionSendResponse {
        run_id,
        status,
        error,
        summary,
    } = response;
    let run_id = run_id.filter(|value| !value.trim().is_empty());
    let error_message = error
        .or(summary)
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| format!("remote memory probe send failed for {name}"));

    match status.as_deref() {
        Some("started") | Some("accepted") | Some("in_flight") => {
            run_id.map(RemoteProbeSendDisposition::Wait).ok_or_else(|| GatewayError::Protocol {
                message: format!("remote memory probe run id missing for {name}"),
            })
        }
        Some("ok") => Ok(RemoteProbeSendDisposition::Completed),
        Some("timeout") => Err(GatewayError::Transport {
            message: format!(
                "timed out waiting for remote memory probe run {}",
                run_id.unwrap_or_else(|| name.to_string())
            ),
        }),
        Some("error") => Err(GatewayError::RequestRejected {
            code: Some("REMOTE_TIMELINE_PROBE_FAILED".to_string()),
            message: error_message,
            retryable: false,
        }),
        None => run_id.map(RemoteProbeSendDisposition::Wait).ok_or_else(|| {
            GatewayError::Protocol {
                message: format!("remote memory probe send status missing for {name}"),
            }
        }),
        Some(other) => Err(GatewayError::Protocol {
            message: format!("unexpected sessions.send status for remote probe: {other}"),
        }),
    }
}

async fn wait_for_remote_probe_run(
    state: GatewayAppState,
    run_id: &str,
    wait_timeout: Duration,
    request_timeout: Duration,
) -> Result<(), GatewayError> {
    let value = request_json_with_timeout(
        state,
        "agent.wait",
        Some(json!({
            "runId": run_id,
            "timeoutMs": wait_timeout.as_millis() as u64,
        })),
        request_timeout,
    )
    .await?;
    let result: GatewayAgentWaitResponse =
        serde_json::from_value(value).map_err(|error| GatewayError::Protocol {
            message: format!("failed decoding agent.wait payload: {error}"),
        })?;

    match result.status.as_str() {
        "ok" => Ok(()),
        "timeout" => Err(GatewayError::Transport {
            message: format!("timed out waiting for remote memory probe run {run_id}"),
        }),
        "error" => Err(GatewayError::RequestRejected {
            code: Some("REMOTE_TIMELINE_PROBE_FAILED".to_string()),
            message: result
                .error
                .unwrap_or_else(|| format!("remote memory probe run {run_id} failed")),
            retryable: false,
        }),
        other => Err(GatewayError::Protocol {
            message: format!("unexpected agent.wait status for remote probe: {other}"),
        }),
    }
}

async fn request_session_messages(
    state: GatewayAppState,
    session_key: &str,
) -> Result<Vec<Value>, GatewayError> {
    let value = match request_json(
        state.clone(),
        "chat.history",
        Some(json!({
            "sessionKey": session_key,
            "limit": 32,
        })),
    )
    .await
    {
        Ok(value) => value,
        Err(GatewayError::NotImplemented { .. }) => {
            request_json(
                state,
                "sessions.get",
                Some(json!({
                    "key": session_key,
                    "limit": 32,
                })),
            )
            .await?
        }
        Err(error) => return Err(error),
    };

    let response: GatewaySessionMessagesResponse =
        serde_json::from_value(value).map_err(|error| GatewayError::Protocol {
            message: format!("failed decoding session messages payload: {error}"),
        })?;
    Ok(response.messages)
}

fn extract_message_text(message: &Value) -> Option<String> {
    if let Some(text) = message.get("text").and_then(Value::as_str) {
        return Some(text.to_string());
    }

    match message.get("content") {
        Some(Value::String(text)) => Some(text.clone()),
        Some(Value::Array(blocks)) => {
            let text_blocks = blocks
                .iter()
                .filter_map(|block| {
                    block
                        .get("text")
                        .and_then(Value::as_str)
                        .map(|value| value.to_string())
                })
                .collect::<Vec<_>>();
            if text_blocks.is_empty() {
                None
            } else {
                Some(text_blocks.join("\n"))
            }
        }
        _ => None,
    }
}

fn extract_json_object_text(text: &str) -> Option<&str> {
    if let Some(start_index) = text.find("```") {
        let fenced = &text[start_index + 3..];
        if let Some(first_newline) = fenced.find('\n') {
            let after_header = &fenced[first_newline + 1..];
            if let Some(end_index) = after_header.find("```") {
                return Some(after_header[..end_index].trim());
            }
        }
    }

    let start_index = text.find('{')?;
    let end_index = text.rfind('}')?;
    if end_index < start_index {
        return None;
    }

    Some(text[start_index..=end_index].trim())
}

fn parse_remote_timeline_probe_reply(
    text: &str,
) -> Result<RemoteTimelineProbeReply, GatewayError> {
    let json_text = extract_json_object_text(text).ok_or_else(|| GatewayError::Protocol {
        message: "remote memory probe did not return a JSON object".to_string(),
    })?;

    serde_json::from_str(json_text).map_err(|error| GatewayError::Protocol {
        message: format!("failed decoding remote memory probe JSON: {error}"),
    })
}

fn parse_remote_memory_search_reply(
    text: &str,
) -> Result<RemoteMemorySearchReply, GatewayError> {
    let json_text = extract_json_object_text(text).ok_or_else(|| GatewayError::Protocol {
        message: "remote memory search did not return a JSON object".to_string(),
    })?;

    serde_json::from_str(json_text).map_err(|error| GatewayError::Protocol {
        message: format!("failed decoding remote memory search JSON: {error}"),
    })
}

fn parse_remote_timeline_probe_reply_from_messages(
    messages: &[Value],
    expected_name: &str,
) -> Result<RemoteTimelineProbeReply, GatewayError> {
    let mut saw_assistant_message = false;
    for message in messages.iter().rev() {
        if message.get("role").and_then(Value::as_str) != Some("assistant") {
            continue;
        }
        let Some(text) = extract_message_text(message) else {
            continue;
        };
        saw_assistant_message = true;
        let Ok(reply) = parse_remote_timeline_probe_reply(text.as_str()) else {
            continue;
        };
        if reply.name == expected_name {
            return Ok(reply);
        }
    }

    if saw_assistant_message {
        return Err(GatewayError::Protocol {
            message: format!(
                "remote memory probe did not produce a matching JSON reply for {expected_name}"
            ),
        });
    }

    Err(GatewayError::Protocol {
        message: format!(
            "remote memory probe did not produce an assistant reply for {expected_name}"
        ),
    })
}

fn parse_remote_memory_search_reply_from_messages(
    messages: &[Value],
) -> Result<RemoteMemorySearchReply, GatewayError> {
    let mut saw_assistant_message = false;
    for message in messages.iter().rev() {
        if message.get("role").and_then(Value::as_str) != Some("assistant") {
            continue;
        }
        let Some(text) = extract_message_text(message) else {
            continue;
        };
        saw_assistant_message = true;
        if let Ok(reply) = parse_remote_memory_search_reply(text.as_str()) {
            return Ok(reply);
        }
    }

    if saw_assistant_message {
        return Err(GatewayError::Protocol {
            message: "remote memory search did not produce a parseable JSON reply".to_string(),
        });
    }

    Err(GatewayError::Protocol {
        message: "remote memory search did not produce an assistant reply".to_string(),
    })
}

async fn delete_remote_probe_session(state: GatewayAppState, session_key: &str) {
    let _ = request_json(
        state,
        "sessions.delete",
        Some(json!({
            "key": session_key,
            "deleteTranscript": true,
        })),
    )
    .await;
}

fn classify_remote_timeline_probe_error(error: &GatewayError) -> RemoteTimelineProbeOutcome {
    let summary = GatewayErrorSummary::from_error(error);
    if is_remote_timeline_probe_timeout(error) {
        RemoteTimelineProbeOutcome::Timeout(summary)
    } else {
        RemoteTimelineProbeOutcome::Error(summary)
    }
}

async fn remote_probe_timeline_entry_with_retry(
    state: GatewayAppState,
    agent_id: &str,
    workspace: &str,
    name: &str,
) -> RemoteTimelineProbeAttempt {
    match remote_read_memory_timeline_entry_with_timeouts(
        state.clone(),
        agent_id,
        workspace,
        name,
        false,
        REMOTE_TIMELINE_PROBE_WAIT_TIMEOUT,
        REMOTE_TIMELINE_PROBE_REQUEST_TIMEOUT,
    )
    .await
    {
        Ok(file) => RemoteTimelineProbeAttempt::from_file(name, file, false),
        Err(error) if is_remote_timeline_probe_timeout(&error) => {
            match remote_read_memory_timeline_entry_with_timeouts(
                state,
                agent_id,
                workspace,
                name,
                false,
                REMOTE_TIMELINE_PROBE_RETRY_WAIT_TIMEOUT,
                REMOTE_TIMELINE_PROBE_RETRY_REQUEST_TIMEOUT,
            )
            .await
            {
                Ok(file) => RemoteTimelineProbeAttempt::from_file(name, file, true),
                Err(retry_error) => {
                    RemoteTimelineProbeAttempt::from_error(name, &retry_error, true)
                }
            }
        }
        Err(error) => RemoteTimelineProbeAttempt::from_error(name, &error, false),
    }
}

async fn remote_read_memory_timeline_entry(
    state: GatewayAppState,
    agent_id: &str,
    workspace: &str,
    name: &str,
    include_content: bool,
) -> Result<GatewayAgentFileEntry, GatewayError> {
    let wait_timeout = if include_content {
        REMOTE_TIMELINE_ENTRY_WAIT_TIMEOUT
    } else {
        REMOTE_TIMELINE_PROBE_WAIT_TIMEOUT
    };
    let request_timeout = if include_content {
        REMOTE_TIMELINE_ENTRY_REQUEST_TIMEOUT
    } else {
        REMOTE_TIMELINE_PROBE_REQUEST_TIMEOUT
    };
    remote_read_memory_timeline_entry_with_timeouts(
        state,
        agent_id,
        workspace,
        name,
        include_content,
        wait_timeout,
        request_timeout,
    )
    .await
}

async fn remote_read_memory_timeline_entry_with_timeouts(
    state: GatewayAppState,
    agent_id: &str,
    workspace: &str,
    name: &str,
    include_content: bool,
    wait_timeout: Duration,
    request_timeout: Duration,
) -> Result<GatewayAgentFileEntry, GatewayError> {
    let normalized_name = normalize_memory_timeline_entry_name(name)?;
    let prompt = build_remote_probe_prompt(normalized_name.as_str(), include_content);
    let session = create_remote_probe_session(state.clone(), agent_id).await?;
    let session_key = session.key.clone();

    let result = async {
        if session.run_started.unwrap_or(false) || session.run_id.is_some() {
            return Err(GatewayError::Protocol {
                message: format!(
                    "remote memory probe session unexpectedly auto-started for {}{}",
                    normalized_name,
                    session
                        .run_error
                        .as_ref()
                        .map(|value| format!(": {value}"))
                        .unwrap_or_default()
                ),
            });
        }

        let send_result = send_remote_probe_session_message(
            state.clone(),
            session_key.as_str(),
            prompt.as_str(),
            request_timeout,
        )
        .await?;

        match resolve_remote_probe_send_disposition(send_result, normalized_name.as_str())? {
            RemoteProbeSendDisposition::Wait(run_id) => {
                wait_for_remote_probe_run(
                    state.clone(),
                    run_id.as_str(),
                    wait_timeout,
                    request_timeout,
                )
                .await?;
            }
            RemoteProbeSendDisposition::Completed => {}
        }

        let messages = request_session_messages(state.clone(), session_key.as_str()).await?;
        let reply = parse_remote_timeline_probe_reply_from_messages(
            &messages,
            normalized_name.as_str(),
        )?;

        let path = format_memory_timeline_entry_path(workspace, normalized_name.as_str());
        if include_content {
            let content = reply.content.unwrap_or_default();
            let missing = reply.missing || content.trim().is_empty();
            return Ok(GatewayAgentFileEntry {
                name: normalized_name,
                path,
                missing,
                size: (!missing).then_some(content.len() as u64),
                updated_at_ms: None,
                content: (!missing).then_some(content),
            });
        }

        let missing = reply.missing;
        let size = reply
            .text_length
            .map(|value| value as u64)
            .filter(|value| *value > 0)
            .or_else(|| {
                reply.content_preview.as_ref().and_then(|preview| {
                    let trimmed = preview.trim();
                    (!trimmed.is_empty()).then_some(trimmed.len() as u64)
                })
            });

        Ok(GatewayAgentFileEntry {
            name: normalized_name,
            path,
            missing,
            size: (!missing).then_some(size).flatten(),
            updated_at_ms: None,
            content: None,
        })
    }
    .await;

    delete_remote_probe_session(state, session_key.as_str()).await;
    result
}

fn file_metadata_updated_at_ms(metadata: &fs::Metadata) -> Option<u64> {
    metadata.modified().ok().and_then(system_time_to_unix_ms)
}

fn system_time_to_unix_ms(value: SystemTime) -> Option<u64> {
    value
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|duration| duration.as_millis() as u64)
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GatewayConfigGetResponse {
    #[serde(default)]
    config: GatewayConfigSnapshot,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GatewayConfigSnapshot {
    #[serde(default)]
    agents: GatewayAgentsConfigSnapshot,
    #[serde(default)]
    memory: GatewayMemoryConfigSnapshot,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GatewayAgentsConfigSnapshot {
    #[serde(default)]
    defaults: GatewayAgentConfigSnapshot,
    #[serde(default)]
    list: Vec<GatewayNamedAgentConfigSnapshot>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GatewayAgentConfigSnapshot {
    workspace: Option<String>,
    model: Option<GatewayAgentModelConfig>,
    memory_search: Option<GatewayMemorySearchSnapshot>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct GatewayNamedAgentConfigSnapshot {
    id: String,
    workspace: Option<String>,
    model: Option<GatewayAgentModelConfig>,
    memory_search: Option<GatewayMemorySearchSnapshot>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
enum GatewayAgentModelConfig {
    Name(String),
    Detailed {
        primary: Option<String>,
        #[serde(default)]
        fallbacks: Vec<String>,
    },
}

#[derive(Debug, Default, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GatewayMemoryConfigSnapshot {
    backend: Option<String>,
    #[serde(default)]
    qmd: GatewayMemoryQmdConfigSnapshot,
}

#[derive(Debug, Default, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GatewayMemoryQmdConfigSnapshot {
    paths: Option<Vec<GatewayMemoryQmdPathSnapshot>>,
    sessions: Option<GatewayMemoryQmdSessionsSnapshot>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(untagged)]
enum GatewayMemoryQmdPathSnapshot {
    Path(String),
    Detailed {
        path: Option<String>,
    },
}

#[derive(Debug, Default, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GatewayMemoryQmdSessionsSnapshot {
    enabled: Option<bool>,
}

#[derive(Debug, Default, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GatewayMemorySearchSnapshot {
    enabled: Option<bool>,
    provider: Option<String>,
    model: Option<String>,
    extra_paths: Option<Vec<String>>,
    sources: Option<Vec<String>>,
    store: Option<GatewayMemorySearchStoreSnapshot>,
    experimental: Option<GatewayMemorySearchExperimentalSnapshot>,
}

#[derive(Debug, Default, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GatewayMemorySearchStoreSnapshot {
    path: Option<String>,
}

#[derive(Debug, Default, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
struct GatewayMemorySearchExperimentalSnapshot {
    session_memory: Option<bool>,
}

#[derive(Debug, Default)]
struct ResolvedGatewayMemorySearchConfig {
    enabled: bool,
    provider: Option<String>,
    model: Option<String>,
    extra_paths: Vec<String>,
    sources: Vec<String>,
    builtin_store_path: String,
    session_memory_enabled: bool,
}

fn parse_gateway_config(value: Value) -> Result<GatewayConfigSnapshot, GatewayError> {
    serde_json::from_value::<GatewayConfigGetResponse>(value)
        .map(|response| response.config)
        .map_err(|error| GatewayError::Protocol {
            message: format!("failed decoding config.get payload: {error}"),
        })
}

fn resolve_agent_model(
    config: &GatewayConfigSnapshot,
    agent_id: &str,
    default_id: &str,
) -> Option<String> {
    let defaults_model = config.agents.defaults.model.as_ref().and_then(format_agent_model);
    let explicit_agent = resolve_named_agent_config(config, agent_id);
    let explicit_model = explicit_agent
        .and_then(|agent| agent.model.as_ref())
        .and_then(format_agent_model);

    if explicit_model.is_some() {
        return explicit_model;
    }

    if explicit_agent.is_some() || agent_id == default_id {
        return defaults_model;
    }

    None
}

fn resolve_named_agent_config<'a>(
    config: &'a GatewayConfigSnapshot,
    agent_id: &str,
) -> Option<&'a GatewayNamedAgentConfigSnapshot> {
    config.agents.list.iter().find(|agent| agent.id == agent_id)
}

fn resolve_agent_workspace(
    config: &GatewayConfigSnapshot,
    agent_id: &str,
    default_id: &str,
) -> Option<String> {
    let defaults_workspace = normalize_optional_string(config.agents.defaults.workspace.clone());
    let explicit_agent = resolve_named_agent_config(config, agent_id);
    let explicit_workspace =
        explicit_agent.and_then(|agent| normalize_optional_string(agent.workspace.clone()));

    if explicit_workspace.is_some() {
        return explicit_workspace;
    }

    if explicit_agent.is_some() || agent_id == default_id {
        return defaults_workspace;
    }

    None
}

fn resolve_agent_memory_diagnostics(
    config: &GatewayConfigSnapshot,
    agent_id: &str,
    default_id: &str,
    _workspace: &str,
) -> GatewayAgentMemoryDiagnostics {
    let search = resolve_agent_memory_search(config, agent_id, default_id);
    let backend = normalize_memory_backend(config.memory.backend.clone());
    let qmd_paths = normalize_qmd_paths(config.memory.qmd.paths.as_ref());
    let qmd_sessions_enabled = config
        .memory
        .qmd
        .sessions
        .as_ref()
        .and_then(|sessions| sessions.enabled)
        .unwrap_or(false);
    let qmd_active = backend == "qmd";
    let qmd_home = (qmd_active || !qmd_paths.is_empty() || qmd_sessions_enabled)
        .then(|| format!("~/.openclaw/agents/{agent_id}/qmd/"));

    GatewayAgentMemoryDiagnostics {
        memory_search_enabled: search.enabled,
        backend,
        provider: search.provider,
        embedding_model: search.model,
        builtin_store_path: search.builtin_store_path,
        sources: search.sources,
        extra_paths: search.extra_paths,
        session_memory_enabled: search.session_memory_enabled,
        qmd_active,
        qmd_home,
        qmd_paths,
        qmd_sessions_enabled,
    }
}

fn resolve_agent_memory_search(
    config: &GatewayConfigSnapshot,
    agent_id: &str,
    default_id: &str,
) -> ResolvedGatewayMemorySearchConfig {
    let defaults = config.agents.defaults.memory_search.as_ref();
    let explicit_agent = resolve_named_agent_config(config, agent_id);
    let explicit = explicit_agent.and_then(|agent| agent.memory_search.as_ref());
    let should_use_defaults = explicit_agent.is_some() || agent_id == default_id;

    let enabled = search_flag(explicit, |snapshot| snapshot.enabled)
        .or_else(|| should_use_defaults.then(|| search_flag(defaults, |snapshot| snapshot.enabled)).flatten())
        .unwrap_or(true);
    let provider = search_string(explicit, |snapshot| snapshot.provider.clone()).or_else(|| {
        should_use_defaults
            .then(|| search_string(defaults, |snapshot| snapshot.provider.clone()))
            .flatten()
    });
    let model = search_string(explicit, |snapshot| snapshot.model.clone()).or_else(|| {
        should_use_defaults
            .then(|| search_string(defaults, |snapshot| snapshot.model.clone()))
            .flatten()
    });
    let extra_paths = search_vec(explicit, |snapshot| snapshot.extra_paths.clone()).or_else(|| {
        should_use_defaults
            .then(|| search_vec(defaults, |snapshot| snapshot.extra_paths.clone()))
            .flatten()
    });
    let sources = search_vec(explicit, |snapshot| snapshot.sources.clone()).or_else(|| {
        should_use_defaults
            .then(|| search_vec(defaults, |snapshot| snapshot.sources.clone()))
            .flatten()
    });
    let builtin_store_path = search_string(explicit, |snapshot| {
        snapshot
            .store
            .as_ref()
            .and_then(|store| store.path.clone())
    })
    .or_else(|| {
        should_use_defaults
            .then(|| {
                search_string(defaults, |snapshot| {
                    snapshot
                        .store
                        .as_ref()
                        .and_then(|store| store.path.clone())
                })
            })
            .flatten()
    })
    .map(|template| expand_agent_template_path(template.as_str(), agent_id))
    .unwrap_or_else(|| format!("~/.openclaw/memory/{agent_id}.sqlite"));
    let session_memory_enabled = search_flag(explicit, |snapshot| {
        snapshot
            .experimental
            .as_ref()
            .and_then(|experimental| experimental.session_memory)
    })
    .or_else(|| {
        should_use_defaults
            .then(|| {
                search_flag(defaults, |snapshot| {
                    snapshot
                        .experimental
                        .as_ref()
                        .and_then(|experimental| experimental.session_memory)
                })
            })
            .flatten()
    })
    .unwrap_or(false);

    ResolvedGatewayMemorySearchConfig {
        enabled,
        provider,
        model,
        extra_paths: extra_paths.unwrap_or_default(),
        sources: sources.unwrap_or_else(|| vec!["memory".to_string()]),
        builtin_store_path,
        session_memory_enabled,
    }
}

fn search_flag(
    snapshot: Option<&GatewayMemorySearchSnapshot>,
    selector: impl Fn(&GatewayMemorySearchSnapshot) -> Option<bool>,
) -> Option<bool> {
    snapshot.and_then(selector)
}

fn search_string(
    snapshot: Option<&GatewayMemorySearchSnapshot>,
    selector: impl Fn(&GatewayMemorySearchSnapshot) -> Option<String>,
) -> Option<String> {
    snapshot
        .and_then(selector)
        .and_then(|value| normalize_optional_string(Some(value)))
}

fn search_vec(
    snapshot: Option<&GatewayMemorySearchSnapshot>,
    selector: impl Fn(&GatewayMemorySearchSnapshot) -> Option<Vec<String>>,
) -> Option<Vec<String>> {
    snapshot
        .and_then(selector)
        .map(normalize_string_list)
}

fn format_agent_model(model: &GatewayAgentModelConfig) -> Option<String> {
    match model {
        GatewayAgentModelConfig::Name(model) => normalize_optional_string(Some(model.clone())),
        GatewayAgentModelConfig::Detailed { primary, fallbacks } => {
            let primary = normalize_optional_string(primary.clone());
            let fallbacks = fallbacks
                .iter()
                .filter_map(|value| normalize_optional_string(Some(value.clone())))
                .collect::<Vec<_>>();

            match (primary, fallbacks.is_empty()) {
                (Some(primary), true) => Some(primary),
                (Some(primary), false) => Some(format!("{primary} -> {}", fallbacks.join(", "))),
                (None, false) => Some(fallbacks.join(", ")),
                (None, true) => None,
            }
        }
    }
}

fn normalize_optional_string(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_string())
    })
}

fn normalize_string_list(values: Vec<String>) -> Vec<String> {
    let mut normalized = Vec::new();
    for value in values {
        if let Some(value) = normalize_optional_string(Some(value)) {
            if !normalized.contains(&value) {
                normalized.push(value);
            }
        }
    }
    normalized
}

fn normalize_memory_backend(value: Option<String>) -> String {
    let normalized = normalize_optional_string(value)
        .map(|value| value.to_ascii_lowercase())
        .unwrap_or_else(|| "builtin".to_string());

    match normalized.as_str() {
        "sqlite" | "default" => "builtin".to_string(),
        other => other.to_string(),
    }
}

fn expand_agent_template_path(template: &str, agent_id: &str) -> String {
    template
        .replace("{agentId}", agent_id)
        .replace("{agent_id}", agent_id)
}

fn normalize_qmd_paths(paths: Option<&Vec<GatewayMemoryQmdPathSnapshot>>) -> Vec<String> {
    let mut normalized = Vec::new();

    for path in paths.into_iter().flatten() {
        let value = match path {
            GatewayMemoryQmdPathSnapshot::Path(path) => Some(path.clone()),
            GatewayMemoryQmdPathSnapshot::Detailed { path } => path.clone(),
        };

        if let Some(value) = normalize_optional_string(value) {
            if !normalized.contains(&value) {
                normalized.push(value);
            }
        }
    }

    normalized
}

fn normalize_memory_root_document_name(name: &str) -> Result<&'static str, GatewayError> {
    match name.trim() {
        "MEMORY.md" => Ok("MEMORY.md"),
        "memory.md" => Ok("memory.md"),
        other => Err(GatewayError::Protocol {
            message: format!("unsupported memory root document: {other}"),
        }),
    }
}

fn normalize_memory_timeline_entry_name(name: &str) -> Result<String, GatewayError> {
    let trimmed = name.trim();
    if is_daily_memory_entry_name(trimmed) {
        return Ok(trimmed.to_string());
    }

    Err(GatewayError::Protocol {
        message: format!("unsupported memory timeline entry: {trimmed}"),
    })
}

fn is_daily_memory_entry_name(name: &str) -> bool {
    let Some(date_part) = name
        .strip_prefix("memory/")
        .and_then(|value| value.strip_suffix(".md"))
    else {
        return false;
    };

    NaiveDate::parse_from_str(date_part, "%Y-%m-%d").is_ok()
}

fn resolve_memory_workspace(primary_workspace: &str, fallback_workspace: &str) -> String {
    let primary = primary_workspace.trim();
    if !primary.is_empty() {
        return primary.to_string();
    }

    fallback_workspace.trim().to_string()
}

fn order_memory_root_documents(mut documents: Vec<GatewayAgentFileEntry>) -> Vec<GatewayAgentFileEntry> {
    documents.sort_by_key(|document| match document.name.as_str() {
        "MEMORY.md" => 0,
        "memory.md" => 1,
        _ => 2,
    });
    documents
}

fn order_daily_memory_entries(mut entries: Vec<GatewayAgentFileEntry>) -> Vec<GatewayAgentFileEntry> {
    entries.sort_by(|left, right| right.name.cmp(&left.name));
    entries
}

fn resolve_agent_summary_name(agent: &crate::gateway::types::GatewayAgentSummary) -> String {
    agent
        .identity
        .as_ref()
        .and_then(|identity| identity.name.as_ref())
        .map(String::as_str)
        .or(agent.name.as_deref())
        .unwrap_or(agent.id.as_str())
        .to_string()
}

async fn resolve_shared_workspace_agents(
    state: GatewayAppState,
    agents: &GatewayAgentsListResult,
    selected_agent_id: &str,
    selected_workspace: &str,
) -> Vec<GatewayMemorySharedAgentSummary> {
    let mut shared_agents = Vec::new();

    for agent in &agents.agents {
        if agent.id == selected_agent_id {
            continue;
        }

        let Ok(agent_memory) = agent_file_get(state.clone(), &agent.id, "MEMORY.md").await else {
            continue;
        };

        if agent_memory.workspace.trim() != selected_workspace.trim() {
            continue;
        }

        shared_agents.push(GatewayMemorySharedAgentSummary {
            id: agent.id.clone(),
            name: resolve_agent_summary_name(agent),
        });
    }

    shared_agents
}

async fn perform_handshake(
    state: &GatewayAppState,
    endpoint: &GatewayEndpoint,
    identity: &GatewayDeviceIdentity,
    role: &str,
    scopes: &[String],
    selected_auth: &SelectedConnectAuth,
) -> Result<(GatewaySocketWriter, GatewaySocketReader, HelloOk), GatewayError> {
    state.replace_snapshot(snapshot_for_phase(
        endpoint,
        &identity.device_id,
        GatewayConnectionPhase::OpeningSocket,
    ));

    let (socket, _) = connect_async(endpoint.ws_url.as_str())
        .await
        .map_err(|error| GatewayError::Transport {
            message: format!("failed opening websocket to {}: {error}", endpoint.ws_url),
        })?;
    let (mut writer, mut reader) = socket.split();

    state.replace_snapshot(snapshot_for_phase(
        endpoint,
        &identity.device_id,
        GatewayConnectionPhase::WaitingForChallenge,
    ));

    let nonce = timeout(
        CONNECT_CHALLENGE_TIMEOUT,
        wait_for_connect_challenge(&mut reader),
    )
    .await
    .map_err(|_| GatewayError::Transport {
        message: "timed out waiting for gateway connect challenge".to_string(),
    })??;

    let signed_at_ms = Utc::now().timestamp_millis();
    let device = sign_connect_device(
        identity,
        &DeviceSignatureContext {
            client_id: DEFAULT_CLIENT_ID.to_string(),
            client_mode: DEFAULT_CLIENT_MODE.to_string(),
            role: role.to_string(),
            scopes: scopes.to_vec(),
            signed_at_ms,
            token: selected_auth.signature_token.clone(),
            nonce: nonce.clone(),
            platform: std::env::consts::OS.to_string(),
            device_family: Some(DEFAULT_DEVICE_FAMILY.to_string()),
        },
    )?;

    state.replace_snapshot(snapshot_for_phase(
        endpoint,
        &identity.device_id,
        GatewayConnectionPhase::SendingConnect,
    ));

    let request_id = random_hex_id();
    let request = RequestFrame::new(
        request_id.clone(),
        "connect",
        ConnectParams {
            min_protocol: PROTOCOL_VERSION,
            max_protocol: PROTOCOL_VERSION,
            client: ConnectClientInfo {
                id: DEFAULT_CLIENT_ID.to_string(),
                display_name: Some("Claw Scope".to_string()),
                version: APP_VERSION.to_string(),
                platform: std::env::consts::OS.to_string(),
                device_family: Some(DEFAULT_DEVICE_FAMILY.to_string()),
                model_identifier: None,
                mode: DEFAULT_CLIENT_MODE.to_string(),
                instance_id: None,
            },
            caps: Vec::new(),
            commands: None,
            permissions: None,
            path_env: None,
            role: role.to_string(),
            scopes: scopes.to_vec(),
            device: Some(device),
            auth: selected_auth.auth.clone(),
            locale: None,
            user_agent: Some(format!("claw-scope/{APP_VERSION}")),
        },
    );

    writer
        .send(Message::Text(
            serde_json::to_string(&request)
                .map_err(|error| GatewayError::Protocol {
                    message: format!("failed serializing connect request: {error}"),
                })?
                .into(),
        ))
        .await
        .map_err(|error| GatewayError::Transport {
            message: format!("failed sending gateway connect request: {error}"),
        })?;

    let hello = timeout(
        CONNECT_RESPONSE_TIMEOUT,
        wait_for_connect_response(&mut reader, &request_id),
    )
    .await
    .map_err(|_| GatewayError::Transport {
        message: "timed out waiting for gateway hello-ok response".to_string(),
    })??;

    Ok((writer, reader, hello))
}

async fn request_json(
    state: GatewayAppState,
    method: &str,
    params: Option<Value>,
) -> Result<Value, GatewayError> {
    request_json_with_timeout(state, method, params, REQUEST_TIMEOUT).await
}

async fn request_json_with_timeout(
    state: GatewayAppState,
    method: &str,
    params: Option<Value>,
    request_timeout: Duration,
) -> Result<Value, GatewayError> {
    let connection = state.session().await.ok_or_else(|| GatewayError::Transport {
        message: "gateway not connected".to_string(),
    })?;
    if !connection.supports_method(method) {
        return Err(GatewayError::NotImplemented {
            feature: format!("gateway method {method}"),
        });
    }

    let request_id = random_hex_id();
    let response_rx = connection.register_pending_request(request_id.clone());
    let request = RequestFrame::new(
        request_id.clone(),
        method,
        params.unwrap_or_else(|| Value::Object(Map::new())),
    );
    let request_text = serde_json::to_string(&request).map_err(|error| GatewayError::Protocol {
        message: format!("failed serializing {method} request: {error}"),
    })?;

    {
        let mut writer = connection.writer.lock().await;
        if let Err(error) = writer.send(Message::Text(request_text.into())).await {
            connection.remove_pending_request(&request_id);
            return Err(GatewayError::Transport {
                message: format!("failed sending gateway request {method}: {error}"),
            });
        }
    }

    match timeout(request_timeout, response_rx).await {
        Ok(Ok(Ok(value))) => Ok(value),
        Ok(Ok(Err(error))) => Err(error),
        Ok(Err(_)) => Err(GatewayError::Transport {
            message: format!("gateway request channel closed for {method}"),
        }),
        Err(_) => {
            connection.remove_pending_request(&request_id);
            Err(GatewayError::Transport {
                message: format!("gateway request timeout for {method}"),
            })
        }
    }
}

async fn wait_for_connect_challenge(
    reader: &mut GatewaySocketReader,
) -> Result<String, GatewayError> {
    loop {
        let message = next_text_message(reader).await?;
        match parse_inbound_frame(&message).map_err(|error| GatewayError::Protocol {
            message: format!("failed parsing gateway frame: {error}"),
        })? {
            InboundFrame::Event(event) if event.event == CONNECT_EVENT_CHALLENGE => {
                return extract_connect_challenge_nonce(event.payload.as_ref()).ok_or(
                    GatewayError::Protocol {
                        message: "gateway connect challenge missing nonce".to_string(),
                    },
                )
            }
            InboundFrame::Unknown | InboundFrame::Event(_) | InboundFrame::Response(_) => continue,
        }
    }
}

async fn wait_for_connect_response(
    reader: &mut GatewaySocketReader,
    request_id: &str,
) -> Result<HelloOk, GatewayError> {
    loop {
        let message = next_text_message(reader).await?;
        match parse_inbound_frame(&message).map_err(|error| GatewayError::Protocol {
            message: format!("failed parsing gateway frame: {error}"),
        })? {
            InboundFrame::Response(response) if response.id == request_id => {
                if response.ok {
                    let payload = response.payload.ok_or_else(|| GatewayError::Protocol {
                        message: "gateway connect response missing payload".to_string(),
                    })?;
                    return serde_json::from_value(payload).map_err(|error| GatewayError::Protocol {
                        message: format!("failed decoding hello-ok payload: {error}"),
                    });
                }

                let response_error = response.error;
                let details = response_error.as_ref().and_then(|error| error.details.as_ref());
                let recovery = parse_connect_error_recovery(details);
                let code = response_error
                    .as_ref()
                    .map(|error| error.code.clone())
                    .or(recovery.code.clone());
                let message = response_error
                    .as_ref()
                    .map(|error| error.message.clone())
                    .unwrap_or_else(|| "gateway connect rejected".to_string());
                let retryable = response_error
                    .as_ref()
                    .and_then(|error| error.retryable)
                    .unwrap_or(false);
                return Err(GatewayError::ConnectRejected {
                    code,
                    message,
                    retryable,
                    can_retry_with_device_token: recovery.can_retry_with_device_token,
                    recommended_next_step: recovery.recommended_next_step,
                    pairing_reason: recovery.pairing_reason,
                });
            }
            InboundFrame::Unknown | InboundFrame::Event(_) | InboundFrame::Response(_) => continue,
        }
    }
}

async fn next_text_message(reader: &mut GatewaySocketReader) -> Result<String, GatewayError> {
    loop {
        match reader.next().await {
            Some(Ok(Message::Text(text))) => return Ok(text.to_string()),
            Some(Ok(Message::Close(frame))) => {
                let reason = frame
                    .map(|frame| frame.reason.to_string())
                    .filter(|reason| !reason.is_empty())
                    .unwrap_or_else(|| "gateway closed during handshake".to_string());
                return Err(GatewayError::Transport { message: reason });
            }
            Some(Ok(_)) => continue,
            Some(Err(error)) => {
                return Err(GatewayError::Transport {
                    message: format!("gateway websocket error: {error}"),
                })
            }
            None => {
                return Err(GatewayError::Transport {
                    message: "gateway connection closed".to_string(),
                })
            }
        }
    }
}

fn spawn_connection_reader(
    state: GatewayAppState,
    connection: GatewayActiveConnection,
    mut reader: GatewaySocketReader,
) {
    tokio::spawn(async move {
        let disconnect_error = loop {
            match reader.next().await {
                Some(Ok(Message::Text(text))) => {
                    if let Err(error) = handle_runtime_frame(&connection, text.to_string()) {
                        break Some(error);
                    }
                }
                Some(Ok(Message::Close(_))) | None => break None,
                Some(Ok(_)) => continue,
                Some(Err(error)) => {
                    break Some(GatewayError::Transport {
                        message: format!("gateway websocket closed with error: {error}"),
                    })
                }
            }
        };

        let close_error = disconnect_error.clone().unwrap_or_else(|| GatewayError::Transport {
            message: "gateway connection closed".to_string(),
        });
        connection.reject_all_pending_requests(close_error);

        let _ = connection.writer.lock().await.close().await;

        if !state.clear_session_for_id(&connection.session_id).await {
            return;
        }

        let mut snapshot = state.snapshot();
        snapshot.phase = if disconnect_error.is_some() {
            GatewayConnectionPhase::Failed
        } else {
            GatewayConnectionPhase::Disconnected
        };
        snapshot.granted_role = None;
        snapshot.granted_scopes.clear();
        snapshot.is_paired = false;
        snapshot.can_retry_with_device_token = false;
        if let Some(error) = disconnect_error {
            snapshot.last_error = Some(GatewayErrorSummary::from_error(&error));
        }
        state.replace_snapshot(snapshot);
    });
}

fn handle_runtime_frame(
    connection: &GatewayActiveConnection,
    message: String,
) -> Result<(), GatewayError> {
    match parse_inbound_frame(&message).map_err(|error| GatewayError::Protocol {
        message: format!("failed parsing gateway frame: {error}"),
    })? {
        InboundFrame::Response(response) => {
            let result = if response.ok {
                Ok(response.payload.unwrap_or(Value::Null))
            } else {
                let response_error = response.error;
                Err(GatewayError::RequestRejected {
                    code: response_error.as_ref().map(|error| error.code.clone()),
                    message: response_error
                        .as_ref()
                        .map(|error| error.message.clone())
                        .unwrap_or_else(|| "gateway request rejected".to_string()),
                    retryable: response_error
                        .as_ref()
                        .and_then(|error| error.retryable)
                        .unwrap_or(false),
                })
            };
            let _ = connection.resolve_pending_request(&response.id, result);
            Ok(())
        }
        InboundFrame::Event(_) | InboundFrame::Unknown => Ok(()),
    }
}

async fn close_connection_writer(connection: &GatewayActiveConnection) {
    let mut writer = connection.writer.lock().await;
    let _ = writer.send(Message::Close(None)).await;
    let _ = writer.close().await;
}

fn should_retry_with_stored_device_token(
    endpoint: &GatewayEndpoint,
    config: &GatewayConnectConfig,
    selected_auth: &SelectedConnectAuth,
    error: &GatewayError,
    already_retried: bool,
) -> bool {
    if already_retried || selected_auth.resolved_device_token.is_some() {
        return false;
    }
    if !matches!(config.auth_mode, crate::gateway::types::GatewayAuthMode::Token) {
        return false;
    }
    if config
        .auth_secret
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .is_none()
    {
        return false;
    }
    if selected_auth.stored_token.is_none() || !is_trusted_device_retry_endpoint(endpoint) {
        return false;
    }
    error.connect_error_code().as_deref() == Some(CONNECT_ERROR_AUTH_TOKEN_MISMATCH)
        || error.can_retry_with_device_token()
        || error.recommended_next_step() == Some("retry_with_device_token")
}

fn is_trusted_device_retry_endpoint(endpoint: &GatewayEndpoint) -> bool {
    matches!(endpoint.transport, GatewayTransportKind::LocalLoopback)
}

fn snapshot_for_phase(
    endpoint: &GatewayEndpoint,
    device_id: &str,
    phase: GatewayConnectionPhase,
) -> GatewayStatusSnapshot {
    GatewayStatusSnapshot {
        phase,
        gateway_origin: Some(endpoint.origin_key.clone()),
        device_id: Some(device_id.to_string()),
        granted_role: None,
        granted_scopes: Vec::new(),
        last_error: None,
        is_paired: false,
        can_retry_with_device_token: false,
    }
}

fn failure_snapshot(
    endpoint: &GatewayEndpoint,
    device_id: &str,
    error: &GatewayError,
) -> GatewayStatusSnapshot {
    GatewayStatusSnapshot {
        phase: if error.connect_error_code().as_deref() == Some(CONNECT_ERROR_PAIRING_REQUIRED) {
            GatewayConnectionPhase::WaitingForApproval
        } else {
            GatewayConnectionPhase::Failed
        },
        gateway_origin: Some(endpoint.origin_key.clone()),
        device_id: Some(device_id.to_string()),
        granted_role: None,
        granted_scopes: Vec::new(),
        last_error: Some(GatewayErrorSummary::from_error(error)),
        is_paired: false,
        can_retry_with_device_token: error.can_retry_with_device_token(),
    }
}

fn random_hex_id() -> String {
    let mut bytes = [0_u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    bytes.iter().map(|byte| format!("{byte:02x}")).collect()
}

#[cfg(test)]
mod tests {
    use super::{
        build_remote_probe_summary, build_timeline_probe_date_names,
        build_timeline_probe_date_names_from_dates, is_daily_memory_entry_name,
        matches_memory_search_source_filter, normalize_remote_memory_search_entry,
        parse_remote_memory_search_reply_from_messages,
        read_local_memory_timeline_entry, resolve_memory_timeline_access,
        resolve_remote_probe_send_disposition, GatewaySessionSendResponse,
        RemoteMemorySearchReplyEntry, RemoteProbeSendDisposition, RemoteTimelineProbeAttempt,
        RemoteTimelineProbeOutcome,
        REMOTE_TIMELINE_ENTRY_REQUEST_TIMEOUT,
        REMOTE_TIMELINE_ENTRY_WAIT_TIMEOUT, REMOTE_TIMELINE_PROBE_REQUEST_TIMEOUT,
        REMOTE_TIMELINE_PROBE_RETRY_REQUEST_TIMEOUT, REMOTE_TIMELINE_PROBE_RETRY_WAIT_TIMEOUT,
        REMOTE_TIMELINE_PROBE_WAIT_TIMEOUT,
        normalize_memory_root_document_name, normalize_memory_timeline_entry_name,
        order_daily_memory_entries, order_memory_root_documents, parse_gateway_config,
        resolve_agent_memory_diagnostics, resolve_agent_model, resolve_memory_workspace,
        scan_local_memory_timeline_entries,
    };
    use crate::gateway::errors::GatewayErrorSummary;
    use crate::gateway::types::{
        GatewayAgentFileEntry, GatewayAgentMemorySearchSourceKind,
        GatewayAgentMemoryTimelineAccessReason,
        GatewayAgentMemoryTimelineProbeDayStatus, GatewayAgentMemoryTimelineProbeStatus,
        GatewayAgentMemoryTimelineSource,
    };
    use serde_json::json;
    use std::{
        fs,
        path::PathBuf,
        time::{SystemTime, UNIX_EPOCH},
    };

    fn create_temp_dir(label: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system time before unix epoch")
            .as_nanos();
        let path = std::env::temp_dir().join(format!("claw-scope-{label}-{unique}"));
        fs::create_dir_all(&path).expect("create temp directory");
        path
    }

    fn probe_attempt(outcome: RemoteTimelineProbeOutcome) -> RemoteTimelineProbeAttempt {
        RemoteTimelineProbeAttempt {
            name: "memory/2026-03-27.md".to_string(),
            date: "2026-03-27".to_string(),
            outcome,
            file: None,
            retried: false,
            recovered_after_retry: false,
        }
    }

    #[test]
    fn gateway_agent_settings_prefers_explicit_model_and_falls_back_to_defaults() {
        let config = parse_gateway_config(json!({
            "config": {
                "agents": {
                    "defaults": {
                        "workspace": "~/.openclaw/workspace-main",
                        "model": "gpt-5.4"
                    },
                    "list": [
                        {
                            "id": "research",
                            "workspace": "~/.openclaw/workspace-research",
                            "model": {
                                "primary": "claude-sonnet-4",
                                "fallbacks": ["gpt-5.4-mini"]
                            }
                        },
                        {
                            "id": "ops",
                            "workspace": "~/.openclaw/workspace-ops"
                        }
                    ]
                }
            }
        }))
        .expect("parse gateway config");

        assert_eq!(
            resolve_agent_model(&config, "research", "main").as_deref(),
            Some("claude-sonnet-4 -> gpt-5.4-mini")
        );
        assert_eq!(
            resolve_agent_model(&config, "ops", "main").as_deref(),
            Some("gpt-5.4")
        );
        assert_eq!(
            resolve_agent_model(&config, "main", "main").as_deref(),
            Some("gpt-5.4")
        );
    }

    #[test]
    fn gateway_agent_settings_handles_model_objects_without_primary() {
        let config = parse_gateway_config(json!({
            "config": {
                "agents": {
                    "defaults": {},
                    "list": [
                        {
                            "id": "fallback-only",
                            "model": {
                                "fallbacks": ["openai/gpt-4.1", "anthropic/claude-sonnet-4"]
                            }
                        }
                    ]
                }
            }
        }))
        .expect("parse gateway config");

        assert_eq!(
            resolve_agent_model(&config, "fallback-only", "main").as_deref(),
            Some("openai/gpt-4.1, anthropic/claude-sonnet-4")
        );
    }

    #[test]
    fn memory_diagnostics_merge_defaults_with_agent_overrides() {
        let config = parse_gateway_config(json!({
            "config": {
                "agents": {
                    "defaults": {
                        "memorySearch": {
                            "enabled": true,
                            "provider": "openai",
                            "model": "text-embedding-3-large",
                            "extraPaths": ["../team-docs"],
                            "sources": ["memory", "sessions"],
                            "store": {
                                "path": "~/.openclaw/memory/{agentId}.sqlite"
                            },
                            "experimental": {
                                "sessionMemory": true
                            }
                        }
                    },
                    "list": [
                        {
                            "id": "research",
                            "memorySearch": {
                                "provider": "gemini",
                                "extraPaths": ["../research-notes"]
                            }
                        }
                    ]
                },
                "memory": {
                    "backend": "qmd",
                    "qmd": {
                        "paths": [
                            { "path": "../shared-kb" }
                        ],
                        "sessions": {
                            "enabled": true
                        }
                    }
                }
            }
        }))
        .expect("parse gateway config");

        let diagnostics =
            resolve_agent_memory_diagnostics(&config, "research", "main", "~/.openclaw/workspace-research");

        assert_eq!(diagnostics.backend.as_str(), "qmd");
        assert!(diagnostics.memory_search_enabled);
        assert_eq!(diagnostics.provider.as_deref(), Some("gemini"));
        assert_eq!(
            diagnostics.embedding_model.as_deref(),
            Some("text-embedding-3-large")
        );
        assert_eq!(
            diagnostics.builtin_store_path.as_str(),
            "~/.openclaw/memory/research.sqlite"
        );
        assert_eq!(
            diagnostics.extra_paths,
            vec!["../research-notes".to_string()]
        );
        assert_eq!(
            diagnostics.sources,
            vec!["memory".to_string(), "sessions".to_string()]
        );
        assert!(diagnostics.session_memory_enabled);
        assert!(diagnostics.qmd_active);
        assert_eq!(
            diagnostics.qmd_home.as_deref(),
            Some("~/.openclaw/agents/research/qmd/")
        );
        assert_eq!(diagnostics.qmd_paths, vec!["../shared-kb".to_string()]);
        assert!(diagnostics.qmd_sessions_enabled);
    }

    #[test]
    fn memory_diagnostics_fill_builtin_defaults_when_config_is_sparse() {
        let config = parse_gateway_config(json!({
            "config": {
                "agents": {
                    "defaults": {},
                    "list": []
                }
            }
        }))
        .expect("parse gateway config");

        let diagnostics =
            resolve_agent_memory_diagnostics(&config, "main", "main", "~/.openclaw/workspace-main");

        assert_eq!(diagnostics.backend.as_str(), "builtin");
        assert!(diagnostics.memory_search_enabled);
        assert_eq!(
            diagnostics.builtin_store_path.as_str(),
            "~/.openclaw/memory/main.sqlite"
        );
        assert!(diagnostics.sources == vec!["memory".to_string()]);
        assert!(diagnostics.extra_paths.is_empty());
        assert!(!diagnostics.session_memory_enabled);
        assert!(!diagnostics.qmd_active);
        assert!(diagnostics.qmd_home.is_none());
        assert!(diagnostics.qmd_paths.is_empty());
        assert!(!diagnostics.qmd_sessions_enabled);
    }

    #[test]
    fn memory_root_document_name_only_allows_known_root_documents() {
        assert_eq!(
            normalize_memory_root_document_name("MEMORY.md").expect("primary document"),
            "MEMORY.md"
        );
        assert_eq!(
            normalize_memory_root_document_name("memory.md").expect("legacy document"),
            "memory.md"
        );
        assert!(normalize_memory_root_document_name("memory/2026-03-27.md").is_err());
    }

    #[test]
    fn memory_timeline_entry_name_only_allows_daily_memory_documents() {
        assert_eq!(
            normalize_memory_timeline_entry_name("memory/2026-03-27.md")
                .expect("timeline document"),
            "memory/2026-03-27.md"
        );
        assert!(normalize_memory_timeline_entry_name("MEMORY.md").is_err());
        assert!(normalize_memory_timeline_entry_name("memory/not-a-date.md").is_err());
    }

    #[test]
    fn daily_memory_name_detection_matches_expected_shape() {
        assert!(is_daily_memory_entry_name("memory/2026-03-27.md"));
        assert!(!is_daily_memory_entry_name("memory.md"));
        assert!(!is_daily_memory_entry_name("memory/2026-13-27.md"));
    }

    #[test]
    fn parse_remote_memory_search_reply_reads_assistant_json() {
        let messages = vec![
            json!({
                "role": "user",
                "text": "search memory"
            }),
            json!({
                "role": "assistant",
                "content": [
                    {
                        "type": "output_text",
                        "text": "{\"results\":[{\"path\":\"~/.openclaw/workspace-main/memory/2026-03-27.md\",\"snippet\":\"Remember to ship the patch.\",\"score\":0.87,\"lineStart\":4,\"lineEnd\":6}]}"
                    }
                ]
            }),
        ];

        let reply = parse_remote_memory_search_reply_from_messages(messages.as_slice())
            .expect("parse assistant search JSON");

        assert_eq!(reply.results.len(), 1);
        assert_eq!(
            reply.results[0].path,
            "~/.openclaw/workspace-main/memory/2026-03-27.md"
        );
        assert_eq!(reply.results[0].score, Some(0.87));
        assert_eq!(reply.results[0].line_start, Some(4));
        assert_eq!(reply.results[0].line_end, Some(6));
    }

    #[test]
    fn normalize_remote_memory_search_entry_maps_daily_memory_hits() {
        let entry = normalize_remote_memory_search_entry(
            "~/.openclaw/workspace-main",
            None,
            RemoteMemorySearchReplyEntry {
                path: "~/.openclaw/workspace-main/memory/2026-03-27.md".to_string(),
                snippet: Some("Remember to ship the patch.".to_string()),
                score: Some(0.87),
                line_start: Some(4),
                line_end: Some(6),
            },
            0,
        );

        assert_eq!(
            entry.source_kind,
            GatewayAgentMemorySearchSourceKind::DailyMemory
        );
        assert_eq!(entry.timeline_entry_name.as_deref(), Some("memory/2026-03-27.md"));
        assert!(entry.canonical_document_name.is_none());
        assert!(matches_memory_search_source_filter(&entry, "daily_memory"));
    }

    #[test]
    fn resolve_memory_workspace_prefers_primary_and_falls_back_when_missing() {
        assert_eq!(
            resolve_memory_workspace("~/.openclaw/workspace-main", "~/.openclaw/workspace-fallback"),
            "~/.openclaw/workspace-main"
        );
        assert_eq!(
            resolve_memory_workspace("", "~/.openclaw/workspace-fallback"),
            "~/.openclaw/workspace-fallback"
        );
    }

    #[test]
    fn order_memory_root_documents_keeps_primary_before_legacy() {
        let ordered = order_memory_root_documents(vec![
            GatewayAgentFileEntry {
                name: "memory.md".to_string(),
                path: "~/.openclaw/workspace/memory.md".to_string(),
                missing: true,
                size: None,
                updated_at_ms: None,
                content: None,
            },
            GatewayAgentFileEntry {
                name: "MEMORY.md".to_string(),
                path: "~/.openclaw/workspace/MEMORY.md".to_string(),
                missing: false,
                size: None,
                updated_at_ms: None,
                content: Some("# Memory".to_string()),
            },
        ]);

        assert_eq!(ordered[0].name, "MEMORY.md");
        assert_eq!(ordered[1].name, "memory.md");
    }

    #[test]
    fn order_daily_memory_entries_keeps_latest_day_first() {
        let ordered = order_daily_memory_entries(vec![
            GatewayAgentFileEntry {
                name: "memory/2026-03-25.md".to_string(),
                path: "~/.openclaw/workspace/memory/2026-03-25.md".to_string(),
                missing: false,
                size: None,
                updated_at_ms: None,
                content: None,
            },
            GatewayAgentFileEntry {
                name: "memory/2026-03-27.md".to_string(),
                path: "~/.openclaw/workspace/memory/2026-03-27.md".to_string(),
                missing: false,
                size: None,
                updated_at_ms: None,
                content: None,
            },
        ]);

        assert_eq!(ordered[0].name, "memory/2026-03-27.md");
        assert_eq!(ordered[1].name, "memory/2026-03-25.md");
    }

    #[test]
    fn resolve_memory_timeline_access_marks_local_workspace_when_directory_is_readable() {
        let workspace = create_temp_dir("timeline-access-local");

        let access = resolve_memory_timeline_access(workspace.as_path(), true)
            .expect("resolve local access");

        assert_eq!(access.mode, GatewayAgentMemoryTimelineSource::LocalWorkspace);
        assert_eq!(
            access.reason,
            GatewayAgentMemoryTimelineAccessReason::WorkspaceLocalAndReadable
        );
        assert_eq!(access.local_workspace_path, Some(workspace));
    }

    #[test]
    fn resolve_memory_timeline_access_marks_remote_probe_when_directory_is_missing() {
        let workspace = create_temp_dir("timeline-access-remote");
        fs::remove_dir_all(&workspace).expect("remove temp directory");

        let access = resolve_memory_timeline_access(workspace.as_path(), true)
            .expect("resolve remote probe fallback");

        assert_eq!(access.mode, GatewayAgentMemoryTimelineSource::RemoteProbe);
        assert_eq!(
            access.reason,
            GatewayAgentMemoryTimelineAccessReason::WorkspaceRemoteOrNotReadable
        );
        assert!(access.local_workspace_path.is_none());
    }

    #[test]
    fn scan_local_memory_timeline_entries_keeps_only_canonical_daily_docs() {
        let workspace = create_temp_dir("timeline-scan");
        let memory_dir = workspace.join("memory");
        fs::create_dir_all(&memory_dir).expect("create memory directory");
        fs::write(memory_dir.join("2026-03-26.md"), "# 2026-03-26").expect("write day 1");
        fs::write(memory_dir.join("2026-03-27.md"), "# 2026-03-27").expect("write day 2");
        fs::write(memory_dir.join("notes.md"), "# not a timeline doc").expect("write ignored note");
        fs::write(memory_dir.join("2026-03-27-session.md"), "# ignored suffix")
            .expect("write ignored suffix note");

        let scan = scan_local_memory_timeline_entries(workspace.as_path())
            .expect("scan local timeline entries");

        assert_eq!(
            scan.entries
                .iter()
                .map(|entry| entry.name.as_str())
                .collect::<Vec<_>>(),
            vec!["memory/2026-03-27.md", "memory/2026-03-26.md"]
        );
        assert_eq!(scan.local_scan_files_count, 4);
        assert_eq!(scan.local_scan_skipped_count, 2);
    }

    #[test]
    fn build_timeline_probe_date_names_returns_newest_first_inclusive_range() {
        assert_eq!(
            build_timeline_probe_date_names("2026-03-22", "2026-03-28")
                .expect("build canonical range"),
            vec![
                "memory/2026-03-28.md".to_string(),
                "memory/2026-03-27.md".to_string(),
                "memory/2026-03-26.md".to_string(),
                "memory/2026-03-25.md".to_string(),
                "memory/2026-03-24.md".to_string(),
                "memory/2026-03-23.md".to_string(),
                "memory/2026-03-22.md".to_string(),
            ]
        );
    }

    #[test]
    fn build_timeline_probe_date_names_rejects_reversed_or_oversized_ranges() {
        assert!(build_timeline_probe_date_names("2026-03-29", "2026-03-28").is_err());
        assert!(build_timeline_probe_date_names("2026-01-01", "2026-03-28").is_err());
    }

    #[test]
    fn remote_probe_request_timeout_exceeds_agent_wait_timeout() {
        assert!(REMOTE_TIMELINE_PROBE_REQUEST_TIMEOUT > REMOTE_TIMELINE_PROBE_WAIT_TIMEOUT);
    }

    #[test]
    fn remote_timeline_entry_timeout_budget_exceeds_probe_budget() {
        assert!(REMOTE_TIMELINE_ENTRY_WAIT_TIMEOUT > REMOTE_TIMELINE_PROBE_WAIT_TIMEOUT);
        assert!(REMOTE_TIMELINE_ENTRY_REQUEST_TIMEOUT > REMOTE_TIMELINE_ENTRY_WAIT_TIMEOUT);
        assert!(REMOTE_TIMELINE_PROBE_RETRY_WAIT_TIMEOUT > REMOTE_TIMELINE_PROBE_WAIT_TIMEOUT);
        assert!(
            REMOTE_TIMELINE_PROBE_RETRY_REQUEST_TIMEOUT > REMOTE_TIMELINE_PROBE_RETRY_WAIT_TIMEOUT
        );
    }

    #[test]
    fn remote_probe_send_disposition_waits_for_started_or_in_flight_runs() {
        assert_eq!(
            resolve_remote_probe_send_disposition(
                GatewaySessionSendResponse {
                    run_id: Some("run-123".to_string()),
                    status: Some("started".to_string()),
                    error: None,
                    summary: None,
                },
                "memory/2026-03-28.md",
            )
            .expect("resolve started send disposition"),
            RemoteProbeSendDisposition::Wait("run-123".to_string())
        );

        assert_eq!(
            resolve_remote_probe_send_disposition(
                GatewaySessionSendResponse {
                    run_id: Some("run-456".to_string()),
                    status: Some("in_flight".to_string()),
                    error: None,
                    summary: None,
                },
                "memory/2026-03-28.md",
            )
            .expect("resolve in-flight send disposition"),
            RemoteProbeSendDisposition::Wait("run-456".to_string())
        );
    }

    #[test]
    fn remote_probe_send_disposition_accepts_completed_runs() {
        assert_eq!(
            resolve_remote_probe_send_disposition(
                GatewaySessionSendResponse {
                    run_id: Some("run-789".to_string()),
                    status: Some("ok".to_string()),
                    error: None,
                    summary: None,
                },
                "memory/2026-03-28.md",
            )
            .expect("resolve completed send disposition"),
            RemoteProbeSendDisposition::Completed
        );
    }

    #[test]
    fn remote_probe_send_disposition_maps_error_and_timeout_statuses() {
        let timeout_error = resolve_remote_probe_send_disposition(
            GatewaySessionSendResponse {
                run_id: Some("run-timeout".to_string()),
                status: Some("timeout".to_string()),
                error: None,
                summary: None,
            },
            "memory/2026-03-28.md",
        )
        .expect_err("timeout should return error");
        assert!(timeout_error.to_string().contains("run-timeout"));

        let request_error = resolve_remote_probe_send_disposition(
            GatewaySessionSendResponse {
                run_id: Some("run-error".to_string()),
                status: Some("error".to_string()),
                error: Some("tool call failed".to_string()),
                summary: None,
            },
            "memory/2026-03-28.md",
        )
        .expect_err("error status should return error");
        assert!(request_error.to_string().contains("tool call failed"));
    }

    #[test]
    fn build_remote_probe_summary_counts_hits_misses_and_skips() {
        let summary = build_remote_probe_summary(&[
            probe_attempt(RemoteTimelineProbeOutcome::Hit),
            probe_attempt(RemoteTimelineProbeOutcome::Miss),
            probe_attempt(RemoteTimelineProbeOutcome::Error(GatewayErrorSummary::new(
                "protocol",
                Some("PROTOCOL_ERROR".to_string()),
                "probe parse failed",
                false,
                None,
            ))),
            probe_attempt(RemoteTimelineProbeOutcome::Hit),
        ]);

        assert_eq!(summary.attempted_days, 4);
        assert_eq!(summary.hit_days, 2);
        assert_eq!(summary.miss_days, 1);
        assert_eq!(summary.skipped_days, 1);
        assert_eq!(summary.timeout_days, 0);
        assert_eq!(summary.error_days, 1);
        assert_eq!(summary.retry_days, 0);
        assert_eq!(summary.retry_recovered_days, 0);
        assert_eq!(
            summary.status,
            GatewayAgentMemoryTimelineProbeStatus::Partial
        );
        assert!(!summary.cached);
        assert_eq!(summary.last_error_category.as_deref(), Some("protocol"));
        assert_eq!(
            summary.last_error_code.as_deref(),
            Some("PROTOCOL_ERROR")
        );
    }

    #[test]
    fn build_remote_probe_summary_marks_zero_hit_probe_as_empty() {
        let summary = build_remote_probe_summary(&[
            probe_attempt(RemoteTimelineProbeOutcome::Miss),
            probe_attempt(RemoteTimelineProbeOutcome::Miss),
            probe_attempt(RemoteTimelineProbeOutcome::Miss),
        ]);

        assert_eq!(summary.hit_days, 0);
        assert_eq!(summary.miss_days, 3);
        assert_eq!(summary.skipped_days, 0);
        assert_eq!(summary.retry_days, 0);
        assert_eq!(summary.retry_recovered_days, 0);
        assert_eq!(summary.status, GatewayAgentMemoryTimelineProbeStatus::Empty);
    }

    #[test]
    fn build_remote_probe_summary_marks_all_timeout_probe_as_timeout() {
        let summary = build_remote_probe_summary(&[
            probe_attempt(RemoteTimelineProbeOutcome::Timeout(GatewayErrorSummary::new(
                "transport",
                Some("SOCKET_ERROR".to_string()),
                "timed out waiting for remote memory probe run",
                true,
                None,
            ))),
            probe_attempt(RemoteTimelineProbeOutcome::Timeout(GatewayErrorSummary::new(
                "transport",
                Some("SOCKET_ERROR".to_string()),
                "timed out waiting for remote memory probe run",
                true,
                None,
            ))),
        ]);

        assert_eq!(summary.timeout_days, 2);
        assert_eq!(summary.error_days, 0);
        assert_eq!(summary.retry_days, 0);
        assert_eq!(summary.retry_recovered_days, 0);
        assert_eq!(
            summary.status,
            GatewayAgentMemoryTimelineProbeStatus::Timeout
        );
    }

    #[test]
    fn build_remote_probe_summary_marks_all_error_probe_as_error() {
        let summary = build_remote_probe_summary(&[
            probe_attempt(RemoteTimelineProbeOutcome::Error(GatewayErrorSummary::new(
                "request",
                Some("REMOTE_TIMELINE_PROBE_FAILED".to_string()),
                "tool call failed",
                false,
                None,
            ))),
            probe_attempt(RemoteTimelineProbeOutcome::Error(GatewayErrorSummary::new(
                "protocol",
                Some("PROTOCOL_ERROR".to_string()),
                "probe parse failed",
                false,
                None,
            ))),
        ]);

        assert_eq!(summary.timeout_days, 0);
        assert_eq!(summary.error_days, 2);
        assert_eq!(summary.hit_days, 0);
        assert_eq!(summary.miss_days, 0);
        assert_eq!(summary.retry_days, 0);
        assert_eq!(summary.retry_recovered_days, 0);
        assert_eq!(summary.status, GatewayAgentMemoryTimelineProbeStatus::Error);
    }

    #[test]
    fn build_remote_probe_summary_tracks_retry_activity() {
        let summary = build_remote_probe_summary(&[
            RemoteTimelineProbeAttempt {
                name: "memory/2026-03-27.md".to_string(),
                date: "2026-03-27".to_string(),
                outcome: RemoteTimelineProbeOutcome::Miss,
                file: None,
                retried: true,
                recovered_after_retry: true,
            },
            RemoteTimelineProbeAttempt {
                name: "memory/2026-03-26.md".to_string(),
                date: "2026-03-26".to_string(),
                outcome: RemoteTimelineProbeOutcome::Timeout(GatewayErrorSummary::new(
                    "transport",
                    Some("SOCKET_ERROR".to_string()),
                    "timed out waiting for remote memory probe run",
                    true,
                    None,
                )),
                file: None,
                retried: true,
                recovered_after_retry: false,
            },
            RemoteTimelineProbeAttempt {
                name: "memory/2026-03-25.md".to_string(),
                date: "2026-03-25".to_string(),
                outcome: RemoteTimelineProbeOutcome::Hit,
                file: None,
                retried: false,
                recovered_after_retry: false,
            },
        ]);

        assert_eq!(summary.attempted_days, 3);
        assert_eq!(summary.retry_days, 2);
        assert_eq!(summary.retry_recovered_days, 1);
        assert_eq!(summary.timeout_days, 1);
        assert_eq!(summary.skipped_days, 1);
        assert_eq!(
            summary.status,
            GatewayAgentMemoryTimelineProbeStatus::Partial
        );
    }

    #[test]
    fn build_remote_probe_summary_exposes_day_results() {
        let summary = build_remote_probe_summary(&[
            RemoteTimelineProbeAttempt {
                name: "memory/2026-03-27.md".to_string(),
                date: "2026-03-27".to_string(),
                outcome: RemoteTimelineProbeOutcome::Hit,
                file: None,
                retried: false,
                recovered_after_retry: false,
            },
            RemoteTimelineProbeAttempt {
                name: "memory/2026-03-26.md".to_string(),
                date: "2026-03-26".to_string(),
                outcome: RemoteTimelineProbeOutcome::Timeout(GatewayErrorSummary::new(
                    "transport",
                    Some("SOCKET_ERROR".to_string()),
                    "timed out waiting for remote memory probe run",
                    true,
                    None,
                )),
                file: None,
                retried: true,
                recovered_after_retry: false,
            },
        ]);

        assert_eq!(summary.days.len(), 2);
        assert_eq!(summary.days[0].date, "2026-03-27");
        assert_eq!(summary.days[0].name, "memory/2026-03-27.md");
        assert_eq!(
            summary.days[0].status,
            GatewayAgentMemoryTimelineProbeDayStatus::Hit
        );
        assert!(!summary.days[0].retried);
        assert_eq!(
            summary.days[1].status,
            GatewayAgentMemoryTimelineProbeDayStatus::Timeout
        );
        assert!(summary.days[1].retried);
        assert!(!summary.days[1].recovered_after_retry);
        assert_eq!(
            summary.days[1].error_code.as_deref(),
            Some("SOCKET_ERROR")
        );
    }

    #[test]
    fn build_timeline_probe_date_names_from_dates_normalizes_and_sorts() {
        let names = build_timeline_probe_date_names_from_dates(&[
            "2026-03-24".to_string(),
            "2026-03-26".to_string(),
            "2026-03-24".to_string(),
            "2026-03-25".to_string(),
        ])
        .expect("valid explicit dates");

        assert_eq!(
            names,
            vec![
                "memory/2026-03-26.md".to_string(),
                "memory/2026-03-25.md".to_string(),
                "memory/2026-03-24.md".to_string(),
            ]
        );
    }

    #[test]
    fn read_local_memory_timeline_entry_reads_canonical_daily_file_content() {
        let workspace = create_temp_dir("timeline-read");
        let memory_dir = workspace.join("memory");
        fs::create_dir_all(&memory_dir).expect("create memory directory");
        fs::write(
            memory_dir.join("2026-03-27.md"),
            "# Daily Memory\n\n- shipped wave 1",
        )
        .expect("write daily memory");

        let entry = read_local_memory_timeline_entry(
            workspace.as_path(),
            "memory/2026-03-27.md",
        )
        .expect("read local timeline entry");

        assert_eq!(entry.name, "memory/2026-03-27.md");
        assert_eq!(
            entry.content.as_deref(),
            Some("# Daily Memory\n\n- shipped wave 1")
        );
        assert!(!entry.missing);
        assert_eq!(
            entry.path,
            memory_dir.join("2026-03-27.md").display().to_string()
        );
    }
}




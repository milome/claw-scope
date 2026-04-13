use std::path::PathBuf;

use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_shell::ShellExt;
use url::Url;

use crate::gateway::{
    connector,
    discovery,
    endpoint::GatewayEndpoint,
    errors::GatewayErrorSummary,
    state::GatewayAppState,
    types::{
        GatewayAdvancedConnectionConfig,
        GatewayAgentFileGetResult, GatewayAgentIdentityResult, GatewayAgentMemoryIndexResult,
        GatewayAgentMemoryResult,
        GatewayDiscoveredCandidate, GatewaySavedEndpoint,
        GatewayConfigSchemaLookupResult,
        GatewayAgentMemoryRuntimeStatusResult, GatewayAgentMemorySearchResult,
        GatewayAgentMemoryStatusResult,
        GatewayAgentMemoryTimelineAccessResult, GatewayAgentMemoryTimelineResult,
        GatewayAgentSettingsResult, GatewayAgentSettingsUpdateInput, GatewayAgentsListResult, GatewayConfigSetResult, GatewayConnectConfig,
        GatewayStatusSnapshot,
    },
};
use crate::gateway::store::{load_saved_endpoints, remove_saved_endpoint, resolve_store_paths, select_saved_endpoint};
use crate::gateway::store::store_advanced_connection_config;

#[tauri::command]
pub async fn gateway_status(
    state: State<'_, GatewayAppState>,
) -> Result<GatewayStatusSnapshot, GatewayErrorSummary> {
    Ok(state.snapshot())
}

#[tauri::command]
pub async fn gateway_normalize_endpoint(
    config: GatewayConnectConfig,
) -> Result<GatewayEndpoint, GatewayErrorSummary> {
    GatewayEndpoint::from_config(&config).map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_connect(
    state: State<'_, GatewayAppState>,
    config: GatewayConnectConfig,
) -> Result<GatewayStatusSnapshot, GatewayErrorSummary> {
    connector::connect(state.inner().clone(), config)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_discover(
    state: State<'_, GatewayAppState>,
    seed_url: Option<String>,
    timeout_ms: Option<u64>,
) -> Result<Vec<GatewayDiscoveredCandidate>, GatewayErrorSummary> {
    let effective_timeout_ms = timeout_ms.or(Some(state.advanced_config().timeout_ms));
    discovery::discover_lan_candidates(seed_url.as_deref(), effective_timeout_ms)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_saved_endpoints() -> Result<Vec<GatewaySavedEndpoint>, GatewayErrorSummary> {
    load_saved_endpoints(&resolve_store_paths())
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_select_endpoint(
    candidate: GatewayDiscoveredCandidate,
) -> Result<GatewaySavedEndpoint, GatewayErrorSummary> {
    select_saved_endpoint(&resolve_store_paths(), &candidate)
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_remove_saved_endpoint(
    endpoint_id: String,
) -> Result<bool, GatewayErrorSummary> {
    remove_saved_endpoint(&resolve_store_paths(), endpoint_id.as_str())
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_disconnect(
    state: State<'_, GatewayAppState>,
) -> Result<GatewayStatusSnapshot, GatewayErrorSummary> {
    connector::disconnect(state.inner().clone())
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agents_list(
    state: State<'_, GatewayAppState>,
) -> Result<GatewayAgentsListResult, GatewayErrorSummary> {
    connector::agents_list(state.inner().clone())
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_identity_get(
    state: State<'_, GatewayAppState>,
    agent_id: String,
) -> Result<GatewayAgentIdentityResult, GatewayErrorSummary> {
    connector::agent_identity_get(state.inner().clone(), &agent_id)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_soul_get(
    state: State<'_, GatewayAppState>,
    agent_id: String,
) -> Result<GatewayAgentFileGetResult, GatewayErrorSummary> {
    connector::agent_soul_get(state.inner().clone(), &agent_id)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_file_read(
    state: State<'_, GatewayAppState>,
    agent_id: String,
    name: String,
) -> Result<GatewayAgentFileGetResult, GatewayErrorSummary> {
    connector::agent_file_read(state.inner().clone(), &agent_id, &name)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_workspace_identity_get(
    state: State<'_, GatewayAppState>,
    agent_id: String,
) -> Result<GatewayAgentFileGetResult, GatewayErrorSummary> {
    connector::agent_workspace_identity_get(state.inner().clone(), &agent_id)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_memory_get(
    state: State<'_, GatewayAppState>,
    agent_id: String,
) -> Result<GatewayAgentMemoryResult, GatewayErrorSummary> {
    connector::agent_memory_get(state.inner().clone(), &agent_id)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_memory_search(
    state: State<'_, GatewayAppState>,
    agent_id: String,
    query: String,
    max_results: Option<usize>,
    source_filter: Option<String>,
) -> Result<GatewayAgentMemorySearchResult, GatewayErrorSummary> {
    connector::agent_memory_search(
        state.inner().clone(),
        &agent_id,
        &query,
        max_results,
        source_filter.as_deref(),
    )
    .await
    .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_memory_status(
    state: State<'_, GatewayAppState>,
    agent_id: String,
) -> Result<GatewayAgentMemoryStatusResult, GatewayErrorSummary> {
    connector::agent_memory_status(state.inner().clone(), &agent_id)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_memory_runtime_status(
    state: State<'_, GatewayAppState>,
    agent_id: String,
) -> Result<GatewayAgentMemoryRuntimeStatusResult, GatewayErrorSummary> {
    connector::agent_memory_runtime_status(state.inner().clone(), &agent_id)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_memory_timeline_get(
    state: State<'_, GatewayAppState>,
    agent_id: String,
) -> Result<GatewayAgentMemoryTimelineResult, GatewayErrorSummary> {
    connector::agent_memory_timeline_get(state.inner().clone(), &agent_id)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_memory_timeline_access_resolve(
    state: State<'_, GatewayAppState>,
    agent_id: String,
) -> Result<GatewayAgentMemoryTimelineAccessResult, GatewayErrorSummary> {
    connector::agent_memory_timeline_access_resolve(state.inner().clone(), &agent_id)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_memory_timeline_local_scan(
    state: State<'_, GatewayAppState>,
    agent_id: String,
) -> Result<GatewayAgentMemoryTimelineResult, GatewayErrorSummary> {
    connector::agent_memory_timeline_local_scan(state.inner().clone(), &agent_id)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_memory_timeline_remote_probe(
    state: State<'_, GatewayAppState>,
    agent_id: String,
    start_date: String,
    end_date: String,
) -> Result<GatewayAgentMemoryTimelineResult, GatewayErrorSummary> {
    connector::agent_memory_timeline_remote_probe(
        state.inner().clone(),
        &agent_id,
        &start_date,
        &end_date,
    )
    .await
    .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_memory_timeline_remote_probe_dates(
    state: State<'_, GatewayAppState>,
    agent_id: String,
    dates: Vec<String>,
) -> Result<GatewayAgentMemoryTimelineResult, GatewayErrorSummary> {
    connector::agent_memory_timeline_remote_probe_dates(state.inner().clone(), &agent_id, &dates)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_memory_timeline_entry_get(
    state: State<'_, GatewayAppState>,
    agent_id: String,
    name: String,
) -> Result<GatewayAgentFileGetResult, GatewayErrorSummary> {
    connector::agent_memory_timeline_entry_get(state.inner().clone(), &agent_id, &name)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_memory_timeline_entry_read(
    state: State<'_, GatewayAppState>,
    agent_id: String,
    name: String,
) -> Result<GatewayAgentFileGetResult, GatewayErrorSummary> {
    connector::agent_memory_timeline_entry_read(state.inner().clone(), &agent_id, &name)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_settings_get(
    state: State<'_, GatewayAppState>,
    agent_id: String,
) -> Result<GatewayAgentSettingsResult, GatewayErrorSummary> {
    connector::agent_settings_get(state.inner().clone(), &agent_id)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_settings_set(
    state: State<'_, GatewayAppState>,
    input: GatewayAgentSettingsUpdateInput,
) -> Result<GatewayAgentSettingsResult, GatewayErrorSummary> {
    connector::agent_settings_set(state.inner().clone(), input)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_config_schema_lookup(
    state: State<'_, GatewayAppState>,
    path: String,
) -> Result<GatewayConfigSchemaLookupResult, GatewayErrorSummary> {
    connector::config_schema_lookup(state.inner().clone(), &path)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_config_set_local(
    state: State<'_, GatewayAppState>,
    key: String,
    value: String,
) -> Result<GatewayConfigSetResult, GatewayErrorSummary> {
    connector::config_set_local(state.inner().clone(), &key, &value)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_advanced_connection_config_get(
    state: State<'_, GatewayAppState>,
) -> Result<GatewayAdvancedConnectionConfig, GatewayErrorSummary> {
    Ok(state.advanced_config())
}

#[tauri::command]
pub async fn gateway_advanced_connection_config_set(
    state: State<'_, GatewayAppState>,
    config: GatewayAdvancedConnectionConfig,
) -> Result<GatewayAdvancedConnectionConfig, GatewayErrorSummary> {
    let normalized = GatewayAdvancedConnectionConfig {
        timeout_ms: config.timeout_ms.clamp(1_000, 120_000),
        heartbeat_ms: config.heartbeat_ms.clamp(1_000, 60_000),
        proxy_url: config
            .proxy_url
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
    };
    let paths = resolve_store_paths();
    store_advanced_connection_config(&paths, &normalized)
        .map_err(|error| GatewayErrorSummary::from_error(&error))?;
    state.replace_advanced_config(normalized.clone());
    Ok(normalized)
}

#[tauri::command]
pub async fn gateway_agent_memory_set(
    state: State<'_, GatewayAppState>,
    agent_id: String,
    name: String,
    content: String,
) -> Result<(), GatewayErrorSummary> {
    connector::agent_memory_set(state.inner().clone(), &agent_id, &name, &content)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_memory_index(
    state: State<'_, GatewayAppState>,
    agent_id: String,
    force: bool,
) -> Result<GatewayAgentMemoryIndexResult, GatewayErrorSummary> {
    connector::agent_memory_index(state.inner().clone(), &agent_id, force)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_workspace_identity_set(
    state: State<'_, GatewayAppState>,
    agent_id: String,
    content: String,
) -> Result<(), GatewayErrorSummary> {
    connector::agent_workspace_identity_set(state.inner().clone(), &agent_id, &content)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn gateway_agent_soul_set(
    state: State<'_, GatewayAppState>,
    agent_id: String,
    content: String,
) -> Result<(), GatewayErrorSummary> {
    connector::agent_soul_set(state.inner().clone(), &agent_id, &content)
        .await
        .map_err(|error| GatewayErrorSummary::from_error(&error))
}

#[tauri::command]
pub async fn open_external_url(
    app: AppHandle,
    url: String,
) -> Result<(), GatewayErrorSummary> {
    let parsed = Url::parse(url.trim()).map_err(|error| {
        GatewayErrorSummary::new(
            "transport",
            Some("INVALID_EXTERNAL_URL".to_string()),
            format!("外部链接格式无效: {error}"),
            false,
            Some("请检查文档链接是否为完整的 http/https 地址。".to_string()),
        )
    })?;

    if !matches!(parsed.scheme(), "http" | "https") {
        return Err(GatewayErrorSummary::new(
            "transport",
            Some("UNSUPPORTED_EXTERNAL_URL_SCHEME".to_string()),
            format!("不支持的外部链接协议: {}", parsed.scheme()),
            false,
            Some("当前只允许打开 http 或 https 文档链接。".to_string()),
        ));
    }

    #[allow(deprecated)]
    app.shell().open(parsed.to_string(), None).map_err(|error| {
        GatewayErrorSummary::new(
            "transport",
            Some("OPEN_EXTERNAL_URL_FAILED".to_string()),
            format!("打开外部链接失败: {error}"),
            true,
            Some("请确认系统默认浏览器可用，或复制链接后手动打开。".to_string()),
        )
    })?;

    Ok(())
}

#[tauri::command]
pub async fn export_markdown_document(
    app: AppHandle,
    suggested_file_name: String,
    content: String,
) -> Result<Option<String>, GatewayErrorSummary> {
    let selected_path = app
        .dialog()
        .file()
        .add_filter("Markdown", &["md"])
        .set_file_name(suggested_file_name)
        .blocking_save_file();

    let Some(selected_path) = selected_path else {
        return Ok(None);
    };

    let output_path = ensure_markdown_extension(selected_path.into_path().map_err(|error| {
        GatewayErrorSummary::new(
            "export",
            Some("EXPORT_INVALID_PATH".to_string()),
            format!("无法解析导出路径: {error}"),
            false,
            Some("请在桌面系统的本地文件目录中选择导出位置。".to_string()),
        )
    })?);

    std::fs::write(&output_path, content.as_bytes()).map_err(|error| {
        GatewayErrorSummary::new(
            "export",
            Some("EXPORT_WRITE_FAILED".to_string()),
            format!("导出失败: {error}"),
            false,
            Some("请检查目标目录是否可写，然后重试。".to_string()),
        )
    })?;

    Ok(Some(output_path.display().to_string()))
}

#[tauri::command]
pub async fn export_markdown_document_quick(
    suggested_file_name: String,
    content: String,
) -> Result<String, GatewayErrorSummary> {
    let output_root = export_markdown_root().map_err(|error| {
        GatewayErrorSummary::new(
            "export",
            Some("EXPORT_ROOT_RESOLVE_FAILED".to_string()),
            format!("无法解析快速导出目录: {error}"),
            false,
            Some("请检查本机用户目录或应用数据目录权限。".to_string()),
        )
    })?;

    std::fs::create_dir_all(&output_root).map_err(|error| {
        GatewayErrorSummary::new(
            "export",
            Some("EXPORT_ROOT_CREATE_FAILED".to_string()),
            format!("无法创建快速导出目录: {error}"),
            false,
            Some("请检查目标目录是否可写。".to_string()),
        )
    })?;

    let file_name = ensure_markdown_extension(PathBuf::from(suggested_file_name));
    let output_path = output_root.join(file_name);
    std::fs::write(&output_path, content.as_bytes()).map_err(|error| {
        GatewayErrorSummary::new(
            "export",
            Some("EXPORT_QUICK_WRITE_FAILED".to_string()),
            format!("快速导出失败: {error}"),
            false,
            Some("请检查目标目录是否可写，然后重试。".to_string()),
        )
    })?;

    Ok(output_path.display().to_string())
}

fn ensure_markdown_extension(mut path: PathBuf) -> PathBuf {
    if path.extension().is_none() {
        path.set_extension("md");
    }

    path
}

fn export_markdown_root() -> Result<PathBuf, std::io::Error> {
    if let Some(app_data) = std::env::var_os("APPDATA") {
        return Ok(PathBuf::from(app_data)
            .join("claw-scope")
            .join("exports"));
    }

    if let Some(home) = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")) {
        return Ok(PathBuf::from(home).join("claw-scope-exports"));
    }

    Ok(std::env::current_dir()?.join("exports"))
}

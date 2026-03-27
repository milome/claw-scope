use std::path::PathBuf;

use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::gateway::{
    connector,
    endpoint::GatewayEndpoint,
    errors::GatewayErrorSummary,
    state::GatewayAppState,
    types::{
        GatewayAgentFileGetResult, GatewayAgentIdentityResult, GatewayAgentsListResult,
        GatewayConnectConfig, GatewayStatusSnapshot,
    },
};

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
pub async fn gateway_agent_workspace_identity_get(
    state: State<'_, GatewayAppState>,
    agent_id: String,
) -> Result<GatewayAgentFileGetResult, GatewayErrorSummary> {
    connector::agent_workspace_identity_get(state.inner().clone(), &agent_id)
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

fn ensure_markdown_extension(mut path: PathBuf) -> PathBuf {
    if path.extension().is_none() {
        path.set_extension("md");
    }

    path
}

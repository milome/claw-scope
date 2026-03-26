use tauri::State;

use crate::gateway::{
    connector,
    endpoint::GatewayEndpoint,
    errors::GatewayErrorSummary,
    state::GatewayAppState,
    types::{GatewayAgentsListResult, GatewayConnectConfig, GatewayStatusSnapshot},
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

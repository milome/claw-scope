#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod gateway;
mod evolution;

use gateway::state::GatewayAppState;
use evolution::state::EvolutionAppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(GatewayAppState::default())
        .manage(EvolutionAppState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            gateway::commands::gateway_status,
            gateway::commands::gateway_normalize_endpoint,
            gateway::commands::gateway_connect,
            gateway::commands::gateway_discover,
            gateway::commands::gateway_disconnect,
            gateway::commands::gateway_saved_endpoints,
            gateway::commands::gateway_select_endpoint,
            gateway::commands::gateway_remove_saved_endpoint,
            gateway::commands::gateway_agents_list,
            gateway::commands::gateway_agent_identity_get,
            gateway::commands::gateway_agent_soul_get,
            gateway::commands::gateway_agent_file_read,
            gateway::commands::gateway_agent_memory_get,
            gateway::commands::gateway_agent_memory_search,
            gateway::commands::gateway_agent_memory_status,
            gateway::commands::gateway_agent_memory_runtime_status,
            gateway::commands::gateway_agent_memory_timeline_get,
            gateway::commands::gateway_agent_memory_timeline_access_resolve,
            gateway::commands::gateway_agent_memory_timeline_local_scan,
            gateway::commands::gateway_agent_memory_timeline_remote_probe,
            gateway::commands::gateway_agent_memory_timeline_remote_probe_dates,
            gateway::commands::gateway_agent_memory_timeline_entry_get,
            gateway::commands::gateway_agent_memory_timeline_entry_read,
            gateway::commands::gateway_agent_workspace_identity_get,
            gateway::commands::gateway_agent_settings_get,
            gateway::commands::gateway_agent_settings_set,
            gateway::commands::gateway_config_schema_lookup,
            gateway::commands::gateway_config_set_local,
            gateway::commands::gateway_advanced_connection_config_get,
            gateway::commands::gateway_advanced_connection_config_set,
            gateway::commands::gateway_agent_memory_set,
            gateway::commands::gateway_agent_memory_index,
            gateway::commands::gateway_agent_workspace_identity_set,
            gateway::commands::gateway_agent_soul_set,
            gateway::commands::open_external_url,
            gateway::commands::export_markdown_document,
            gateway::commands::export_markdown_document_quick,
            evolution::commands::evolution_preview,
            evolution::commands::evolution_execute_start,
            evolution::commands::evolution_operation_status,
            evolution::commands::evolution_cancel,
            evolution::commands::evolution_execute,
            evolution::commands::evolution_history_list,
            evolution::commands::evolution_audit_summary,
            evolution::commands::evolution_rollback,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

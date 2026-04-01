#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod gateway;

use gateway::state::GatewayAppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(GatewayAppState::default())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            gateway::commands::gateway_status,
            gateway::commands::gateway_normalize_endpoint,
            gateway::commands::gateway_connect,
            gateway::commands::gateway_disconnect,
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
            gateway::commands::gateway_config_set_local,
            gateway::commands::gateway_agent_memory_set,
            gateway::commands::gateway_agent_memory_index,
            gateway::commands::gateway_agent_workspace_identity_set,
            gateway::commands::gateway_agent_soul_set,
            gateway::commands::open_external_url,
            gateway::commands::export_markdown_document,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

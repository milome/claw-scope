#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod gateway;

use gateway::state::GatewayAppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(GatewayAppState::default())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            gateway::commands::gateway_status,
            gateway::commands::gateway_normalize_endpoint,
            gateway::commands::gateway_connect,
            gateway::commands::gateway_disconnect,
            gateway::commands::gateway_agents_list,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

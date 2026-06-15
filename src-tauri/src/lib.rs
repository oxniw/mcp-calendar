mod models;
mod storage;
mod commands;
mod notifications;
mod mcp;

use commands::{AppState, get_events, save_event, delete_event, get_mcp_config};

pub fn run_mcp_server() {
    mcp::run_mcp_server();
}

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Get path to local AppData directory for the app
            let app_data_dir = app.path().app_data_dir().unwrap();
            let file_path = app_data_dir.join("calendar.json");
            
            // Spawn background notification worker thread
            notifications::start_notification_worker(file_path.clone());
            
            app.manage(AppState { file_path });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![get_events, save_event, delete_event, get_mcp_config])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

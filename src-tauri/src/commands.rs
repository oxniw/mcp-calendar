use crate::models::CalendarEvent;
use crate::storage::{load_events, save_events};
use std::path::PathBuf;
use tauri::State;

pub struct AppState {
    pub file_path: PathBuf,
}

#[tauri::command]
pub async fn get_events(state: State<'_, AppState>) -> Result<Vec<CalendarEvent>, String> {
    load_events(&state.file_path)
}

#[tauri::command]
pub async fn save_event(state: State<'_, AppState>, event: CalendarEvent) -> Result<(), String> {
    let mut events = load_events(&state.file_path)?;

    // If an event with the same ID already exists, update it; otherwise, append it.
    if let Some(index) = events.iter().position(|e| e.id == event.id) {
        events[index] = event;
    } else {
        events.push(event);
    }

    save_events(&state.file_path, &events)
}

#[tauri::command]
pub async fn delete_event(state: State<'_, AppState>, id: String) -> Result<(), String> {
    let mut events = load_events(&state.file_path)?;
    let initial_len = events.len();
    events.retain(|e| e.id != id);

    if events.len() == initial_len {
        return Err("Event not found".to_string());
    }

    save_events(&state.file_path, &events)
}

#[tauri::command]
pub fn get_mcp_config() -> Result<String, String> {
    let exe_path = std::env::current_exe()
        .map_err(|e| format!("Failed to get current exe path: {}", e))?;
    
    let exe_path_str = exe_path.to_string_lossy().replace('\\', "/");
    
    let config = serde_json::json!({
        "mcpServers": {
            "stop-scrolling-calendar": {
                "command": exe_path_str,
                "args": ["--mcp"]
            }
        }
    });
    
    serde_json::to_string_pretty(&config)
        .map_err(|e| format!("Failed to serialize: {}", e))
}


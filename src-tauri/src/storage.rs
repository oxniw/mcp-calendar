use std::fs::{File, OpenOptions};
use std::io::{Read, Write};
use std::path::Path;
use crate::models::CalendarEvent;

/// Loads events from the specified JSON file path.
/// If the file does not exist, returns an empty list.
pub fn load_events(file_path: &Path) -> Result<Vec<CalendarEvent>, String> {
    if !file_path.exists() {
        return Ok(Vec::new());
    }

    let mut file = File::open(file_path).map_err(|e| format!("Failed to open file: {}", e))?;
    let mut contents = String::new();
    file.read_to_string(&mut contents).map_err(|e| format!("Failed to read file: {}", e))?;

    if contents.trim().is_empty() {
        return Ok(Vec::new());
    }

    let events: Vec<CalendarEvent> = serde_json::from_str(&contents)
        .map_err(|e| format!("Failed to parse JSON: {}", e))?;
    Ok(events)
}

/// Saves the list of events to the specified JSON file path, overwriting it.
pub fn save_events(file_path: &Path, events: &[CalendarEvent]) -> Result<(), String> {
    if let Some(parent) = file_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create directories: {}", e))?;
    }

    let json = serde_json::to_string_pretty(events)
        .map_err(|e| format!("Failed to serialize events: {}", e))?;

    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(file_path)
        .map_err(|e| format!("Failed to open file for writing: {}", e))?;

    file.write_all(json.as_bytes())
        .map_err(|e| format!("Failed to write data: {}", e))?;

    Ok(())
}

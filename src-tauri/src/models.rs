use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalendarEvent {
    pub id: String,
    pub title: String,
    pub description: String,
    #[serde(rename = "startTime")]
    pub start_time: String, // ISO 8601 string (e.g. "2026-06-15T12:00:00")
    #[serde(rename = "endTime")]
    pub end_time: String,   // ISO 8601 string
    pub category: Option<String>,
}

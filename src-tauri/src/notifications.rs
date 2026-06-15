use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::Mutex;
use std::sync::OnceLock;
use std::time::Duration;
use crate::storage::load_events;

// Thread-safe in-memory cache to keep track of already notified event IDs during the current session
fn notified_events() -> &'static Mutex<HashSet<String>> {
    static INSTANCE: OnceLock<Mutex<HashSet<String>>> = OnceLock::new();
    INSTANCE.get_or_init(|| Mutex::new(HashSet::new()))
}

/// Spawns a background OS thread that monitors the calendar JSON file
/// and sends notifications when an event's start time is reached.
pub fn start_notification_worker(file_path: PathBuf) {
    std::thread::spawn(move || {
        loop {
            // Load calendar events
            if let Ok(events) = load_events(&file_path) {
                let now = time::OffsetDateTime::now_utc();

                for event in events {
                    // Skip if already notified in this session
                    {
                        let notified = notified_events().lock().unwrap();
                        if notified.contains(&event.id) {
                            continue;
                        }
                    }

                    // Parse event start time (ISO 8601/Rfc3339)
                    if let Ok(event_time) = time::OffsetDateTime::parse(
                        &event.start_time,
                        &time::format_description::well_known::Rfc3339,
                    ) {
                        let diff_seconds = (event_time - now).whole_seconds();

                        // Notify if the event starts in the next 30 seconds or has started within the last 30 seconds
                        if diff_seconds.abs() <= 30 {
                            // Register ID as notified first to prevent race conditions
                            {
                                let mut notified = notified_events().lock().unwrap();
                                notified.insert(event.id.clone());
                            }

                            // Trigger OS desktop notification
                            let body_text = if event.description.is_empty() {
                                "This event is starting now!".to_string()
                            } else {
                                event.description.clone()
                            };

                            let category_label = event.category.clone().unwrap_or_else(|| "other".to_string());
                            let title_text = format!("{} ({})", event.title, category_label.to_uppercase());

                            if let Err(e) = notify_rust::Notification::new()
                                .summary(&title_text)
                                .body(&body_text)
                                .appname("Calendar")
                                .timeout(Duration::from_secs(10))
                                .show()
                            {
                                eprintln!("Failed to send desktop notification: {}", e);
                            }
                        }
                    }
                }
            }

            // Sleep 15 seconds before checking again
            std::thread::sleep(Duration::from_secs(15));
        }
    });
}

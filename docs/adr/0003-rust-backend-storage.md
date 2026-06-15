# 3. Storage Adapter on Rust Backend

We decided to implement the Storage Adapter logic entirely in the Rust backend rather than exposing raw filesystem access to the React frontend. The Rust backend will handle loading and saving the calendar events JSON file and expose async Tauri commands (`get_events`, `save_event`, `delete_event`) to the frontend. This enforces a clean boundary, enhances security, and allows future storage migrations (such as SQLite) without changing frontend code.

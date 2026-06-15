import { invoke } from "@tauri-apps/api/core";

export interface CalendarEvent {
  id: string;
  title: string;
  description: string;
  startTime: string; // ISO 8601 string, e.g. "2026-06-15T12:00:00"
  endTime: string;   // ISO 8601 string, e.g. "2026-06-15T13:00:00"
  category: "work" | "personal" | "important" | "other";
}

/**
 * Fetches all calendar events from the Rust backend.
 */
export async function getEvents(): Promise<CalendarEvent[]> {
  try {
    const events = await invoke<CalendarEvent[]>("get_events");
    return events || [];
  } catch (error) {
    console.error("Failed to load events:", error);
    throw error;
  }
}

/**
 * Saves or updates an event in the Rust backend storage.
 */
export async function saveEvent(event: CalendarEvent): Promise<void> {
  try {
    await invoke("save_event", { event });
  } catch (error) {
    console.error("Failed to save event:", error);
    throw error;
  }
}

/**
 * Deletes an event by ID from the Rust backend storage.
 */
export async function deleteEvent(id: string): Promise<void> {
  try {
    await invoke("delete_event", { id });
  } catch (error) {
    console.error("Failed to delete event:", error);
    throw error;
  }
}

/**
 * Fetches the MCP Server JSON configuration string from the Rust backend.
 */
export async function getMcpConfig(): Promise<string> {
  try {
    return await invoke<string>("get_mcp_config");
  } catch (error) {
    console.error("Failed to get MCP config:", error);
    throw error;
  }
}


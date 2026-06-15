use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{self, BufRead};
use std::path::PathBuf;
use crate::storage::{load_events, save_events};
use crate::models::CalendarEvent;

#[allow(dead_code)]
#[derive(Deserialize, Debug)]
struct JsonRpcRequest {
    jsonrpc: String,
    id: Option<Value>,
    method: String,
    params: Option<Value>,
}

#[derive(Serialize)]
struct JsonRpcResponse {
    jsonrpc: &'static str,
    id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<JsonRpcError>,
}

#[derive(Serialize)]
struct JsonRpcError {
    code: i32,
    message: String,
}

fn get_app_data_path() -> PathBuf {
    #[cfg(target_os = "windows")]
    {
        if let Some(appdata) = std::env::var_os("APPDATA") {
            let mut path = PathBuf::from(appdata);
            path.push("com.onxiw.stop-scrolling");
            return path;
        }
    }
    #[cfg(target_os = "macos")]
    {
        if let Some(home) = std::env::var_os("HOME") {
            let mut path = PathBuf::from(home);
            path.push("Library");
            path.push("Application Support");
            path.push("com.onxiw.stop-scrolling");
            return path;
        }
    }
    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        if let Some(config) = std::env::var_os("XDG_CONFIG_HOME") {
            let mut path = PathBuf::from(config);
            path.push("com.onxiw.stop-scrolling");
            return path;
        } else if let Some(home) = std::env::var_os("HOME") {
            let mut path = PathBuf::from(home);
            path.push(".config");
            path.push("com.onxiw.stop-scrolling");
            return path;
        }
    }
    PathBuf::from(".")
}

pub fn run_mcp_server() {
    let file_path = get_app_data_path().join("calendar.json");
    
    eprintln!("Starting MCP server, using calendar file: {:?}", file_path);
    
    let stdin = io::stdin();
    for line_result in stdin.lock().lines() {
        let line = match line_result {
            Ok(l) => l,
            Err(e) => {
                eprintln!("Error reading stdin: {}", e);
                break;
            }
        };
        
        if line.trim().is_empty() {
            continue;
        }
        
        let request: JsonRpcRequest = match serde_json::from_str(&line) {
            Ok(req) => req,
            Err(e) => {
                eprintln!("Error parsing request JSON: {}", e);
                send_error(Value::Null, -32700, &format!("Parse error: {}", e));
                continue;
            }
        };
        
        handle_request(request, &file_path);
    }
}

fn handle_request(request: JsonRpcRequest, file_path: &std::path::Path) {
    let id = request.id.unwrap_or(Value::Null);
    
    if id.is_null() && request.method.starts_with("notifications/") {
        eprintln!("Received notification: {}", request.method);
        return;
    }
    
    match request.method.as_str() {
        "initialize" => {
            let result = serde_json::json!({
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "stop-scrolling-mcp",
                    "version": "0.1.0"
                }
            });
            send_result(id, result);
        }
        "tools/list" => {
            let result = serde_json::json!({
                "tools": [
                    {
                        "name": "get_events",
                        "description": "Retrieve all calendar events.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {}
                        }
                    },
                    {
                        "name": "save_event",
                        "description": "Save or update a calendar event. If updating, make sure to pass the original event's ID. If creating a new event, the ID can be omitted and will be generated automatically. All times must be in ISO 8601 local format (e.g. 2026-06-15T09:00:00).",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "id": {
                                    "type": "string",
                                    "description": "The unique ID (UUID) of the event. Omit when creating a new event, provide when updating an existing one."
                                },
                                "title": {
                                    "type": "string",
                                    "description": "The title of the event."
                                },
                                "description": {
                                    "type": "string",
                                    "description": "Description details of the event."
                                },
                                "startTime": {
                                    "type": "string",
                                    "description": "Start time in ISO 8601 format (local time, e.g. YYYY-MM-DDTHH:MM:SS)."
                                },
                                "endTime": {
                                    "type": "string",
                                    "description": "End time in ISO 8601 format."
                                },
                                "category": {
                                    "type": "string",
                                    "enum": ["work", "personal", "important", "other"],
                                    "description": "Category for classification."
                                }
                            },
                            "required": ["title", "startTime", "endTime"]
                        }
                    },
                    {
                        "name": "delete_event",
                        "description": "Delete a calendar event by its unique ID.",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "id": {
                                    "type": "string",
                                    "description": "The unique ID of the event to delete."
                                }
                            },
                            "required": ["id"]
                        }
                    }
                ]
            });
            send_result(id, result);
        }
        "tools/call" => {
            let params = request.params.unwrap_or(Value::Null);
            let name = params.get("name").and_then(|v| v.as_str()).unwrap_or("");
            let arguments = params.get("arguments").cloned().unwrap_or(Value::Object(serde_json::Map::new()));
            
            match handle_tool_call(name, arguments, file_path) {
                Ok(content) => {
                    let result = serde_json::json!({
                        "content": content
                    });
                    send_result(id, result);
                }
                Err(err_msg) => {
                    let result = serde_json::json!({
                        "content": [
                            {
                                "type": "text",
                                "text": format!("Error executing tool: {}", err_msg)
                            }
                        ],
                        "isError": true
                    });
                    send_result(id, result);
                }
            }
        }
        _ => {
            send_error(id, -32601, &format!("Method not found: {}", request.method));
        }
    }
}

fn handle_tool_call(name: &str, arguments: Value, file_path: &std::path::Path) -> Result<Vec<Value>, String> {
    match name {
        "get_events" => {
            let events = load_events(file_path)?;
            let text = serde_json::to_string_pretty(&events)
                .map_err(|e| format!("Failed to serialize events: {}", e))?;
            Ok(vec![serde_json::json!({
                "type": "text",
                "text": text
            })])
        }
        "save_event" => {
            let title = arguments.get("title")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter: title".to_string())?
                .to_string();
                
            let start_time = arguments.get("startTime")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter: startTime".to_string())?
                .to_string();
                
            let end_time = arguments.get("endTime")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter: endTime".to_string())?
                .to_string();
                
            let description = arguments.get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("")
                .to_string();
                
            let category = arguments.get("category")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
                
            let id = arguments.get("id")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
                
            let event = CalendarEvent {
                id,
                title,
                description,
                start_time,
                end_time,
                category,
            };
            
            let event_title = event.title.clone();
            let mut events = load_events(file_path)?;
            
            if let Some(index) = events.iter().position(|e| e.id == event.id) {
                events[index] = event;
            } else {
                events.push(event);
            }
            
            save_events(file_path, &events)?;
            
            Ok(vec![serde_json::json!({
                "type": "text",
                "text": format!("Successfully saved event: {}", event_title)
            })])
        }
        "delete_event" => {
            let id = arguments.get("id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| "Missing required parameter: id".to_string())?;
                
            let mut events = load_events(file_path)?;
            let initial_len = events.len();
            events.retain(|e| e.id != id);
            
            if events.len() == initial_len {
                return Err("Event not found".to_string());
            }
            
            save_events(file_path, &events)?;
            
            Ok(vec![serde_json::json!({
                "type": "text",
                "text": format!("Successfully deleted event: {}", id)
            })])
        }
        _ => Err(format!("Unknown tool: {}", name)),
    }
}

fn send_result(id: Value, result: Value) {
    let response = JsonRpcResponse {
        jsonrpc: "2.0",
        id,
        result: Some(result),
        error: None,
    };
    if let Ok(json_str) = serde_json::to_string(&response) {
        println!("{}", json_str);
    }
}

fn send_error(id: Value, code: i32, message: &str) {
    let response = JsonRpcResponse {
        jsonrpc: "2.0",
        id,
        result: None,
        error: Some(JsonRpcError {
            code,
            message: message.to_string(),
        }),
    };
    if let Ok(json_str) = serde_json::to_string(&response) {
        println!("{}", json_str);
    }
}

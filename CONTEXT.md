# Calendar Context

A lightweight local desktop calendar application for organizing events, reminders, and tasks.

## Language

**Event**:
A scheduled occurrence in the calendar having a title, description, start time, and end time.
_Avoid_: Task, appointment

**Storage Adapter**:
An abstraction layer defining how calendar data is persisted and loaded, shielding the domain logic from the underlying storage technology (e.g., JSON file vs. SQL database).
_Avoid_: DB wrapper, file saver

**Category**:
A classification tag for an event (work, personal, important, or other) used for visual color coding in the UI.
_Avoid_: Event tag, color label

**Notification Worker**:
A background thread in the Rust backend that periodically checks events against system time and triggers native OS desktop alerts when an event starts.
_Avoid_: Alert timer, push sender

**Schedule Template**:
A reusable set of events (either copied from a source day or imported from a JSON file) that is shifted to align with the currently selected date upon import.
_Avoid_: Calendar backup, routine list

**Model Context Protocol (MCP) Server**:
A communication interface in the Rust backend that implements the Model Context Protocol over standard I/O (stdin/stdout), allowing external AI assistants to inspect and modify calendar events.
_Avoid_: LLM bridge, agent link, calendar API


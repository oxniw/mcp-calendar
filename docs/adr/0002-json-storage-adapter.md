# 2. Plain JSON File Storage with Abstraction Layer

We decided to store calendar events in a plain JSON file in the local user directory instead of a database like SQLite. To ensure future extensibility and easy modification (such as switching to SQLite or adding cloud synchronization), we will design a strict "Storage Adapter" abstraction layer in the codebase. All reads/writes will go through this adapter, isolating the JSON file operations from the frontend and calendar logic.

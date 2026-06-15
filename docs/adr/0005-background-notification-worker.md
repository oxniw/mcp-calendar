# 5. Rust Background Notification Worker

We decided to implement event reminders using a native Rust background thread (Notification Worker) rather than frontend JavaScript timers. The worker checks the local calendar JSON file every 30 seconds and uses the native OS notification APIs. This ensures alerts are delivered on time, bypassing operating system throttling that commonly delays or blocks JavaScript timers when the webview window is minimized or inactive.

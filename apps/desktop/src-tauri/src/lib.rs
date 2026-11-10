//! DevAtlas desktop shell.
//!
//! The Tauri layer is the infrastructure boundary: it registers commands and wires the
//! runtime to `devatlas-application`. Business logic does not live here.

mod commands;

/// Builds and runs the desktop application until the last window closes.
pub fn run() -> tauri::Result<()> {
    init_tracing();
    tracing::info!(version = env!("CARGO_PKG_VERSION"), "starting DevAtlas");

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![commands::app_info::get_app_info])
        .run(tauri::generate_context!())
}

fn init_tracing() {
    // `try_init` only fails if a global subscriber is already installed, which is harmless.
    let _ = tracing_subscriber::fmt().with_target(false).try_init();
}

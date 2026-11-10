//! DevAtlas Setup: a custom installer whose wizard UI is a webview, carrying the DevAtlas app
//! exe inside it. Run with `--uninstall` it removes DevAtlas instead.
//!
//! This is a separate delivery app, not part of DevAtlas's domain, so its logic lives here
//! rather than in `crates/application`.

use std::sync::atomic::Ordering;

use tauri::Manager;

mod commands;
mod install;
mod system;
mod uninstall;

pub fn run() -> tauri::Result<()> {
    // `try_init` only fails if a global subscriber is already installed, which is harmless.
    let _ = tracing_subscriber::fmt().with_target(false).try_init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(commands::Installed::default())
        .setup(|app| {
            if std::env::args().any(|arg| arg == uninstall::FLAG) {
                // The window stays hidden; dialogs block, so they run off the main thread.
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    let code = uninstall::run(&handle);
                    handle.exit(code);
                });
            } else if let Some(window) = app.get_webview_window("main") {
                // Created hidden so the uninstaller never flashes the wizard.
                window.show()?;
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing mid-install (Alt+F4, taskbar) would leave a half-written app behind.
            if let tauri::WindowEvent::CloseRequested { api, .. } = event
                && window
                    .state::<commands::Installed>()
                    .busy
                    .load(Ordering::SeqCst)
            {
                api.prevent_close();
            }
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_install_defaults,
            commands::get_available_space,
            commands::install,
            commands::launch_app,
        ])
        .run(tauri::generate_context!())
}

//! DevAtlas desktop shell.
//!
//! The Tauri layer is the infrastructure boundary: it registers commands and wires the
//! runtime to `devatlas-application`. Business logic does not live here.

use tauri::Manager;

mod commands;

/// Builds and runs the desktop application until the last window closes.
pub fn run() -> tauri::Result<()> {
    init_tracing();
    tracing::info!(version = env!("CARGO_PKG_VERSION"), "starting DevAtlas");

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let cache_file = app.path().app_cache_dir()?.join("previews.json");
            app.manage(commands::preview::Previews::new(cache_file)?);
            let data_dir = app.path().app_data_dir()?;
            app.manage(commands::library::LibraryStore::new(&data_dir));
            app.manage(commands::discovery::Discovery::new()?);
            app.manage(commands::news::News::new()?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info::get_app_info,
            commands::discovery::list_trending_repos,
            commands::discovery::get_github_repo,
            commands::news::list_news,
            commands::news::list_top_stories,
            commands::news::list_language_rankings,
            commands::library::list_library,
            commands::library::mark_resource_opened,
            commands::library::add_link,
            commands::library::remove_link,
            commands::preview::get_resource_preview,
            commands::viewer::viewer_open,
            commands::viewer::viewer_set_bounds,
            commands::viewer::viewer_close,
            commands::viewer::viewer_go,
        ])
        .run(tauri::generate_context!())
}

fn init_tracing() {
    // `try_init` only fails if a global subscriber is already installed, which is harmless.
    let _ = tracing_subscriber::fmt().with_target(false).try_init();
}

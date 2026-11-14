//! DevAtlas desktop shell.
//!
//! The Tauri layer is the infrastructure boundary: it registers commands and wires the
//! runtime to `devatlas-application`. Business logic does not live here.

use tauri::Manager;

mod commands;
mod mcp;

/// Runs DevAtlas as an AI agent's MCP server on stdio (`devatlas --mcp`), with no window.
pub fn run_mcp() -> std::process::ExitCode {
    mcp::run()
}

/// The database file. Dev builds get their own, so a work-in-progress migration never
/// touches the installed app's data.
pub(crate) const fn database_file() -> &'static str {
    if cfg!(debug_assertions) {
        "devatlas-dev.db"
    } else {
        "devatlas.db"
    }
}

/// Brings the open window forward when DevAtlas is launched again, instead of opening another.
pub(crate) fn focus_main_window(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    // Each step only fails if the window is already closing.
    let _ = window.unminimize();
    let _ = window.show();
    let _ = window.set_focus();
}

/// Builds and runs the desktop application until the last window closes.
pub fn run() -> tauri::Result<()> {
    init_tracing();
    tracing::info!(version = env!("CARGO_PKG_VERSION"), "starting DevAtlas");

    tauri::Builder::default()
        // First, so a second launch hands over to this window before anything else starts.
        // `--mcp` runs never get here: agents' servers are separate processes by design.
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            focus_main_window(app);
        }))
        .plugin(tauri_plugin_opener::init())
        // Used from Rust only, so paths never come from the webview; no capability is granted.
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let cache_file = app.path().app_cache_dir()?.join("previews.json");
            app.manage(commands::preview::Previews::new(cache_file)?);
            let data_dir = app.path().app_data_dir()?;
            app.manage(commands::library::LibraryStore::new(&data_dir));
            app.manage(tauri::async_runtime::block_on(
                commands::organizer::Organizer::open(&data_dir.join(database_file())),
            ));
            app.manage(commands::discovery::Discovery::new()?);
            app.manage(commands::settings::Secrets::new());
            commands::settings::load_github_token(app.handle());
            app.manage(commands::news::News::new()?);
            app.manage(commands::community::Community::new(
                app.handle(),
                &data_dir,
            )?);
            commands::app_info::remove_previous_version();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::agent::get_agent_connection,
            commands::agent::import_github_stars,
            commands::agent::get_star_sync,
            commands::agent::set_star_sync,
            commands::agent::sync_github_stars,
            commands::app_info::get_app_info,
            commands::app_info::check_for_update,
            commands::app_info::install_update,
            commands::community::community_session,
            commands::community::community_sign_in,
            commands::community::community_cancel_sign_in,
            commands::community::community_sign_out,
            commands::community::list_shared_collections,
            commands::community::my_shared_collections,
            commands::community::get_shared_collection,
            commands::community::preview_group_share,
            commands::community::share_group,
            commands::community::unshare_collection,
            commands::community::report_shared_collection,
            commands::community::follow_shared_collection,
            commands::community::unfollow_shared_collection,
            commands::discovery::list_trending_repos,
            commands::discovery::get_github_repo,
            commands::discovery::get_repo_activity,
            commands::organizer::update_resource,
            commands::organizer::list_groups,
            commands::organizer::create_group,
            commands::organizer::update_group,
            commands::organizer::delete_group,
            commands::organizer::set_group_resources,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::get_onboarded,
            commands::settings::complete_onboarding,
            commands::settings::set_github_token,
            commands::settings::clear_github_token,
            commands::organizer::list_snippets,
            commands::organizer::create_snippet,
            commands::organizer::update_snippet,
            commands::organizer::delete_snippet,
            commands::organizer::list_removed_suggestions,
            commands::organizer::remove_suggestion,
            commands::organizer::restore_suggestions,
            commands::tools::export_backup,
            commands::tools::import_file,
            commands::tools::check_links,
            commands::news::list_news,
            commands::news::list_top_stories,
            commands::news::list_language_rankings,
            commands::news::get_star_boards,
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

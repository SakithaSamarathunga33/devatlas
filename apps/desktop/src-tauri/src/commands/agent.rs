use devatlas_application::agent::{self, AgentUsage};
use devatlas_application::library;
use devatlas_application::stars;
use devatlas_storage::agent_usage::{self, JsonlUsageLog};
use devatlas_storage::install_location;
use serde::Serialize;
use tauri::{AppHandle, Manager, Runtime, State};

use super::discovery::Discovery;
use super::library::{LibraryStore, now_ms, selection};

/// How an agent starts DevAtlas as its MCP server, and how often agents have.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentConnection {
    /// The installed app if there is one, else this program: agents run it with `--mcp`.
    executable: String,
    usage: AgentUsage,
}

#[tauri::command]
pub fn get_agent_connection<R: Runtime>(app: AppHandle<R>) -> Result<AgentConnection, String> {
    // The installed copy, even from a development build: rebuilding never locks or replaces it.
    let executable = match install_location::installed_app() {
        Some(installed) => installed,
        None => std::env::current_exe().map_err(|error| {
            tracing::warn!(%error, "could not resolve the app's own path");
            "DevAtlas couldn't find its own program file.".to_owned()
        })?,
    };
    let data_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    let usage = agent::usage_this_week(
        &JsonlUsageLog::new(data_dir.join(agent_usage::FILE_NAME)),
        now_ms(),
    )
    .unwrap_or_else(|error| {
        tracing::warn!(%error, "could not read the agent usage log");
        AgentUsage::default()
    });
    Ok(AgentConnection {
        executable: executable.display().to_string(),
        usage,
    })
}

/// Adds the repositories `username` starred on GitHub to the library. Returns how many were
/// new.
#[tauri::command]
pub async fn import_github_stars(
    username: String,
    store: State<'_, LibraryStore>,
    discovery: State<'_, Discovery>,
) -> Result<usize, String> {
    import_stars(&store, &discovery, &username).await
}

/// Whose stars are kept in sync, or `None` when syncing is off.
#[tauri::command]
pub async fn get_star_sync(store: State<'_, LibraryStore>) -> Result<Option<String>, String> {
    stars::synced_user(&store.star_sync).map_err(|error| {
        tracing::warn!(%error, "could not read the star sync setting");
        error.to_string()
    })
}

/// Keeps `username`'s stars in sync from now on, or stops with `None`.
#[tauri::command]
pub async fn set_star_sync(
    username: Option<String>,
    store: State<'_, LibraryStore>,
) -> Result<Option<String>, String> {
    stars::set_sync(&store.star_sync, username.as_deref()).map_err(|error| error.to_string())
}

/// Imports new stars for the synced username; 0 when syncing is off. The app calls this at
/// start and every few hours.
#[tauri::command]
pub async fn sync_github_stars(
    store: State<'_, LibraryStore>,
    discovery: State<'_, Discovery>,
) -> Result<usize, String> {
    let user = stars::synced_user(&store.star_sync).map_err(|error| error.to_string())?;
    match user {
        Some(user) => import_stars(&store, &discovery, &user).await,
        None => Ok(0),
    }
}

async fn import_stars(
    store: &LibraryStore,
    discovery: &Discovery,
    username: &str,
) -> Result<usize, String> {
    // Fetched before taking the lock: up to ten requests, and the library polls.
    let links = stars::starred_links(discovery.github(), username, now_ms())
        .await
        .map_err(|error| error.to_string())?;
    let _guard = store.lock.lock().await;
    let selected = selection(store);
    library::import_links(
        &selected.bookmarks,
        &store.saved,
        &store.memory,
        &selected.folder,
        &links,
        &[],
        now_ms(),
    )
    .map_err(|error| {
        tracing::warn!(%error, "could not import GitHub stars");
        error.to_string()
    })
}

use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use devatlas_application::library::{self, LibrarySnapshot};
use devatlas_domain::resource::Resource;
use devatlas_storage::brave::BraveBookmarks;
use devatlas_storage::library_memory::JsonLibraryMemory;
use devatlas_storage::saved_links::JsonSavedLinks;
use tauri::{AppHandle, Manager, Runtime, State};
use tokio::sync::Mutex;

use super::preview::Previews;

/// Top-level Brave bookmark folder that holds developer resources.
// ponytail: fixed folder name; make it a user setting once Settings exists.
const DEVELOPER_FOLDER: &str = "develop";
const BROWSER: &str = "Brave";

/// Saved links and library memory, plus a lock: every command read-modify-writes them.
pub struct LibraryStore {
    saved: JsonSavedLinks,
    memory: JsonLibraryMemory,
    lock: Mutex<()>,
}

impl LibraryStore {
    pub fn new(data_dir: &Path) -> Self {
        Self {
            saved: JsonSavedLinks::new(data_dir.join("saved-links.json")),
            memory: JsonLibraryMemory::new(data_dir.join("library-memory.json")),
            lock: Mutex::new(()),
        }
    }
}

/// Reads the library: Brave's `develop` bookmarks (read-only) plus links saved in DevAtlas.
#[tauri::command]
pub async fn list_library<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, LibraryStore>,
) -> Result<LibrarySnapshot, String> {
    let source = brave(&app)?;
    let _guard = store.lock.lock().await;
    library::load_library(
        &source,
        &store.saved,
        &store.memory,
        BROWSER,
        DEVELOPER_FOLDER,
        now_ms(),
    )
    .map_err(|error| {
        tracing::warn!(%error, "could not load the library");
        error.to_string()
    })
}

/// Saves a link in DevAtlas, fetching its title and preview first.
#[tauri::command]
pub async fn add_link<R: Runtime>(
    url: String,
    app: AppHandle<R>,
    store: State<'_, LibraryStore>,
    previews: State<'_, Previews>,
) -> Result<Resource, String> {
    let source = brave(&app)?;
    let _guard = store.lock.lock().await;
    library::add_link(
        &source,
        DEVELOPER_FOLDER,
        &store.saved,
        &previews.fetcher,
        &previews.cache,
        &url,
        now_ms(),
    )
    .await
    .map_err(|error| error.to_string())
}

/// Removes a link saved in DevAtlas. Brave bookmarks are never modified.
#[tauri::command]
pub async fn remove_link(id: String, store: State<'_, LibraryStore>) -> Result<bool, String> {
    let _guard = store.lock.lock().await;
    library::remove_link(&store.saved, &id).map_err(|error| {
        tracing::warn!(%error, "could not remove a saved link");
        error.to_string()
    })
}

/// Clears the "new" mark once the user opens a resource.
#[tauri::command]
pub async fn mark_resource_opened(
    id: String,
    store: State<'_, LibraryStore>,
) -> Result<(), String> {
    let _guard = store.lock.lock().await;
    library::mark_opened(&store.memory, &id).map_err(|error| {
        tracing::warn!(%error, "could not record an opened resource");
        error.to_string()
    })
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| {
            i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX)
        })
}

fn brave<R: Runtime>(app: &AppHandle<R>) -> Result<BraveBookmarks, String> {
    brave_bookmarks_path(app)
        .map(BraveBookmarks::new)
        .map_err(|error| {
            tracing::warn!(%error, "could not resolve the Brave profile directory");
            "The Brave profile directory could not be located.".to_owned()
        })
}

/// The Default profile's bookmarks file, resolved from the OS data directories.
fn brave_bookmarks_path<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<PathBuf> {
    let paths = app.path();
    #[cfg(windows)]
    let profiles = paths
        .local_data_dir()?
        .join("BraveSoftware")
        .join("Brave-Browser")
        .join("User Data");
    #[cfg(target_os = "macos")]
    let profiles = paths
        .data_dir()?
        .join("BraveSoftware")
        .join("Brave-Browser");
    #[cfg(all(unix, not(target_os = "macos")))]
    let profiles = paths
        .config_dir()?
        .join("BraveSoftware")
        .join("Brave-Browser");
    Ok(profiles.join("Default").join("Bookmarks"))
}

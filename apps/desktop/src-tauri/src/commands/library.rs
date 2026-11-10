use std::path::PathBuf;
use std::sync::{Mutex, PoisonError};
use std::time::{SystemTime, UNIX_EPOCH};

use devatlas_application::library::{self, LibrarySnapshot};
use devatlas_storage::brave::BraveBookmarks;
use devatlas_storage::library_memory::JsonLibraryMemory;
use tauri::{AppHandle, Manager, Runtime, State};

/// Top-level Brave bookmark folder that holds developer resources.
// ponytail: fixed folder name; make it a user setting once Settings exists.
const DEVELOPER_FOLDER: &str = "develop";

/// Library memory plus a lock: listing and marking both read-modify-write the same file.
pub struct LibraryStore {
    memory: JsonLibraryMemory,
    lock: Mutex<()>,
}

impl LibraryStore {
    pub fn new(memory_file: PathBuf) -> Self {
        Self {
            memory: JsonLibraryMemory::new(memory_file),
            lock: Mutex::new(()),
        }
    }
}

/// Reads the developer library live from Brave's bookmarks (read-only) and flags new links.
#[tauri::command]
pub async fn list_library<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, LibraryStore>,
) -> Result<LibrarySnapshot, String> {
    let path = brave_bookmarks_path(&app).map_err(|error| {
        tracing::warn!(%error, "could not resolve the Brave profile directory");
        "The Brave profile directory could not be located.".to_owned()
    })?;

    let _guard = store.lock.lock().unwrap_or_else(PoisonError::into_inner);
    library::load_library(
        &BraveBookmarks::new(path),
        &store.memory,
        "Brave",
        DEVELOPER_FOLDER,
        now_ms(),
    )
    .map_err(|error| {
        tracing::warn!(%error, "could not load the library");
        error.to_string()
    })
}

/// Clears the "new" mark once the user opens a resource.
#[tauri::command]
pub async fn mark_resource_opened(
    id: String,
    store: State<'_, LibraryStore>,
) -> Result<(), String> {
    let _guard = store.lock.lock().unwrap_or_else(PoisonError::into_inner);
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

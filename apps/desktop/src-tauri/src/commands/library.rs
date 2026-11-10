use std::path::PathBuf;

use devatlas_application::library::{self, LibrarySnapshot};
use devatlas_storage::brave::BraveBookmarks;
use tauri::{AppHandle, Manager, Runtime};

/// Top-level Brave bookmark folder that holds developer resources.
// ponytail: fixed folder name; make it a user setting once Settings exists.
const DEVELOPER_FOLDER: &str = "develop";

/// Reads the developer library live from Brave's bookmarks (read-only).
#[tauri::command]
pub async fn list_library<R: Runtime>(app: AppHandle<R>) -> Result<LibrarySnapshot, String> {
    let path = brave_bookmarks_path(&app).map_err(|error| {
        tracing::warn!(%error, "could not resolve the Brave profile directory");
        "The Brave profile directory could not be located.".to_owned()
    })?;
    tracing::debug!(path = %path.display(), "reading Brave bookmarks");

    library::load_library(&BraveBookmarks::new(path), "Brave", DEVELOPER_FOLDER).map_err(|error| {
        tracing::warn!(%error, "could not load the library");
        error.to_string()
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

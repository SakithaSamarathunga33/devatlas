use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use devatlas_application::library::{self, LibrarySnapshot, LibrarySource, RawBookmark};
use devatlas_application::link_health::LinkHealthStore;
use devatlas_application::organizer::{self, OrganizerStore};
use devatlas_application::settings::{self, BookmarkSettings, Browser, SettingsStore};
use devatlas_domain::resource::Resource;
use devatlas_storage::browsers;
use devatlas_storage::library_memory::JsonLibraryMemory;
use devatlas_storage::paths;
use devatlas_storage::saved_links::JsonSavedLinks;
use devatlas_storage::settings::JsonSettings;
use tauri::{AppHandle, Manager, Runtime, State};
use tokio::sync::Mutex;

use super::organizer::Organizer;
use super::preview::Previews;

/// The folder existing installs read before bookmark settings existed.
const ORIGINAL_FOLDER: &str = "develop";

/// Saved links, library memory and settings, plus a lock: every command read-modify-writes
/// them.
pub struct LibraryStore {
    pub(crate) saved: JsonSavedLinks,
    pub(crate) memory: JsonLibraryMemory,
    pub(super) settings: JsonSettings,
    pub(super) lock: Mutex<()>,
}

impl LibraryStore {
    pub fn new(data_dir: &Path) -> Self {
        Self {
            saved: JsonSavedLinks::new(data_dir.join("saved-links.json")),
            memory: JsonLibraryMemory::new(data_dir.join("library-memory.json")),
            settings: JsonSettings::new(data_dir.join("settings.json")),
            lock: Mutex::new(()),
        }
    }
}

/// Chooses the bookmark source once, on the first run after settings were introduced, so a
/// browser that's briefly unreadable later can't silently switch the library off.
pub fn initialize_settings<R: Runtime>(app: &AppHandle<R>) {
    let store = app.state::<LibraryStore>();
    if !matches!(store.settings.load(), Ok(None)) {
        return;
    }
    let has_brave = paths::browser_user_data_dir(Browser::Brave)
        .is_some_and(|dir| dir.join("Default").join("Bookmarks").is_file());
    let initial = if has_brave {
        BookmarkSettings {
            browser: Some(Browser::Brave),
            profile: "Default".to_owned(),
            folder: ORIGINAL_FOLDER.to_owned(),
        }
    } else {
        BookmarkSettings::default()
    };
    if let Err(error) = store.settings.save(&initial) {
        tracing::warn!(%error, "could not store the initial settings");
    }
}

/// The stored settings, re-validated because the file could have been edited. A damaged file
/// falls back to no browser, with the reason.
pub(crate) fn current_settings(store: &LibraryStore) -> (BookmarkSettings, Option<String>) {
    let unreadable = || "Your bookmark settings couldn't be read. Choose them again.".to_owned();
    match store.settings.load() {
        Ok(stored) => match settings::validate(stored.unwrap_or_default()) {
            Ok(valid) => (valid, None),
            Err(error) => {
                tracing::warn!(%error, "stored settings are invalid");
                (BookmarkSettings::default(), Some(unreadable()))
            }
        },
        Err(error) => {
            tracing::warn!(%error, "could not read the settings");
            (BookmarkSettings::default(), Some(unreadable()))
        }
    }
}

/// The selected browser's bookmarks, already read.
pub(crate) struct Selection {
    pub(crate) bookmarks: Vec<RawBookmark>,
    pub(crate) browser: String,
    pub(crate) folder: String,
    pub(crate) warning: Option<String>,
}

/// Reads the selected source. A browser that can't be read yields no bookmarks and a warning,
/// so links saved in DevAtlas stay available. Call while holding the store's lock.
pub(crate) fn selection(store: &LibraryStore) -> Selection {
    let (selected, warning) = current_settings(store);
    let Some(browser) = selected.browser else {
        return Selection {
            bookmarks: Vec::new(),
            browser: String::new(),
            folder: String::new(),
            warning,
        };
    };
    let read = browsers::bookmarks(browser, &selected.profile).map_err(|error| error.to_string());
    let (bookmarks, warning) = match read {
        Ok(bookmarks) => (bookmarks, warning),
        Err(reason) => {
            tracing::warn!(%reason, "could not read the browser's bookmarks");
            (Vec::new(), Some(reason))
        }
    };
    Selection {
        bookmarks,
        browser: browser.label().to_owned(),
        folder: selected.folder,
        warning,
    }
}

/// Reads the library: the selected browser's bookmarks (read-only) plus links saved in
/// DevAtlas, with the user's categories, tags and notes applied.
#[tauri::command]
pub async fn list_library(
    store: State<'_, LibraryStore>,
    organizer: State<'_, Organizer>,
) -> Result<LibrarySnapshot, String> {
    let _guard = store.lock.lock().await;
    let selected = selection(&store);
    let snapshot = library::load_library(
        &selected.bookmarks,
        &store.saved,
        &store.memory,
        &selected.browser,
        &selected.folder,
        now_ms(),
    )
    .map_err(|error| {
        tracing::warn!(%error, "could not load the library");
        error.to_string()
    })?;
    let snapshot = LibrarySnapshot {
        source: LibrarySource {
            warning: selected.warning,
            ..snapshot.source
        },
        ..snapshot
    };

    // Annotations are extras: without the database the library still shows.
    let Ok(database) = organizer.database() else {
        return Ok(snapshot);
    };
    let extras = (database.annotations().await, database.link_health().await);
    match extras {
        (Ok(annotations), Ok(health)) => Ok(organizer::annotate(snapshot, &annotations, &health)),
        (annotations, health) => {
            tracing::warn!(
                annotations = annotations.is_ok(),
                health = health.is_ok(),
                "could not read what the user added to links"
            );
            Ok(snapshot)
        }
    }
}

/// Saves a link in DevAtlas, fetching its title and preview first.
#[tauri::command]
pub async fn add_link(
    url: String,
    store: State<'_, LibraryStore>,
    previews: State<'_, Previews>,
) -> Result<Resource, String> {
    let _guard = store.lock.lock().await;
    let selected = selection(&store);
    library::add_link(
        &selected.bookmarks,
        &selected.folder,
        &store.saved,
        &store.memory,
        &previews.fetcher,
        &previews.cache,
        &url,
        now_ms(),
    )
    .await
    .map_err(|error| error.to_string())
}

/// Removes a resource from the library. Browser bookmarks are hidden, never modified.
#[tauri::command]
pub async fn remove_link(id: String, store: State<'_, LibraryStore>) -> Result<bool, String> {
    let _guard = store.lock.lock().await;
    library::remove_link(&store.saved, &store.memory, &id).map_err(|error| {
        tracing::warn!(%error, "could not remove a library resource");
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
    library::mark_opened(&store.memory, &id, now_ms()).map_err(|error| {
        tracing::warn!(%error, "could not record an opened resource");
        error.to_string()
    })
}

pub(crate) fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_or(0, |elapsed| {
            i64::try_from(elapsed.as_millis()).unwrap_or(i64::MAX)
        })
}

use devatlas_application::backup::{self, BackupStore, ImportSummary};
use devatlas_application::library::{self, SavedLinkStore};
use devatlas_application::link_health::{self, LinkCheckSummary};
use devatlas_application::organizer::OrganizerStore;
use devatlas_application::snippets::SnippetStore;
use devatlas_storage::backup_file::{self, ImportFile};
use tauri::{AppHandle, Runtime, State};
use tauri_plugin_dialog::DialogExt;

use super::library::{LibraryStore, now_ms, selection};
use super::organizer::Organizer;
use super::preview::Previews;

const SAVE_FAILED: &str = "DevAtlas couldn't read your data for the backup. Please try again.";

fn store_error<E: std::fmt::Debug>(message: &'static str) -> impl FnOnce(E) -> String {
    move |error| {
        tracing::warn!(?error, "{message}");
        message.to_owned()
    }
}

/// Writes a backup to a file the user picks. The path never comes from the webview. Returns
/// the file name, or nothing if the dialog was cancelled.
#[tauri::command]
pub async fn export_backup<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, LibraryStore>,
    organizer: State<'_, Organizer>,
) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .set_file_name("devatlas-backup.json")
        .add_filter("DevAtlas backup", &["json"])
        .blocking_save_file();
    let Some(picked) = picked else {
        return Ok(None);
    };
    let path = picked
        .into_path()
        .map_err(store_error("That location can't be used."))?;

    let database = organizer.database()?;
    let (links, hidden) = {
        let _guard = store.lock.lock().await;
        (
            store.saved.load().map_err(store_error(SAVE_FAILED))?,
            library::hidden_ids(&store.memory).map_err(store_error(SAVE_FAILED))?,
        )
    };
    let annotations = database
        .annotations()
        .await
        .map_err(store_error(SAVE_FAILED))?;
    let groups = database.groups().await.map_err(store_error(SAVE_FAILED))?;
    let snippets = database
        .snippets()
        .await
        .map_err(store_error(SAVE_FAILED))?;

    let backup = backup::build(links, hidden, &annotations, &groups, snippets, now_ms());
    backup_file::write_backup(&path, &backup).map_err(|error| error.to_string())?;
    Ok(path
        .file_name()
        .map(|name| name.to_string_lossy().into_owned()))
}

/// Imports a DevAtlas backup or a browser's bookmarks export, from a file the user picks.
/// Merges: nothing already there is removed. Returns nothing if the dialog was cancelled.
#[tauri::command]
pub async fn import_file<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, LibraryStore>,
    organizer: State<'_, Organizer>,
) -> Result<Option<ImportSummary>, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("Backup or bookmarks", &["json", "html", "htm"])
        .blocking_pick_file();
    let Some(picked) = picked else {
        return Ok(None);
    };
    let path = picked
        .into_path()
        .map_err(store_error("That file can't be used."))?;
    // Parsing a large file is blocking work, kept off the async workers.
    let file = tauri::async_runtime::spawn_blocking(move || backup_file::read_import(&path))
        .await
        .map_err(store_error("That file couldn't be read."))?
        .map_err(|error| error.to_string())?;

    let (links, hidden, groups, snippets) = match file {
        ImportFile::Links(links) => (links, Vec::new(), 0, 0),
        ImportFile::Backup(backup) => {
            let backup = backup::clean(backup).map_err(|error| error.to_string())?;
            organizer
                .database()?
                .restore(&backup)
                .await
                .map_err(store_error("The backup couldn't be restored."))?;
            let (groups, snippets) = (backup.groups.len(), backup.snippets.len());
            (backup.saved_links, backup.hidden, groups, snippets)
        }
    };

    let _guard = store.lock.lock().await;
    let selected = selection(&store);
    let added = library::import_links(
        &selected.bookmarks,
        &store.saved,
        &store.memory,
        &selected.folder,
        &links,
        &hidden,
        now_ms(),
    )
    .map_err(store_error(
        "Part of the import was applied, but its links couldn't be added. Importing again is safe.",
    ))?;
    Ok(Some(ImportSummary {
        links: added,
        groups,
        snippets,
    }))
}

/// Checks every link in the library for pages that are gone or have moved.
#[tauri::command]
pub async fn check_links(
    store: State<'_, LibraryStore>,
    organizer: State<'_, Organizer>,
    previews: State<'_, Previews>,
) -> Result<LinkCheckSummary, String> {
    let database = organizer.database()?;
    // The lock covers reading the library only; the network checks run without it.
    let links: Vec<(String, String)> = {
        let _guard = store.lock.lock().await;
        let selected = selection(&store);
        library::load_library(
            &selected.bookmarks,
            &store.saved,
            &store.memory,
            &selected.browser,
            &selected.folder,
            now_ms(),
        )
        .map_err(store_error("The library couldn't be read."))?
        .resources
        .into_iter()
        .map(|item| (item.resource.id, item.resource.url))
        .collect()
    };
    link_health::check_links(&previews.fetcher, database, links, now_ms())
        .await
        .map_err(|error| error.to_string())
}

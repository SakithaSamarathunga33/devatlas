use devatlas_application::library;
use devatlas_application::settings::{
    self, BookmarkSettings, Browser, BrowserOption, ProfileOption, SettingsStore, SettingsView,
};
use devatlas_storage::chromium::{self, ChromiumBookmarks};
use tauri::{AppHandle, Runtime, State};

use super::library::{LibraryStore, current_settings, now_ms, selection, user_data_dir};

/// The browsers and profiles found on this computer, with each profile's bookmark folders.
fn browser_options<R: Runtime>(app: &AppHandle<R>) -> Vec<BrowserOption> {
    Browser::ALL
        .iter()
        .filter_map(|&browser| {
            let dir = user_data_dir(app, browser).ok()?;
            let profiles: Vec<ProfileOption> = chromium::profiles(&dir)
                .into_iter()
                .map(|profile| ProfileOption {
                    folders: library::top_level_folders(&ChromiumBookmarks::new(profile.bookmarks)),
                    id: profile.id,
                    name: profile.name,
                })
                .collect();
            (!profiles.is_empty()).then_some(BrowserOption {
                browser,
                label: browser.label(),
                profiles,
            })
        })
        .collect()
}

/// The current bookmark settings and what can be chosen.
#[tauri::command]
pub async fn get_settings<R: Runtime>(
    app: AppHandle<R>,
    store: State<'_, LibraryStore>,
) -> Result<SettingsView, String> {
    let settings = {
        let _guard = store.lock.lock().await;
        current_settings(&store).0
    };
    // Outside the lock: this reads every profile's bookmarks, and the library polls.
    Ok(SettingsView {
        settings,
        options: browser_options(&app),
    })
}

/// Saves the bookmark settings. Links the new source brings in count as already seen, so
/// switching browser doesn't flag the whole library as new.
#[tauri::command]
pub async fn update_settings<R: Runtime>(
    settings: BookmarkSettings,
    app: AppHandle<R>,
    store: State<'_, LibraryStore>,
) -> Result<SettingsView, String> {
    let valid = settings::validate(settings).map_err(|error| error.to_string())?;
    {
        let _guard = store.lock.lock().await;
        store.settings.save(&valid).map_err(|error| {
            tracing::warn!(%error, "could not save the settings");
            "DevAtlas couldn't save your settings. Please try again.".to_owned()
        })?;

        let selected = selection(&app, &store);
        if let Err(error) = library::rebaseline(
            &selected.bookmarks,
            &store.saved,
            &store.memory,
            &selected.folder,
            now_ms(),
        ) {
            tracing::warn!(%error, "could not record the new source's links as seen");
        }
    }
    Ok(SettingsView {
        settings: valid,
        options: browser_options(&app),
    })
}

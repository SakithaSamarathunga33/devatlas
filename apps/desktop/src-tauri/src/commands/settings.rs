use devatlas_application::library;
use devatlas_application::settings::{
    self, BookmarkSettings, Browser, BrowserOption, ProfileOption, SecretStore, SettingsStore,
    SettingsView,
};
use devatlas_storage::browsers;
use devatlas_storage::credentials::KeyringSecret;
use tauri::{AppHandle, Manager, Runtime, State};

use super::discovery::Discovery;
use super::library::{LibraryStore, current_settings, now_ms, selection};

/// The GitHub token in the OS credential store. Dev builds use their own entry.
pub struct Secrets {
    github_token: KeyringSecret,
}

impl Secrets {
    pub fn new() -> Self {
        let service = if cfg!(debug_assertions) {
            "DevAtlas (dev)"
        } else {
            "DevAtlas"
        };
        Self {
            github_token: KeyringSecret::new(service),
        }
    }

    fn has_token(&self) -> bool {
        matches!(self.github_token.load(), Ok(Some(_)))
    }
}

/// Hands the stored GitHub token, if any, to the GitHub client at startup.
pub fn load_github_token<R: Runtime>(app: &AppHandle<R>) {
    match app.state::<Secrets>().github_token.load() {
        Ok(Some(token)) => app.state::<Discovery>().set_github_token(Some(token)),
        Ok(None) => {}
        Err(error) => tracing::warn!(%error, "could not read the GitHub token"),
    }
}

/// The browsers and profiles found on this computer, with each profile's bookmark folders.
fn browser_options() -> Vec<BrowserOption> {
    Browser::ALL
        .iter()
        .filter_map(|&browser| {
            let profiles: Vec<ProfileOption> = browsers::profiles(browser)
                .into_iter()
                .map(|profile| ProfileOption {
                    folders: browsers::bookmarks(browser, &profile.id)
                        .map(|bookmarks| library::top_level_folders(&bookmarks))
                        .unwrap_or_default(),
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

/// The current settings and what can be chosen.
#[tauri::command]
pub async fn get_settings(
    store: State<'_, LibraryStore>,
    secrets: State<'_, Secrets>,
) -> Result<SettingsView, String> {
    let settings = {
        let _guard = store.lock.lock().await;
        current_settings(&store).0
    };
    // Outside the lock: this reads every profile's bookmarks, and the library polls.
    Ok(SettingsView {
        settings,
        options: browser_options(),
        has_github_token: secrets.has_token(),
    })
}

/// Saves the bookmark settings. Links the new source brings in count as already seen, so
/// switching browser doesn't flag the whole library as new.
#[tauri::command]
pub async fn update_settings(
    settings: BookmarkSettings,
    store: State<'_, LibraryStore>,
    secrets: State<'_, Secrets>,
) -> Result<SettingsView, String> {
    let valid = settings::validate(settings).map_err(|error| error.to_string())?;
    {
        let _guard = store.lock.lock().await;
        store.settings.save(&valid).map_err(|error| {
            tracing::warn!(%error, "could not save the settings");
            "DevAtlas couldn't save your settings. Please try again.".to_owned()
        })?;

        let selected = selection(&store);
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
        options: browser_options(),
        has_github_token: secrets.has_token(),
    })
}

const TOKEN_STORE_FAILED: &str = "Your system's credential store couldn't be used.";

/// Stores a GitHub token in the OS credential store and starts using it.
#[tauri::command]
pub async fn set_github_token(
    token: String,
    secrets: State<'_, Secrets>,
    discovery: State<'_, Discovery>,
) -> Result<(), String> {
    let token = settings::clean_token(&token).map_err(|error| error.to_string())?;
    secrets.github_token.save(&token).map_err(|error| {
        tracing::warn!(%error, "could not store the GitHub token");
        TOKEN_STORE_FAILED.to_owned()
    })?;
    discovery.set_github_token(Some(token));
    Ok(())
}

/// Forgets the GitHub token.
#[tauri::command]
pub async fn clear_github_token(
    secrets: State<'_, Secrets>,
    discovery: State<'_, Discovery>,
) -> Result<(), String> {
    secrets.github_token.delete().map_err(|error| {
        tracing::warn!(%error, "could not delete the GitHub token");
        TOKEN_STORE_FAILED.to_owned()
    })?;
    discovery.set_github_token(None);
    Ok(())
}

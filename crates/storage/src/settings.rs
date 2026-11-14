//! Bookmark settings as a JSON file in the app data dir.

use std::path::PathBuf;

use devatlas_application::settings::{BookmarkSettings, SettingsStore};

use crate::json_file::{self, JsonFileError};

pub struct JsonSettings {
    path: PathBuf,
}

impl JsonSettings {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

impl SettingsStore for JsonSettings {
    type Error = JsonFileError;

    fn load(&self) -> Result<Option<BookmarkSettings>, JsonFileError> {
        json_file::read(&self.path)
    }

    fn save(&self, settings: &BookmarkSettings) -> Result<(), JsonFileError> {
        json_file::write(&self.path, settings)
    }
}

#[cfg(test)]
mod tests {
    use devatlas_application::settings::Browser;

    use super::*;

    #[test]
    fn starts_empty_and_round_trips() {
        let path = std::env::temp_dir()
            .join(format!("devatlas-settings-test-{}", std::process::id()))
            .join("settings.json");
        let store = JsonSettings::new(path.clone());
        assert_eq!(store.load().unwrap(), None);

        let settings = BookmarkSettings {
            browser: Some(Browser::Chrome),
            profile: "Profile 1".to_owned(),
            folder: "dev".to_owned(),
            onboarded: true,
        };
        store.save(&settings).unwrap();

        assert_eq!(store.load().unwrap(), Some(settings));
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn a_file_from_before_onboarding_reads_as_not_onboarded() {
        let path = std::env::temp_dir()
            .join(format!("devatlas-settings-legacy-{}", std::process::id()))
            .join("settings.json");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(
            &path,
            r#"{ "browser": "brave", "profile": "Default", "folder": "develop" }"#,
        )
        .unwrap();

        let loaded = JsonSettings::new(path.clone()).load().unwrap().unwrap();

        assert!(!loaded.onboarded);
        assert_eq!(loaded.folder, "develop");
        std::fs::remove_file(path).unwrap();
    }
}

//! Where the library reads browser bookmarks from: which browser, profile and folder, or no
//! browser at all, for people who only add links in DevAtlas.

use serde::{Deserialize, Serialize};

/// Longest bookmark folder name accepted.
const MAX_FOLDER_LEN: usize = 128;

/// Browsers that keep bookmarks in Chromium's JSON format.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Browser {
    Brave,
    Chrome,
    Edge,
    Vivaldi,
}

impl Browser {
    pub const ALL: [Self; 4] = [Self::Brave, Self::Chrome, Self::Edge, Self::Vivaldi];

    pub const fn label(self) -> &'static str {
        match self {
            Self::Brave => "Brave",
            Self::Chrome => "Google Chrome",
            Self::Edge => "Microsoft Edge",
            Self::Vivaldi => "Vivaldi",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkSettings {
    /// `None`: read no browser; the library holds only links added in DevAtlas.
    pub browser: Option<Browser>,
    /// A profile directory name, such as `Default` or `Profile 1`.
    pub profile: String,
    /// The top-level bookmark folder holding developer links.
    pub folder: String,
}

impl Default for BookmarkSettings {
    fn default() -> Self {
        Self {
            browser: None,
            profile: "Default".to_owned(),
            folder: String::new(),
        }
    }
}

/// A browser profile found on this computer.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProfileOption {
    pub id: String,
    pub name: String,
    pub folders: Vec<String>,
}

/// A browser found on this computer, with its profiles.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserOption {
    pub browser: Browser,
    pub label: &'static str,
    pub profiles: Vec<ProfileOption>,
}

/// What the Settings page shows: the current choice and what can be chosen.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsView {
    pub settings: BookmarkSettings,
    pub options: Vec<BrowserOption>,
}

/// Port: persists the settings. `load` returns `None` when nothing was stored yet.
pub trait SettingsStore {
    type Error: std::error::Error;

    fn load(&self) -> Result<Option<BookmarkSettings>, Self::Error>;
    fn save(&self, settings: &BookmarkSettings) -> Result<(), Self::Error>;
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
pub enum SettingsError {
    #[error("Choose a browser profile from the list.")]
    InvalidProfile,
    #[error("Choose a bookmark folder from the list.")]
    MissingFolder,
}

/// `Default` or `Profile N`: the only directories read, so a value can never name a path.
pub fn is_profile_dir(name: &str) -> bool {
    name == "Default"
        || name.strip_prefix("Profile ").is_some_and(|number| {
            !number.is_empty() && number.bytes().all(|byte| byte.is_ascii_digit())
        })
}

/// Checks a selection coming from the UI, and from disk, since either could be tampered with.
pub fn validate(settings: BookmarkSettings) -> Result<BookmarkSettings, SettingsError> {
    if settings.browser.is_none() {
        return Ok(BookmarkSettings::default());
    }
    if !is_profile_dir(&settings.profile) {
        return Err(SettingsError::InvalidProfile);
    }
    let folder = settings.folder.trim();
    if folder.is_empty() || folder.len() > MAX_FOLDER_LEN {
        return Err(SettingsError::MissingFolder);
    }
    Ok(BookmarkSettings {
        folder: folder.to_owned(),
        ..settings
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn settings(browser: Option<Browser>, profile: &str, folder: &str) -> BookmarkSettings {
        BookmarkSettings {
            browser,
            profile: profile.to_owned(),
            folder: folder.to_owned(),
        }
    }

    #[test]
    fn accepts_only_chromium_profile_directories() {
        for name in ["Default", "Profile 1", "Profile 27"] {
            assert!(is_profile_dir(name), "{name}");
        }
        for name in [
            "",
            "..",
            "../evil",
            "Profile",
            "Profile x",
            "Guest Profile",
            "a/b",
        ] {
            assert!(!is_profile_dir(name), "{name}");
        }
    }

    #[test]
    fn trims_the_folder_of_a_valid_selection() {
        let cleaned = validate(settings(Some(Browser::Chrome), "Profile 2", "  dev  ")).unwrap();

        assert_eq!(cleaned, settings(Some(Browser::Chrome), "Profile 2", "dev"));
    }

    #[test]
    fn refuses_a_path_as_the_profile() {
        assert_eq!(
            validate(settings(Some(Browser::Brave), "../../secrets", "dev")),
            Err(SettingsError::InvalidProfile)
        );
    }

    #[test]
    fn a_browser_needs_a_folder() {
        assert_eq!(
            validate(settings(Some(Browser::Brave), "Default", "   ")),
            Err(SettingsError::MissingFolder)
        );
        assert_eq!(
            validate(settings(Some(Browser::Brave), "Default", &"x".repeat(200))),
            Err(SettingsError::MissingFolder)
        );
    }

    #[test]
    fn no_browser_ignores_profile_and_folder() {
        assert_eq!(
            validate(settings(None, "../evil", "anything")).unwrap(),
            BookmarkSettings::default()
        );
    }

    #[test]
    fn browsers_serialize_lowercase_and_have_labels() {
        assert_eq!(serde_json::to_string(&Browser::Edge).unwrap(), "\"edge\"");
        assert_eq!(Browser::Edge.label(), "Microsoft Edge");
    }
}

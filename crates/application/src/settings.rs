//! Where the library reads browser bookmarks from: which browser, profile and folder, or no
//! browser at all, for people who only add links in DevAtlas.

use serde::{Deserialize, Serialize};

/// Longest bookmark folder name accepted.
const MAX_FOLDER_LEN: usize = 128;
const MAX_TOKEN_LEN: usize = 255;

/// Browsers whose bookmarks can be read: Chromium's JSON format (Brave, Chrome, Edge, Vivaldi,
/// and Opera, which keeps one profile at the top of its folder) and Firefox's database.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Browser {
    Brave,
    Chrome,
    Edge,
    Vivaldi,
    Opera,
    OperaGx,
    Firefox,
}

/// The longest Firefox profile folder name accepted, such as `x7y2abcd.default-release`.
const MAX_FIREFOX_PROFILE_LEN: usize = 64;

impl Browser {
    pub const ALL: [Self; 7] = [
        Self::Brave,
        Self::Chrome,
        Self::Edge,
        Self::Vivaldi,
        Self::Opera,
        Self::OperaGx,
        Self::Firefox,
    ];

    pub const fn label(self) -> &'static str {
        match self {
            Self::Brave => "Brave",
            Self::Chrome => "Google Chrome",
            Self::Edge => "Microsoft Edge",
            Self::Vivaldi => "Vivaldi",
            Self::Opera => "Opera",
            Self::OperaGx => "Opera GX",
            Self::Firefox => "Mozilla Firefox",
        }
    }

    /// Whether `id` names one of this browser's profiles, checked by its text alone, so a
    /// value from the UI or a tampered settings file can never name another path.
    pub fn is_profile_id(self, id: &str) -> bool {
        match self {
            Self::Brave | Self::Chrome | Self::Edge | Self::Vivaldi => is_profile_dir(id),
            // Opera keeps its one profile at the top of its folder.
            Self::Opera | Self::OperaGx => id == "Default",
            Self::Firefox => is_firefox_profile(id),
        }
    }
}

/// A Firefox profile folder name inside `Profiles`: letters, digits, `.`, `_` and `-`, not
/// starting with a dot.
fn is_firefox_profile(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= MAX_FIREFOX_PROFILE_LEN
        && !name.starts_with('.')
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BookmarkSettings {
    /// `None`: read no browser; the library holds only links added in DevAtlas.
    pub browser: Option<Browser>,
    /// A profile id: a Chromium profile folder (`Default`, `Profile 1`), `Default` for Opera,
    /// or a Firefox profile folder name.
    pub profile: String,
    /// The top-level bookmark folder holding developer links.
    pub folder: String,
    /// Whether the first-launch welcome was answered (signed in, or chose to stay local).
    /// Files written before it existed read as `false`, so they see the welcome once.
    #[serde(default)]
    pub onboarded: bool,
}

impl Default for BookmarkSettings {
    fn default() -> Self {
        Self {
            browser: None,
            profile: "Default".to_owned(),
            folder: String::new(),
            onboarded: false,
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
    /// Whether a GitHub token is stored; the token itself never reaches the UI.
    pub has_github_token: bool,
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
    #[error("That doesn't look like a GitHub token.")]
    InvalidToken,
}

/// Port: keeps secrets in the operating system's credential store.
pub trait SecretStore {
    type Error: std::error::Error;

    fn load(&self) -> Result<Option<String>, Self::Error>;
    fn save(&self, secret: &str) -> Result<(), Self::Error>;
    fn delete(&self) -> Result<(), Self::Error>;
}

/// Trims a pasted GitHub token and checks its shape, so it can't smuggle extra HTTP headers.
pub fn clean_token(raw: &str) -> Result<String, SettingsError> {
    let token = raw.trim();
    let allowed = |c: char| c.is_ascii_alphanumeric() || c == '_';
    if token.is_empty() || token.len() > MAX_TOKEN_LEN || !token.chars().all(allowed) {
        return Err(SettingsError::InvalidToken);
    }
    Ok(token.to_owned())
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
    let Some(browser) = settings.browser else {
        return Ok(BookmarkSettings {
            onboarded: settings.onboarded,
            ..BookmarkSettings::default()
        });
    };
    if !browser.is_profile_id(&settings.profile) {
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

/// Whether the first-launch welcome was answered. Read from the file as stored, not after
/// validation, so a bookmark choice that no longer validates doesn't bring the welcome back.
pub fn is_onboarded<S: SettingsStore>(store: &S) -> bool {
    matches!(store.load(), Ok(Some(settings)) if settings.onboarded)
}

/// A bookmark selection from the Settings page. The UI never sends `onboarded`, so the stored
/// answer is kept rather than reset.
pub fn apply_update<S: SettingsStore>(
    store: &S,
    incoming: BookmarkSettings,
) -> Result<BookmarkSettings, SettingsError> {
    validate(BookmarkSettings {
        onboarded: is_onboarded(store),
        ..incoming
    })
}

/// Records that the first-launch welcome was answered, keeping the rest of the settings.
pub fn complete_onboarding<S: SettingsStore>(store: &S) -> Result<(), S::Error> {
    let current = store.load()?.unwrap_or_default();
    store.save(&BookmarkSettings {
        onboarded: true,
        ..current
    })
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::convert::Infallible;

    use super::*;

    fn settings(browser: Option<Browser>, profile: &str, folder: &str) -> BookmarkSettings {
        BookmarkSettings {
            browser,
            profile: profile.to_owned(),
            folder: folder.to_owned(),
            onboarded: false,
        }
    }

    #[derive(Default)]
    struct MemoryStore(RefCell<Option<BookmarkSettings>>);

    impl SettingsStore for MemoryStore {
        type Error = Infallible;

        fn load(&self) -> Result<Option<BookmarkSettings>, Infallible> {
            Ok(self.0.borrow().clone())
        }

        fn save(&self, settings: &BookmarkSettings) -> Result<(), Infallible> {
            *self.0.borrow_mut() = Some(settings.clone());
            Ok(())
        }
    }

    #[test]
    fn completing_onboarding_on_a_first_launch_stores_only_the_flag() {
        let store = MemoryStore::default();

        complete_onboarding(&store).unwrap();

        assert_eq!(
            store.load().unwrap(),
            Some(BookmarkSettings {
                onboarded: true,
                ..BookmarkSettings::default()
            })
        );
    }

    #[test]
    fn completing_onboarding_keeps_the_bookmark_choice() {
        let chosen = settings(Some(Browser::Chrome), "Profile 1", "dev");
        let store = MemoryStore(RefCell::new(Some(chosen.clone())));

        complete_onboarding(&store).unwrap();

        assert_eq!(
            store.load().unwrap(),
            Some(BookmarkSettings {
                onboarded: true,
                ..chosen
            })
        );
    }

    #[test]
    fn saving_from_the_settings_page_keeps_the_onboarding_answer() {
        let onboarded = MemoryStore(RefCell::new(Some(BookmarkSettings {
            onboarded: true,
            ..BookmarkSettings::default()
        })));

        let chrome = apply_update(
            &onboarded,
            settings(Some(Browser::Chrome), "Default", "dev"),
        );
        let none = apply_update(&onboarded, settings(None, "Default", ""));

        assert!(chrome.unwrap().onboarded);
        assert!(none.unwrap().onboarded);
        assert!(
            !apply_update(&MemoryStore::default(), settings(None, "", ""))
                .unwrap()
                .onboarded
        );
    }

    #[test]
    fn an_invalid_bookmark_choice_keeps_the_onboarding_answer() {
        let tampered = MemoryStore(RefCell::new(Some(BookmarkSettings {
            onboarded: true,
            ..settings(Some(Browser::Brave), "../evil", "dev")
        })));

        assert!(is_onboarded(&tampered));
        let fixed = apply_update(&tampered, settings(Some(Browser::Brave), "Default", "dev"));
        assert!(fixed.unwrap().onboarded);
    }

    #[derive(Debug, thiserror::Error)]
    #[error("unreadable")]
    struct Unreadable;

    struct BrokenStore;

    impl SettingsStore for BrokenStore {
        type Error = Unreadable;

        fn load(&self) -> Result<Option<BookmarkSettings>, Unreadable> {
            Err(Unreadable)
        }

        fn save(&self, _: &BookmarkSettings) -> Result<(), Unreadable> {
            Err(Unreadable)
        }
    }

    #[test]
    fn an_unreadable_file_is_not_onboarded_and_is_not_overwritten() {
        assert!(!is_onboarded(&BrokenStore));
        assert!(complete_onboarding(&BrokenStore).is_err());
    }

    #[test]
    fn settings_written_before_onboarding_existed_read_as_not_onboarded() {
        let old: BookmarkSettings =
            serde_json::from_str(r#"{"browser":"edge","profile":"Default","folder":"dev"}"#)
                .unwrap();

        assert!(!old.onboarded);
        assert_eq!(old.folder, "dev");
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
    fn each_browser_accepts_only_its_own_kind_of_profile() {
        let ok = |browser, profile: &str| validate(settings(Some(browser), profile, "dev")).is_ok();

        assert!(ok(Browser::Opera, "Default"));
        assert!(ok(Browser::OperaGx, "Default"));
        assert!(!ok(Browser::Opera, "Profile 1"));
        assert!(ok(Browser::Firefox, "x7y2abcd.default-release"));
        for bad in [
            "",
            ".",
            "..",
            "../x",
            "a/b",
            r"a\b",
            ".hidden",
            "Profile 1 ",
            &"a".repeat(65),
        ] {
            assert!(!ok(Browser::Firefox, bad), "{bad:?} should be refused");
        }
        assert!(!ok(Browser::Chrome, "x7y2abcd.default-release"));
    }

    #[test]
    fn names_the_new_browsers() {
        assert_eq!(Browser::ALL.len(), 7);
        assert_eq!(Browser::OperaGx.label(), "Opera GX");
        assert_eq!(
            serde_json::to_string(&Browser::OperaGx).unwrap(),
            "\"operagx\""
        );
        assert_eq!(Browser::Firefox.label(), "Mozilla Firefox");
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
    fn accepts_github_token_shapes_and_trims() {
        assert_eq!(
            clean_token("  ghp_abcDEF123  ").unwrap(),
            "ghp_abcDEF123".to_owned()
        );
        assert_eq!(
            clean_token("github_pat_11AA_bb").unwrap(),
            "github_pat_11AA_bb".to_owned()
        );
    }

    #[test]
    fn refuses_tokens_that_could_inject_headers() {
        for token in ["", "   ", "abc\r\nX-Evil: 1", "has space", "semi;colon"] {
            assert_eq!(
                clean_token(token),
                Err(SettingsError::InvalidToken),
                "{token}"
            );
        }
        assert_eq!(
            clean_token(&"a".repeat(MAX_TOKEN_LEN + 1)),
            Err(SettingsError::InvalidToken)
        );
    }

    #[test]
    fn browsers_serialize_lowercase_and_have_labels() {
        assert_eq!(serde_json::to_string(&Browser::Edge).unwrap(), "\"edge\"");
        assert_eq!(Browser::Edge.label(), "Microsoft Edge");
    }
}

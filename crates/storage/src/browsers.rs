//! Every supported browser behind one interface: the profiles found on this computer, and a
//! profile's bookmarks. Chromium browsers and Opera share one format; Firefox has its own.

use std::path::Path;

use devatlas_application::library::{BookmarkSource, RawBookmark};
use devatlas_application::settings::Browser;

use crate::chromium::{self, ChromiumBookmarks, ChromiumBookmarksError};
use crate::firefox::{self, FirefoxBookmarks, FirefoxError};
use crate::paths;

/// Opera keeps its one profile at the top of its folder, under this id.
const OPERA_PROFILE: &str = "Default";

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BrowserProfile {
    pub id: String,
    pub name: String,
}

#[derive(Debug, thiserror::Error)]
pub enum BrowserBookmarksError {
    #[error("Your browser's data folder could not be located.")]
    NoFolder,
    #[error("Choose a browser profile from the list.")]
    InvalidProfile,
    #[error(transparent)]
    Chromium(#[from] ChromiumBookmarksError),
    #[error(transparent)]
    Firefox(#[from] FirefoxError),
}

/// The profiles of `browser` that have bookmarks; empty when it isn't installed.
pub fn profiles(browser: Browser) -> Vec<BrowserProfile> {
    paths::browser_user_data_dir(browser)
        .map(|dir| profiles_in(browser, &dir))
        .unwrap_or_default()
}

/// The profiles of `browser` in its data folder `dir`.
pub fn profiles_in(browser: Browser, dir: &Path) -> Vec<BrowserProfile> {
    match browser {
        Browser::Brave | Browser::Chrome | Browser::Edge | Browser::Vivaldi => {
            chromium::profiles(dir)
                .into_iter()
                .map(|profile| BrowserProfile {
                    id: profile.id,
                    name: profile.name,
                })
                .collect()
        }
        Browser::Opera | Browser::OperaGx => {
            if chromium::has_bookmarks(dir) {
                vec![BrowserProfile {
                    id: OPERA_PROFILE.to_owned(),
                    name: OPERA_PROFILE.to_owned(),
                }]
            } else {
                Vec::new()
            }
        }
        Browser::Firefox => firefox::profiles(dir)
            .into_iter()
            .map(|profile| BrowserProfile {
                id: profile.id,
                name: profile.name,
            })
            .collect(),
    }
}

/// The bookmarks of one profile of `browser`. Read only.
pub fn bookmarks(
    browser: Browser,
    profile: &str,
) -> Result<Vec<RawBookmark>, BrowserBookmarksError> {
    let dir = paths::browser_user_data_dir(browser).ok_or(BrowserBookmarksError::NoFolder)?;
    bookmarks_in(browser, &dir, profile)
}

/// The bookmarks of one profile of `browser`, whose data folder is `dir`.
pub fn bookmarks_in(
    browser: Browser,
    dir: &Path,
    profile: &str,
) -> Result<Vec<RawBookmark>, BrowserBookmarksError> {
    // Checked again here: the id names a folder.
    if !browser.is_profile_id(profile) {
        return Err(BrowserBookmarksError::InvalidProfile);
    }
    Ok(match browser {
        Browser::Brave | Browser::Chrome | Browser::Edge | Browser::Vivaldi => {
            ChromiumBookmarks::for_profile(dir.join(profile)).bookmarks()?
        }
        Browser::Opera | Browser::OperaGx => {
            ChromiumBookmarks::for_profile(dir.to_path_buf()).bookmarks()?
        }
        Browser::Firefox => {
            FirefoxBookmarks::new(firefox::places_path(dir, profile)).bookmarks()?
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const BOOKMARKS: &str = r#"{ "roots": {
        "bookmark_bar": { "name": "Bookmarks bar", "type": "folder", "children": [
          { "name": "dev", "type": "folder", "children": [
            { "name": "Motion", "type": "url", "url": "https://motion.dev/" } ] } ] },
        "other": { "name": "Other", "type": "folder", "children": [] },
        "synced": { "name": "Mobile", "type": "folder", "children": [] } }, "version": 1 }"#;

    fn temp(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "devatlas-browsers-test-{name}-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn opera_has_one_profile_at_the_top_of_its_folder() {
        let dir = temp("opera");
        assert!(profiles_in(Browser::Opera, &dir).is_empty());
        std::fs::write(dir.join("Bookmarks"), BOOKMARKS).unwrap();

        assert_eq!(
            profiles_in(Browser::OperaGx, &dir),
            [BrowserProfile {
                id: "Default".to_owned(),
                name: "Default".to_owned()
            }]
        );
        let titles: Vec<String> = bookmarks_in(Browser::Opera, &dir, "Default")
            .unwrap()
            .into_iter()
            .map(|bookmark| bookmark.title)
            .collect();
        assert_eq!(titles, ["Motion"]);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn refuses_a_profile_id_that_names_another_folder() {
        let dir = temp("refuse");

        for (browser, profile) in [
            (Browser::Chrome, "../x"),
            (Browser::Opera, "Profile 1"),
            (Browser::Firefox, "../../secrets"),
        ] {
            assert!(matches!(
                bookmarks_in(browser, &dir, profile),
                Err(BrowserBookmarksError::InvalidProfile)
            ));
        }
        std::fs::remove_dir_all(dir).unwrap();
    }
}

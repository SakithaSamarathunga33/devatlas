//! Read-only access to Chromium-family browsers (Brave, Chrome, Edge, Vivaldi): the profiles
//! found on this computer, and each profile's `Bookmarks` file.

use std::collections::HashMap;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};

use devatlas_application::library::{BookmarkSource, RawBookmark};
use devatlas_application::settings::is_profile_dir;
use serde::Deserialize;

/// Offset between 1601-01-01 (Chromium's epoch) and 1970-01-01, in milliseconds.
const CHROMIUM_EPOCH_OFFSET_MS: i64 = 11_644_473_600_000;

#[derive(Debug, thiserror::Error)]
pub enum ChromiumBookmarksError {
    #[error(
        "Your browser's bookmarks were not found. Open the browser once, or choose another in Settings."
    )]
    NotFound,
    #[error("Your browser's bookmarks could not be read: {0}")]
    Io(std::io::Error),
    // No detail: serde's message can quote the file's content, and this reaches the UI.
    #[error("Your browser's bookmarks file is not in the expected format.")]
    Format(#[from] serde_json::Error),
}

/// A bookmarks file. Only ever read; DevAtlas never writes to the browser profile.
#[derive(Debug, Clone)]
pub struct ChromiumBookmarks {
    path: PathBuf,
}

impl ChromiumBookmarks {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

impl BookmarkSource for ChromiumBookmarks {
    type Error = ChromiumBookmarksError;

    fn bookmarks(&self) -> Result<Vec<RawBookmark>, ChromiumBookmarksError> {
        let json = std::fs::read_to_string(&self.path).map_err(|error| match error.kind() {
            ErrorKind::NotFound => ChromiumBookmarksError::NotFound,
            _ => ChromiumBookmarksError::Io(error),
        })?;
        Ok(parse(&json)?)
    }
}

/// A browser profile that has bookmarks.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ChromiumProfile {
    /// The directory name, such as `Default` or `Profile 1`.
    pub id: String,
    /// The name the user gave it, or the directory name.
    pub name: String,
    pub bookmarks: PathBuf,
}

#[derive(Deserialize)]
struct LocalState {
    profile: LocalStateProfiles,
}

#[derive(Deserialize)]
struct LocalStateProfiles {
    info_cache: HashMap<String, ProfileInfo>,
}

#[derive(Deserialize)]
struct ProfileInfo {
    name: String,
}

/// Friendly profile names from `Local State`; a missing or damaged file just means none.
fn profile_names(user_data: &Path) -> HashMap<String, String> {
    std::fs::read(user_data.join("Local State"))
        .ok()
        .and_then(|bytes| serde_json::from_slice::<LocalState>(&bytes).ok())
        .map(|state| {
            state
                .profile
                .info_cache
                .into_iter()
                .map(|(id, info)| (id, info.name))
                .collect()
        })
        .unwrap_or_default()
}

/// The profiles in a browser's user-data directory that have a bookmarks file, `Default`
/// first. Empty when the browser isn't installed.
pub fn profiles(user_data: &Path) -> Vec<ChromiumProfile> {
    let Ok(entries) = std::fs::read_dir(user_data) else {
        return Vec::new();
    };
    let names = profile_names(user_data);
    let mut found: Vec<ChromiumProfile> = entries
        .flatten()
        .filter_map(|entry| {
            let id = entry.file_name().into_string().ok()?;
            let bookmarks = entry.path().join("Bookmarks");
            (is_profile_dir(&id) && bookmarks.is_file()).then(|| ChromiumProfile {
                name: names.get(&id).cloned().unwrap_or_else(|| id.clone()),
                id,
                bookmarks,
            })
        })
        .collect();
    found.sort_by_key(|profile| (profile.id != "Default", profile.id.clone()));
    found
}

#[derive(Deserialize)]
struct BookmarksFile {
    roots: Roots,
}

#[derive(Deserialize)]
struct Roots {
    bookmark_bar: Option<Node>,
    other: Option<Node>,
    synced: Option<Node>,
}

#[derive(Deserialize)]
struct Node {
    #[serde(default)]
    name: String,
    #[serde(rename = "type")]
    kind: String,
    url: Option<String>,
    date_added: Option<String>,
    #[serde(default)]
    children: Vec<Node>,
}

fn parse(json: &str) -> Result<Vec<RawBookmark>, serde_json::Error> {
    let file: BookmarksFile = serde_json::from_str(json)?;
    let mut bookmarks = Vec::new();
    let roots = [file.roots.bookmark_bar, file.roots.other, file.roots.synced];
    for root in roots.iter().flatten() {
        collect(&root.children, &mut Vec::new(), &mut bookmarks);
    }
    Ok(bookmarks)
}

fn collect(nodes: &[Node], path: &mut Vec<String>, out: &mut Vec<RawBookmark>) {
    for node in nodes {
        match (node.kind.as_str(), &node.url) {
            ("url", Some(url)) => out.push(RawBookmark {
                title: node.name.clone(),
                url: url.clone(),
                folder_path: path.clone(),
                added_at: node
                    .date_added
                    .as_deref()
                    .and_then(chromium_time_to_unix_ms),
            }),
            ("folder", _) => {
                path.push(node.name.clone());
                collect(&node.children, path, out);
                path.pop();
            }
            _ => {}
        }
    }
}

/// Chromium stores times as microseconds since 1601-01-01; `0` means unknown.
fn chromium_time_to_unix_ms(value: &str) -> Option<i64> {
    let micros: i64 = value.parse().ok().filter(|micros| *micros > 0)?;
    Some(micros / 1000 - CHROMIUM_EPOCH_OFFSET_MS)
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str = r#"{
      "checksum": "x",
      "roots": {
        "bookmark_bar": {
          "name": "Bookmarks bar", "type": "folder", "children": [
            { "name": "Top", "type": "url", "url": "https://top.example/", "date_added": "0" },
            { "name": "develop", "type": "folder", "children": [
              { "name": "Motion", "type": "url", "url": "https://motion.dev/docs",
                "date_added": "13400000000000000" },
              { "name": "components", "type": "folder", "children": [
                { "name": "Uiverse", "type": "url", "url": "https://uiverse.io/elements" }
              ]}
            ]}
          ]
        },
        "other": { "name": "Other bookmarks", "type": "folder", "children": [] },
        "synced": { "name": "Mobile bookmarks", "type": "folder", "children": [] }
      },
      "version": 1
    }"#;

    #[test]
    fn parses_bookmarks_with_their_folder_paths() {
        let bookmarks = parse(SAMPLE).unwrap();

        let summary: Vec<(&str, Vec<&str>)> = bookmarks
            .iter()
            .map(|b| {
                (
                    b.title.as_str(),
                    b.folder_path.iter().map(String::as_str).collect(),
                )
            })
            .collect();
        assert_eq!(
            summary,
            [
                ("Top", vec![]),
                ("Motion", vec!["develop"]),
                ("Uiverse", vec!["develop", "components"]),
            ]
        );
    }

    #[test]
    fn converts_chromium_timestamps_to_unix_milliseconds() {
        let bookmarks = parse(SAMPLE).unwrap();

        assert_eq!(bookmarks[0].added_at, None, "0 means unknown");
        // 13_400_000_000_000_000 µs since 1601 = 1_755_526_400_000 ms since 1970 (2025-08-18).
        assert_eq!(bookmarks[1].added_at, Some(1_755_526_400_000));
        assert_eq!(bookmarks[2].added_at, None, "missing means unknown");
    }

    #[test]
    fn reports_a_missing_file_as_not_found() {
        let source = ChromiumBookmarks::new(PathBuf::from("Z:/definitely/missing/Bookmarks"));
        assert!(matches!(
            source.bookmarks(),
            Err(ChromiumBookmarksError::NotFound)
        ));
    }

    fn temp_profiles(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "devatlas-chromium-test-{name}-{}",
            std::process::id()
        ));
        for profile in ["Profile 2", "Default", "Guest Profile", "Profile 9"] {
            std::fs::create_dir_all(dir.join(profile)).unwrap();
        }
        for profile in ["Profile 2", "Default", "Guest Profile"] {
            std::fs::write(dir.join(profile).join("Bookmarks"), SAMPLE).unwrap();
        }
        dir
    }

    #[test]
    fn finds_profiles_with_bookmarks_and_their_friendly_names() {
        let dir = temp_profiles("names");
        std::fs::write(
            dir.join("Local State"),
            r#"{ "profile": { "info_cache": { "Profile 2": { "name": "Work" } } } }"#,
        )
        .unwrap();

        let found = profiles(&dir);

        let summary: Vec<(&str, &str)> = found
            .iter()
            .map(|profile| (profile.id.as_str(), profile.name.as_str()))
            .collect();
        assert_eq!(summary, [("Default", "Default"), ("Profile 2", "Work")]);
        assert_eq!(found[1].bookmarks, dir.join("Profile 2").join("Bookmarks"));
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_damaged_local_state_only_loses_the_friendly_names() {
        let dir = temp_profiles("damaged");
        std::fs::write(dir.join("Local State"), "{ not json").unwrap();

        assert_eq!(profiles(&dir)[1].name, "Profile 2");
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_missing_browser_has_no_profiles() {
        assert!(profiles(Path::new("Z:/definitely/missing")).is_empty());
    }

    #[test]
    fn rejects_files_in_an_unexpected_format() {
        assert!(parse(r#"{ "not": "bookmarks" }"#).is_err());
    }
}

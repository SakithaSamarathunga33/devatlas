//! Read-only access to a Brave profile's `Bookmarks` file (Chromium JSON format).

use std::io::ErrorKind;
use std::path::PathBuf;

use devatlas_application::library::{BookmarkSource, RawBookmark};
use serde::Deserialize;

/// Offset between 1601-01-01 (Chromium's epoch) and 1970-01-01, in milliseconds.
const CHROMIUM_EPOCH_OFFSET_MS: i64 = 11_644_473_600_000;

#[derive(Debug, thiserror::Error)]
pub enum BraveBookmarksError {
    #[error(
        "Brave bookmarks were not found for the Default profile. Open Brave once, then try again."
    )]
    NotFound,
    #[error("Brave bookmarks could not be read: {0}")]
    Io(std::io::Error),
    #[error("Brave's bookmarks file is not in the expected format: {0}")]
    Format(#[from] serde_json::Error),
}

/// A Brave bookmarks file. Only ever read; DevAtlas never writes to the browser profile.
#[derive(Debug, Clone)]
pub struct BraveBookmarks {
    path: PathBuf,
}

impl BraveBookmarks {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

impl BookmarkSource for BraveBookmarks {
    type Error = BraveBookmarksError;

    fn bookmarks(&self) -> Result<Vec<RawBookmark>, BraveBookmarksError> {
        let json = std::fs::read_to_string(&self.path).map_err(|error| match error.kind() {
            ErrorKind::NotFound => BraveBookmarksError::NotFound,
            _ => BraveBookmarksError::Io(error),
        })?;
        Ok(parse(&json)?)
    }
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
        let source = BraveBookmarks::new(PathBuf::from("Z:/definitely/missing/Bookmarks"));
        assert!(matches!(
            source.bookmarks(),
            Err(BraveBookmarksError::NotFound)
        ));
    }

    #[test]
    fn rejects_files_in_an_unexpected_format() {
        assert!(parse(r#"{ "not": "bookmarks" }"#).is_err());
    }
}

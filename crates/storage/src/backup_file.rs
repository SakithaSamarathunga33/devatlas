//! Backup files, and bookmark exports from any browser. Paths come from a native dialog, and
//! what's read is untrusted: the application layer validates it before anything is stored.

use std::path::Path;

use devatlas_application::backup::Backup;
use devatlas_application::library::SavedLink;
use scraper::{Html, Selector};

use crate::json_file::{self, JsonFileError};

const MAX_IMPORT_BYTES: usize = 32 * 1024 * 1024;
const MAX_LINKS: usize = 50_000;
/// Longest link title or address kept.
const MAX_TEXT: usize = 2_048;

#[derive(Debug, thiserror::Error)]
pub enum BackupFileError {
    #[error("That file couldn't be read.")]
    Unreadable,
    #[error("That file is too large to import.")]
    TooLarge,
    #[error("That isn't a DevAtlas backup or a browser bookmarks file.")]
    Unrecognized,
    #[error("The backup couldn't be written.")]
    Write(#[from] JsonFileError),
}

/// What an import file turned out to be.
#[derive(Debug, PartialEq, Eq)]
pub enum ImportFile {
    Backup(Backup),
    Links(Vec<SavedLink>),
}

pub fn write_backup(path: &Path, backup: &Backup) -> Result<(), BackupFileError> {
    Ok(json_file::write(path, backup)?)
}

pub fn read_import(path: &Path) -> Result<ImportFile, BackupFileError> {
    let size = std::fs::metadata(path).map_err(|_| BackupFileError::Unreadable)?;
    if size.len() > MAX_IMPORT_BYTES as u64 {
        return Err(BackupFileError::TooLarge);
    }
    let bytes = std::fs::read(path).map_err(|_| BackupFileError::Unreadable)?;
    let text = String::from_utf8_lossy(&bytes);
    if text.trim_start().starts_with('<') {
        let links = parse_bookmarks_html(&text);
        return if links.is_empty() {
            Err(BackupFileError::Unrecognized)
        } else {
            Ok(ImportFile::Links(links))
        };
    }
    serde_json::from_str(&text)
        .map(ImportFile::Backup)
        .map_err(|_| BackupFileError::Unrecognized)
}

/// The links in a Netscape-format bookmarks export, which every major browser can produce.
fn parse_bookmarks_html(html: &str) -> Vec<SavedLink> {
    let document = Html::parse_document(html);
    let Ok(links) = Selector::parse("a[href]") else {
        return Vec::new();
    };
    document
        .select(&links)
        .take(MAX_LINKS)
        .filter_map(|link| {
            let added_at = link
                .attr("add_date")
                .and_then(|seconds| seconds.parse::<i64>().ok())
                .map_or(0, |seconds| seconds.saturating_mul(1000));
            let url = link.attr("href").filter(|url| url.len() <= MAX_TEXT)?;
            Some(SavedLink {
                url: url.to_owned(),
                title: link
                    .text()
                    .collect::<String>()
                    .trim()
                    .chars()
                    .take(MAX_TEXT)
                    .collect(),
                added_at,
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use devatlas_application::backup::BACKUP_VERSION;

    use super::*;

    fn temp(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("devatlas-backup-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(name)
    }

    fn backup() -> Backup {
        Backup {
            version: BACKUP_VERSION,
            exported_at: 1,
            saved_links: Vec::new(),
            hidden: vec!["h".to_owned()],
            annotations: Vec::new(),
            groups: Vec::new(),
            snippets: Vec::new(),
        }
    }

    #[test]
    fn writes_and_reads_back_a_backup() {
        let path = temp("backup.json");

        write_backup(&path, &backup()).unwrap();

        assert_eq!(read_import(&path).unwrap(), ImportFile::Backup(backup()));
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn reads_a_browser_bookmarks_export() {
        let path = temp("bookmarks.html");
        std::fs::write(
            &path,
            r#"<!DOCTYPE NETSCAPE-Bookmark-file-1>
            <DL><p>
              <DT><H3>Dev</H3>
              <DL><p>
                <DT><A HREF="https://motion.dev/" ADD_DATE="1700000000">Motion</A>
                <DT><A HREF="javascript:alert(1)">Bad</A>
                <DT><A HREF="https://a.example/">  </A>
              </DL><p>
            </DL>"#,
        )
        .unwrap();

        let ImportFile::Links(links) = read_import(&path).unwrap() else {
            panic!("links expected");
        };

        assert_eq!(links.len(), 3, "unusable links are dropped when importing");
        assert_eq!(links[0].title, "Motion");
        assert_eq!(links[0].url, "https://motion.dev/");
        assert_eq!(links[0].added_at, 1_700_000_000_000);
        assert_eq!(links[2].added_at, 0);
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn rejects_a_file_that_is_neither() {
        let path = temp("nonsense.json");
        std::fs::write(&path, "{ \"not\": \"a backup\" }").unwrap();

        assert!(matches!(
            read_import(&path),
            Err(BackupFileError::Unrecognized)
        ));
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn refuses_an_oversized_file() {
        let path = temp("huge.json");
        std::fs::write(&path, vec![b' '; MAX_IMPORT_BYTES + 1]).unwrap();

        assert!(matches!(read_import(&path), Err(BackupFileError::TooLarge)));
        std::fs::remove_file(path).unwrap();
    }
}

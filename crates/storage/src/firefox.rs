//! Read-only access to Firefox: its profiles from `profiles.ini`, and each profile's bookmarks
//! from `places.sqlite`. Firefox locks that database while it runs, so a copy is read (with its
//! write-ahead log, so recent bookmarks are included) and deleted straight after.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, PoisonError};
use std::time::{SystemTime, UNIX_EPOCH};

use devatlas_application::library::{BookmarkSource, RawBookmark};
use devatlas_application::settings::Browser;
use sqlx::sqlite::SqliteConnectOptions;
use sqlx::{ConnectOptions, Connection, Row};

/// Firefox's built-in folders. The menu, toolbar, "Other" and mobile folders hold bookmarks
/// but aren't part of a bookmark's folder path, as Chromium's "Bookmarks bar" isn't.
const CONTAINERS: [&str; 5] = [
    "root________",
    "menu________",
    "toolbar_____",
    "unfiled_____",
    "mobile______",
];
/// Firefox stores tags as folders of bookmark copies; those are not bookmarks.
const TAGS: &str = "tags________";
const BOOKMARK: i64 = 1;
/// Real folder trees are far shallower; this only stops a damaged database from looping.
const MAX_DEPTH: usize = 64;

#[derive(Debug, thiserror::Error)]
pub enum FirefoxError {
    #[error(
        "Firefox's bookmarks were not found. Open Firefox once, or choose another browser in Settings."
    )]
    NotFound,
    #[error("Firefox's bookmarks could not be read: {0}")]
    Io(#[from] std::io::Error),
    // No detail: SQLite's message can quote the database, and this reaches the UI.
    #[error("Firefox's bookmarks database could not be read.")]
    Database(#[from] sqlx::Error),
}

/// A Firefox profile with a bookmarks database.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FirefoxProfile {
    /// The profile's folder name inside `Profiles`, such as `x7y2abcd.default-release`.
    pub id: String,
    pub name: String,
}

/// The bookmarks database of the profile `id` inside the Firefox folder `root`.
pub fn places_path(root: &Path, id: &str) -> PathBuf {
    root.join("Profiles").join(id).join("places.sqlite")
}

/// Profiles listed in `profiles.ini` that keep their data in Firefox's own `Profiles` folder
/// and have bookmarks, the default one first. Profiles stored elsewhere are left out: their
/// path would have to be trusted from the file.
pub fn profiles(root: &Path) -> Vec<FirefoxProfile> {
    let Ok(ini) = std::fs::read_to_string(root.join("profiles.ini")) else {
        return Vec::new();
    };
    let mut found: Vec<(bool, FirefoxProfile)> = sections(&ini)
        .into_iter()
        .filter(|(section, _)| section.starts_with("Profile"))
        .filter_map(|(_, keys)| {
            if keys.get("IsRelative").map(String::as_str) != Some("1") {
                return None;
            }
            let id = keys.get("Path")?.strip_prefix("Profiles/")?.to_owned();
            if !Browser::Firefox.is_profile_id(&id) || !places_path(root, &id).is_file() {
                return None;
            }
            let name = keys.get("Name").cloned().unwrap_or_else(|| id.clone());
            let is_default = keys.get("Default").map(String::as_str) == Some("1");
            Some((is_default, FirefoxProfile { id, name }))
        })
        .collect();
    found.sort_by_key(|(is_default, _)| !is_default);
    found.into_iter().map(|(_, profile)| profile).collect()
}

/// `[Section]` headers and their `key=value` lines.
fn sections(ini: &str) -> Vec<(String, HashMap<String, String>)> {
    let mut sections: Vec<(String, HashMap<String, String>)> = Vec::new();
    for line in ini.lines().map(str::trim) {
        if let Some(name) = line
            .strip_prefix('[')
            .and_then(|rest| rest.strip_suffix(']'))
        {
            sections.push((name.to_owned(), HashMap::new()));
        } else if let (Some((key, value)), Some((_, keys))) =
            (line.split_once('='), sections.last_mut())
        {
            keys.insert(key.trim().to_owned(), value.trim().to_owned());
        }
    }
    sections
}

/// When and how big the database and its log were: unchanged means the bookmarks are too.
type Stamp = [(Option<SystemTime>, u64); 2];

/// The last read, so the library's frequent refreshes don't copy the database each time.
static LAST_READ: Mutex<Option<(PathBuf, Stamp, Vec<RawBookmark>)>> = Mutex::new(None);

fn stamp(places: &Path) -> Stamp {
    [
        places.to_path_buf(),
        places.with_file_name("places.sqlite-wal"),
    ]
    .map(|path| {
        std::fs::metadata(path).map_or((None, 0), |meta| (meta.modified().ok(), meta.len()))
    })
}

/// A profile's `places.sqlite`. Only ever read, and only through a copy.
#[derive(Debug, Clone)]
pub struct FirefoxBookmarks {
    places: PathBuf,
}

impl FirefoxBookmarks {
    pub fn new(places: PathBuf) -> Self {
        Self { places }
    }
}

impl BookmarkSource for FirefoxBookmarks {
    type Error = FirefoxError;

    fn bookmarks(&self) -> Result<Vec<RawBookmark>, FirefoxError> {
        if !self.places.is_file() {
            return Err(FirefoxError::NotFound);
        }
        let current = stamp(&self.places);
        if let Some((path, seen, bookmarks)) = LAST_READ
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .as_ref()
            && *path == self.places
            && *seen == current
        {
            return Ok(bookmarks.clone());
        }
        let copy = TempCopy::new(&self.places)?;
        let path = copy.database.clone();
        // A thread with its own runtime: callers may already be inside one, which can't block.
        let rows = std::thread::spawn(move || {
            tokio::runtime::Builder::new_current_thread()
                .build()
                .map_err(FirefoxError::Io)?
                .block_on(read_rows(&path))
                .map_err(FirefoxError::Database)
        })
        .join()
        .map_err(|_| FirefoxError::Io(std::io::Error::other("the reader stopped")))??;
        let bookmarks = build(&rows);
        *LAST_READ.lock().unwrap_or_else(PoisonError::into_inner) =
            Some((self.places.clone(), current, bookmarks.clone()));
        Ok(bookmarks)
    }
}

/// A private copy of the database and its write-ahead log, removed when dropped.
struct TempCopy {
    dir: PathBuf,
    database: PathBuf,
}

impl TempCopy {
    fn new(places: &Path) -> Result<Self, std::io::Error> {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_or(0, |elapsed| elapsed.as_nanos());
        let dir =
            std::env::temp_dir().join(format!("devatlas-firefox-{}-{stamp}", std::process::id()));
        std::fs::create_dir_all(&dir)?;
        let copy = Self {
            database: dir.join("places.sqlite"),
            dir,
        };
        std::fs::copy(places, &copy.database)?;
        let wal = places.with_file_name("places.sqlite-wal");
        if wal.is_file() {
            std::fs::copy(&wal, copy.dir.join("places.sqlite-wal"))?;
        }
        Ok(copy)
    }
}

impl Drop for TempCopy {
    fn drop(&mut self) {
        if let Err(error) = std::fs::remove_dir_all(&self.dir) {
            tracing::warn!(%error, "could not remove the copy of Firefox's bookmarks");
        }
    }
}

struct Node {
    parent: i64,
    kind: i64,
    title: String,
    guid: String,
    url: Option<String>,
    /// Microseconds since 1970.
    date_added: Option<i64>,
}

async fn read_rows(path: &Path) -> Result<Vec<(i64, Node)>, sqlx::Error> {
    // The copy is ours, so it may be opened for writing: SQLite needs that to apply the log.
    let mut connection = SqliteConnectOptions::new().filename(path).connect().await?;
    let rows = sqlx::query(
        "SELECT b.id, b.parent, b.type, b.title, b.guid, b.dateAdded, p.url
         FROM moz_bookmarks b LEFT JOIN moz_places p ON p.id = b.fk
         ORDER BY b.id",
    )
    .fetch_all(&mut connection)
    .await?;
    // Closed before the copy is deleted: a dropped connection closes in the background.
    connection.close().await?;
    rows.iter()
        .map(|row| {
            Ok((
                row.try_get("id")?,
                Node {
                    parent: row.try_get("parent")?,
                    kind: row.try_get("type")?,
                    title: row
                        .try_get::<Option<String>, _>("title")?
                        .unwrap_or_default(),
                    guid: row.try_get("guid")?,
                    url: row.try_get("url")?,
                    date_added: row.try_get("dateAdded")?,
                },
            ))
        })
        .collect()
}

/// Bookmarks with their folder paths, leaving out tags and Firefox's built-in folders.
fn build(rows: &[(i64, Node)]) -> Vec<RawBookmark> {
    let by_id: HashMap<i64, &Node> = rows.iter().map(|(id, node)| (*id, node)).collect();
    rows.iter()
        .filter_map(|(_, node)| {
            let url = node.url.as_ref().filter(|_| node.kind == BOOKMARK)?;
            let mut folder_path = Vec::new();
            let mut parent = by_id.get(&node.parent).copied();
            for _ in 0..MAX_DEPTH {
                let Some(folder) = parent else { break };
                if folder.guid == TAGS {
                    return None;
                }
                if CONTAINERS.contains(&folder.guid.as_str()) {
                    break;
                }
                folder_path.push(folder.title.clone());
                parent = by_id.get(&folder.parent).copied();
            }
            folder_path.reverse();
            Some(RawBookmark {
                title: node.title.clone(),
                url: url.clone(),
                folder_path,
                added_at: node
                    .date_added
                    .filter(|micros| *micros > 0)
                    .map(|micros| micros / 1000),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use sqlx::sqlite::SqliteJournalMode;

    use super::*;

    fn temp_root(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "devatlas-firefox-test-{name}-{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    /// A small `places.sqlite` with the toolbar, a nested folder, a menu bookmark and a tag.
    async fn write_places(path: &Path) {
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        let mut db = SqliteConnectOptions::new()
            .filename(path)
            .create_if_missing(true)
            .journal_mode(SqliteJournalMode::Wal)
            .connect()
            .await
            .unwrap();
        let statements = [
            "CREATE TABLE moz_places (id INTEGER PRIMARY KEY, url TEXT)",
            "CREATE TABLE moz_bookmarks (id INTEGER PRIMARY KEY, type INTEGER, fk INTEGER,
             parent INTEGER, title TEXT, dateAdded INTEGER, guid TEXT)",
            "INSERT INTO moz_places VALUES (1, 'https://motion.dev/'),
             (2, 'https://uiverse.io/'), (3, 'https://top.example/')",
            "INSERT INTO moz_bookmarks VALUES
             (1, 2, NULL, 0, '', 0, 'root________'),
             (2, 2, NULL, 1, 'menu', 0, 'menu________'),
             (3, 2, NULL, 1, 'toolbar', 0, 'toolbar_____'),
             (4, 2, NULL, 1, 'tags', 0, 'tags________'),
             (10, 2, NULL, 3, 'develop', 0, 'folderdevelo'),
             (11, 1, 1, 10, 'Motion', 1700000000000000, 'bookmarkmoti'),
             (12, 2, NULL, 10, 'components', 0, 'foldercompon'),
             (13, 1, 2, 12, 'Uiverse', NULL, 'bookmarkuive'),
             (14, 2, NULL, 4, 'react', 0, 'tagreact____'),
             (15, 1, 1, 14, NULL, 0, 'tagcopymotio'),
             (16, 1, 3, 2, 'Top', 0, 'bookmarktop_')",
        ];
        for statement in statements {
            sqlx::query(statement).execute(&mut db).await.unwrap();
        }
        db.close().await.unwrap();
    }

    #[tokio::test]
    async fn reads_bookmarks_with_folders_and_skips_tags() {
        let root = temp_root("bookmarks");
        let places = places_path(&root, "abc.default-release");
        write_places(&places).await;

        let found: Vec<(String, Vec<String>, Option<i64>)> = FirefoxBookmarks::new(places)
            .bookmarks()
            .unwrap()
            .into_iter()
            .map(|b| (b.title, b.folder_path, b.added_at))
            .collect();

        assert_eq!(
            found,
            [
                (
                    "Motion".to_owned(),
                    vec!["develop".to_owned()],
                    Some(1_700_000_000_000)
                ),
                (
                    "Uiverse".to_owned(),
                    vec!["develop".to_owned(), "components".to_owned()],
                    None
                ),
                ("Top".to_owned(), vec![], None),
            ]
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn lists_profiles_from_profiles_ini_default_first() {
        let root = temp_root("profiles");
        write_places(&places_path(&root, "abc.default")).await;
        write_places(&places_path(&root, "xyz.default-release")).await;
        std::fs::write(
            root.join("profiles.ini"),
            "[General]\nStartWithLastProfile=1\n\n\
             [Profile1]\nName=default\nIsRelative=1\nPath=Profiles/abc.default\n\n\
             [Profile0]\nName=default-release\nIsRelative=1\nPath=Profiles/xyz.default-release\nDefault=1\n\n\
             [Profile2]\nName=elsewhere\nIsRelative=0\nPath=D:\\firefox\\work\n\n\
             [Profile3]\nName=escape\nIsRelative=1\nPath=Profiles/../../x\n\n\
             [Profile4]\nName=empty\nIsRelative=1\nPath=Profiles/nothing.here\n",
        )
        .unwrap();

        let ids: Vec<String> = profiles(&root).into_iter().map(|p| p.name).collect();

        assert_eq!(ids, ["default-release", "default"]);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[tokio::test]
    async fn rereads_only_when_firefox_changed_the_database() {
        let root = temp_root("cache");
        let places = places_path(&root, "abc.default-release");
        write_places(&places).await;
        let source = FirefoxBookmarks::new(places.clone());
        assert_eq!(source.bookmarks().unwrap().len(), 3);

        // Firefox saves a bookmark: the file changes, so the next read sees it.
        std::thread::sleep(std::time::Duration::from_millis(20));
        let mut db = SqliteConnectOptions::new()
            .filename(&places)
            .connect()
            .await
            .unwrap();
        sqlx::query("INSERT INTO moz_places VALUES (4, 'https://new.example/')")
            .execute(&mut db)
            .await
            .unwrap();
        sqlx::query("INSERT INTO moz_bookmarks VALUES (17, 1, 4, 3, 'New', 0, 'bookmarknew_')")
            .execute(&mut db)
            .await
            .unwrap();
        db.close().await.unwrap();

        assert_eq!(source.bookmarks().unwrap().len(), 4);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn a_missing_database_is_not_found() {
        assert!(matches!(
            FirefoxBookmarks::new(PathBuf::from("Z:/definitely/missing/places.sqlite")).bookmarks(),
            Err(FirefoxError::NotFound)
        ));
        assert!(profiles(Path::new("Z:/definitely/missing")).is_empty());
    }
}

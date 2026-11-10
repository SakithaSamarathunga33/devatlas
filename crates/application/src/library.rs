//! Use cases: build the developer library from a bookmark source, and remember which
//! resources the user has already seen so new ones can be highlighted.

use std::collections::{BTreeMap, HashSet};

use devatlas_domain::resource::Resource;
use serde::{Deserialize, Serialize};

/// How long a newly found resource keeps its "new" mark if it is never opened.
pub const NEW_FOR_MS: i64 = 7 * 24 * 60 * 60 * 1000;

/// A bookmark as a browser stores it, before cleaning or classification.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RawBookmark {
    pub title: String,
    pub url: String,
    /// Folders from the top level down, excluding the browser's root (e.g. "Bookmarks bar").
    pub folder_path: Vec<String>,
    /// Unix milliseconds, if the browser recorded it.
    pub added_at: Option<i64>,
}

/// Port: a place bookmarks can be read from, such as a browser profile.
pub trait BookmarkSource {
    type Error: std::error::Error;

    fn bookmarks(&self) -> Result<Vec<RawBookmark>, Self::Error>;
}

/// What DevAtlas remembers about one resource between runs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceMemory {
    /// When DevAtlas first found the resource, as Unix milliseconds.
    pub first_seen: i64,
    /// Whether the user has opened it in DevAtlas (or it predates the memory).
    pub opened: bool,
}

/// Remembered resources, keyed by resource id.
pub type LibraryMemory = BTreeMap<String, ResourceMemory>;

/// Port: persists [`LibraryMemory`]. `load` returns `None` when nothing was stored yet.
pub trait LibraryMemoryStore {
    type Error: std::error::Error;

    fn load(&self) -> Result<Option<LibraryMemory>, Self::Error>;
    fn save(&self, memory: &LibraryMemory) -> Result<(), Self::Error>;
}

/// Where the library was read from, shown to the user.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LibrarySource {
    pub browser: String,
    pub folder: String,
}

/// A resource plus whether it is new to the user.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryItem {
    #[serde(flatten)]
    pub resource: Resource,
    pub is_new: bool,
}

/// The developer library as currently found in the source.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LibrarySnapshot {
    pub source: LibrarySource,
    pub resources: Vec<LibraryItem>,
}

#[derive(Debug, thiserror::Error)]
pub enum LibraryError<S: std::error::Error, M: std::error::Error> {
    #[error(transparent)]
    Source(S),
    #[error("DevAtlas could not update its library memory: {0}")]
    Memory(M),
}

/// Collects the bookmarks filed under the top-level `folder` (any depth, matched
/// case-insensitively), cleans and classifies them, drops duplicates and unusable links,
/// sorts them by title, and marks the ones found since earlier runs as new.
///
/// On the very first run every resource is treated as already seen, so only links added
/// afterwards are highlighted.
pub fn load_library<S: BookmarkSource, M: LibraryMemoryStore>(
    source: &S,
    memory: &M,
    browser: &str,
    folder: &str,
    now_ms: i64,
) -> Result<LibrarySnapshot, LibraryError<S::Error, M::Error>> {
    let resources = collect_resources(source, folder).map_err(LibraryError::Source)?;
    let stored = memory.load().map_err(LibraryError::Memory)?;
    let first_run = stored.is_none();
    let mut known = stored.unwrap_or_default();

    let mut changed = first_run;
    for resource in &resources {
        known.entry(resource.id.clone()).or_insert_with(|| {
            changed = true;
            ResourceMemory {
                first_seen: now_ms,
                opened: first_run,
            }
        });
    }
    // Forget removed links so re-adding one marks it new again. An empty folder is more
    // likely a renamed or unreadable folder, so it never wipes the memory.
    if !resources.is_empty() {
        let current: HashSet<&str> = resources.iter().map(|r| r.id.as_str()).collect();
        let before = known.len();
        known.retain(|id, _| current.contains(id.as_str()));
        changed |= known.len() != before;
    }
    if changed {
        memory.save(&known).map_err(LibraryError::Memory)?;
    }

    let resources = resources
        .into_iter()
        .map(|resource| {
            let is_new = known
                .get(&resource.id)
                .is_some_and(|entry| !entry.opened && now_ms - entry.first_seen < NEW_FOR_MS);
            LibraryItem { resource, is_new }
        })
        .collect();

    Ok(LibrarySnapshot {
        source: LibrarySource {
            browser: browser.to_owned(),
            folder: folder.to_owned(),
        },
        resources,
    })
}

/// Records that the user opened a resource, which clears its "new" mark.
pub fn mark_opened<M: LibraryMemoryStore>(memory: &M, id: &str) -> Result<(), M::Error> {
    let mut known = memory.load()?.unwrap_or_default();
    if let Some(entry) = known.get_mut(id) {
        if !entry.opened {
            entry.opened = true;
            memory.save(&known)?;
        }
    }
    Ok(())
}

fn collect_resources<S: BookmarkSource>(
    source: &S,
    folder: &str,
) -> Result<Vec<Resource>, S::Error> {
    let mut seen = HashSet::new();
    let mut resources: Vec<Resource> = source
        .bookmarks()?
        .into_iter()
        .filter(|bookmark| {
            bookmark
                .folder_path
                .first()
                .is_some_and(|top| top.eq_ignore_ascii_case(folder))
        })
        .filter_map(|bookmark| {
            Resource::from_bookmark(
                &bookmark.title,
                &bookmark.url,
                &bookmark.folder_path,
                bookmark.added_at,
            )
        })
        .filter(|resource| seen.insert(resource.id.clone()))
        .collect();
    resources.sort_by_key(|resource| resource.title.to_lowercase());
    Ok(resources)
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::convert::Infallible;

    use devatlas_domain::resource::ResourceCategory;

    use super::*;

    const DAY_MS: i64 = 24 * 60 * 60 * 1000;

    struct FakeSource(RefCell<Vec<RawBookmark>>);

    impl FakeSource {
        fn new(bookmarks: Vec<RawBookmark>) -> Self {
            Self(RefCell::new(bookmarks))
        }

        fn add(&self, bookmark: RawBookmark) {
            self.0.borrow_mut().push(bookmark);
        }
    }

    impl BookmarkSource for FakeSource {
        type Error = Infallible;

        fn bookmarks(&self) -> Result<Vec<RawBookmark>, Infallible> {
            Ok(self.0.borrow().clone())
        }
    }

    #[derive(Default)]
    struct FakeMemory(RefCell<Option<LibraryMemory>>);

    impl LibraryMemoryStore for FakeMemory {
        type Error = Infallible;

        fn load(&self) -> Result<Option<LibraryMemory>, Infallible> {
            Ok(self.0.borrow().clone())
        }

        fn save(&self, memory: &LibraryMemory) -> Result<(), Infallible> {
            *self.0.borrow_mut() = Some(memory.clone());
            Ok(())
        }
    }

    fn bookmark(title: &str, url: &str, path: &[&str]) -> RawBookmark {
        RawBookmark {
            title: title.to_owned(),
            url: url.to_owned(),
            folder_path: path.iter().map(|folder| (*folder).to_owned()).collect(),
            added_at: None,
        }
    }

    fn load(source: &FakeSource, memory: &FakeMemory, now_ms: i64) -> LibrarySnapshot {
        load_library(source, memory, "Brave", "develop", now_ms).unwrap()
    }

    fn new_titles(snapshot: &LibrarySnapshot) -> Vec<&str> {
        snapshot
            .resources
            .iter()
            .filter(|item| item.is_new)
            .map(|item| item.resource.title.as_str())
            .collect()
    }

    #[test]
    fn keeps_only_the_requested_folder_and_its_subfolders() {
        let source = FakeSource::new(vec![
            bookmark("Motion", "https://motion.dev/docs", &["develop"]),
            bookmark(
                "Uiverse",
                "https://uiverse.io/elements",
                &["Develop", "components"],
            ),
            bookmark("Bank", "https://bank.example/login", &["stuffs"]),
            bookmark("Loose", "https://loose.example", &[]),
        ]);

        let library = load(&source, &FakeMemory::default(), 0);

        let titles: Vec<&str> = library
            .resources
            .iter()
            .map(|item| item.resource.title.as_str())
            .collect();
        assert_eq!(titles, ["Motion", "Uiverse"]);
        assert_eq!(
            library.resources[1].resource.category,
            ResourceCategory::UiComponents
        );
        assert_eq!(
            library.source,
            LibrarySource {
                browser: "Brave".to_owned(),
                folder: "develop".to_owned(),
            }
        );
    }

    #[test]
    fn drops_duplicates_and_unusable_links_and_sorts_by_title() {
        let source = FakeSource::new(vec![
            bookmark("free-for.dev", "https://free-for.dev/?a=1#/", &["develop"]),
            bookmark(
                "Anime.js",
                "https://animejs.com/",
                &["develop", "components"],
            ),
            bookmark(
                "Free for Developers",
                "https://free-for.dev/#/",
                &["develop"],
            ),
            bookmark("Anime.js again", "https://animejs.com", &["develop"]),
            bookmark("Script", "javascript:void(0)", &["develop"]),
        ]);

        let library = load(&source, &FakeMemory::default(), 0);

        let titles: Vec<&str> = library
            .resources
            .iter()
            .map(|item| item.resource.title.as_str())
            .collect();
        assert_eq!(titles, ["Anime.js", "free-for.dev"]);
    }

    #[test]
    fn treats_everything_as_seen_on_the_first_run() {
        let source = FakeSource::new(vec![bookmark(
            "Motion",
            "https://motion.dev/",
            &["develop"],
        )]);
        let memory = FakeMemory::default();

        let library = load(&source, &memory, 1_000);

        assert!(new_titles(&library).is_empty());
        assert!(memory.0.borrow().is_some(), "the baseline is stored");
    }

    #[test]
    fn marks_links_added_after_the_first_run_as_new_until_opened() {
        let source = FakeSource::new(vec![bookmark(
            "Motion",
            "https://motion.dev/",
            &["develop"],
        )]);
        let memory = FakeMemory::default();
        load(&source, &memory, 1_000);

        source.add(bookmark(
            "Uiverse",
            "https://uiverse.io/",
            &["develop", "components"],
        ));
        let library = load(&source, &memory, 2_000);
        assert_eq!(new_titles(&library), ["Uiverse"]);

        mark_opened(&memory, "uiverse.io").unwrap();
        assert!(new_titles(&load(&source, &memory, 3_000)).is_empty());
    }

    #[test]
    fn new_marks_expire_after_a_week() {
        let source = FakeSource::new(vec![]);
        let memory = FakeMemory::default();
        load(&source, &memory, 0);
        source.add(bookmark("Uiverse", "https://uiverse.io/", &["develop"]));
        load(&source, &memory, DAY_MS);

        assert_eq!(new_titles(&load(&source, &memory, 7 * DAY_MS)), ["Uiverse"]);
        assert!(new_titles(&load(&source, &memory, 8 * DAY_MS + 1)).is_empty());
    }

    #[test]
    fn re_adding_a_removed_link_marks_it_new_again() {
        let motion = bookmark("Motion", "https://motion.dev/", &["develop"]);
        let uiverse = bookmark("Uiverse", "https://uiverse.io/", &["develop"]);
        let source = FakeSource::new(vec![motion.clone(), uiverse.clone()]);
        let memory = FakeMemory::default();
        load(&source, &memory, 0);

        *source.0.borrow_mut() = vec![motion];
        load(&source, &memory, 1);
        source.add(uiverse);

        assert_eq!(new_titles(&load(&source, &memory, 2)), ["Uiverse"]);
    }

    #[test]
    fn an_empty_folder_does_not_wipe_the_memory() {
        let source = FakeSource::new(vec![bookmark(
            "Motion",
            "https://motion.dev/",
            &["develop"],
        )]);
        let memory = FakeMemory::default();
        load(&source, &memory, 0);

        *source.0.borrow_mut() = vec![];
        load(&source, &memory, 1);
        source.add(bookmark("Motion", "https://motion.dev/", &["develop"]));

        assert!(new_titles(&load(&source, &memory, 2)).is_empty());
    }

    #[test]
    fn serializes_items_flat_with_an_is_new_flag() {
        let source = FakeSource::new(vec![bookmark(
            "Motion",
            "https://motion.dev/",
            &["develop"],
        )]);
        let library = load(&source, &FakeMemory::default(), 0);

        let json = serde_json::to_value(&library.resources[0]).unwrap();

        assert_eq!(json["title"], "Motion");
        assert_eq!(json["isNew"], false);
    }
}

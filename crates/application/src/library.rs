//! Use cases: build the developer library from browser bookmarks plus links saved in
//! DevAtlas, add and remove saved links, and remember which resources the user has seen so
//! new ones can be highlighted.

use std::collections::{BTreeMap, HashSet};

use devatlas_domain::resource::{Resource, normalize_url};
use serde::{Deserialize, Serialize};

use crate::preview::{self, PreviewCache, PreviewSource};

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

/// A link the user saved directly in DevAtlas.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SavedLink {
    pub url: String,
    pub title: String,
    /// Unix milliseconds.
    pub added_at: i64,
}

/// Port: persists the links saved in DevAtlas.
pub trait SavedLinkStore {
    type Error: std::error::Error;

    fn load(&self) -> Result<Vec<SavedLink>, Self::Error>;
    fn save(&self, links: &[SavedLink]) -> Result<(), Self::Error>;
}

/// What DevAtlas remembers about one resource between runs.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourceMemory {
    /// When DevAtlas first found the resource, as Unix milliseconds.
    pub first_seen: i64,
    /// Whether the user has opened it in DevAtlas (or it predates the memory).
    pub opened: bool,
    /// Whether the user removed it from DevAtlas. Browser bookmarks are hidden this way
    /// rather than deleted, so the browser profile is never written to.
    #[serde(default, skip_serializing_if = "std::ops::Not::not")]
    pub hidden: bool,
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

/// The developer library as currently found.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct LibrarySnapshot {
    pub source: LibrarySource,
    pub resources: Vec<LibraryItem>,
}

#[derive(Debug, thiserror::Error)]
pub enum LibraryError<B: std::error::Error, L: std::error::Error, M: std::error::Error> {
    #[error(transparent)]
    Source(B),
    #[error("DevAtlas could not read your saved links: {0}")]
    Saved(L),
    #[error("DevAtlas could not update its library memory: {0}")]
    Memory(M),
}

/// Result of [`load_library`], with each port's error type.
pub type LoadResult<B, L, M> = Result<
    LibrarySnapshot,
    LibraryError<
        <B as BookmarkSource>::Error,
        <L as SavedLinkStore>::Error,
        <M as LibraryMemoryStore>::Error,
    >,
>;

#[derive(Debug, thiserror::Error)]
pub enum AddLinkError<B: std::error::Error, L: std::error::Error, M: std::error::Error> {
    #[error("Enter a web address, such as https://www.awwwards.com/websites/portfolio/.")]
    InvalidUrl,
    #[error("\u{201c}{0}\u{201d} is already in your library.")]
    AlreadySaved(String),
    #[error(transparent)]
    Source(B),
    #[error("DevAtlas could not save the link: {0}")]
    Store(L),
    #[error("DevAtlas could not update its library memory: {0}")]
    Memory(M),
}

#[derive(Debug, thiserror::Error)]
pub enum RemoveLinkError<L: std::error::Error, M: std::error::Error> {
    #[error("DevAtlas could not update your saved links: {0}")]
    Store(L),
    #[error("DevAtlas could not update its library memory: {0}")]
    Memory(M),
}

/// Collects the bookmarks filed under the top-level browser `folder` (any depth, matched
/// case-insensitively) plus the links saved in DevAtlas, cleans and classifies them, drops
/// duplicates (the browser copy wins) and unusable links, sorts them by title, and marks
/// the ones found since earlier runs as new.
///
/// On the very first run every resource is treated as already seen, so only links added
/// afterwards are highlighted.
pub fn load_library<B, L, M>(
    source: &B,
    saved: &L,
    memory: &M,
    browser: &str,
    folder: &str,
    now_ms: i64,
) -> LoadResult<B, L, M>
where
    B: BookmarkSource,
    L: SavedLinkStore,
    M: LibraryMemoryStore,
{
    let mut resources = browser_resources(source, folder).map_err(LibraryError::Source)?;
    let saved_links = saved.load().map_err(LibraryError::Saved)?;
    let mut seen: HashSet<String> = resources.iter().map(|r| r.id.clone()).collect();
    resources
        .extend(saved_resources(&saved_links).filter(|resource| seen.insert(resource.id.clone())));
    resources.sort_by_key(|resource| resource.title.to_lowercase());

    let known = remember(memory, &resources, now_ms).map_err(LibraryError::Memory)?;
    let resources = resources
        .into_iter()
        .filter(|resource| !known.get(&resource.id).is_some_and(|entry| entry.hidden))
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

/// Saves a link in DevAtlas after fetching its title (and warming the preview cache).
/// An unreachable site is still saved, titled by its host, so links can be added offline.
/// Adding a link the user removed earlier brings it back, marked new.
#[allow(clippy::too_many_arguments)] // each argument is a distinct port or input
pub async fn add_link<B, L, M, P, C>(
    source: &B,
    folder: &str,
    saved: &L,
    memory: &M,
    previews: &P,
    cache: &C,
    raw_url: &str,
    now_ms: i64,
) -> Result<Resource, AddLinkError<B::Error, L::Error, M::Error>>
where
    B: BookmarkSource,
    L: SavedLinkStore,
    M: LibraryMemoryStore,
    P: PreviewSource,
    C: PreviewCache,
{
    let url = normalize_url(&with_scheme(raw_url)).ok_or(AddLinkError::InvalidUrl)?;
    let candidate = Resource::saved("", url.as_str(), now_ms).ok_or(AddLinkError::InvalidUrl)?;
    let mut links = saved.load().map_err(AddLinkError::Store)?;
    {
        let browser = browser_resources(source, folder).map_err(AddLinkError::Source)?;
        let duplicate = browser
            .into_iter()
            .chain(saved_resources(&links))
            .find(|resource| resource.id == candidate.id);
        if let Some(existing) = duplicate {
            return if unhide(memory, &existing.id).map_err(AddLinkError::Memory)? {
                Ok(existing)
            } else {
                Err(AddLinkError::AlreadySaved(existing.title))
            };
        }
    }

    let title = preview::get_preview(previews, cache, url.as_str())
        .await
        .ok()
        .and_then(|preview| preview.title)
        .unwrap_or_default();
    let resource = Resource::saved(&title, url.as_str(), now_ms).ok_or(AddLinkError::InvalidUrl)?;
    links.push(SavedLink {
        url: resource.url.clone(),
        title: resource.title.clone(),
        added_at: now_ms,
    });
    saved.save(&links).map_err(AddLinkError::Store)?;
    unhide(memory, &resource.id).map_err(AddLinkError::Memory)?;
    Ok(resource)
}

/// Forgets a hidden resource so the next load finds it again as new. Returns whether it
/// was hidden.
fn unhide<M: LibraryMemoryStore>(memory: &M, id: &str) -> Result<bool, M::Error> {
    let mut known = memory.load()?.unwrap_or_default();
    if !known.get(id).is_some_and(|entry| entry.hidden) {
        return Ok(false);
    }
    known.remove(id);
    memory.save(&known)?;
    Ok(true)
}

/// Removes a resource from the library: a link saved in DevAtlas is deleted, and a browser
/// bookmark is hidden (the browser profile is never written to). Returns whether anything
/// changed.
pub fn remove_link<L, M>(
    saved: &L,
    memory: &M,
    id: &str,
) -> Result<bool, RemoveLinkError<L::Error, M::Error>>
where
    L: SavedLinkStore,
    M: LibraryMemoryStore,
{
    let links = saved.load().map_err(RemoveLinkError::Store)?;
    let kept: Vec<SavedLink> = links
        .iter()
        .filter(|link| {
            Resource::saved(&link.title, &link.url, link.added_at)
                .is_none_or(|resource| resource.id != id)
        })
        .cloned()
        .collect();
    if kept.len() != links.len() {
        saved.save(&kept).map_err(RemoveLinkError::Store)?;
        return Ok(true);
    }

    let mut known = memory
        .load()
        .map_err(RemoveLinkError::Memory)?
        .unwrap_or_default();
    let Some(entry) = known.get_mut(id).filter(|entry| !entry.hidden) else {
        return Ok(false);
    };
    entry.hidden = true;
    memory.save(&known).map_err(RemoveLinkError::Memory)?;
    Ok(true)
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

/// Accepts addresses typed without a scheme, such as `www.awwwards.com/websites`.
fn with_scheme(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.contains("://") {
        trimmed.to_owned()
    } else {
        format!("https://{trimmed}")
    }
}

/// Updates the memory with the current resources and returns it.
fn remember<M: LibraryMemoryStore>(
    memory: &M,
    resources: &[Resource],
    now_ms: i64,
) -> Result<LibraryMemory, M::Error> {
    let stored = memory.load()?;
    let first_run = stored.is_none();
    let mut known = stored.unwrap_or_default();

    let mut changed = first_run;
    for resource in resources {
        known.entry(resource.id.clone()).or_insert_with(|| {
            changed = true;
            ResourceMemory {
                first_seen: now_ms,
                opened: first_run,
                hidden: false,
            }
        });
    }
    // Forget removed links so re-adding one marks it new again. An empty library is more
    // likely a renamed or unreadable folder, so it never wipes the memory.
    if !resources.is_empty() {
        let current: HashSet<&str> = resources.iter().map(|r| r.id.as_str()).collect();
        let before = known.len();
        known.retain(|id, _| current.contains(id.as_str()));
        changed |= known.len() != before;
    }
    if changed {
        memory.save(&known)?;
    }
    Ok(known)
}

fn browser_resources<B: BookmarkSource>(
    source: &B,
    folder: &str,
) -> Result<Vec<Resource>, B::Error> {
    let mut seen = HashSet::new();
    Ok(source
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
        .collect())
}

fn saved_resources(links: &[SavedLink]) -> impl Iterator<Item = Resource> + '_ {
    links
        .iter()
        .filter_map(|link| Resource::saved(&link.title, &link.url, link.added_at))
}

#[cfg(test)]
mod tests {
    use std::cell::RefCell;
    use std::convert::Infallible;
    use std::pin::pin;
    use std::sync::Mutex;
    use std::task::{Context, Poll, Waker};

    use devatlas_domain::resource::{ResourceCategory, ResourceOrigin};
    use url::Url;

    use super::*;
    use crate::preview::ResourcePreview;

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

    #[derive(Default)]
    struct FakeSaved(RefCell<Vec<SavedLink>>);

    impl SavedLinkStore for FakeSaved {
        type Error = Infallible;

        fn load(&self) -> Result<Vec<SavedLink>, Infallible> {
            Ok(self.0.borrow().clone())
        }

        fn save(&self, links: &[SavedLink]) -> Result<(), Infallible> {
            *self.0.borrow_mut() = links.to_vec();
            Ok(())
        }
    }

    struct FakePreviews {
        title: Option<&'static str>,
    }

    #[derive(Debug, thiserror::Error)]
    #[error("offline")]
    struct Offline;

    impl PreviewSource for FakePreviews {
        type Error = Offline;

        async fn fetch(&self, _url: &Url) -> Result<ResourcePreview, Offline> {
            match self.title {
                Some(title) => Ok(ResourcePreview {
                    title: Some(title.to_owned()),
                    ..ResourcePreview::default()
                }),
                None => Err(Offline),
            }
        }
    }

    #[derive(Default)]
    struct FakeCache(Mutex<BTreeMap<String, ResourcePreview>>);

    impl PreviewCache for FakeCache {
        fn get(&self, url: &str) -> Option<ResourcePreview> {
            self.0.lock().unwrap().get(url).cloned()
        }

        fn put(&self, url: &str, preview: ResourcePreview) {
            self.0.lock().unwrap().insert(url.to_owned(), preview);
        }
    }

    /// The fakes resolve immediately, so a single poll completes the future.
    fn block_on<F: std::future::Future>(future: F) -> F::Output {
        let mut future = pin!(future);
        let mut cx = Context::from_waker(Waker::noop());
        loop {
            if let Poll::Ready(output) = future.as_mut().poll(&mut cx) {
                return output;
            }
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
        load_with(source, &FakeSaved::default(), memory, now_ms)
    }

    fn load_with(
        source: &FakeSource,
        saved: &FakeSaved,
        memory: &FakeMemory,
        now_ms: i64,
    ) -> LibrarySnapshot {
        load_library(source, saved, memory, "Brave", "develop", now_ms).unwrap()
    }

    fn titles(snapshot: &LibrarySnapshot) -> Vec<&str> {
        snapshot
            .resources
            .iter()
            .map(|item| item.resource.title.as_str())
            .collect()
    }

    fn new_titles(snapshot: &LibrarySnapshot) -> Vec<&str> {
        snapshot
            .resources
            .iter()
            .filter(|item| item.is_new)
            .map(|item| item.resource.title.as_str())
            .collect()
    }

    fn add(
        source: &FakeSource,
        saved: &FakeSaved,
        title: Option<&'static str>,
        url: &str,
    ) -> Result<Resource, AddLinkError<Infallible, Infallible, Infallible>> {
        add_remembering(source, saved, &FakeMemory::default(), title, url)
    }

    fn add_remembering(
        source: &FakeSource,
        saved: &FakeSaved,
        memory: &FakeMemory,
        title: Option<&'static str>,
        url: &str,
    ) -> Result<Resource, AddLinkError<Infallible, Infallible, Infallible>> {
        block_on(add_link(
            source,
            "develop",
            saved,
            memory,
            &FakePreviews { title },
            &FakeCache::default(),
            url,
            100,
        ))
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

        assert_eq!(titles(&library), ["Motion", "Uiverse"]);
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

        assert_eq!(titles(&library), ["Anime.js", "free-for.dev"]);
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
    fn serializes_items_flat_with_origin_and_is_new() {
        let source = FakeSource::new(vec![bookmark(
            "Motion",
            "https://motion.dev/",
            &["develop"],
        )]);
        let library = load(&source, &FakeMemory::default(), 0);

        let json = serde_json::to_value(&library.resources[0]).unwrap();

        assert_eq!(json["title"], "Motion");
        assert_eq!(json["origin"], "browser");
        assert_eq!(json["isNew"], false);
    }

    #[test]
    fn adding_a_link_fetches_its_title_and_shows_it_as_new() {
        let source = FakeSource::new(vec![bookmark(
            "Motion",
            "https://motion.dev/",
            &["develop"],
        )]);
        let (saved, memory) = (FakeSaved::default(), FakeMemory::default());
        load_with(&source, &saved, &memory, 0);

        let added = add(
            &source,
            &saved,
            Some("Best Portfolio Websites | Web Design Inspiration"),
            "www.awwwards.com/websites/portfolio/",
        )
        .unwrap();

        assert_eq!(
            added.title,
            "Best Portfolio Websites | Web Design Inspiration"
        );
        assert_eq!(added.url, "https://www.awwwards.com/websites/portfolio/");
        assert_eq!(added.category, ResourceCategory::Inspiration);
        assert_eq!(added.origin, ResourceOrigin::DevAtlas);
        let library = load_with(&source, &saved, &memory, 200);
        assert_eq!(
            new_titles(&library),
            ["Best Portfolio Websites | Web Design Inspiration"]
        );
    }

    #[test]
    fn adding_works_offline_using_the_host_as_title() {
        let saved = FakeSaved::default();

        let added = add(
            &FakeSource::new(vec![]),
            &saved,
            None,
            "https://reactdrops.dev",
        )
        .unwrap();

        assert_eq!(added.title, "reactdrops.dev");
        assert_eq!(saved.0.borrow().len(), 1);
    }

    #[test]
    fn adding_rejects_duplicates_and_invalid_urls() {
        let source = FakeSource::new(vec![bookmark(
            "Motion",
            "https://motion.dev/docs",
            &["develop"],
        )]);
        let saved = FakeSaved::default();

        assert!(matches!(
            add(&source, &saved, Some("x"), "https://motion.dev/docs/"),
            Err(AddLinkError::AlreadySaved(title)) if title == "Motion"
        ));
        add(&source, &saved, Some("Awwwards"), "https://awwwards.com/").unwrap();
        assert!(matches!(
            add(&source, &saved, Some("x"), "https://awwwards.com"),
            Err(AddLinkError::AlreadySaved(_))
        ));
        assert!(matches!(
            add(&source, &saved, Some("x"), "javascript:alert(1)"),
            Err(AddLinkError::InvalidUrl)
        ));
        assert!(matches!(
            add(&source, &saved, Some("x"), "   "),
            Err(AddLinkError::InvalidUrl)
        ));
    }

    #[test]
    fn removing_deletes_a_saved_link_and_re_adding_shows_it_as_new() {
        let source = FakeSource::new(vec![bookmark(
            "Motion",
            "https://motion.dev/",
            &["develop"],
        )]);
        let (saved, memory) = (FakeSaved::default(), FakeMemory::default());
        load_with(&source, &saved, &memory, 0);
        add_remembering(
            &source,
            &saved,
            &memory,
            Some("Awwwards"),
            "https://awwwards.com/",
        )
        .unwrap();
        load_with(&source, &saved, &memory, 1);

        assert!(remove_link(&saved, &memory, "awwwards.com").unwrap());
        assert!(saved.0.borrow().is_empty());
        assert_eq!(titles(&load_with(&source, &saved, &memory, 2)), ["Motion"]);

        add_remembering(
            &source,
            &saved,
            &memory,
            Some("Awwwards"),
            "https://awwwards.com/",
        )
        .unwrap();
        assert_eq!(
            new_titles(&load_with(&source, &saved, &memory, 3)),
            ["Awwwards"]
        );
    }

    #[test]
    fn removing_a_browser_bookmark_hides_it_until_it_is_added_again() {
        let source = FakeSource::new(vec![
            bookmark("Motion", "https://motion.dev/", &["develop"]),
            bookmark("Uiverse", "https://uiverse.io/", &["develop"]),
        ]);
        let (saved, memory) = (FakeSaved::default(), FakeMemory::default());
        load_with(&source, &saved, &memory, 0);

        assert!(remove_link(&saved, &memory, "motion.dev").unwrap());
        assert!(!remove_link(&saved, &memory, "motion.dev").unwrap());
        assert_eq!(titles(&load_with(&source, &saved, &memory, 1)), ["Uiverse"]);
        assert_eq!(source.0.borrow().len(), 2, "the browser is never modified");

        let restored =
            add_remembering(&source, &saved, &memory, None, "https://motion.dev").unwrap();
        assert_eq!(restored.title, "Motion");
        assert!(
            saved.0.borrow().is_empty(),
            "nothing is copied into saved links"
        );
        assert_eq!(
            new_titles(&load_with(&source, &saved, &memory, 2)),
            ["Motion"]
        );
        assert!(matches!(
            add_remembering(&source, &saved, &memory, None, "https://motion.dev"),
            Err(AddLinkError::AlreadySaved(_))
        ));
    }

    #[test]
    fn browser_bookmarks_win_over_duplicate_saved_links() {
        let source = FakeSource::new(vec![bookmark(
            "Motion",
            "https://motion.dev/",
            &["develop"],
        )]);
        let saved = FakeSaved(RefCell::new(vec![SavedLink {
            url: "https://motion.dev".to_owned(),
            title: "Saved Motion".to_owned(),
            added_at: 0,
        }]));

        let library = load_with(&source, &saved, &FakeMemory::default(), 0);

        assert_eq!(titles(&library), ["Motion"]);
        assert_eq!(
            library.resources[0].resource.origin,
            ResourceOrigin::Browser
        );
    }
}

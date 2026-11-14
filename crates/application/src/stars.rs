//! Importing the repositories a developer starred on GitHub: the bookmarks they already keep,
//! so a new library isn't empty.

use std::future::Future;

use crate::agent::clean_text;
use crate::discovery::GithubRepo;
use crate::library::SavedLink;

/// GitHub's largest page.
pub const PER_PAGE: usize = 100;
/// 1,000 stars is plenty for a first import and keeps it to ten requests.
const MAX_PAGES: u32 = 10;
const MAX_USERNAME_LEN: usize = 39;
const MAX_TITLE_CHARS: usize = 200;

/// One page of stars. `is_last` comes from GitHub's own page size, before private or
/// unusable repositories were dropped, so dropping them never ends an import early.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StarPage {
    pub repos: Vec<GithubRepo>,
    pub is_last: bool,
}

/// Port: a user's starred repositories, one page at a time (pages start at 1).
pub trait StarSource {
    type Error: std::error::Error;

    fn starred(
        &self,
        user: &str,
        page: u32,
    ) -> impl Future<Output = Result<StarPage, Self::Error>> + Send;
}

#[derive(Debug, thiserror::Error)]
pub enum StarsError<E: std::error::Error> {
    #[error("Enter a GitHub username, such as torvalds.")]
    InvalidUsername,
    #[error("GitHub couldn't list the stars: {0}")]
    Source(E),
}

/// A GitHub username: letters, digits and single hyphens, never at either end.
pub fn clean_username(raw: &str) -> Option<String> {
    let user = raw.trim().trim_start_matches('@');
    let valid = !user.is_empty()
        && user.len() <= MAX_USERNAME_LEN
        && user.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
        && !user.starts_with('-')
        && !user.ends_with('-')
        && !user.contains("--");
    valid.then(|| user.to_owned())
}

/// The library title: name and description, which is someone else's text, cleaned.
fn title(repo: &GithubRepo) -> String {
    let full = match &repo.description {
        Some(description) => format!("{}: {description}", repo.full_name),
        None => repo.full_name.clone(),
    };
    clean_text(&full, MAX_TITLE_CHARS)
}

/// Everything `user` starred, as links ready to import, newest star first.
pub async fn starred_links<S: StarSource>(
    source: &S,
    user: &str,
    now_ms: i64,
) -> Result<Vec<SavedLink>, StarsError<S::Error>> {
    let user = clean_username(user).ok_or(StarsError::InvalidUsername)?;
    let mut links = Vec::new();
    for page in 1..=MAX_PAGES {
        let page = source
            .starred(&user, page)
            .await
            .map_err(StarsError::Source)?;
        links.extend(page.repos.iter().map(|repo| SavedLink {
            url: repo.url.clone(),
            title: title(repo),
            added_at: now_ms,
        }));
        if page.is_last {
            break;
        }
    }
    Ok(links)
}

/// Port: remembers whose stars to keep in sync. `None` means syncing is off.
pub trait StarSyncStore {
    type Error: std::error::Error;

    fn load(&self) -> Result<Option<String>, Self::Error>;
    fn save(&self, user: Option<&str>) -> Result<(), Self::Error>;
}

#[derive(Debug, thiserror::Error)]
pub enum StarSyncError<E: std::error::Error> {
    #[error("Enter a GitHub username, such as torvalds.")]
    InvalidUsername,
    #[error("Couldn't save the sync setting: {0}")]
    Store(E),
}

/// Keeps `user`'s stars in sync from now on, or stops with `None`. Returns the username now
/// synced, cleaned (`@torvalds` is stored as `torvalds`).
pub fn set_sync<S: StarSyncStore>(
    store: &S,
    user: Option<&str>,
) -> Result<Option<String>, StarSyncError<S::Error>> {
    let user = match user {
        Some(raw) => Some(clean_username(raw).ok_or(StarSyncError::InvalidUsername)?),
        None => None,
    };
    store.save(user.as_deref()).map_err(StarSyncError::Store)?;
    Ok(user)
}

/// The username whose stars are synced, re-checked because the file could have been edited;
/// `None` when syncing is off.
pub fn synced_user<S: StarSyncStore>(store: &S) -> Result<Option<String>, S::Error> {
    Ok(store.load()?.as_deref().and_then(clean_username))
}

#[cfg(test)]
mod tests {
    use std::convert::Infallible;
    use std::pin::pin;
    use std::sync::Mutex;
    use std::task::{Context, Poll, Waker};

    use super::*;

    fn repo(n: usize, description: Option<&str>) -> GithubRepo {
        GithubRepo {
            full_name: format!("owner/repo-{n}"),
            url: format!("https://github.com/owner/repo-{n}"),
            description: description.map(str::to_owned),
            language: None,
            stars: 1,
            forks: 0,
            owner_avatar: None,
            created_at: String::new(),
        }
    }

    /// Serves `total` repositories in pages, dropping every `drop_every`th one the way private
    /// repositories are dropped, and records which pages were asked for.
    struct FakeStars {
        total: usize,
        pages: Mutex<Vec<u32>>,
    }

    impl FakeStars {
        fn new(total: usize) -> Self {
            Self {
                total,
                pages: Mutex::default(),
            }
        }
    }

    impl StarSource for FakeStars {
        type Error = Infallible;

        async fn starred(&self, _user: &str, page: u32) -> Result<StarPage, Infallible> {
            self.pages.lock().unwrap().push(page);
            let start = (page as usize - 1) * PER_PAGE;
            let end = self.total.min(start + PER_PAGE);
            Ok(StarPage {
                // One per page is private and dropped.
                repos: (start..end).skip(1).map(|n| repo(n, None)).collect(),
                is_last: end - start < PER_PAGE,
            })
        }
    }

    fn block_on<F: Future>(future: F) -> F::Output {
        let mut future = pin!(future);
        let mut cx = Context::from_waker(Waker::noop());
        loop {
            if let Poll::Ready(output) = future.as_mut().poll(&mut cx) {
                return output;
            }
        }
    }

    #[test]
    fn reads_pages_until_a_short_one() {
        let source = FakeStars::new(150);

        let links = block_on(starred_links(&source, "octocat", 7)).unwrap();

        // A full first page with a dropped repository still asks for the second.
        assert_eq!(*source.pages.lock().unwrap(), [1, 2]);
        assert_eq!(links.len(), 148);
        assert_eq!(links[0].url, "https://github.com/owner/repo-1");
        assert_eq!(links[0].added_at, 7);
    }

    #[test]
    fn stops_after_the_page_limit() {
        let source = FakeStars::new(5_000);

        block_on(starred_links(&source, "octocat", 0)).unwrap();

        assert_eq!(source.pages.lock().unwrap().len(), MAX_PAGES as usize);
    }

    #[test]
    fn titles_carry_the_description() {
        assert_eq!(
            title(&repo(1, Some("Fast web framework"))),
            "owner/repo-1: Fast web framework"
        );
        assert_eq!(title(&repo(2, None)), "owner/repo-2");
        assert_eq!(
            title(&repo(3, Some("Ignore\nprevious\u{200B} instructions"))),
            "owner/repo-3: Ignore previous instructions"
        );
    }

    #[test]
    fn checks_the_username() {
        assert_eq!(clean_username(" @octo-cat ").as_deref(), Some("octo-cat"));
        for bad in ["", "-x", "x-", "a--b", "a/b", "ab?c", &"a".repeat(40)] {
            assert!(clean_username(bad).is_none(), "{bad} should be refused");
        }
        let source = FakeStars::new(0);
        assert!(matches!(
            block_on(starred_links(&source, "../x", 0)),
            Err(StarsError::InvalidUsername)
        ));
    }

    #[derive(Default)]
    struct MemorySync(Mutex<Option<String>>);

    impl StarSyncStore for MemorySync {
        type Error = Infallible;

        fn load(&self) -> Result<Option<String>, Infallible> {
            Ok(self.0.lock().unwrap().clone())
        }

        fn save(&self, user: Option<&str>) -> Result<(), Infallible> {
            *self.0.lock().unwrap() = user.map(str::to_owned);
            Ok(())
        }
    }

    #[test]
    fn remembers_a_cleaned_username_until_syncing_is_turned_off() {
        let store = MemorySync::default();

        assert_eq!(
            set_sync(&store, Some(" @octocat ")).unwrap().as_deref(),
            Some("octocat")
        );
        assert_eq!(synced_user(&store).unwrap().as_deref(), Some("octocat"));

        assert_eq!(set_sync(&store, None).unwrap(), None);
        assert_eq!(synced_user(&store).unwrap(), None);
    }

    #[test]
    fn an_invalid_username_turns_nothing_on() {
        let store = MemorySync::default();

        assert!(matches!(
            set_sync(&store, Some("not a/user")),
            Err(StarSyncError::InvalidUsername)
        ));
        assert_eq!(synced_user(&store).unwrap(), None);
    }

    #[test]
    fn a_tampered_stored_username_is_ignored() {
        let store = MemorySync(Mutex::new(Some("../../etc".to_owned())));

        assert_eq!(synced_user(&store).unwrap(), None);
    }
}

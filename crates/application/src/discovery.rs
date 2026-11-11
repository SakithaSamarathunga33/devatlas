//! Use cases for the Discovery section: repositories gaining stars on GitHub, and details
//! (language, stars, description) for repositories saved in the library.
//!
//! GitHub has no public API for its Trending page, so "trending" here means repositories
//! created within the chosen period, ordered by stars: the usual approximation.

use std::future::Future;

use serde::{Deserialize, Serialize};

const MS_PER_DAY: i64 = 24 * 60 * 60 * 1000;
/// Longest language name accepted, e.g. "Jupyter Notebook".
const MAX_LANGUAGE_LEN: usize = 32;

/// How far back "trending" looks.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TrendingPeriod {
    Day,
    Week,
    Month,
}

impl TrendingPeriod {
    fn days(self) -> i64 {
        match self {
            Self::Day => 1,
            Self::Week => 7,
            Self::Month => 30,
        }
    }
}

/// A GitHub repository as shown in Discovery.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubRepo {
    /// `owner/name`.
    pub full_name: String,
    /// Always a `https://github.com/…` address.
    pub url: String,
    pub description: Option<String>,
    pub language: Option<String>,
    pub stars: u64,
    pub forks: u64,
    pub owner_avatar: Option<String>,
    /// ISO-8601, as GitHub reports it.
    pub created_at: String,
}

/// What to ask the source for: repositories created on or after `created_since`
/// (`YYYY-MM-DD`, UTC), optionally in one language.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TrendingQuery {
    pub created_since: String,
    pub language: Option<String>,
}

/// Port: searches a code host for repositories, most-starred first.
pub trait TrendingSource {
    type Error: std::error::Error;

    fn search(
        &self,
        query: &TrendingQuery,
    ) -> impl Future<Output = Result<Vec<GithubRepo>, Self::Error>> + Send;
}

#[derive(Debug, thiserror::Error)]
pub enum TrendingError<E: std::error::Error> {
    #[error("Choose a programming language from the list.")]
    InvalidLanguage,
    #[error(transparent)]
    Source(E),
}

/// Repositories created within `period` (counted back from `now_ms`), most-starred first.
/// `language` is a GitHub language name such as "Rust"; empty means every language.
pub async fn trending_repos<S: TrendingSource>(
    source: &S,
    period: TrendingPeriod,
    language: Option<&str>,
    now_ms: i64,
) -> Result<Vec<GithubRepo>, TrendingError<S::Error>> {
    let query = TrendingQuery {
        created_since: iso_date(now_ms - period.days() * MS_PER_DAY),
        language: valid_language(language)?,
    };
    source.search(&query).await.map_err(TrendingError::Source)
}

/// Port: looks up one repository by `owner/name`.
pub trait RepoSource {
    type Error: std::error::Error;

    fn repo(&self, full_name: &str)
    -> impl Future<Output = Result<GithubRepo, Self::Error>> + Send;
}

#[derive(Debug, thiserror::Error)]
pub enum RepoError<E: std::error::Error> {
    #[error("\u{201c}{0}\u{201d} is not a GitHub repository name (owner/name).")]
    InvalidName(String),
    #[error(transparent)]
    Source(E),
}

/// Details of the repository `owner/name`, such as one saved in the library.
pub async fn repo_details<S: RepoSource>(
    source: &S,
    full_name: &str,
) -> Result<GithubRepo, RepoError<S::Error>> {
    let full_name = full_name.trim();
    if !is_repo_name(full_name) {
        return Err(RepoError::InvalidName(full_name.to_owned()));
    }
    source.repo(full_name).await.map_err(RepoError::Source)
}

/// GitHub's naming rules: owners are 1–39 letters, digits or hyphens; repository names are
/// 1–100 letters, digits, `.`, `_` or `-`, and never `.` or `..`. Anything else could reach
/// another API path, so it is refused before a request is built.
pub(crate) fn is_repo_name(full_name: &str) -> bool {
    let Some((owner, name)) = full_name.split_once('/') else {
        return false;
    };
    let owner_ok = (1..=39).contains(&owner.len())
        && owner.chars().all(|c| c.is_ascii_alphanumeric() || c == '-');
    let name_ok = (1..=100).contains(&name.len())
        && !matches!(name, "." | "..")
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'));
    owner_ok && name_ok
}

/// Accepts language names made of letters, digits, spaces and `+ # . -` (C++, C#, F#,
/// Jupyter Notebook…), so a value can never smuggle extra search qualifiers or quotes.
fn valid_language<E: std::error::Error>(
    language: Option<&str>,
) -> Result<Option<String>, TrendingError<E>> {
    let Some(language) = language.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    let allowed = |c: char| c.is_ascii_alphanumeric() || matches!(c, ' ' | '+' | '#' | '.' | '-');
    if language.len() > MAX_LANGUAGE_LEN || !language.chars().all(allowed) {
        return Err(TrendingError::InvalidLanguage);
    }
    Ok(Some(language.to_owned()))
}

/// `YYYY-MM-DD` (UTC) for Unix milliseconds, using Howard Hinnant's days-to-civil algorithm
/// so no date crate is needed.
fn iso_date(unix_ms: i64) -> String {
    let days = unix_ms.div_euclid(MS_PER_DAY);
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let day_of_era = z.rem_euclid(146_097);
    let year_of_era =
        (day_of_era - day_of_era / 1_460 + day_of_era / 36_524 - day_of_era / 146_096) / 365;
    let day_of_year = day_of_era - (365 * year_of_era + year_of_era / 4 - year_of_era / 100);
    let shifted_month = (5 * day_of_year + 2) / 153;
    let day = day_of_year - (153 * shifted_month + 2) / 5 + 1;
    let month = if shifted_month < 10 {
        shifted_month + 3
    } else {
        shifted_month - 9
    };
    let year = year_of_era + era * 400 + i64::from(month <= 2);
    format!("{year:04}-{month:02}-{day:02}")
}

#[cfg(test)]
mod tests {
    use std::convert::Infallible;
    use std::pin::pin;
    use std::sync::Mutex;
    use std::task::{Context, Poll, Waker};

    use super::*;

    /// Records the query it was asked and answers with one repository.
    #[derive(Default)]
    struct FakeSource(Mutex<Option<TrendingQuery>>);

    impl FakeSource {
        fn last_query(&self) -> Option<TrendingQuery> {
            self.0.lock().unwrap().clone()
        }
    }

    impl TrendingSource for FakeSource {
        type Error = Infallible;

        async fn search(&self, query: &TrendingQuery) -> Result<Vec<GithubRepo>, Infallible> {
            *self.0.lock().unwrap() = Some(query.clone());
            Ok(vec![GithubRepo {
                full_name: "tauri-apps/tauri".to_owned(),
                url: "https://github.com/tauri-apps/tauri".to_owned(),
                description: None,
                language: Some("Rust".to_owned()),
                stars: 1,
                forks: 0,
                owner_avatar: None,
                created_at: "2026-11-09T10:00:00Z".to_owned(),
            }])
        }
    }

    /// The fake resolves immediately, so a single poll completes the future.
    fn block_on<F: Future>(future: F) -> F::Output {
        let mut future = pin!(future);
        let mut cx = Context::from_waker(Waker::noop());
        loop {
            if let Poll::Ready(output) = future.as_mut().poll(&mut cx) {
                return output;
            }
        }
    }

    /// 2026-11-10T12:00:00Z
    const NOW_MS: i64 = 1_794_312_000_000;

    fn search(
        source: &FakeSource,
        period: TrendingPeriod,
        language: Option<&str>,
    ) -> Result<Vec<GithubRepo>, TrendingError<Infallible>> {
        block_on(trending_repos(source, period, language, NOW_MS))
    }

    #[test]
    fn formats_dates_in_utc() {
        assert_eq!(iso_date(0), "1970-01-01");
        assert_eq!(iso_date(951_782_400_000), "2000-02-29");
        assert_eq!(iso_date(1_700_000_000_000), "2023-11-14");
        assert_eq!(iso_date(NOW_MS), "2026-11-10");
        assert_eq!(iso_date(-MS_PER_DAY), "1969-12-31");
    }

    #[test]
    fn asks_for_repositories_created_within_the_period() {
        let source = FakeSource::default();

        let repos = search(&source, TrendingPeriod::Week, None).unwrap();

        assert_eq!(repos[0].full_name, "tauri-apps/tauri");
        assert_eq!(
            source.last_query(),
            Some(TrendingQuery {
                created_since: "2026-11-03".to_owned(),
                language: None,
            })
        );
        search(&source, TrendingPeriod::Day, None).unwrap();
        assert_eq!(source.last_query().unwrap().created_since, "2026-11-09");
        search(&source, TrendingPeriod::Month, None).unwrap();
        assert_eq!(source.last_query().unwrap().created_since, "2026-10-11");
    }

    #[test]
    fn passes_valid_language_names_through() {
        let source = FakeSource::default();

        for language in ["Rust", "C++", "C#", "Jupyter Notebook", "Objective-C"] {
            search(&source, TrendingPeriod::Day, Some(language)).unwrap();
            assert_eq!(
                source.last_query().unwrap().language.as_deref(),
                Some(language)
            );
        }
        search(&source, TrendingPeriod::Day, Some("  ")).unwrap();
        assert_eq!(source.last_query().unwrap().language, None);
    }

    /// Answers any lookup with a repository named after the request.
    struct FakeRepos;

    impl RepoSource for FakeRepos {
        type Error = Infallible;

        async fn repo(&self, full_name: &str) -> Result<GithubRepo, Infallible> {
            Ok(GithubRepo {
                full_name: full_name.to_owned(),
                url: format!("https://github.com/{full_name}"),
                description: None,
                language: None,
                stars: 0,
                forks: 0,
                owner_avatar: None,
                created_at: "2026-01-01T00:00:00Z".to_owned(),
            })
        }
    }

    #[test]
    fn looks_up_valid_repository_names_only() {
        for name in [
            "tauri-apps/tauri",
            " vercel/next.js ",
            "a/b_c-d.e",
            "x-y/.github",
        ] {
            let repo = block_on(repo_details(&FakeRepos, name)).unwrap();
            assert_eq!(repo.full_name, name.trim());
        }
        for name in [
            "tauri-apps",
            "owner/",
            "/name",
            "owner/name/extra",
            "owner/..",
            "owner/.",
            "own er/name",
            "owner/na?me",
            "../repos",
            &format!("{}/name", "o".repeat(40)),
        ] {
            assert!(
                matches!(
                    block_on(repo_details(&FakeRepos, name)),
                    Err(RepoError::InvalidName(_))
                ),
                "{name} should be refused"
            );
        }
    }

    #[test]
    fn rejects_languages_that_could_inject_search_qualifiers() {
        let source = FakeSource::default();
        let too_long = "x".repeat(MAX_LANGUAGE_LEN + 1);

        for language in ["Rust\" stars:>1", "Rust org:evil", too_long.as_str()] {
            assert!(matches!(
                search(&source, TrendingPeriod::Day, Some(language)),
                Err(TrendingError::InvalidLanguage)
            ));
        }
        assert!(source.last_query().is_none(), "nothing reached the source");
    }
}

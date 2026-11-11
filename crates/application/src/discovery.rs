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

/// How long a release check stays valid; GitHub allows 60 unauthenticated requests an hour.
pub const RELEASE_CHECK_FRESH_MS: i64 = 6 * 60 * 60 * 1000;
/// How far back star growth is measured.
const STAR_WINDOW_DAYS: i64 = 7;

/// A repository's newest published release.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoRelease {
    pub tag: String,
    pub name: Option<String>,
    /// Always a `https://github.com/…` address.
    pub url: String,
    /// ISO-8601, as GitHub reports it.
    pub published_at: String,
}

/// Stars gained over the last `days` days.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StarsGained {
    pub count: i64,
    pub days: i64,
}

/// What changed recently in a repository saved in the library.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RepoActivity {
    pub latest_release: Option<RepoRelease>,
    /// `None` until DevAtlas has an earlier star count to compare with.
    pub stars_gained: Option<StarsGained>,
}

/// Port: looks up a repository's newest release. `None` when it has none.
pub trait ReleaseSource: RepoSource {
    fn latest_release(
        &self,
        full_name: &str,
    ) -> impl Future<Output = Result<Option<RepoRelease>, Self::Error>> + Send;
}

/// Port: remembers release checks and daily star counts between runs.
pub trait RepoHistoryStore {
    type Error: std::error::Error;

    /// When the release was last checked and what was found.
    fn release_check(
        &self,
        full_name: &str,
    ) -> impl Future<Output = Result<Option<(i64, Option<RepoRelease>)>, Self::Error>> + Send;
    fn save_release_check(
        &self,
        full_name: &str,
        checked_at: i64,
        release: Option<&RepoRelease>,
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;
    /// Records the star count for a day, replacing that day's earlier count.
    fn record_stars(
        &self,
        full_name: &str,
        day: i64,
        stars: u64,
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;
    /// The oldest recorded day on or after `earliest_day`, with its star count.
    fn stars_since(
        &self,
        full_name: &str,
        earliest_day: i64,
    ) -> impl Future<Output = Result<Option<(i64, u64)>, Self::Error>> + Send;
}

#[derive(Debug, thiserror::Error)]
pub enum RepoActivityError<S: std::error::Error, H: std::error::Error> {
    #[error("\u{201c}{0}\u{201d} is not a GitHub repository name (owner/name).")]
    InvalidName(String),
    #[error(transparent)]
    Source(S),
    #[error("DevAtlas couldn't read its repository history.")]
    Store(H),
}

/// A saved repository's newest release and recent star growth. Release checks are stored, so
/// restarting DevAtlas doesn't spend GitHub's hourly request limit again.
pub async fn repo_activity<S: ReleaseSource, H: RepoHistoryStore>(
    source: &S,
    history: &H,
    full_name: &str,
    now_ms: i64,
) -> Result<RepoActivity, RepoActivityError<S::Error, H::Error>> {
    let full_name = full_name.trim();
    if !is_repo_name(full_name) {
        return Err(RepoActivityError::InvalidName(full_name.to_owned()));
    }
    let key = full_name.to_ascii_lowercase();
    let repo = source
        .repo(full_name)
        .await
        .map_err(RepoActivityError::Source)?;

    let today = now_ms.div_euclid(MS_PER_DAY);
    let earlier = history
        .stars_since(&key, today - STAR_WINDOW_DAYS)
        .await
        .map_err(RepoActivityError::Store)?
        .filter(|(day, _)| *day < today);
    history
        .record_stars(&key, today, repo.stars)
        .await
        .map_err(RepoActivityError::Store)?;

    let stored = history
        .release_check(&key)
        .await
        .map_err(RepoActivityError::Store)?;
    let latest_release = match stored {
        Some((checked_at, release)) if now_ms - checked_at < RELEASE_CHECK_FRESH_MS => release,
        stale => match source.latest_release(full_name).await {
            Ok(release) => {
                history
                    .save_release_check(&key, now_ms, release.as_ref())
                    .await
                    .map_err(RepoActivityError::Store)?;
                release
            }
            // Usually GitHub's rate limit (the source logs it): show what is already known
            // rather than losing the star growth too.
            Err(_) => stale.and_then(|(_, release)| release),
        },
    };

    let as_signed = |stars: u64| i64::try_from(stars).unwrap_or(i64::MAX);
    Ok(RepoActivity {
        latest_release,
        stars_gained: earlier.map(|(day, stars)| StarsGained {
            count: as_signed(repo.stars).saturating_sub(as_signed(stars)),
            days: today - day,
        }),
    })
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

    /// A repository with a fixed star count and one release; counts the release lookups.
    struct FakeActivity {
        stars: u64,
        release: Option<RepoRelease>,
        lookups: Mutex<u32>,
    }

    impl RepoSource for FakeActivity {
        type Error = Infallible;

        async fn repo(&self, full_name: &str) -> Result<GithubRepo, Infallible> {
            let repo = FakeRepos.repo(full_name).await?;
            Ok(GithubRepo {
                stars: self.stars,
                ..repo
            })
        }
    }

    impl ReleaseSource for FakeActivity {
        async fn latest_release(&self, _: &str) -> Result<Option<RepoRelease>, Infallible> {
            *self.lookups.lock().unwrap() += 1;
            Ok(self.release.clone())
        }
    }

    #[derive(Default)]
    struct FakeHistory {
        check: Mutex<Option<(i64, Option<RepoRelease>)>>,
        stars: Mutex<Vec<(i64, u64)>>,
    }

    impl RepoHistoryStore for FakeHistory {
        type Error = Infallible;

        async fn release_check(
            &self,
            _: &str,
        ) -> Result<Option<(i64, Option<RepoRelease>)>, Infallible> {
            Ok(self.check.lock().unwrap().clone())
        }

        async fn save_release_check(
            &self,
            _: &str,
            checked_at: i64,
            release: Option<&RepoRelease>,
        ) -> Result<(), Infallible> {
            *self.check.lock().unwrap() = Some((checked_at, release.cloned()));
            Ok(())
        }

        async fn record_stars(&self, _: &str, day: i64, stars: u64) -> Result<(), Infallible> {
            let mut rows = self.stars.lock().unwrap();
            rows.retain(|(existing, _)| *existing != day);
            rows.push((day, stars));
            Ok(())
        }

        async fn stars_since(
            &self,
            _: &str,
            earliest_day: i64,
        ) -> Result<Option<(i64, u64)>, Infallible> {
            let rows = self.stars.lock().unwrap();
            Ok(rows
                .iter()
                .filter(|(day, _)| *day >= earliest_day)
                .min_by_key(|(day, _)| *day)
                .copied())
        }
    }

    fn release() -> RepoRelease {
        RepoRelease {
            tag: "v1.2.0".to_owned(),
            name: Some("Big one".to_owned()),
            url: "https://github.com/a/b/releases/tag/v1.2.0".to_owned(),
            published_at: "2026-11-09T10:00:00Z".to_owned(),
        }
    }

    fn activity_source(stars: u64) -> FakeActivity {
        FakeActivity {
            stars,
            release: Some(release()),
            lookups: Mutex::new(0),
        }
    }

    #[test]
    fn reuses_a_recent_release_check_across_restarts() {
        let (source, history) = (activity_source(5), FakeHistory::default());

        let first = block_on(repo_activity(&source, &history, "a/b", NOW_MS)).unwrap();
        let second = block_on(repo_activity(&source, &history, "A/B", NOW_MS + 1_000)).unwrap();

        assert_eq!(first.latest_release, Some(release()));
        assert_eq!(second.latest_release, Some(release()));
        assert_eq!(*source.lookups.lock().unwrap(), 1);
    }

    #[test]
    fn checks_again_once_the_release_check_is_stale() {
        let (source, history) = (activity_source(5), FakeHistory::default());

        block_on(repo_activity(&source, &history, "a/b", NOW_MS)).unwrap();
        block_on(repo_activity(
            &source,
            &history,
            "a/b",
            NOW_MS + RELEASE_CHECK_FRESH_MS + 1,
        ))
        .unwrap();

        assert_eq!(*source.lookups.lock().unwrap(), 2);
    }

    #[test]
    fn remembers_that_a_repository_has_no_releases() {
        let source = FakeActivity {
            stars: 5,
            release: None,
            lookups: Mutex::new(0),
        };
        let history = FakeHistory::default();

        block_on(repo_activity(&source, &history, "a/b", NOW_MS)).unwrap();
        let again = block_on(repo_activity(&source, &history, "a/b", NOW_MS + 1)).unwrap();

        assert_eq!(again.latest_release, None);
        assert_eq!(*source.lookups.lock().unwrap(), 1);
    }

    #[test]
    fn has_no_star_growth_on_the_first_day() {
        let (source, history) = (activity_source(5), FakeHistory::default());

        let activity = block_on(repo_activity(&source, &history, "a/b", NOW_MS)).unwrap();

        assert_eq!(activity.stars_gained, None);
    }

    #[test]
    fn measures_star_growth_from_the_oldest_check_in_the_last_week() {
        let history = FakeHistory::default();
        block_on(repo_activity(
            &activity_source(100),
            &history,
            "a/b",
            NOW_MS,
        ))
        .unwrap();

        let later = NOW_MS + 3 * MS_PER_DAY;
        let activity = block_on(repo_activity(&activity_source(160), &history, "a/b", later));

        assert_eq!(
            activity.unwrap().stars_gained,
            Some(StarsGained { count: 60, days: 3 })
        );
    }

    #[test]
    fn ignores_star_checks_older_than_a_week() {
        let history = FakeHistory::default();
        block_on(repo_activity(
            &activity_source(100),
            &history,
            "a/b",
            NOW_MS,
        ))
        .unwrap();

        let later = NOW_MS + 9 * MS_PER_DAY;
        let activity = block_on(repo_activity(&activity_source(160), &history, "a/b", later));

        assert_eq!(activity.unwrap().stars_gained, None);
    }

    /// Details work but the release lookup is rate-limited.
    struct RateLimitedReleases;

    #[derive(Debug, thiserror::Error)]
    #[error("rate limited")]
    struct RateLimited;

    impl RepoSource for RateLimitedReleases {
        type Error = RateLimited;

        async fn repo(&self, full_name: &str) -> Result<GithubRepo, RateLimited> {
            let repo = FakeRepos.repo(full_name).await.map_err(|_| RateLimited)?;
            Ok(GithubRepo { stars: 160, ..repo })
        }
    }

    impl ReleaseSource for RateLimitedReleases {
        async fn latest_release(&self, _: &str) -> Result<Option<RepoRelease>, RateLimited> {
            Err(RateLimited)
        }
    }

    #[test]
    fn a_failed_release_lookup_keeps_star_growth_and_the_last_known_release() {
        let history = FakeHistory::default();
        block_on(repo_activity(
            &activity_source(100),
            &history,
            "a/b",
            NOW_MS,
        ))
        .unwrap();

        let later = NOW_MS + 3 * MS_PER_DAY;
        let activity = block_on(repo_activity(&RateLimitedReleases, &history, "a/b", later));

        let activity = activity.unwrap();
        assert_eq!(activity.latest_release, Some(release()));
        assert_eq!(
            activity.stars_gained,
            Some(StarsGained { count: 60, days: 3 })
        );
    }

    #[test]
    fn activity_refuses_invalid_repository_names() {
        let (source, history) = (activity_source(5), FakeHistory::default());

        assert!(matches!(
            block_on(repo_activity(&source, &history, "../evil", NOW_MS)),
            Err(RepoActivityError::InvalidName(_))
        ));
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

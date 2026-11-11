//! GitHub REST API client for Discovery: recently created repositories, most-starred first
//! (search), and details of single repositories saved in the library.
//!
//! Talks only to `api.github.com`, sends a token only if the user saved one, follows no redirects, bounds every
//! response in time and size, and caches answers so browsing stays within the
//! unauthenticated limits (10 searches a minute, 60 other requests an hour).

use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard, PoisonError};
use std::time::{Duration, Instant};

use devatlas_application::discovery::{
    GithubRepo, ReleaseSource, RepoRelease, RepoSource, TrendingQuery, TrendingSource,
};
use devatlas_application::stars::{PER_PAGE, StarPage, StarSource};
use reqwest::StatusCode;
use reqwest::header::ACCEPT;
use serde::Deserialize;
use url::Url;

const API_ROOT: &str = "https://api.github.com/";
const SEARCH_URL: &str = "https://api.github.com/search/repositories";
const RESULTS_PER_SEARCH: &str = "30";
const SEARCH_CACHE_FOR: Duration = Duration::from_secs(15 * 60);
const REPO_CACHE_FOR: Duration = Duration::from_secs(60 * 60);
const REQUEST_TIMEOUT: Duration = Duration::from_secs(10);
const CONNECT_TIMEOUT: Duration = Duration::from_secs(5);
const MAX_RESPONSE_BYTES: usize = 2 * 1024 * 1024;
const USER_AGENT: &str = concat!("DevAtlas/", env!("CARGO_PKG_VERSION"));

#[derive(Debug, thiserror::Error)]
pub enum GithubError {
    #[error("GitHub's request limit was reached. Try again in a few minutes.")]
    RateLimited,
    #[error("GitHub has no public repository called \u{201c}{0}\u{201d}.")]
    NotFound(String),
    #[error("GitHub answered with status {0}.")]
    Status(u16),
    #[error("GitHub could not be reached: {0}")]
    Http(#[from] reqwest::Error),
    #[error("GitHub sent an unexpected response: {0}")]
    Format(#[from] serde_json::Error),
    #[error("GitHub's response was larger than expected.")]
    TooLarge,
    #[error(transparent)]
    Url(#[from] url::ParseError),
}

type Cache<T> = Mutex<HashMap<String, (Instant, T)>>;

/// A poisoned lock only means another request panicked; the cached data is still valid.
fn lock<T>(cache: &Cache<T>) -> MutexGuard<'_, HashMap<String, (Instant, T)>> {
    cache.lock().unwrap_or_else(PoisonError::into_inner)
}

fn cached<T: Clone>(cache: &Cache<T>, key: &str, fresh_for: Duration) -> Option<T> {
    lock(cache)
        .get(key)
        .filter(|(fetched_at, _)| fetched_at.elapsed() < fresh_for)
        .map(|(_, value)| value.clone())
}

pub struct GithubApi {
    client: reqwest::Client,
    searches: Cache<Vec<GithubRepo>>,
    repos: Cache<GithubRepo>,
    /// Optional, raises GitHub's limit. Only ever sent to `api.github.com`.
    token: Mutex<Option<String>>,
}

impl GithubApi {
    pub fn new() -> Result<Self, GithubError> {
        let client = reqwest::Client::builder()
            .user_agent(USER_AGENT)
            .timeout(REQUEST_TIMEOUT)
            .connect_timeout(CONNECT_TIMEOUT)
            .redirect(reqwest::redirect::Policy::none())
            .build()?;
        Ok(Self {
            client,
            searches: Mutex::default(),
            repos: Mutex::default(),
            token: Mutex::default(),
        })
    }

    /// Sets or clears the token. Cached answers were fetched with the old one, so they go.
    pub fn set_token(&self, token: Option<String>) {
        *self.token.lock().unwrap_or_else(PoisonError::into_inner) = token;
        lock(&self.searches).clear();
        lock(&self.repos).clear();
    }

    fn token(&self) -> Option<String> {
        self.token
            .lock()
            .unwrap_or_else(PoisonError::into_inner)
            .clone()
    }

    async fn send(&self, url: Url, token: Option<&str>) -> Result<reqwest::Response, GithubError> {
        let request = self
            .client
            .get(url)
            .header(ACCEPT, "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28");
        let request = match token {
            Some(token) => request.bearer_auth(token),
            None => request,
        };
        Ok(request.send().await?)
    }

    /// GETs a GitHub API URL and returns the body, at most `MAX_RESPONSE_BYTES` long.
    async fn get(&self, url: Url) -> Result<Vec<u8>, GithubError> {
        let token = self.token();
        let mut response = self.send(url.clone(), token.as_deref()).await?;
        if response.status() == StatusCode::UNAUTHORIZED && token.is_some() {
            // A revoked or expired token must not break Repos: carry on without it.
            tracing::warn!("GitHub rejected the saved token; continuing without it");
            response = self.send(url, None).await?;
        }
        match response.status() {
            status if status.is_success() => {}
            StatusCode::FORBIDDEN | StatusCode::TOO_MANY_REQUESTS => {
                return Err(GithubError::RateLimited);
            }
            status => return Err(GithubError::Status(status.as_u16())),
        }

        let mut body = Vec::new();
        while let Some(chunk) = response.chunk().await? {
            body.extend_from_slice(&chunk);
            if body.len() > MAX_RESPONSE_BYTES {
                return Err(GithubError::TooLarge);
            }
        }
        Ok(body)
    }
}

impl TrendingSource for GithubApi {
    type Error = GithubError;

    async fn search(&self, query: &TrendingQuery) -> Result<Vec<GithubRepo>, GithubError> {
        let terms = search_terms(query);
        if let Some(repos) = cached(&self.searches, &terms, SEARCH_CACHE_FOR) {
            return Ok(repos);
        }

        let url = Url::parse_with_params(
            SEARCH_URL,
            [
                ("q", terms.as_str()),
                ("sort", "stars"),
                ("order", "desc"),
                ("per_page", RESULTS_PER_SEARCH),
            ],
        )?;
        let repos = parse_search(&self.get(url).await?)?;
        lock(&self.searches).insert(terms, (Instant::now(), repos.clone()));
        Ok(repos)
    }
}

impl RepoSource for GithubApi {
    type Error = GithubError;

    async fn repo(&self, full_name: &str) -> Result<GithubRepo, GithubError> {
        let key = full_name.to_ascii_lowercase();
        if let Some(repo) = cached(&self.repos, &key, REPO_CACHE_FOR) {
            return Ok(repo);
        }

        let not_found = || GithubError::NotFound(full_name.to_owned());
        let body = match self.get(repo_url(full_name)?).await {
            Err(GithubError::Status(404)) => return Err(not_found()),
            other => other?,
        };
        let repo = parse_repo(&body)?.ok_or_else(not_found)?;
        lock(&self.repos).insert(key, (Instant::now(), repo.clone()));
        Ok(repo)
    }
}

impl StarSource for GithubApi {
    type Error = GithubError;

    /// Not cached: an import is a one-off, and must see stars added a minute ago.
    async fn starred(&self, user: &str, page: u32) -> Result<StarPage, GithubError> {
        let mut url = Url::parse(API_ROOT)?;
        // Segments, not string joining: a user name can never add to the path.
        url.path_segments_mut()
            .map_err(|()| GithubError::NotFound(user.to_owned()))?
            .extend(["users", user, "starred"]);
        url.query_pairs_mut()
            .append_pair("per_page", &PER_PAGE.to_string())
            .append_pair("page", &page.to_string());
        let body = match self.get(url).await {
            Err(GithubError::Status(404)) => return Err(GithubError::NotFound(user.to_owned())),
            other => other?,
        };
        let repos = serde_json::from_slice::<Vec<ApiRepo>>(&body)?;
        Ok(StarPage {
            is_last: repos.len() < PER_PAGE,
            repos: repos.into_iter().filter_map(into_repo).collect(),
        })
    }
}

impl ReleaseSource for GithubApi {
    /// Not cached here: the caller stores each check, so it survives restarts.
    async fn latest_release(&self, full_name: &str) -> Result<Option<RepoRelease>, GithubError> {
        match self.get(release_url(full_name)?).await {
            // No release yet, or the repository moved (redirects are not followed).
            Err(GithubError::Status(404 | 301 | 302 | 307 | 308)) => Ok(None),
            Err(error) => {
                tracing::warn!(%error, %full_name, "could not check the latest release");
                Err(error)
            }
            Ok(body) => Ok(parse_release(&body)?),
        }
    }
}

/// `https://api.github.com/repos/{owner}/{name}`. The application layer has validated the
/// name; the parts are still added as encoded path segments, never pasted into the URL.
fn repo_url(full_name: &str) -> Result<Url, GithubError> {
    let (owner, name) = full_name.split_once('/').unwrap_or((full_name, ""));
    let mut url = Url::parse(API_ROOT)?;
    if let Ok(mut segments) = url.path_segments_mut() {
        segments.clear().extend(["repos", owner, name]);
    }
    Ok(url)
}

fn release_url(full_name: &str) -> Result<Url, GithubError> {
    let mut url = repo_url(full_name)?;
    if let Ok(mut segments) = url.path_segments_mut() {
        segments.extend(["releases", "latest"]);
    }
    Ok(url)
}

#[derive(Deserialize)]
struct ApiRelease {
    tag_name: String,
    name: Option<String>,
    html_url: String,
    published_at: Option<String>,
}

/// One API release, or `None` when unpublished or its link does not point at GitHub: this is
/// external data, and the UI opens these links.
fn parse_release(body: &[u8]) -> Result<Option<RepoRelease>, serde_json::Error> {
    let release: ApiRelease = serde_json::from_slice(body)?;
    if !release.html_url.starts_with("https://github.com/") {
        return Ok(None);
    }
    Ok(release.published_at.map(|published_at| RepoRelease {
        tag: release.tag_name,
        name: release
            .name
            .map(|name| name.trim().to_owned())
            .filter(|name| !name.is_empty()),
        url: release.html_url,
        published_at,
    }))
}

/// The `q` parameter. The application layer has already restricted `language` to
/// characters that cannot close the quotes or add qualifiers.
fn search_terms(query: &TrendingQuery) -> String {
    let created = format!("created:>={}", query.created_since);
    match &query.language {
        Some(language) => format!("{created} language:\"{language}\""),
        None => created,
    }
}

#[derive(Deserialize)]
struct SearchResponse {
    items: Vec<ApiRepo>,
}

#[derive(Deserialize)]
struct ApiRepo {
    full_name: String,
    html_url: String,
    description: Option<String>,
    language: Option<String>,
    stargazers_count: u64,
    forks_count: u64,
    created_at: String,
    owner: Option<ApiOwner>,
    #[serde(default)]
    private: bool,
}

#[derive(Deserialize)]
struct ApiOwner {
    avatar_url: Option<String>,
}

/// Maps one API repository, or `None` when its link does not point at GitHub over https:
/// this is external data, and the UI opens these links. Private repositories are dropped too:
/// a token can see them, and their details must not be stored or shown as public.
fn into_repo(repo: ApiRepo) -> Option<GithubRepo> {
    if repo.private || !repo.html_url.starts_with("https://github.com/") {
        return None;
    }
    Some(GithubRepo {
        full_name: repo.full_name,
        url: repo.html_url,
        description: repo
            .description
            .map(|text| text.trim().to_owned())
            .filter(|text| !text.is_empty()),
        language: repo.language,
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        owner_avatar: repo
            .owner
            .and_then(|owner| owner.avatar_url)
            .filter(|avatar| avatar.starts_with("https://")),
        created_at: repo.created_at,
    })
}

fn parse_search(body: &[u8]) -> Result<Vec<GithubRepo>, serde_json::Error> {
    let response: SearchResponse = serde_json::from_slice(body)?;
    Ok(response.items.into_iter().filter_map(into_repo).collect())
}

fn parse_repo(body: &[u8]) -> Result<Option<GithubRepo>, serde_json::Error> {
    Ok(into_repo(serde_json::from_slice(body)?))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_the_search_terms() {
        let mut query = TrendingQuery {
            created_since: "2026-11-03".to_owned(),
            language: None,
        };
        assert_eq!(search_terms(&query), "created:>=2026-11-03");

        query.language = Some("Jupyter Notebook".to_owned());
        assert_eq!(
            search_terms(&query),
            "created:>=2026-11-03 language:\"Jupyter Notebook\""
        );
    }

    #[test]
    fn parses_repositories_and_drops_unsafe_links() {
        let body = br#"{
          "total_count": 3,
          "items": [
            {
              "full_name": "tauri-apps/tauri",
              "html_url": "https://github.com/tauri-apps/tauri",
              "description": "  Build smaller, faster apps.  ",
              "language": "Rust",
              "stargazers_count": 1234,
              "forks_count": 56,
              "created_at": "2026-11-05T10:00:00Z",
              "owner": { "avatar_url": "https://avatars.githubusercontent.com/u/1" }
            },
            {
              "full_name": "someone/empty",
              "html_url": "https://github.com/someone/empty",
              "description": "",
              "language": null,
              "stargazers_count": 7,
              "forks_count": 0,
              "created_at": "2026-11-06T10:00:00Z",
              "owner": { "avatar_url": "http://insecure.example/a.png" }
            },
            {
              "full_name": "evil/redirect",
              "html_url": "javascript:alert(1)",
              "description": null,
              "language": null,
              "stargazers_count": 1,
              "forks_count": 0,
              "created_at": "2026-11-07T10:00:00Z",
              "owner": null
            }
          ]
        }"#;

        let repos = parse_search(body).unwrap();

        assert_eq!(repos.len(), 2);
        assert_eq!(
            repos[0],
            GithubRepo {
                full_name: "tauri-apps/tauri".to_owned(),
                url: "https://github.com/tauri-apps/tauri".to_owned(),
                description: Some("Build smaller, faster apps.".to_owned()),
                language: Some("Rust".to_owned()),
                stars: 1234,
                forks: 56,
                owner_avatar: Some("https://avatars.githubusercontent.com/u/1".to_owned()),
                created_at: "2026-11-05T10:00:00Z".to_owned(),
            }
        );
        assert_eq!(repos[1].description, None);
        assert_eq!(repos[1].owner_avatar, None);
    }

    #[test]
    fn builds_repository_urls_from_encoded_segments() {
        assert_eq!(
            repo_url("vercel/next.js").unwrap().as_str(),
            "https://api.github.com/repos/vercel/next.js"
        );
    }

    #[test]
    fn parses_a_single_repository() {
        let body = br#"{
          "full_name": "harry0703/MoneyPrinterTurbo",
          "html_url": "https://github.com/harry0703/MoneyPrinterTurbo",
          "description": "Generate short videos with AI.",
          "language": "Python",
          "stargazers_count": 40000,
          "forks_count": 5000,
          "created_at": "2024-03-11T00:00:00Z",
          "owner": { "avatar_url": "https://avatars.githubusercontent.com/u/2" }
        }"#;
        let off_github = br#"{
          "full_name": "a/b", "html_url": "http://elsewhere.example/a/b",
          "description": null, "language": null, "stargazers_count": 0,
          "forks_count": 0, "created_at": "2024-01-01T00:00:00Z", "owner": null
        }"#;

        let repo = parse_repo(body).unwrap().unwrap();

        assert_eq!(repo.full_name, "harry0703/MoneyPrinterTurbo");
        assert_eq!(repo.language.as_deref(), Some("Python"));
        assert_eq!(repo.stars, 40000);
        assert!(parse_repo(off_github).unwrap().is_none());
    }

    #[test]
    fn builds_release_urls_from_encoded_segments() {
        assert_eq!(
            release_url("vercel/next.js").unwrap().as_str(),
            "https://api.github.com/repos/vercel/next.js/releases/latest"
        );
    }

    #[test]
    fn parses_a_release_and_drops_unsafe_or_unpublished_ones() {
        let body = br#"{
          "tag_name": "v1.2.0", "name": "  Big one  ",
          "html_url": "https://github.com/a/b/releases/tag/v1.2.0",
          "published_at": "2026-11-09T10:00:00Z"
        }"#;
        let unnamed = br#"{
          "tag_name": "v2", "name": "   ",
          "html_url": "https://github.com/a/b/releases/tag/v2",
          "published_at": "2026-11-09T10:00:00Z"
        }"#;
        let off_github = br#"{
          "tag_name": "v1", "name": null, "html_url": "javascript:alert(1)",
          "published_at": "2026-11-09T10:00:00Z"
        }"#;
        let unpublished = br#"{
          "tag_name": "v1", "name": null,
          "html_url": "https://github.com/a/b/releases/tag/v1", "published_at": null
        }"#;

        let release = parse_release(body).unwrap().unwrap();

        assert_eq!(release.tag, "v1.2.0");
        assert_eq!(release.name.as_deref(), Some("Big one"));
        assert_eq!(parse_release(unnamed).unwrap().unwrap().name, None);
        assert!(parse_release(off_github).unwrap().is_none());
        assert!(parse_release(unpublished).unwrap().is_none());
    }

    #[test]
    fn never_shows_private_repositories_a_token_can_see() {
        let body = br#"{
          "full_name": "me/secret", "html_url": "https://github.com/me/secret",
          "description": null, "language": null, "stargazers_count": 0, "forks_count": 0,
          "created_at": "2024-01-01T00:00:00Z", "owner": null, "private": true
        }"#;

        assert!(parse_repo(body).unwrap().is_none());
    }

    #[test]
    fn changing_the_token_clears_answers_fetched_with_the_old_one() {
        let api = GithubApi::new().unwrap();
        lock(&api.searches).insert("q".to_owned(), (Instant::now(), Vec::new()));

        api.set_token(Some("abc".to_owned()));

        assert!(lock(&api.searches).is_empty());
        assert_eq!(api.token().as_deref(), Some("abc"));
    }

    #[test]
    fn reports_malformed_responses() {
        assert!(parse_search(b"{ \"message\": \"Bad credentials\" }").is_err());
    }
}

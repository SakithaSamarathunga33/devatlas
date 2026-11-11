use devatlas_application::discovery::{self, GithubRepo, RepoActivity, TrendingPeriod};
use devatlas_storage::github::{GithubApi, GithubError};
use tauri::State;

use super::library::now_ms;
use super::organizer::Organizer;

/// The GitHub API client and its caches, created once at startup.
pub struct Discovery {
    github: GithubApi,
}

impl Discovery {
    pub fn new() -> Result<Self, GithubError> {
        Ok(Self {
            github: GithubApi::new()?,
        })
    }

    pub(super) fn github(&self) -> &GithubApi {
        &self.github
    }

    /// Sets or clears the token used for GitHub requests.
    pub fn set_github_token(&self, token: Option<String>) {
        self.github.set_token(token);
    }
}

/// Repositories created within `period` that have the most stars, optionally in one language.
#[tauri::command]
pub async fn list_trending_repos(
    period: TrendingPeriod,
    language: Option<String>,
    discovery: State<'_, Discovery>,
) -> Result<Vec<GithubRepo>, String> {
    discovery::trending_repos(&discovery.github, period, language.as_deref(), now_ms())
        .await
        .map_err(|error| {
            tracing::warn!(%error, "could not load trending repositories");
            error.to_string()
        })
}

/// Language, stars and description of one repository, such as one saved in the library.
#[tauri::command]
pub async fn get_github_repo(
    full_name: String,
    discovery: State<'_, Discovery>,
) -> Result<GithubRepo, String> {
    discovery::repo_details(&discovery.github, &full_name)
        .await
        .map_err(|error| {
            tracing::debug!(%error, %full_name, "repository details unavailable");
            error.to_string()
        })
}

/// A saved repository's newest release and recent star growth.
#[tauri::command]
pub async fn get_repo_activity(
    full_name: String,
    discovery: State<'_, Discovery>,
    organizer: State<'_, Organizer>,
) -> Result<RepoActivity, String> {
    discovery::repo_activity(
        &discovery.github,
        organizer.database()?,
        &full_name,
        now_ms(),
    )
    .await
    .map_err(|error| {
        tracing::debug!(?error, %full_name, "repository activity unavailable");
        error.to_string()
    })
}

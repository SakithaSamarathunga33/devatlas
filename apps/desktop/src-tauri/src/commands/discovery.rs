use devatlas_application::discovery::{self, GithubRepo, TrendingPeriod};
use devatlas_storage::github::{GithubApi, GithubError};
use tauri::State;

use super::library::now_ms;

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

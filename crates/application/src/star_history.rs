//! Use case: GitHub repositories as ranked by star-history.com: the biggest weekly gainers,
//! the most-starred of all time, a pool to draw random picks from, and how stars are
//! distributed across all repositories.

use std::future::Future;

use serde::Serialize;

use crate::discovery::is_repo_name;

/// Longest ranked list kept; the site publishes 20.
const MAX_RANKED: usize = 100;
/// Largest random pool kept; the site publishes about 13,000.
const MAX_RANDOM_POOL: usize = 20_000;

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StarRepo {
    /// `owner/name`.
    pub full_name: String,
    pub stars: u64,
    /// Stars gained in the week; weekly ranking only.
    pub new_stars: Option<u64>,
    /// Places moved since last week; `None` means new to the ranking.
    pub rank_change: Option<i32>,
}

/// How many repositories have at least `threshold` stars.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StarTier {
    pub threshold: u64,
    pub label: String,
    pub count: u64,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StarBoards {
    pub weekly: Vec<StarRepo>,
    /// The week covered, e.g. "Nov 3, 2026 – Nov 9, 2026".
    pub weekly_period: Option<String>,
    pub all_time: Vec<StarRepo>,
    pub all_time_updated: Option<String>,
    pub random_pool: Vec<StarRepo>,
    pub pyramid: Vec<StarTier>,
    pub pyramid_updated: Option<String>,
}

/// Port: reads the published rankings.
pub trait StarBoardSource {
    type Error: std::error::Error;

    fn boards(&self) -> impl Future<Output = Result<StarBoards, Self::Error>> + Send;
}

/// The rankings, keeping only entries that are real GitHub repository names: this is
/// external data, and the UI builds links from it.
pub async fn star_boards<S: StarBoardSource>(source: &S) -> Result<StarBoards, S::Error> {
    source.boards().await.map(clean)
}

fn clean(boards: StarBoards) -> StarBoards {
    StarBoards {
        weekly: valid(boards.weekly, MAX_RANKED),
        all_time: valid(boards.all_time, MAX_RANKED),
        random_pool: valid(boards.random_pool, MAX_RANDOM_POOL),
        ..boards
    }
}

fn valid(repos: Vec<StarRepo>, limit: usize) -> Vec<StarRepo> {
    repos
        .into_iter()
        .filter(|repo| is_repo_name(&repo.full_name))
        .take(limit)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn repo(full_name: &str) -> StarRepo {
        StarRepo {
            full_name: full_name.to_owned(),
            stars: 10,
            new_stars: None,
            rank_change: None,
        }
    }

    fn boards(weekly: Vec<StarRepo>) -> StarBoards {
        StarBoards {
            weekly,
            weekly_period: None,
            all_time: vec![repo("tauri-apps/tauri"), repo("not a repo")],
            all_time_updated: None,
            random_pool: vec![repo("../secrets"), repo("vercel/next.js")],
            pyramid: Vec::new(),
            pyramid_updated: None,
        }
    }

    #[test]
    fn drops_names_that_are_not_github_repositories() {
        let cleaned = clean(boards(vec![repo("javascript:alert(1)"), repo("a/b")]));

        assert_eq!(cleaned.weekly, vec![repo("a/b")]);
        assert_eq!(cleaned.all_time, vec![repo("tauri-apps/tauri")]);
        assert_eq!(cleaned.random_pool, vec![repo("vercel/next.js")]);
    }

    #[test]
    fn caps_ranked_lists() {
        let many = (0..MAX_RANKED + 5).map(|_| repo("a/b")).collect();

        assert_eq!(clean(boards(many)).weekly.len(), MAX_RANKED);
    }
}

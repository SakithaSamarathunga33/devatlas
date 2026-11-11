//! Finds saved links that have died or moved.

use std::collections::HashMap;
use std::future::Future;

use serde::Serialize;

/// Most links checked in one run.
const MAX_LINKS: usize = 5_000;

/// The result of checking one link.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum LinkHealth {
    Ok,
    /// The page is gone: 404, 410, or the domain no longer exists.
    Broken,
    /// It now redirects to a different site.
    Moved,
    /// Inconclusive: login walls, rate limits, timeouts and server errors say nothing about
    /// whether the page still exists.
    Unknown,
}

impl LinkHealth {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Ok => "ok",
            Self::Broken => "broken",
            Self::Moved => "moved",
            Self::Unknown => "unknown",
        }
    }

    pub fn parse(text: &str) -> Option<Self> {
        [Self::Ok, Self::Broken, Self::Moved, Self::Unknown]
            .into_iter()
            .find(|health| health.as_str() == text)
    }
}

pub type LinkHealthMap = HashMap<String, LinkHealth>;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LinkCheckSummary {
    pub checked: usize,
    pub broken: usize,
    pub moved: usize,
    pub unknown: usize,
}

/// Port: checks links over the network.
pub trait LinkChecker {
    /// Whether the internet is reachable at all; without it every link would look dead.
    fn online(&self) -> impl Future<Output = bool> + Send;
    /// One result per URL, in order.
    fn check_all(&self, urls: &[String]) -> impl Future<Output = Vec<LinkHealth>> + Send;
}

/// Port: remembers the last verdict per link.
pub trait LinkHealthStore {
    type Error: std::error::Error;

    fn link_health(&self) -> impl Future<Output = Result<LinkHealthMap, Self::Error>> + Send;
    fn save_link_health(
        &self,
        results: &[(String, LinkHealth)],
        checked_at: i64,
    ) -> impl Future<Output = Result<(), Self::Error>> + Send;
}

#[derive(Debug, thiserror::Error)]
pub enum LinkCheckError<E: std::error::Error> {
    #[error("You seem to be offline, so links can't be checked right now.")]
    Offline,
    #[error("DevAtlas couldn't save the results. Please try again.")]
    Store(E),
}

/// Checks `(id, url)` pairs and stores the conclusive results; an inconclusive one keeps the
/// link's previous verdict.
pub async fn check_links<C: LinkChecker, S: LinkHealthStore>(
    checker: &C,
    store: &S,
    links: Vec<(String, String)>,
    now_ms: i64,
) -> Result<LinkCheckSummary, LinkCheckError<S::Error>> {
    if !checker.online().await {
        return Err(LinkCheckError::Offline);
    }
    let links: Vec<(String, String)> = links.into_iter().take(MAX_LINKS).collect();
    let urls: Vec<String> = links.iter().map(|(_, url)| url.clone()).collect();
    let results = checker.check_all(&urls).await;

    let count = |wanted: LinkHealth| results.iter().filter(|health| **health == wanted).count();
    let summary = LinkCheckSummary {
        checked: results.len(),
        broken: count(LinkHealth::Broken),
        moved: count(LinkHealth::Moved),
        unknown: count(LinkHealth::Unknown),
    };
    let conclusive: Vec<(String, LinkHealth)> = links
        .into_iter()
        .zip(results)
        .filter(|(_, health)| *health != LinkHealth::Unknown)
        .map(|((id, _), health)| (id, health))
        .collect();
    store
        .save_link_health(&conclusive, now_ms)
        .await
        .map_err(LinkCheckError::Store)?;
    Ok(summary)
}

#[cfg(test)]
mod tests {
    use std::convert::Infallible;
    use std::pin::pin;
    use std::sync::Mutex;
    use std::task::{Context, Poll, Waker};

    use super::*;

    fn block_on<F: Future>(future: F) -> F::Output {
        let mut future = pin!(future);
        let mut cx = Context::from_waker(Waker::noop());
        loop {
            if let Poll::Ready(output) = future.as_mut().poll(&mut cx) {
                return output;
            }
        }
    }

    struct FakeChecker {
        online: bool,
    }

    impl LinkChecker for FakeChecker {
        async fn online(&self) -> bool {
            self.online
        }

        async fn check_all(&self, urls: &[String]) -> Vec<LinkHealth> {
            urls.iter()
                .map(|url| {
                    if url.contains("gone") {
                        LinkHealth::Broken
                    } else if url.contains("flaky") {
                        LinkHealth::Unknown
                    } else {
                        LinkHealth::Ok
                    }
                })
                .collect()
        }
    }

    #[derive(Default)]
    struct FakeStore(Mutex<Vec<(String, LinkHealth)>>);

    impl LinkHealthStore for FakeStore {
        type Error = Infallible;

        async fn link_health(&self) -> Result<LinkHealthMap, Infallible> {
            Ok(self.0.lock().unwrap().iter().cloned().collect())
        }

        async fn save_link_health(
            &self,
            results: &[(String, LinkHealth)],
            _checked_at: i64,
        ) -> Result<(), Infallible> {
            self.0.lock().unwrap().extend_from_slice(results);
            Ok(())
        }
    }

    fn links() -> Vec<(String, String)> {
        vec![
            ("ok".to_owned(), "https://ok.example".to_owned()),
            ("gone".to_owned(), "https://gone.example".to_owned()),
            ("flaky".to_owned(), "https://flaky.example".to_owned()),
        ]
    }

    #[test]
    fn counts_results_and_stores_conclusive_ones_only() {
        let store = FakeStore::default();

        let summary = block_on(check_links(
            &FakeChecker { online: true },
            &store,
            links(),
            1,
        ))
        .unwrap();

        assert_eq!(
            summary,
            LinkCheckSummary {
                checked: 3,
                broken: 1,
                moved: 0,
                unknown: 1
            }
        );
        let saved = store.0.lock().unwrap();
        assert_eq!(saved.len(), 2, "unknown results keep the previous verdict");
    }

    #[test]
    fn refuses_to_judge_links_while_offline() {
        let store = FakeStore::default();

        let result = block_on(check_links(
            &FakeChecker { online: false },
            &store,
            links(),
            1,
        ));

        assert!(matches!(result, Err(LinkCheckError::Offline)));
        assert!(store.0.lock().unwrap().is_empty());
    }
}

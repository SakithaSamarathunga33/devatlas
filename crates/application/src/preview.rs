//! Use case: preview images for a resource, fetched once and then served from a cache.

use std::future::Future;

use devatlas_domain::resource::normalize_url;
use serde::{Deserialize, Serialize};
use url::Url;

/// Images that represent a web page.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResourcePreview {
    /// Social preview image (`og:image` / `twitter:image`), if the page declares one.
    pub image: Option<String>,
    /// Best available site icon.
    pub icon: Option<String>,
}

/// Port: fetches preview metadata for a public web page.
pub trait PreviewSource {
    type Error: std::error::Error;

    fn fetch(&self, url: &Url)
    -> impl Future<Output = Result<ResourcePreview, Self::Error>> + Send;
}

/// Port: remembers previews between runs.
pub trait PreviewCache {
    fn get(&self, url: &str) -> Option<ResourcePreview>;
    fn put(&self, url: &str, preview: ResourcePreview);
}

#[derive(Debug, thiserror::Error)]
pub enum PreviewError<E: std::error::Error> {
    #[error("Only http and https links have previews.")]
    UnsupportedUrl,
    #[error("The site could not be reached: {0}")]
    Fetch(#[source] E),
}

/// Returns the cached preview for `raw_url`, fetching and caching it on first use.
/// Fetch failures are not cached, so an offline site is retried next time.
pub async fn get_preview<S: PreviewSource, C: PreviewCache>(
    source: &S,
    cache: &C,
    raw_url: &str,
) -> Result<ResourcePreview, PreviewError<S::Error>> {
    let url = normalize_url(raw_url).ok_or(PreviewError::UnsupportedUrl)?;
    if let Some(cached) = cache.get(url.as_str()) {
        return Ok(cached);
    }
    let preview = source.fetch(&url).await.map_err(PreviewError::Fetch)?;
    cache.put(url.as_str(), preview.clone());
    Ok(preview)
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::pin::pin;
    use std::sync::Mutex;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::task::{Context, Poll, Waker};

    use super::*;

    #[derive(Debug, thiserror::Error)]
    #[error("offline")]
    struct Offline;

    struct FakeSource {
        calls: AtomicUsize,
        online: bool,
    }

    impl PreviewSource for FakeSource {
        type Error = Offline;

        async fn fetch(&self, url: &Url) -> Result<ResourcePreview, Offline> {
            self.calls.fetch_add(1, Ordering::SeqCst);
            if !self.online {
                return Err(Offline);
            }
            Ok(ResourcePreview {
                image: Some(format!("{url}og.png")),
                icon: None,
            })
        }
    }

    #[derive(Default)]
    struct FakeCache(Mutex<HashMap<String, ResourcePreview>>);

    impl PreviewCache for FakeCache {
        fn get(&self, url: &str) -> Option<ResourcePreview> {
            self.0.lock().unwrap().get(url).cloned()
        }

        fn put(&self, url: &str, preview: ResourcePreview) {
            self.0.lock().unwrap().insert(url.to_owned(), preview);
        }
    }

    /// The fakes resolve immediately, so a single poll completes the future.
    fn block_on<F: Future>(future: F) -> F::Output {
        let mut future = pin!(future);
        let mut cx = Context::from_waker(Waker::noop());
        loop {
            if let Poll::Ready(output) = future.as_mut().poll(&mut cx) {
                return output;
            }
        }
    }

    fn source(online: bool) -> FakeSource {
        FakeSource {
            calls: AtomicUsize::new(0),
            online,
        }
    }

    #[test]
    fn fetches_once_then_serves_from_cache() {
        let (source, cache) = (source(true), FakeCache::default());

        let first = block_on(get_preview(&source, &cache, "https://newtab@motion.dev/")).unwrap();
        let second = block_on(get_preview(&source, &cache, "https://motion.dev/")).unwrap();

        assert_eq!(first.image.as_deref(), Some("https://motion.dev/og.png"));
        assert_eq!(first, second);
        assert_eq!(source.calls.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn rejects_non_web_urls_without_fetching() {
        let (source, cache) = (source(true), FakeCache::default());

        let result = block_on(get_preview(&source, &cache, "javascript:alert(1)"));

        assert!(matches!(result, Err(PreviewError::UnsupportedUrl)));
        assert_eq!(source.calls.load(Ordering::SeqCst), 0);
    }

    #[test]
    fn does_not_cache_failures() {
        let (source, cache) = (source(false), FakeCache::default());

        let result = block_on(get_preview(&source, &cache, "https://motion.dev/"));

        assert!(matches!(result, Err(PreviewError::Fetch(Offline))));
        assert!(cache.get("https://motion.dev/").is_none());
    }
}

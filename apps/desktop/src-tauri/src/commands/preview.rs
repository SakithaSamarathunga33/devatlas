use std::path::PathBuf;

use devatlas_application::preview::{self, ResourcePreview};
use devatlas_storage::preview_cache::JsonPreviewCache;
use devatlas_storage::web_preview::{WebPreviewError, WebPreviewFetcher};
use tauri::State;

/// Preview fetching and caching, created once at startup and shared by all commands.
pub struct Previews {
    fetcher: WebPreviewFetcher,
    cache: JsonPreviewCache,
}

impl Previews {
    pub fn new(cache_file: PathBuf) -> Result<Self, WebPreviewError> {
        Ok(Self {
            fetcher: WebPreviewFetcher::new()?,
            cache: JsonPreviewCache::open(cache_file),
        })
    }
}

/// Preview image and icon for a resource; fetched once, then served from the local cache.
#[tauri::command]
pub async fn get_resource_preview(
    url: String,
    previews: State<'_, Previews>,
) -> Result<ResourcePreview, String> {
    preview::get_preview(&previews.fetcher, &previews.cache, &url)
        .await
        .map_err(|error| {
            tracing::debug!(%error, %url, "preview unavailable");
            error.to_string()
        })
}

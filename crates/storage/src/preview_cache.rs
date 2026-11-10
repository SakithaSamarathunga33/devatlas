//! Preview cache persisted as a small JSON file in the app cache directory.

use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard, PoisonError};

use devatlas_application::preview::{PreviewCache, ResourcePreview};

pub struct JsonPreviewCache {
    path: PathBuf,
    entries: Mutex<HashMap<String, ResourcePreview>>,
}

impl JsonPreviewCache {
    /// Loads existing entries; a missing or unreadable file starts an empty cache.
    pub fn open(path: PathBuf) -> Self {
        let entries = std::fs::read(&path)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or_default();
        Self {
            path,
            entries: Mutex::new(entries),
        }
    }

    fn entries(&self) -> MutexGuard<'_, HashMap<String, ResourcePreview>> {
        self.entries.lock().unwrap_or_else(PoisonError::into_inner)
    }
}

impl PreviewCache for JsonPreviewCache {
    fn get(&self, url: &str) -> Option<ResourcePreview> {
        self.entries().get(url).cloned()
    }

    fn put(&self, url: &str, preview: ResourcePreview) {
        let mut entries = self.entries();
        entries.insert(url.to_owned(), preview);
        // ponytail: rewrites the whole file per entry while holding the lock; fine for
        // hundreds of links, batch the writes if libraries grow into the thousands.
        let written = serde_json::to_vec(&*entries)
            .map_err(std::io::Error::other)
            .and_then(|bytes| {
                if let Some(dir) = self.path.parent() {
                    std::fs::create_dir_all(dir)?;
                }
                std::fs::write(&self.path, bytes)
            });
        if let Err(error) = written {
            tracing::warn!(%error, path = %self.path.display(), "could not persist the preview cache");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_file(name: &str) -> PathBuf {
        std::env::temp_dir()
            .join(format!("devatlas-test-{}", std::process::id()))
            .join(name)
    }

    #[test]
    fn persists_entries_across_instances() {
        let path = temp_file("previews.json");
        let preview = ResourcePreview {
            image: Some("https://motion.dev/og.png".to_owned()),
            icon: None,
        };

        JsonPreviewCache::open(path.clone()).put("https://motion.dev/", preview.clone());
        let reopened = JsonPreviewCache::open(path.clone());

        assert_eq!(reopened.get("https://motion.dev/"), Some(preview));
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn starts_empty_when_the_file_is_missing_or_corrupt() {
        let missing = JsonPreviewCache::open(temp_file("missing.json"));
        assert_eq!(missing.get("https://motion.dev/"), None);

        let corrupt_path = temp_file("corrupt.json");
        std::fs::create_dir_all(corrupt_path.parent().unwrap()).unwrap();
        std::fs::write(&corrupt_path, "not json").unwrap();
        assert_eq!(JsonPreviewCache::open(corrupt_path.clone()).get("x"), None);
        std::fs::remove_file(corrupt_path).unwrap();
    }
}

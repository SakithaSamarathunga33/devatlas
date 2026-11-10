//! Links saved directly in DevAtlas, as a JSON file in the app data dir.

use std::path::PathBuf;

use devatlas_application::library::{SavedLink, SavedLinkStore};

use crate::json_file::{self, JsonFileError};

pub struct JsonSavedLinks {
    path: PathBuf,
}

impl JsonSavedLinks {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

impl SavedLinkStore for JsonSavedLinks {
    type Error = JsonFileError;

    fn load(&self) -> Result<Vec<SavedLink>, JsonFileError> {
        Ok(json_file::read(&self.path)?.unwrap_or_default())
    }

    fn save(&self, links: &[SavedLink]) -> Result<(), JsonFileError> {
        json_file::write(&self.path, links)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starts_empty_and_round_trips_links() {
        let path = std::env::temp_dir()
            .join(format!("devatlas-saved-test-{}", std::process::id()))
            .join("saved-links.json");
        let store = JsonSavedLinks::new(path.clone());
        assert!(store.load().unwrap().is_empty());

        let links = [SavedLink {
            url: "https://www.awwwards.com/websites/portfolio/".to_owned(),
            title: "Best Portfolio Websites".to_owned(),
            added_at: 1,
        }];
        store.save(&links).unwrap();

        assert_eq!(store.load().unwrap(), links);
        std::fs::remove_file(path).unwrap();
    }
}

//! Which published Community collection belongs to which local collection, as a small JSON
//! file in the app data dir. No file means nothing was shared from this computer.

use std::collections::HashMap;
use std::path::PathBuf;

use devatlas_application::community::ShareStore;

use crate::json_file::{self, JsonFileError};

pub struct JsonShares {
    path: PathBuf,
}

impl JsonShares {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

impl ShareStore for JsonShares {
    type Error = JsonFileError;

    fn load(&self) -> Result<HashMap<String, String>, JsonFileError> {
        Ok(json_file::read(&self.path)?.unwrap_or_default())
    }

    fn save(&self, shares: &HashMap<String, String>) -> Result<(), JsonFileError> {
        json_file::write(&self.path, shares)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn remembers_shared_collections() {
        let dir = std::env::temp_dir().join(format!("devatlas-shares-{}", std::process::id()));
        let store = JsonShares::new(dir.join("community-shares.json"));
        assert!(store.load().unwrap().is_empty());

        let shares = HashMap::from([("group".to_owned(), "shared".to_owned())]);
        store.save(&shares).unwrap();
        assert_eq!(store.load().unwrap(), shares);
        std::fs::remove_dir_all(dir).unwrap();
    }
}

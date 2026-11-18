//! What this computer remembers about library sync, as JSON files in the app data dir, and
//! the copy of the library kept from before a sync deleted or overwrote something in it.

use std::io::ErrorKind;
use std::path::PathBuf;

use devatlas_application::backup::Backup;
use devatlas_application::library_sync::{SyncState, SyncStateStore};

use crate::json_file::{self, JsonFileError};

pub struct JsonSyncState {
    path: PathBuf,
    previous: PathBuf,
}

impl JsonSyncState {
    /// `previous` is a DevAtlas backup file, so Settings > Import can bring it back.
    pub fn new(path: PathBuf, previous: PathBuf) -> Self {
        Self { path, previous }
    }
}

impl SyncStateStore for JsonSyncState {
    type Error = JsonFileError;

    fn load(&self) -> Result<Option<SyncState>, JsonFileError> {
        json_file::read(&self.path)
    }

    fn save(&self, state: &SyncState) -> Result<(), JsonFileError> {
        json_file::write(&self.path, state)
    }

    fn clear(&self) -> Result<(), JsonFileError> {
        match std::fs::remove_file(&self.path) {
            Err(error) if error.kind() != ErrorKind::NotFound => Err(error.into()),
            _ => Ok(()),
        }
    }

    fn keep_previous(&self, library: &Backup) -> Result<(), JsonFileError> {
        json_file::write(&self.previous, library)
    }
}

#[cfg(test)]
mod tests {
    use devatlas_application::library_sync_merge::empty_library;

    use super::*;

    #[test]
    fn remembers_and_forgets_the_last_sync() {
        let dir = std::env::temp_dir().join(format!("devatlas-sync-{}", std::process::id()));
        let store = JsonSyncState::new(dir.join("sync.json"), dir.join("before-sync.json"));
        assert_eq!(store.load().unwrap(), None);
        store.clear().unwrap();

        let state = SyncState {
            owner: "me".to_owned(),
            generation: "g".to_owned(),
            revision: 2,
            synced_at: 3,
            base: empty_library(),
        };
        store.save(&state).unwrap();
        assert_eq!(store.load().unwrap(), Some(state));
        store.keep_previous(&empty_library()).unwrap();
        assert!(dir.join("before-sync.json").exists());

        store.clear().unwrap();
        assert_eq!(store.load().unwrap(), None);
        std::fs::remove_dir_all(dir).unwrap();
    }
}

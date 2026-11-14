//! Whose GitHub stars to keep in sync, as a small JSON file in the app data dir. No file means
//! syncing is off.

use std::path::PathBuf;

use devatlas_application::stars::StarSyncStore;
use serde::{Deserialize, Serialize};

use crate::json_file::{self, JsonFileError};

#[derive(Serialize, Deserialize)]
struct StarSyncFile {
    user: String,
}

pub struct JsonStarSync {
    path: PathBuf,
}

impl JsonStarSync {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

impl StarSyncStore for JsonStarSync {
    type Error = JsonFileError;

    fn load(&self) -> Result<Option<String>, JsonFileError> {
        Ok(json_file::read::<StarSyncFile>(&self.path)?.map(|file| file.user))
    }

    fn save(&self, user: Option<&str>) -> Result<(), JsonFileError> {
        match user {
            Some(user) => json_file::write(
                &self.path,
                &StarSyncFile {
                    user: user.to_owned(),
                },
            ),
            None => match std::fs::remove_file(&self.path) {
                Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(error.into()),
                _ => Ok(()),
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn stores_the_username_and_forgets_it_when_turned_off() {
        let dir = std::env::temp_dir().join(format!("devatlas-star-sync-{}", std::process::id()));
        let store = JsonStarSync::new(dir.join("star-sync.json"));
        assert_eq!(store.load().unwrap(), None);

        store.save(Some("octocat")).unwrap();
        assert_eq!(store.load().unwrap().as_deref(), Some("octocat"));

        store.save(None).unwrap();
        assert_eq!(store.load().unwrap(), None);
        store.save(None).unwrap();
        std::fs::remove_dir_all(dir).unwrap();
    }
}

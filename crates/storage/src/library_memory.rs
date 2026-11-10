//! Library memory (which resources the user has seen) as a JSON file in the app data dir.
// ponytail: JSON file until the SQLite database lands in DEVATLAS-002.

use std::io::ErrorKind;
use std::path::PathBuf;

use devatlas_application::library::{LibraryMemory, LibraryMemoryStore};

#[derive(Debug, thiserror::Error)]
pub enum LibraryMemoryError {
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("the library memory file is damaged: {0}")]
    Format(#[from] serde_json::Error),
}

pub struct JsonLibraryMemory {
    path: PathBuf,
}

impl JsonLibraryMemory {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

impl LibraryMemoryStore for JsonLibraryMemory {
    type Error = LibraryMemoryError;

    fn load(&self) -> Result<Option<LibraryMemory>, LibraryMemoryError> {
        match std::fs::read(&self.path) {
            Ok(bytes) => Ok(Some(serde_json::from_slice(&bytes)?)),
            Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
            Err(error) => Err(error.into()),
        }
    }

    /// Writes to a temporary file first, so a crash never leaves a half-written memory.
    fn save(&self, memory: &LibraryMemory) -> Result<(), LibraryMemoryError> {
        if let Some(dir) = self.path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        let temporary = self.path.with_extension("json.tmp");
        std::fs::write(&temporary, serde_json::to_vec_pretty(memory)?)?;
        std::fs::rename(&temporary, &self.path)?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use devatlas_application::library::ResourceMemory;

    use super::*;

    fn temp_file(name: &str) -> PathBuf {
        std::env::temp_dir()
            .join(format!("devatlas-memory-test-{}", std::process::id()))
            .join(name)
    }

    #[test]
    fn missing_file_means_nothing_stored_yet() {
        let store = JsonLibraryMemory::new(temp_file("missing.json"));
        assert!(store.load().unwrap().is_none());
    }

    #[test]
    fn round_trips_the_memory() {
        let path = temp_file("memory.json");
        let store = JsonLibraryMemory::new(path.clone());
        let memory = LibraryMemory::from([(
            "uiverse.io/elements".to_owned(),
            ResourceMemory {
                first_seen: 42,
                opened: false,
            },
        )]);

        store.save(&memory).unwrap();

        assert_eq!(store.load().unwrap(), Some(memory));
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn reports_a_damaged_file() {
        let path = temp_file("damaged.json");
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, "{ not json").unwrap();

        let result = JsonLibraryMemory::new(path.clone()).load();

        assert!(matches!(result, Err(LibraryMemoryError::Format(_))));
        std::fs::remove_file(path).unwrap();
    }
}

//! Library memory (which resources the user has seen) as a JSON file in the app data dir.

use std::path::PathBuf;

use devatlas_application::library::{LibraryMemory, LibraryMemoryStore};

use crate::json_file::{self, JsonFileError};

pub struct JsonLibraryMemory {
    path: PathBuf,
}

impl JsonLibraryMemory {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

impl LibraryMemoryStore for JsonLibraryMemory {
    type Error = JsonFileError;

    fn load(&self) -> Result<Option<LibraryMemory>, JsonFileError> {
        json_file::read(&self.path)
    }

    fn save(&self, memory: &LibraryMemory) -> Result<(), JsonFileError> {
        json_file::write(&self.path, memory)
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
                hidden: true,
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

        assert!(matches!(result, Err(JsonFileError::Format(_))));
        std::fs::remove_file(path).unwrap();
    }
}

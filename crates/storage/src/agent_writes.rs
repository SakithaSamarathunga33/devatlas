//! Whether AI agents may change the library through the MCP server, as a small JSON file in the
//! app data dir. No file means they may not.

use std::path::PathBuf;

use devatlas_application::agent::AgentWritesStore;
use serde::{Deserialize, Serialize};

use crate::json_file::{self, JsonFileError};

pub const FILE_NAME: &str = "agent-writes.json";

#[derive(Serialize, Deserialize)]
struct AgentWritesFile {
    allowed: bool,
}

pub struct JsonAgentWrites {
    path: PathBuf,
}

impl JsonAgentWrites {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

impl AgentWritesStore for JsonAgentWrites {
    type Error = JsonFileError;

    fn allowed(&self) -> Result<bool, JsonFileError> {
        Ok(json_file::read::<AgentWritesFile>(&self.path)?.is_some_and(|file| file.allowed))
    }

    fn set_allowed(&self, allowed: bool) -> Result<(), JsonFileError> {
        if allowed {
            return json_file::write(&self.path, &AgentWritesFile { allowed });
        }
        match std::fs::remove_file(&self.path) {
            Err(error) if error.kind() != std::io::ErrorKind::NotFound => Err(error.into()),
            _ => Ok(()),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn agents_may_not_write_until_allowed() {
        let dir =
            std::env::temp_dir().join(format!("devatlas-agent-writes-{}", std::process::id()));
        let store = JsonAgentWrites::new(dir.join(FILE_NAME));
        assert!(!store.allowed().unwrap());

        store.set_allowed(true).unwrap();
        assert!(store.allowed().unwrap());

        store.set_allowed(false).unwrap();
        assert!(!store.allowed().unwrap());
        store.set_allowed(false).unwrap();
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn a_damaged_file_is_an_error_not_permission() {
        let dir =
            std::env::temp_dir().join(format!("devatlas-agent-writes-bad-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join(FILE_NAME), "{not json").unwrap();
        let store = JsonAgentWrites::new(dir.join(FILE_NAME));

        assert!(store.allowed().is_err());
        std::fs::remove_dir_all(dir).unwrap();
    }
}

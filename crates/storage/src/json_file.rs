//! Small JSON files in the app data directory: saved links, library memory and settings.

use std::io::ErrorKind;
use std::path::Path;

use serde::Serialize;
use serde::de::DeserializeOwned;

#[derive(Debug, thiserror::Error)]
pub enum JsonFileError {
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("the file is damaged: {0}")]
    Format(#[from] serde_json::Error),
}

/// Reads a JSON file; `None` when it does not exist yet.
pub(crate) fn read<T: DeserializeOwned>(path: &Path) -> Result<Option<T>, JsonFileError> {
    match std::fs::read(path) {
        Ok(bytes) => Ok(Some(serde_json::from_slice(&bytes)?)),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.into()),
    }
}

/// Writes a JSON file via a temporary file, so a crash never leaves it half written.
pub(crate) fn write<T: Serialize + ?Sized>(path: &Path, value: &T) -> Result<(), JsonFileError> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    let temporary = path.with_extension("json.tmp");
    std::fs::write(&temporary, serde_json::to_vec_pretty(value)?)?;
    std::fs::rename(&temporary, path)?;
    Ok(())
}

//! The desktop app's log file. A released Windows build has no console, so stdout goes
//! nowhere; logs go to `<app data>/logs/` instead (and to stdout too in debug builds).
//! The `--mcp` server logs to stderr on its own (see `mcp.rs`). Never log tokens.

use std::fs::{self, File, OpenOptions};
use std::io;
use std::path::Path;
use std::sync::Mutex;

use tracing_subscriber::fmt::writer::MakeWriterExt;

/// Past this size the log is moved aside at startup, so the folder stays under ~10 MB.
const MAX_LOG_BYTES: u64 = 5 * 1024 * 1024;

/// Dev builds keep their own log, as they keep their own database.
const fn log_file_name() -> &'static str {
    if cfg!(debug_assertions) {
        "devatlas-dev.log"
    } else {
        "devatlas.log"
    }
}

/// Installs the global subscriber, logging to `data_dir/logs/`. Never fails: without a log
/// file it logs to stdout.
pub(crate) fn init(data_dir: &Path) {
    let file = open_log_file(&data_dir.join("logs"), log_file_name(), MAX_LOG_BYTES);
    let builder = tracing_subscriber::fmt().with_target(false);
    // `try_init` only fails if a global subscriber is already installed, which is harmless.
    match file {
        Ok(file) if cfg!(debug_assertions) => {
            let _ = builder
                .with_ansi(false)
                .with_writer(Mutex::new(file).and(io::stdout))
                .try_init();
        }
        Ok(file) => {
            let _ = builder
                .with_ansi(false)
                .with_writer(Mutex::new(file))
                .try_init();
        }
        Err(error) => {
            let _ = builder.try_init();
            tracing::warn!(%error, "could not open the log file; logging to stdout only");
        }
    }
}

/// Opens `dir/name` for appending. A file over `max_bytes` first becomes `name.old`,
/// replacing the previous one; if it can't be moved, it is emptied instead.
fn open_log_file(dir: &Path, name: &str, max_bytes: u64) -> io::Result<File> {
    fs::create_dir_all(dir)?;
    let path = dir.join(name);
    let too_big = fs::metadata(&path).is_ok_and(|meta| meta.len() > max_bytes);
    if too_big && fs::rename(&path, dir.join(format!("{name}.old"))).is_err() {
        // Emptied, then reopened for appending, so every writer keeps adding at the end.
        OpenOptions::new().write(true).truncate(true).open(&path)?;
    }
    OpenOptions::new().create(true).append(true).open(path)
}

#[cfg(test)]
mod tests {
    use std::io::Write;

    use super::*;

    fn temp_dir(test: &str) -> std::path::PathBuf {
        let dir =
            std::env::temp_dir().join(format!("devatlas-logging-{test}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        dir
    }

    #[test]
    fn creates_the_folder_and_appends_to_a_small_log() {
        let dir = temp_dir("append");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("app.log"), "first\n").unwrap();

        let mut file = open_log_file(&dir, "app.log", 1024).unwrap();
        file.write_all(b"second\n").unwrap();
        drop(file);

        assert_eq!(
            fs::read_to_string(dir.join("app.log")).unwrap(),
            "first\nsecond\n"
        );
        assert!(!dir.join("app.log.old").exists());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn moves_an_oversized_log_aside_replacing_the_previous_one() {
        let dir = temp_dir("rotate");
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("app.log.old"), "ancient").unwrap();
        fs::write(dir.join("app.log"), "x".repeat(20)).unwrap();

        let mut file = open_log_file(&dir, "app.log", 10).unwrap();
        file.write_all(b"fresh\n").unwrap();
        drop(file);

        assert_eq!(fs::read_to_string(dir.join("app.log")).unwrap(), "fresh\n");
        assert_eq!(
            fs::read_to_string(dir.join("app.log.old")).unwrap(),
            "x".repeat(20)
        );
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn empties_an_oversized_log_it_cannot_move_and_keeps_appending() {
        let dir = temp_dir("fallback");
        // A folder where the old log would go makes the rename fail.
        fs::create_dir_all(dir.join("app.log.old")).unwrap();
        fs::write(dir.join("app.log"), "x".repeat(20)).unwrap();

        let mut first = open_log_file(&dir, "app.log", 10).unwrap();
        first
            .write_all(
                b"one
",
            )
            .unwrap();
        let mut second = open_log_file(&dir, "app.log", 10).unwrap();
        second
            .write_all(
                b"two
",
            )
            .unwrap();
        first
            .write_all(
                b"three
",
            )
            .unwrap();
        drop((first, second));

        assert_eq!(
            fs::read_to_string(dir.join("app.log")).unwrap(),
            "one
two
three
"
        );
        assert!(dir.join("app.log.old").is_dir());
        fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn starts_a_new_log_in_a_missing_folder() {
        let dir = temp_dir("missing").join("logs");

        open_log_file(&dir, "app.log", 10).unwrap();

        assert!(dir.join("app.log").is_file());
        fs::remove_dir_all(dir.parent().unwrap()).unwrap();
    }
}

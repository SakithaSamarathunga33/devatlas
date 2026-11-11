//! A log of the lookups AI agents make, one JSON line per lookup, so DevAtlas can show how
//! often it is actually used while coding. Appending keeps concurrent agents from losing
//! each other's lines; nothing but the tool name and time is recorded.

use std::fs::OpenOptions;
use std::io::{ErrorKind, Write};
use std::path::PathBuf;

use devatlas_application::agent::{AgentUsage, UsageLog};
use serde::{Deserialize, Serialize};

/// The log's file name in the app data folder.
pub const FILE_NAME: &str = "agent-lookups.jsonl";
/// Past this size, lookups older than `KEEP_MS` are dropped.
const MAX_BYTES: u64 = 256 * 1024;
const KEEP_MS: i64 = 30 * 24 * 60 * 60 * 1000;

#[derive(Serialize, Deserialize)]
struct Line {
    at: i64,
    tool: String,
}

pub struct JsonlUsageLog {
    path: PathBuf,
}

impl JsonlUsageLog {
    pub fn new(path: PathBuf) -> Self {
        Self { path }
    }
}

impl JsonlUsageLog {
    /// Keeps only lookups at or after `since`, rewriting the file through a temporary one.
    fn prune(&self, since: i64) -> Result<(), std::io::Error> {
        let kept: String = std::fs::read_to_string(&self.path)?
            .lines()
            .filter(|line| {
                serde_json::from_str::<Line>(line).is_ok_and(|parsed| parsed.at >= since)
            })
            .map(|line| format!("{line}\n"))
            .collect();
        let temporary = self.path.with_extension("jsonl.tmp");
        std::fs::write(&temporary, kept)?;
        std::fs::rename(&temporary, &self.path)
    }
}

impl UsageLog for JsonlUsageLog {
    type Error = std::io::Error;

    fn record(&self, tool: &str, at: i64) -> Result<(), std::io::Error> {
        if let Some(dir) = self.path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        let mut line = serde_json::to_vec(&Line {
            at,
            tool: tool.to_owned(),
        })
        .map_err(std::io::Error::other)?;
        line.push(b'\n');
        // One write per line: appends from separate processes don't interleave.
        OpenOptions::new()
            .create(true)
            .append(true)
            .open(&self.path)?
            .write_all(&line)?;
        if std::fs::metadata(&self.path)?.len() > MAX_BYTES {
            self.prune(at - KEEP_MS)?;
        }
        Ok(())
    }

    fn since(&self, since: i64) -> Result<AgentUsage, std::io::Error> {
        let text = match std::fs::read_to_string(&self.path) {
            Ok(text) => text,
            Err(error) if error.kind() == ErrorKind::NotFound => return Ok(AgentUsage::default()),
            Err(error) => return Err(error),
        };
        let lines: Vec<Line> = text
            .lines()
            .filter_map(|line| serde_json::from_str(line).ok())
            .collect();
        Ok(AgentUsage {
            lookups: lines.iter().filter(|line| line.at >= since).count(),
            last_at: lines.iter().map(|line| line.at).max(),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_recent_lookups_and_remembers_the_last() {
        let path = std::env::temp_dir()
            .join(format!("devatlas-usage-{}", std::process::id()))
            .join("agent-lookups.jsonl");
        let _ = std::fs::remove_file(&path);
        let log = JsonlUsageLog::new(path.clone());
        assert_eq!(log.since(0).unwrap(), AgentUsage::default());

        log.record("search_library", 100).unwrap();
        log.record("get_resource", 200).unwrap();
        log.record("get_project_stack", 300).unwrap();

        assert_eq!(
            log.since(150).unwrap(),
            AgentUsage {
                lookups: 2,
                last_at: Some(300),
            }
        );
        std::fs::remove_file(path).unwrap();
    }

    #[test]
    fn a_large_log_drops_old_lookups() {
        let path = std::env::temp_dir()
            .join(format!("devatlas-usage-prune-{}", std::process::id()))
            .join(FILE_NAME);
        let _ = std::fs::remove_file(&path);
        let log = JsonlUsageLog::new(path.clone());
        let old: String = (0..10_000)
            .map(|_| "{\"at\":1,\"tool\":\"search_library\"}\n")
            .collect();
        std::fs::create_dir_all(path.parent().unwrap()).unwrap();
        std::fs::write(&path, old).unwrap();

        log.record("get_resource", KEEP_MS + 10).unwrap();

        assert_eq!(
            log.since(0).unwrap(),
            AgentUsage {
                lookups: 1,
                last_at: Some(KEEP_MS + 10),
            }
        );
        std::fs::remove_file(path).unwrap();
    }
}

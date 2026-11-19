# Backup & Sync Store

> 39 nodes · cohesion 0.07

## Key Concepts

- **Database** (44 connections) — `crates/storage/src/database.rs`
- **DatabaseError** (10 connections) — `crates/storage/src/database.rs`
- **BackupStore** (5 connections) — `crates/application/src/backup.rs`
- **SyncStore** (5 connections) — `crates/application/src/library_sync.rs`
- **creates_updates_and_deletes_snippets()** (5 connections) — `crates/storage/src/database.rs`
- **.apply_sync()** (5 connections) — `crates/storage/src/database.rs`
- **.create_snippet()** (5 connections) — `crates/storage/src/database.rs`
- **.migrated()** (5 connections) — `crates/storage/src/database.rs`
- **tags_text()** (5 connections) — `crates/storage/src/database.rs`
- **.restore()** (4 connections) — `crates/storage/src/database.rs`
- **remembers_removed_suggestions_until_restored()** (4 connections) — `crates/storage/src/database.rs`
- **SnippetInput** (4 connections)
- **.restore()** (3 connections) — `crates/application/src/backup.rs`
- **.open()** (3 connections) — `crates/storage/src/database.rs`
- **.open_read_only()** (3 connections) — `crates/storage/src/database.rs`
- **.save_link_health()** (3 connections) — `crates/storage/src/database.rs`
- **.save_release_check()** (3 connections) — `crates/storage/src/database.rs`
- **.snippets()** (3 connections) — `crates/storage/src/database.rs`
- **.update_snippet()** (3 connections) — `crates/storage/src/database.rs`
- **read_only_access_reads_but_never_writes()** (3 connections) — `crates/storage/src/database.rs`
- **remembers_release_checks_including_no_release()** (3 connections) — `crates/storage/src/database.rs`
- **RepoRelease** (3 connections)
- **snippet_input()** (3 connections) — `crates/storage/src/database.rs`
- **stores_the_latest_link_verdict()** (3 connections) — `crates/storage/src/database.rs`
- **SqlitePool** (3 connections)
- *... and 14 more nodes in this community*

## Relationships

- [SQLite Database Store](SQLite_Database_Store.md) (34 shared connections)
- [Library Sync Use Case](Library_Sync_Use_Case.md) (4 shared connections)
- [tools.rs](tools.rs.md) (3 shared connections)
- [organizer.rs](organizer.rs.md) (3 shared connections)
- [Link Health Checks](Link_Health_Checks.md) (3 shared connections)
- [library_sync.rs](library_sync.rs.md) (2 shared connections)
- [Library Sync Three-Way Merge](Library_Sync_Three-Way_Merge.md) (2 shared connections)
- [backup.rs](backup.rs.md) (1 shared connections)
- [Organizer (Notes, Groups)](Organizer_Notes,_Groups.md) (1 shared connections)
- [snippets.rs](snippets.rs.md) (1 shared connections)
- [suggestions.rs](suggestions.rs.md) (1 shared connections)
- [discovery.rs](discovery.rs.md) (1 shared connections)

## Source Files

- `crates/application/src/backup.rs`
- `crates/application/src/library_sync.rs`
- `crates/storage/src/database.rs`

## Audit Trail

- EXTRACTED: 107 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*
# Database

> God node · 44 connections · `crates/storage/src/database.rs`

**Community:** [Backup & Sync Store](Backup_&_Sync_Store.md)

## Connections by Relation

### contains
- database.rs `EXTRACTED`

### implements
- OrganizerStore `EXTRACTED`
- SnippetStore `EXTRACTED`
- LinkHealthStore `EXTRACTED`
- RepoHistoryStore `EXTRACTED`
- SuggestionStore `EXTRACTED`
- BackupStore `EXTRACTED`
- SyncStore `EXTRACTED`

### imports_from
- commands/library_sync.rs `EXTRACTED`
- commands/organizer.rs `EXTRACTED`
- [tools.rs](tools.rs.md) `EXTRACTED`

### method
- .in_memory() `EXTRACTED`
- .create_group() `EXTRACTED`
- .change_resource() `EXTRACTED`
- .groups() `EXTRACTED`
- .annotations() `EXTRACTED`
- .create_snippet() `EXTRACTED`
- .apply_sync() `EXTRACTED`
- .migrated() `EXTRACTED`
- .restore() `EXTRACTED`
- .record_stars() `EXTRACTED`
- .set_group_resources() `EXTRACTED`
- .snippets() `EXTRACTED`
- .open() `EXTRACTED`
- .update_snippet() `EXTRACTED`
- .save_link_health() `EXTRACTED`
- .open_read_only() `EXTRACTED`
- .save_release_check() `EXTRACTED`
- .remove_suggestion() `EXTRACTED`
- .restore_suggestions() `EXTRACTED`
- .link_health() `EXTRACTED`
- *…and 7 more `method` connection(s) not listed (lowest-degree first to go)*

### references
- Organizer `EXTRACTED`
- .database() `EXTRACTED`
- save() `EXTRACTED`
- library_backup() `EXTRACTED`
- ThisComputer `EXTRACTED`
- SqlitePool `EXTRACTED`

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*
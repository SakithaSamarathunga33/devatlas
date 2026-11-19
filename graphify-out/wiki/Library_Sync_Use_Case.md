# Library Sync Use Case

> 62 nodes · cohesion 0.08

## Key Concepts

- **Backup** (50 connections) — `crates/application/src/backup.rs`
- **src/library_sync.rs** (47 connections) — `crates/application/src/library_sync.rs`
- **SyncError** (30 connections) — `crates/application/src/library_sync.rs`
- **.sync()** (19 connections) — `crates/application/src/library_sync.rs`
- **.prepare()** (11 connections) — `crates/application/src/library_sync.rs`
- **status()** (11 connections) — `crates/application/src/library_sync.rs`
- **library_sync_state.rs** (11 connections) — `crates/storage/src/library_sync_state.rs`
- **.turn_on()** (10 connections) — `crates/application/src/library_sync.rs`
- **.start()** (9 connections) — `crates/application/src/library_sync.rs`
- **Output** (9 connections)
- **SyncServer** (9 connections) — `crates/application/src/library_sync.rs`
- **turn_off()** (9 connections) — `crates/application/src/library_sync.rs`
- **LibrarySync** (8 connections) — `crates/application/src/library_sync.rs`
- **.download()** (8 connections) — `crates/application/src/library_sync.rs`
- **.start_over()** (8 connections) — `crates/application/src/library_sync.rs`
- **SyncStateStore** (8 connections) — `crates/application/src/library_sync.rs`
- **LibrarySync<'_, S, C, K, St, L>** (7 connections) — `crates/application/src/library_sync.rs`
- **.seal()** (7 connections) — `crates/application/src/library_sync.rs`
- **load_secret()** (7 connections) — `crates/application/src/library_sync.rs`
- **canonical()** (7 connections) — `crates/application/src/library_sync_merge.rs`
- **save_secret()** (7 connections) — `crates/application/src/library_sync.rs`
- **ThisComputer** (6 connections) — `apps/desktop/src-tauri/src/commands/library_sync.rs`
- **checked()** (6 connections) — `crates/application/src/library_sync.rs`
- **LocalLibrary** (6 connections) — `crates/application/src/library_sync.rs`
- **.load()** (6 connections) — `crates/application/src/library_sync.rs`
- *... and 37 more nodes in this community*

## Relationships

- [Library Sync Three-Way Merge](Library_Sync_Three-Way_Merge.md) (25 shared connections)
- [library_sync_tests.rs](library_sync_tests.rs.md) (19 shared connections)
- [Library Sync Tests](Library_Sync_Tests.md) (14 shared connections)
- [backup.rs](backup.rs.md) (11 shared connections)
- [library.rs (2)](library.rs_2.md) (8 shared connections)
- [Library Memory & Share Records](Library_Memory_&_Share_Records.md) (6 shared connections)
- [library_sync.rs](library_sync.rs.md) (5 shared connections)
- [Backup & Sync Store](Backup_&_Sync_Store.md) (4 shared connections)
- [tools.rs](tools.rs.md) (4 shared connections)
- [Sync Encryption (Argon2/XChaCha)](Sync_Encryption_Argon2-XChaCha.md) (4 shared connections)
- [Agent Write Permissions](Agent_Write_Permissions.md) (4 shared connections)
- [backup_file.rs](backup_file.rs.md) (3 shared connections)

## Source Files

- `apps/desktop/src-tauri/src/commands/library_sync.rs`
- `crates/application/src/backup.rs`
- `crates/application/src/library_sync.rs`
- `crates/application/src/library_sync_merge.rs`
- `crates/storage/src/library_sync_state.rs`

## Audit Trail

- EXTRACTED: 250 (92%)
- INFERRED: 22 (8%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*
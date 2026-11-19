# Library Memory & Share Records

> 33 nodes · cohesion 0.12

## Key Concepts

- **JsonFileError** (33 connections) — `crates/storage/src/json_file.rs`
- **write()** (12 connections) — `crates/storage/src/json_file.rs`
- **library_memory.rs** (12 connections) — `crates/storage/src/library_memory.rs`
- **JsonLibraryMemory** (9 connections) — `crates/storage/src/library_memory.rs`
- **JsonSyncState** (9 connections) — `crates/storage/src/library_sync_state.rs`
- **community_shares.rs** (8 connections) — `crates/storage/src/community_shares.rs`
- **read()** (8 connections) — `crates/storage/src/json_file.rs`
- **JsonShares** (7 connections) — `crates/storage/src/community_shares.rs`
- **ReadOnlyMemory** (6 connections) — `apps/desktop/src-tauri/src/mcp.rs`
- **remembers_and_forgets_the_last_sync()** (6 connections) — `crates/storage/src/library_sync_state.rs`
- **.load()** (5 connections) — `crates/storage/src/library_memory.rs`
- **.save()** (5 connections) — `crates/storage/src/library_memory.rs`
- **.keep_previous()** (5 connections) — `crates/storage/src/library_sync_state.rs`
- **.save()** (5 connections) — `crates/storage/src/library_sync_state.rs`
- **.save()** (4 connections) — `crates/storage/src/community_shares.rs`
- **.new()** (4 connections) — `crates/storage/src/library_memory.rs`
- **reports_a_damaged_file()** (4 connections) — `crates/storage/src/library_memory.rs`
- **round_trips_the_memory()** (4 connections) — `crates/storage/src/library_memory.rs`
- **temp_file()** (4 connections) — `crates/storage/src/library_memory.rs`
- **.load()** (4 connections) — `crates/storage/src/library_sync_state.rs`
- **.load()** (4 connections) — `crates/storage/src/saved_links.rs`
- **.load()** (3 connections) — `apps/desktop/src-tauri/src/mcp.rs`
- **.save()** (3 connections) — `apps/desktop/src-tauri/src/mcp.rs`
- **ResourceMemory** (3 connections) — `crates/application/src/library.rs`
- **.load()** (3 connections) — `crates/storage/src/community_shares.rs`
- *... and 8 more nodes in this community*

## Relationships

- [Agent Write Permissions](Agent_Write_Permissions.md) (13 shared connections)
- [library.rs](library.rs.md) (8 shared connections)
- [Library Sync Use Case](Library_Sync_Use_Case.md) (6 shared connections)
- [saved_links.rs](saved_links.rs.md) (6 shared connections)
- [settings.rs (3)](settings.rs_3.md) (5 shared connections)
- [MCP Server](MCP_Server.md) (3 shared connections)
- [backup_file.rs](backup_file.rs.md) (3 shared connections)
- [backup.rs](backup.rs.md) (2 shared connections)
- [community.rs](community.rs.md) (2 shared connections)
- [Community Commands](Community_Commands.md) (2 shared connections)
- [Agent Connection Commands](Agent_Connection_Commands.md) (2 shared connections)
- [library_sync.rs](library_sync.rs.md) (2 shared connections)

## Source Files

- `apps/desktop/src-tauri/src/mcp.rs`
- `crates/application/src/library.rs`
- `crates/storage/src/community_shares.rs`
- `crates/storage/src/json_file.rs`
- `crates/storage/src/library_memory.rs`
- `crates/storage/src/library_sync_state.rs`
- `crates/storage/src/saved_links.rs`

## Audit Trail

- EXTRACTED: 123 (99%)
- INFERRED: 1 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*
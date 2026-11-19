# Agent Write Permissions

> 31 nodes · cohesion 0.09

## Key Concepts

- **serialize** (26 connections)
- **deserialize** (24 connections)
- **path** (20 connections)
- **json_file.rs** (15 connections) — `crates/storage/src/json_file.rs`
- **agent_writes.rs** (13 connections) — `crates/storage/src/agent_writes.rs`
- **star_sync.rs** (10 connections) — `crates/storage/src/star_sync.rs`
- **AgentWritesStore** (7 connections) — `crates/application/src/agent.rs`
- **JsonAgentWrites** (7 connections) — `crates/storage/src/agent_writes.rs`
- **JsonStarSync** (7 connections) — `crates/storage/src/star_sync.rs`
- **src/app_info.rs** (6 connections) — `crates/application/src/app_info.rs`
- **errorkind** (5 connections)
- **.set_allowed()** (4 connections) — `crates/storage/src/agent_writes.rs`
- **.save()** (4 connections) — `crates/storage/src/star_sync.rs`
- **.current()** (3 connections) — `crates/application/src/app_info.rs`
- **agents_may_not_write_until_allowed()** (3 connections) — `crates/storage/src/agent_writes.rs`
- **.allowed()** (3 connections) — `crates/storage/src/agent_writes.rs`
- **.new()** (3 connections) — `crates/storage/src/agent_writes.rs`
- **stores_the_username_and_forgets_it_when_turned_off()** (3 connections) — `crates/storage/src/star_sync.rs`
- **AppInfo** (2 connections) — `crates/application/src/app_info.rs`
- **current_reports_product_name_given_version_and_host_platform()** (2 connections) — `crates/application/src/app_info.rs`
- **serializes_to_the_ipc_contract_shape()** (2 connections) — `crates/application/src/app_info.rs`
- **a_damaged_file_is_an_error_not_permission()** (2 connections) — `crates/storage/src/agent_writes.rs`
- **.load()** (2 connections) — `crates/storage/src/star_sync.rs`
- **.new()** (2 connections) — `crates/storage/src/star_sync.rs`
- **.allowed()** (1 connections) — `crates/application/src/agent.rs`
- *... and 6 more nodes in this community*

## Relationships

- [Library Memory & Share Records](Library_Memory_&_Share_Records.md) (13 shared connections)
- [Agent Connection Commands](Agent_Connection_Commands.md) (8 shared connections)
- [backup.rs](backup.rs.md) (5 shared connections)
- [MCP Server](MCP_Server.md) (4 shared connections)
- [Library Sync Use Case](Library_Sync_Use_Case.md) (4 shared connections)
- [In-App Site Viewer](In-App_Site_Viewer.md) (4 shared connections)
- [MCP Agent Library Search](MCP_Agent_Library_Search.md) (3 shared connections)
- [saved_links.rs](saved_links.rs.md) (3 shared connections)
- [commands.rs](commands.rs.md) (3 shared connections)
- [agent_usage.rs](agent_usage.rs.md) (3 shared connections)
- [Chromium Bookmarks](Chromium_Bookmarks.md) (3 shared connections)
- [Self-Update Install](Self-Update_Install.md) (2 shared connections)

## Source Files

- `crates/application/src/agent.rs`
- `crates/application/src/app_info.rs`
- `crates/storage/src/agent_writes.rs`
- `crates/storage/src/json_file.rs`
- `crates/storage/src/star_sync.rs`

## Audit Trail

- EXTRACTED: 140 (99%)
- INFERRED: 1 (1%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*
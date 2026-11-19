# SQLite Database Store

> 47 nodes · cohesion 0.11

## Key Concepts

- **database.rs** (76 connections) — `crates/storage/src/database.rs`
- **.in_memory()** (23 connections) — `crates/storage/src/database.rs`
- **save()** (13 connections) — `crates/storage/src/database.rs`
- **.create_group()** (12 connections) — `crates/storage/src/database.rs`
- **annotation()** (11 connections) — `crates/storage/src/database.rs`
- **a_sync_replaces_members_and_deletes_what_was_deleted_elsewhere()** (9 connections) — `crates/storage/src/database.rs`
- **restoring_merges_without_dropping_existing_members()** (8 connections) — `crates/storage/src/database.rs`
- **.change_resource()** (6 connections) — `crates/storage/src/database.rs`
- **.groups()** (6 connections) — `crates/storage/src/database.rs`
- **read_annotation()** (6 connections) — `crates/storage/src/database.rs`
- **saving_a_link_sets_exactly_its_groups_and_skips_deleted_ones()** (6 connections) — `crates/storage/src/database.rs`
- **write_annotation()** (6 connections) — `crates/storage/src/database.rs`
- **.annotations()** (5 connections) — `crates/storage/src/database.rs`
- **deleting_a_group_removes_its_memberships_but_not_annotations()** (5 connections) — `crates/storage/src/database.rs`
- **patching_a_link_changes_only_the_named_fields_and_keeps_its_groups()** (5 connections) — `crates/storage/src/database.rs`
- **restored_backup()** (5 connections) — `crates/storage/src/database.rs`
- **round_trips_annotations_keeping_tag_order()** (5 connections) — `crates/storage/src/database.rs`
- **ResourceAnnotation** (5 connections)
- **Snippet** (5 connections)
- **the_edit_dialog_wont_save_over_a_change_made_after_it_opened()** (5 connections) — `crates/storage/src/database.rs`
- **backup_group()** (4 connections) — `crates/storage/src/database.rs`
- **creates_lists_and_renames_groups()** (4 connections) — `crates/storage/src/database.rs`
- **.record_stars()** (4 connections) — `crates/storage/src/database.rs`
- **parse_category()** (4 connections) — `crates/storage/src/database.rs`
- **patching_cleans_input_and_can_clear_fields()** (4 connections) — `crates/storage/src/database.rs`
- *... and 22 more nodes in this community*

## Relationships

- [Backup & Sync Store](Backup_&_Sync_Store.md) (34 shared connections)
- [Organizer (Notes, Groups)](Organizer_Notes,_Groups.md) (6 shared connections)
- [Library Sync Three-Way Merge](Library_Sync_Three-Way_Merge.md) (4 shared connections)
- [MCP Server](MCP_Server.md) (3 shared connections)
- [Link Health Checks](Link_Health_Checks.md) (3 shared connections)
- [Firefox Bookmarks](Firefox_Bookmarks.md) (3 shared connections)
- [Library Sync Use Case](Library_Sync_Use_Case.md) (2 shared connections)
- [backup.rs](backup.rs.md) (2 shared connections)
- [News Use Case](News_Use_Case.md) (1 shared connections)
- [snippets.rs](snippets.rs.md) (1 shared connections)
- [suggestions.rs](suggestions.rs.md) (1 shared connections)
- [Sync Encryption (Argon2/XChaCha)](Sync_Encryption_Argon2-XChaCha.md) (1 shared connections)

## Source Files

- `crates/storage/src/database.rs`

## Audit Trail

- EXTRACTED: 177 (98%)
- INFERRED: 4 (2%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*
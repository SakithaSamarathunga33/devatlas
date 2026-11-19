# Library Sync Tests

> 38 nodes · cohesion 0.13

## Key Concepts

- **library_sync_tests.rs** (34 connections) — `crates/application/src/library_sync_tests.rs`
- **.sync()** (19 connections) — `crates/application/src/library_sync_tests.rs`
- **.with()** (17 connections) — `crates/application/src/library_sync_tests.rs`
- **block_on()** (16 connections) — `crates/application/src/library_sync_tests.rs`
- **State** (11 connections) — `crates/application/src/library_sync_tests.rs`
- **SyncState** (10 connections) — `crates/application/src/library_sync.rs`
- **Local** (9 connections) — `crates/application/src/library_sync_tests.rs`
- **Computer** (8 connections) — `crates/application/src/library_sync_tests.rs`
- **Secrets** (8 connections) — `crates/application/src/library_sync_tests.rs`
- **unsafe_links_from_another_computer_are_dropped()** (7 connections) — `crates/application/src/library_sync_tests.rs`
- **link()** (6 connections) — `crates/application/src/library_sync_tests.rs`
- **reports_whether_sync_is_on()** (6 connections) — `crates/application/src/library_sync_tests.rs`
- **Mutex** (6 connections)
- **a_computer_whose_library_files_were_lost_gets_the_library_back()** (5 connections) — `crates/application/src/library_sync_tests.rs`
- **a_copy_put_back_from_an_earlier_revision_is_refused()** (5 connections) — `crates/application/src/library_sync_tests.rs`
- **a_group_deleted_here_but_renamed_there_comes_back()** (5 connections) — `crates/application/src/library_sync_tests.rs`
- **apply_list()** (5 connections) — `crates/application/src/library_sync_tests.rs`
- **starting_over_asks_other_computers_for_the_new_passphrase()** (5 connections) — `crates/application/src/library_sync_tests.rs`
- **a_link_deleted_on_one_computer_is_deleted_on_the_other_and_kept_in_a_backup()** (4 connections) — `crates/application/src/library_sync_tests.rs`
- **a_second_computer_gets_the_library_and_keeps_its_own()** (4 connections) — `crates/application/src/library_sync_tests.rs`
- **a_wrong_passphrase_is_refused_and_nothing_is_stored()** (4 connections) — `crates/application/src/library_sync_tests.rs`
- **an_unchanged_library_is_not_uploaded_again()** (4 connections) — `crates/application/src/library_sync_tests.rs`
- **another_accounts_key_is_not_used()** (4 connections) — `crates/application/src/library_sync_tests.rs`
- **.apply()** (4 connections) — `crates/application/src/library_sync_tests.rs`
- **.clear()** (4 connections) — `crates/application/src/library_sync_tests.rs`
- *... and 13 more nodes in this community*

## Relationships

- [library_sync_tests.rs](library_sync_tests.rs.md) (18 shared connections)
- [Library Sync Use Case](Library_Sync_Use_Case.md) (14 shared connections)
- [Library Sync Three-Way Merge](Library_Sync_Three-Way_Merge.md) (6 shared connections)
- [library.rs (2)](library.rs_2.md) (5 shared connections)
- [Library Memory & Share Records](Library_Memory_&_Share_Records.md) (2 shared connections)
- [backup.rs](backup.rs.md) (1 shared connections)
- [library.rs](library.rs.md) (1 shared connections)
- [agent_setups.rs (2)](agent_setups.rs_2.md) (1 shared connections)
- [credentials.rs](credentials.rs.md) (1 shared connections)

## Source Files

- `crates/application/src/library_sync.rs`
- `crates/application/src/library_sync_tests.rs`

## Audit Trail

- EXTRACTED: 121 (85%)
- INFERRED: 21 (15%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*
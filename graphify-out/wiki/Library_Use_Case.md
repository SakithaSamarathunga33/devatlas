# Library Use Case

> 39 nodes · cohesion 0.19

## Key Concepts

- **src/library.rs** (96 connections) — `crates/application/src/library.rs`
- **.new()** (27 connections) — `crates/application/src/library.rs`
- **bookmark()** (25 connections) — `crates/application/src/library.rs`
- **load_with()** (18 connections) — `crates/application/src/library.rs`
- **load()** (15 connections) — `crates/application/src/library.rs`
- **new_titles()** (14 connections) — `crates/application/src/library.rs`
- **titles()** (11 connections) — `crates/application/src/library.rs`
- **.add()** (8 connections) — `crates/application/src/library.rs`
- **removing_a_browser_bookmark_hides_it_until_it_is_added_again()** (8 connections) — `crates/application/src/library.rs`
- **removing_deletes_a_saved_link_and_re_adding_shows_it_as_new()** (8 connections) — `crates/application/src/library.rs`
- **an_unreadable_browser_does_not_forget_links_when_saved_links_exist()** (7 connections) — `crates/application/src/library.rs`
- **importing_adds_new_links_as_already_seen()** (7 connections) — `crates/application/src/library.rs`
- **LibrarySnapshot** (7 connections) — `crates/application/src/library.rs`
- **marks_links_added_after_the_first_run_as_new_until_opened()** (7 connections) — `crates/application/src/library.rs`
- **rebaseline_accepts_a_new_source_without_clearing_real_new_marks()** (7 connections) — `crates/application/src/library.rs`
- **adding_a_link_fetches_its_title_and_shows_it_as_new()** (6 connections) — `crates/application/src/library.rs`
- **an_empty_folder_does_not_wipe_the_memory()** (6 connections) — `crates/application/src/library.rs`
- **browser_bookmarks_win_over_duplicate_saved_links()** (6 connections) — `crates/application/src/library.rs`
- **importing_restores_hidden_links()** (6 connections) — `crates/application/src/library.rs`
- **lists_hidden_links_for_backups()** (6 connections) — `crates/application/src/library.rs`
- **new_marks_expire_after_a_week()** (6 connections) — `crates/application/src/library.rs`
- **re_adding_a_removed_link_marks_it_new_again()** (6 connections) — `crates/application/src/library.rs`
- **removing_a_saved_link_forgets_it_even_without_a_browser()** (6 connections) — `crates/application/src/library.rs`
- **switching_browsers_keeps_removed_links_hidden()** (6 connections) — `crates/application/src/library.rs`
- **drops_duplicates_and_unusable_links_and_sorts_by_title()** (5 connections) — `crates/application/src/library.rs`
- *... and 14 more nodes in this community*

## Relationships

- [Add Link Flow](Add_Link_Flow.md) (34 shared connections)
- [library.rs](library.rs.md) (31 shared connections)
- [library.rs (3)](library.rs_3.md) (6 shared connections)
- [MCP Agent Library Search](MCP_Agent_Library_Search.md) (5 shared connections)
- [GitHub Stars Import](GitHub_Stars_Import.md) (3 shared connections)
- [library.rs (2)](library.rs_2.md) (3 shared connections)
- [preview.rs](preview.rs.md) (2 shared connections)
- [Agent Write Permissions](Agent_Write_Permissions.md) (2 shared connections)
- [Link Health Checks](Link_Health_Checks.md) (1 shared connections)
- [agent_setups_tests.rs](agent_setups_tests.rs.md) (1 shared connections)
- [agent_setups.rs (2)](agent_setups.rs_2.md) (1 shared connections)
- [Library Sync Use Case](Library_Sync_Use_Case.md) (1 shared connections)

## Source Files

- `crates/application/src/library.rs`

## Audit Trail

- EXTRACTED: 198 (83%)
- INFERRED: 40 (17%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*
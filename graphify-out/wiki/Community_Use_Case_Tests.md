# Community Use Case Tests

> 32 nodes · cohesion 0.14

## Key Concepts

- **community_tests.rs** (42 connections) — `crates/application/src/community_tests.rs`
- **block_on()** (17 connections) — `crates/application/src/community_tests.rs`
- **set_following()** (11 connections) — `crates/application/src/community.rs`
- **library()** (8 connections) — `crates/application/src/community_tests.rs`
- **group()** (7 connections) — `crates/application/src/community_tests.rs`
- **a_copy_that_is_no_longer_ours_is_published_anew()** (6 connections) — `crates/application/src/community_tests.rs`
- **FakeShares** (6 connections) — `crates/application/src/community_tests.rs`
- **refuses_empty_and_oversized_collections_before_sending()** (6 connections) — `crates/application/src/community_tests.rs`
- **sharing_again_updates_the_same_collection()** (6 connections) — `crates/application/src/community_tests.rs`
- **.save()** (5 connections) — `crates/application/src/community_tests.rs`
- **item()** (5 connections) — `crates/application/src/community_tests.rs`
- **publishing_sends_only_titles_and_urls_and_remembers_the_copy()** (5 connections) — `crates/application/src/community_tests.rs`
- **a_failed_account_deletion_keeps_what_was_shared()** (4 connections) — `crates/application/src/community_tests.rs`
- **deleting_the_account_forgets_what_was_shared()** (4 connections) — `crates/application/src/community_tests.rs`
- **.delete_account()** (4 connections) — `crates/application/src/community_tests.rs`
- **preview_drops_secrets_a_link_can_carry()** (4 connections) — `crates/application/src/community_tests.rs`
- **preview_keeps_https_links_and_counts_the_rest()** (4 connections) — `crates/application/src/community_tests.rs`
- **reads_every_page_of_an_accounts_collections()** (4 connections) — `crates/application/src/community_tests.rs`
- **Mutex** (4 connections)
- **shared_before()** (4 connections) — `crates/application/src/community_tests.rs`
- **following_a_malformed_id_sends_nothing()** (3 connections) — `crates/application/src/community_tests.rs`
- **following_sends_the_id_and_reads_back_the_count()** (3 connections) — `crates/application/src/community_tests.rs`
- **following_your_own_collection_is_refused_with_a_clear_message()** (3 connections) — `crates/application/src/community_tests.rs`
- **reports_trim_the_reason_and_refuse_long_ones()** (3 connections) — `crates/application/src/community_tests.rs`
- **unsharing_forgets_every_local_collection_mapped_to_it()** (3 connections) — `crates/application/src/community_tests.rs`
- *... and 7 more nodes in this community*

## Relationships

- [community_tests.rs](community_tests.rs.md) (10 shared connections)
- [community.rs](community.rs.md) (9 shared connections)
- [Community Limits & Validation](Community_Limits_&_Validation.md) (8 shared connections)
- [community_tests.rs (2)](community_tests.rs_2.md) (5 shared connections)
- [community.rs (2)](community.rs_2.md) (3 shared connections)
- [GitHub Stars Import](GitHub_Stars_Import.md) (3 shared connections)
- [MCP Agent Library Search](MCP_Agent_Library_Search.md) (3 shared connections)
- [Chromium Bookmarks](Chromium_Bookmarks.md) (1 shared connections)
- [rankings.rs](rankings.rs.md) (1 shared connections)
- [In-App Site Viewer](In-App_Site_Viewer.md) (1 shared connections)
- [backup.rs](backup.rs.md) (1 shared connections)

## Source Files

- `crates/application/src/community.rs`
- `crates/application/src/community_tests.rs`

## Audit Trail

- EXTRACTED: 93 (82%)
- INFERRED: 20 (18%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*
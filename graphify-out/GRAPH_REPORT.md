# Graph Report - devatlas  (2026-11-19)

## Corpus Check
- 442 files · ~340,199 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 94 file(s) not represented in the graph (top: .toml 79, (none) 7, .css 4)

## Summary
- 4894 nodes · 12277 edges · 234 communities (181 shown, 53 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 530 edges (avg confidence: 0.82)
- Token cost: 288,328 input · 0 output

## Community Hubs (Navigation)
- Chart Band Config
- Desktop App Shell & Tests
- Chart Config Context
- Repos Discovery Page
- Dashboard Summary & Filter Tabs
- In-App Site Viewer
- Installer UI
- Area Chart Rendering
- News Page & Brand Icons
- Library Sync Use Case
- Organizer (Notes, Groups)
- Chart Animation
- News Feeds Storage
- Community Link Images Storage
- Chart Hover Context
- Area Chart Component
- Fast SVG Path
- Sync Encryption (Argon2/XChaCha)
- Community Link Images Use Case
- GitHub Stars Import
- SQLite Database Store
- Supabase Community Schema
- Shared Page Header & Search
- OAuth Loopback Listener
- Community Supabase Client
- MCP Agent Library Search
- App Layout & Sidebar
- Community Share Dialog & Hooks
- Resource Cards & Library Browser
- MCP Server
- Project Manifest Parsing
- News Use Case
- Settings Page
- Community Commands
- Backup & Sync Store
- Community Limits & Validation
- Library Use Case
- Link Health Checks
- Explorer Page
- Library Sync Tests
- Firefox Bookmarks
- Library Sync Three-Way Merge
- Chromium Bookmarks
- Modal & Community Dialogs
- Add Link Flow
- GitHub API Client
- Installer Extraction
- Settings Use Case
- Chart Tooltip & Axis
- Star History Rankings
- Agent Setup Sharing UI
- Library Memory & Share Records
- Agent Connection Commands
- App Info & Updates
- Community Use Case Tests
- Self-Update Install
- E2E Fake Backend
- Frontend Dependencies
- Library Sync Settings UI
- Agent Write Permissions
- backup.rs
- use-chart-phase-orchestrator.ts
- github.rs
- preview.rs
- discovery.rs
- package.json
- local_setup.rs
- discovery.rs (2)
- grid-lines.tsx
- browsers.rs
- web_preview.rs
- package.json (2)
- organizer.rs
- commands.rs
- tauri.conf.json
- library_sync_tests.rs
- updates.rs
- community_auth.rs
- community.rs
- agent-settings.tsx
- cover_maker.rs
- use-app-info.test.tsx
- dashboard-page.tsx
- snippets-page.tsx
- snippets.rs
- agent_setups.rs
- tsconfig.base.json
- viewer.service.ts
- mcp.rs
- community_auth.rs (2)
- rankings.rs
- library.rs
- community_setups.rs
- account-nav-item.tsx
- suggestions.rs
- backup_file.rs
- add-link-form.tsx
- library_sync.rs
- settings.rs
- package.json (3)
- agent_setups.rs (2)
- agent_usage.rs
- rankings.rs (2)
- projection-utils.ts
- system.rs
- library_sync_server.rs
- community.rs (2)
- agent_setups.rs (3)
- community_tests.rs
- discovery.rs (3)
- star_history.rs
- logging.rs
- package.json (4)
- package.json (5)
- tauri.conf.json (2)
- agent_setups_tests.rs
- agent.rs
- install_location.rs
- BACKUPS.md
- gradients.tsx
- community-page.tsx
- settings.rs (2)
- credentials.rs
- app_update.rs
- build.rs
- tools.rs
- news.rs
- uninstall.rs
- agent_setups_tests.rs (2)
- updates.rs (2)
- web_preview.rs (2)
- follow-button.tsx
- agent.rs (2)
- agent_setups.rs (4)
- organizer.rs (2)
- preview_cache.rs
- system-design.md
- README.md
- AGENTS.md
- date-ticker.tsx
- preview.rs (2)
- community_covers.rs
- agent_setups.rs (5)
- library.rs (2)
- PRODUCT.md
- package.json (6)
- ci.yml
- community.rs (3)
- updates.rs (3)
- security-model.md
- .prettierrc.json
- install.rs
- updates.rs (4)
- security-model.md (2)
- lib.rs
- tsconfig.json
- tsconfig.json (2)
- settings.rs (3)
- library.rs (3)
- 0001_organizer.sql
- web_preview.rs (3)
- tsconfig.json (3)
- package.json (7)
- saved_links.rs
- web_preview.rs (4)
- README.md (2)
- series-path-utils.ts
- tsconfig.node.json
- package.json (8)
- tsconfig.node.json (2)
- community_tests.rs (2)
- default.json
- default.json (2)
- discovery.rs (4)
- organizer.rs (3)
- security-model.md (3)
- index.html
- y-axis-ticks.ts
- install.rs (2)
- library_sync.rs (2)
- index.html (2)
- README.md (3)
- package.json (9)
- Cargo.toml
- release-notes.test.sh
- main.rs
- devatlas.variants.d.ts
- main.rs (2)
- devatlas.variants.d.ts (2)
- 0002_repo_history.sql
- community.rs (4)
- package.json (10)
- package.json (11)
- package.json (12)
- package.json (13)
- package.json (14)
- package.json (15)
- package.json (16)
- package.json (17)
- package.json (18)
- package.json (19)
- package.json (20)
- package.json (21)
- package.json (22)
- package.json (23)
- package.json (24)
- package.json (25)
- package.json (26)
- package.json (27)
- package.json (28)
- package.json (29)
- package.json (30)
- lib.rs (2)
- 0005_removed_suggestions.sql
- release-notes.sh
- Cargo.toml (2)

## God Nodes (most connected - your core abstractions)
1. `invokeCommand()` - 88 edges
2. `SupabaseError` - 70 edges
3. `Backup` - 50 edges
4. `Database` - 44 edges
5. `LibraryStore` - 42 edges
6. `AppProviders()` - 42 edges
7. `react-router` - 40 edges
8. `@tanstack/react-query` - 38 edges
9. `TimeSeriesChartInner` - 37 edges
10. `Community` - 33 edges

## Surprising Connections (you probably didn't know these)
- `Website FAQ` --semantically_similar_to--> `DevAtlas README`  [INFERRED] [semantically similar]
  docs/index.html → README.md
- `MCP Server Section` --semantically_similar_to--> `DevAtlas MCP Server (DevAtlas.exe --mcp)`  [INFERRED] [semantically similar]
  docs/index.html → README.md
- `Windows Desktop Build Job` --references--> `Installer index.html (DevAtlas Setup UI)`  [INFERRED]
  .github/workflows/ci.yml → apps/installer/index.html
- `One-click signed update` --semantically_similar_to--> `In-app updater (forward-only, signature-verified)`  [INFERRED] [semantically similar]
  apps/desktop/PRODUCT.md → docs/operations/RELEASING.md
- `Releasing DevAtlas` --references--> `CI Workflow`  [EXTRACTED]
  docs/operations/RELEASING.md → .github/workflows/ci.yml

## Import Cycles
- 2-file cycle: `apps/desktop/src-tauri/src/commands/library.rs -> apps/desktop/src-tauri/src/commands/organizer.rs -> apps/desktop/src-tauri/src/commands/library.rs`
- 2-file cycle: `apps/desktop/src-tauri/src/commands/community.rs -> apps/desktop/src-tauri/src/commands/library_sync.rs -> apps/desktop/src-tauri/src/commands/community.rs`
- 2-file cycle: `crates/storage/src/community.rs -> crates/storage/src/community_auth.rs -> crates/storage/src/community.rs`
- 2-file cycle: `crates/storage/src/community.rs -> crates/storage/src/community_covers.rs -> crates/storage/src/community.rs`
- 2-file cycle: `apps/installer/src-tauri/src/install.rs -> apps/installer/src-tauri/src/system.rs -> apps/installer/src-tauri/src/install.rs`
- 2-file cycle: `crates/application/src/community.rs -> crates/application/src/community_untrusted.rs -> crates/application/src/community.rs`
- 3-file cycle: `crates/application/src/agent.rs -> crates/application/src/library.rs -> crates/application/src/agent_setups.rs -> crates/application/src/agent.rs`
- 3-file cycle: `crates/application/src/agent_setups.rs -> crates/application/src/community.rs -> crates/application/src/library.rs -> crates/application/src/agent_setups.rs`
- 4-file cycle: `crates/application/src/agent.rs -> crates/application/src/library.rs -> crates/application/src/agent_setups.rs -> crates/application/src/community.rs -> crates/application/src/agent.rs`
- 4-file cycle: `crates/application/src/agent.rs -> crates/application/src/library.rs -> crates/application/src/agent_setups.rs -> crates/application/src/community_untrusted.rs -> crates/application/src/agent.rs`
- 4-file cycle: `crates/application/src/agent_setups.rs -> crates/application/src/community_untrusted.rs -> crates/application/src/community.rs -> crates/application/src/library.rs -> crates/application/src/agent_setups.rs`
- 5-file cycle: `crates/application/src/agent.rs -> crates/application/src/library.rs -> crates/application/src/agent_setups.rs -> crates/application/src/community.rs -> crates/application/src/community_untrusted.rs -> crates/application/src/agent.rs`
- 5-file cycle: `crates/application/src/agent.rs -> crates/application/src/library.rs -> crates/application/src/agent_setups.rs -> crates/application/src/community_untrusted.rs -> crates/application/src/community.rs -> crates/application/src/agent.rs`

## Hyperedges (group relationships)
- **Bounded, allow-listed outbound network access from Rust** — docs_security_security_model_hardened_preview_fetching, docs_security_security_model_allow_listed_news_sources, docs_security_security_model_fixed_host_github_api, docs_security_security_model_link_checks, docs_security_security_model_signed_self_update [INFERRED 0.85]
- **Controls that keep the webview/Rust boundary narrow** — docs_security_security_model_webview_rust_boundary, docs_security_security_model_least_privilege_capabilities, docs_security_security_model_command_allow_list, docs_security_security_model_strict_csp, docs_security_security_model_prototype_freezing, docs_security_security_model_typed_validated_ipc, docs_security_security_model_native_dialogs_from_rust [INFERRED 0.85]
- **DevAtlas MCP toolset for AI coding agents** — readme_mcp_server, readme_search_library, readme_list_library, readme_get_resource, readme_get_project_stack, readme_update_resource [EXTRACTED 1.00]
- **Push-to-release pipeline (CI build, signed update, publish)** — github_workflows_ci_desktop_build_job, github_workflows_ci_devatlas_windows_installers, github_workflows_release_release_workflow, github_workflows_release_sign_update, docs_operations_releasing_in_app_updater, docs_operations_releasing_update_signing_key [EXTRACTED 1.00]
- **Layered Rust workspace (desktop -> application -> domain, storage implements ports)** — docs_architecture_system_design_devatlas_desktop, docs_architecture_system_design_devatlas_application, docs_architecture_system_design_devatlas_domain, docs_architecture_system_design_devatlas_storage [EXTRACTED 1.00]
- **Local-first data design constraints** — docs_decisions_adr_002_local_first_local_first, docs_database_schema_design_sqlite_first, docs_database_schema_design_uuid_utc, docs_architecture_dependency_rules_ports_and_adapters, docs_architecture_system_design_app_data_layout [INFERRED 0.85]

## Communities (234 total, 53 thin omitted)

### Community 0 - "Chart Band Config"
Cohesion: 0.04
Nodes (91): bandConfigFromProps(), BandConfigProps, bandKeysByAxis(), defaultBandLabel(), extractBandConfigs(), getChildComponentName(), nonEmptyString(), CHART_CLIP_PASSTHROUGH (+83 more)

### Community 1 - "Desktop App Shell & Tests"
Cohesion: 0.04
Nodes (64): App(), APP_INFO, invokeMock, LIBRARY, RELEASE, renderApp(), STORY, TRENDING (+56 more)

### Community 2 - "Chart Config Context"
Cohesion: 0.05
Nodes (74): ChartConfigContext, ChartConfigProviderProps, ChartConfigValue, DEFAULT_CHART_CONFIG, resolveTooltipBoxMotion(), SpringConfig, useChartConfig(), chartCssVars (+66 more)

### Community 3 - "Repos Discovery Page"
Cohesion: 0.06
Nodes (77): BOARD_LABELS, DiscoveryPage(), matches(), parseLanguage(), parsePeriod(), parseSection(), PERIOD_LABELS, SEARCH_LABELS (+69 more)

### Community 4 - "Dashboard Summary & Filter Tabs"
Cohesion: 0.06
Nodes (59): Scenario, FilterTabs(), FilterTabsOption, FilterTabsProps, LAST_MONTH, NOW, THIS_MONTH, CATEGORY_OPTIONS (+51 more)

### Community 5 - "In-App Site Viewer"
Cohesion: 0.05
Nodes (41): accepts_finite_non_negative_bounds(), allows_only_web_navigation(), bounds(), is_web(), MAIN_LABEL, PAGE_LOAD_EVENT, PageLoad, rejects_negative_or_non_finite_bounds() (+33 more)

### Community 6 - "Installer UI"
Cohesion: 0.06
Nodes (50): App(), launch(), INITIAL_OPTIONS, messageOf(), run(), Screen, STEP_LABEL, api (+42 more)

### Community 7 - "Area Chart Rendering"
Cohesion: 0.08
Nodes (52): Area(), AreaProps, AreaGradientDefs, AreaGradientDefsProps, useAreaLoadingPulseState(), AreaLabelBox, evenlySpacedLabelIndices(), layoutAreaValueLabels() (+44 more)

### Community 8 - "News Page & Brand Icons"
Cohesion: 0.08
Nodes (50): simple-icons@^16.37.0, NewsPreview(), BrandIcon(), formatChange(), INDEX_LABELS, LanguageRankings(), Movement(), rankingColumns() (+42 more)

### Community 9 - "Library Sync Use Case"
Cohesion: 0.08
Nodes (31): ThisComputer, Backup, check_passphrase(), checked(), FirstCopy, LibrarySync, LibrarySync<'_, S, C, K, St, L>, load_secret() (+23 more)

### Community 10 - "Organizer (Notes, Groups)"
Cohesion: 0.08
Nodes (41): a_blank_note_means_no_note(), annotate(), annotation_without_a_category_keeps_the_automatic_one(), Annotations, annotations_carry_reading_status_and_health_marks_links(), annotations_override_the_category_and_add_tags_and_notes(), Changed, check_id() (+33 more)

### Community 11 - "Chart Animation"
Cohesion: 0.06
Nodes (42): clipRevealTransition(), DEFAULT_ANIMATION_DURATION_MS, DEFAULT_ANIMATION_EASING, DEFAULT_CHART_ENTER_TRANSITION, GRID_ANGLE_LABEL_FADE_S, GRID_ANGLE_LABEL_STAGGER_S, GRID_RING_SPRING, GRID_RING_STAGGER_S (+34 more)

### Community 12 - "News Feeds Storage"
Cohesion: 0.07
Nodes (34): FeedEntry, CONNECT_TIMEOUT, FEED_ACCEPT, FEED_CACHE_FOR, FeedCache, HnHit, HnSearch, lock() (+26 more)

### Community 13 - "Community Link Images Storage"
Cohesion: 0.10
Nodes (23): SupabaseCommunity, refusal(), SupabaseCommunity, SupabaseCommunity, SupabaseError, AuthRejected, Browser, Cancelled (+15 more)

### Community 14 - "Chart Hover Context"
Cohesion: 0.07
Nodes (44): AreaChartProps, AreaChartLoadingProps, BandConfig, ChartHoverContext, ChartHoverContextValue, ChartHoverStore, ChartHoverStoreContext, ChartProvider() (+36 more)

### Community 15 - "Area Chart Component"
Cohesion: 0.07
Nodes (35): AreaChart(), DEFAULT_MARGIN, extractAreaConfigs(), useStableMargin(), ChartLoadingLabel(), ChartLoadingLabelProps, ChartParentSizeProps, ElementSize (+27 more)

### Community 16 - "Fast SVG Path"
Cohesion: 0.08
Nodes (34): FastPath, fastShapePath(), formatCoordinate(), Generator, AreaClosedConfig, LinePath(), LinePathConfig, linePathD() (+26 more)

### Community 17 - "Sync Encryption (Argon2/XChaCha)"
Cohesion: 0.07
Nodes (27): associated_data(), cipher(), CipherError, Damaged, Encode, Key, Random, Seal (+19 more)

### Community 18 - "Community Link Images Use Case"
Cohesion: 0.08
Nodes (21): a_collection_without_images_records_none_and_deletes_old_ones(), AT_ONCE, block_on(), CoverError, Invalid, Store, CoverMaker, CoverStore (+13 more)

### Community 19 - "GitHub Stars Import"
Cohesion: 0.08
Nodes (29): a_tampered_stored_username_is_ignored(), an_invalid_username_turns_nothing_on(), block_on(), checks_the_username(), clean_username(), FakeStars, MAX_PAGES, MAX_TITLE_CHARS (+21 more)

### Community 20 - "SQLite Database Store"
Cohesion: 0.11
Nodes (29): a_sync_replaces_members_and_deletes_what_was_deleted_elsewhere(), annotation(), as_signed(), backup_group(), category_text(), creates_lists_and_renames_groups(), deleting_a_group_removes_its_memberships_but_not_annotations(), group_ids_are_unique() (+21 more)

### Community 21 - "Supabase Community Schema"
Cohesion: 0.07
Nodes (30): public.profiles, public.publish_collection(), public.reports, public.shared_collections, public.shared_links, public.sync_profile(), reports_reporter_idx, shared_collections_owner_idx (+22 more)

### Community 22 - "Shared Page Header & Search"
Cohesion: 0.09
Nodes (25): ForYouToggle(), PageHeader(), PageHeaderProps, SearchField(), SearchFieldProps, growth(), RepoActivityLine(), RemoveRepoButton() (+17 more)

### Community 23 - "OAuth Loopback Listener"
Cohesion: 0.07
Nodes (31): an_oversized_request_line_is_not_a_reply(), answers_with_a_static_page(), Callback, Code, Error, Other, CALLBACK_PATH, challenge_for() (+23 more)

### Community 24 - "Community Supabase Client"
Cohesion: 0.09
Nodes (36): a_card_shows_the_stored_covers_only(), a_duplicate_follow_counts_as_following(), a_page_skips_malformed_rows_but_pages_on_the_raw_count(), a_row_with_a_negative_follower_count_is_left_out(), Answer, CommunityConfig, config(), CONNECT_TIMEOUT (+28 more)

### Community 25 - "MCP Agent Library Search"
Cohesion: 0.10
Nodes (32): clean_text(), contains_word(), DEFAULT_RESULTS, find(), find_by_id_or_address_with_snippets(), GENERIC_NAMES, group(), is_hidden() (+24 more)

### Community 26 - "App Layout & Sidebar"
Cohesion: 0.10
Nodes (28): AppLayout(), AppHeader(), ThemeToggle(), WindowControls(), AppSidebar(), isActive(), NavItem(), homeNavigation (+20 more)

### Community 27 - "Community Share Dialog & Hooks"
Cohesion: 0.12
Nodes (37): PreviewBody(), ShareDialog(), collectionQueryKey(), forgetAccount(), mineQueryKey, sessionQueryKey, useDeleteCommunityAccount(), useFollowCollection() (+29 more)

### Community 28 - "Resource Cards & Library Browser"
Cohesion: 0.13
Nodes (32): SharedLinkCard(), githubFullName(), SuggestedCard(), EditResourceDialog(), inFilter(), LibraryBrowser(), linkHealthLabel(), PREVIEW_RATIO (+24 more)

### Community 29 - "MCP Server"
Cohesion: 0.06
Nodes (18): confine(), confines_folders_to_the_agents_own(), cwd(), IDENTIFIER, INSTRUCTIONS, is_local(), Library, ListArgs (+10 more)

### Community 30 - "Project Manifest Parsing"
Cohesion: 0.10
Nodes (34): an_empty_folder_has_no_dependencies(), caps_how_many_and_how_long(), cargo(), cargo_members(), ecosystem_from(), ecosystem_name(), ecosystem_order(), go() (+26 more)

### Community 31 - "News Use Case"
Cohesion: 0.09
Nodes (26): block_on(), FakeReader, FakeStories, FeedReader, is_web_url(), keeps_the_newest_valid_posts_per_source_and_reports_failures(), latest_news(), newest_posts() (+18 more)

### Community 32 - "Settings Page"
Cohesion: 0.10
Nodes (30): BookmarkForm(), errorText(), GithubTokenForm(), LibraryTools(), NO_BROWSER, plural(), SettingsPage(), settingsQueryKey (+22 more)

### Community 33 - "Community Commands"
Cohesion: 0.11
Nodes (21): Community, community_cancel_sign_in(), COMMUNITY_KEY, community_session(), community_sign_in(), community_sign_out(), COMMUNITY_URL, delete_community_account() (+13 more)

### Community 34 - "Backup & Sync Store"
Cohesion: 0.07
Nodes (14): BackupStore, SyncStore, creates_updates_and_deletes_snippets(), Database, DatabaseError, Folder, Migrate, Open (+6 more)

### Community 35 - "Community Limits & Validation"
Cohesion: 0.10
Nodes (31): MAX_COVERS, MAX_DESCRIPTION_CHARS, MAX_LINK_TITLE_CHARS, MAX_LINKS, MAX_OFFSET, MAX_QUERY_CHARS, MAX_REASON_CHARS, MAX_TIMESTAMP_LEN (+23 more)

### Community 36 - "Library Use Case"
Cohesion: 0.19
Nodes (36): adding_a_link_fetches_its_title_and_shows_it_as_new(), adding_rejects_duplicates_and_invalid_urls(), adding_works_offline_using_the_host_as_title(), already_read_bookmarks_can_be_a_source(), an_empty_folder_does_not_wipe_the_memory(), an_unreadable_browser_does_not_forget_links_when_saved_links_exist(), bookmark(), browser_bookmarks_win_over_duplicate_saved_links() (+28 more)

### Community 37 - "Link Health Checks"
Cohesion: 0.09
Nodes (20): block_on(), check_links(), counts_results_and_stores_conclusive_ones_only(), FakeChecker, FakeStore, LinkChecker, LinkCheckError, Offline (+12 more)

### Community 38 - "Explorer Page"
Cohesion: 0.12
Nodes (24): Browser(), BrowserSkeleton(), CardGroup(), ExplorerPage(), SUGGESTED_IDS, renderExplorer(), removedSuggestionsQueryKey, useRemovedSuggestions() (+16 more)

### Community 39 - "Library Sync Tests"
Cohesion: 0.13
Nodes (24): SyncState, a_computer_whose_library_files_were_lost_gets_the_library_back(), a_copy_put_back_from_an_earlier_revision_is_refused(), a_group_deleted_here_but_renamed_there_comes_back(), a_link_deleted_on_one_computer_is_deleted_on_the_other_and_kept_in_a_backup(), a_second_computer_gets_the_library_and_keeps_its_own(), a_wrong_passphrase_is_refused_and_nothing_is_stored(), an_unchanged_library_is_not_uploaded_again() (+16 more)

### Community 40 - "Firefox Bookmarks"
Cohesion: 0.09
Nodes (26): a_missing_database_is_not_found(), BOOKMARK, build(), CONTAINERS, FirefoxBookmarks, FirefoxError, Database, Io (+18 more)

### Community 41 - "Library Sync Three-Way Merge"
Cohesion: 0.13
Nodes (30): BackupGroup, a_deletion_on_one_computer_reaches_the_other(), a_first_sync_keeps_everything_from_both_computers(), an_edit_wins_over_no_change_on_either_side(), canonical_order_ignores_how_the_lists_were_read(), Changes, changes(), Changes<T> (+22 more)

### Community 42 - "Chromium Bookmarks"
Cohesion: 0.09
Nodes (30): a_damaged_local_state_only_loses_the_friendly_names(), a_missing_browser_has_no_profiles(), ACCOUNT, BOOKMARK_FILES, BookmarksFile, CHROMIUM_EPOCH_OFFSET_MS, ChromiumBookmarks, ChromiumBookmarksError (+22 more)

### Community 43 - "Modal & Community Dialogs"
Cohesion: 0.15
Nodes (30): Modal(), ModalProps, ReportDialog(), UnshareDialog(), REMOVED, bySource(), itemDescription(), ItemList() (+22 more)

### Community 44 - "Add Link Flow"
Cohesion: 0.12
Nodes (28): add_link(), AddLinkError, AlreadySaved, InvalidUrl, Memory, Source, Store, browser_resources() (+20 more)

### Community 45 - "GitHub API Client"
Cohesion: 0.08
Nodes (30): API_ROOT, ApiOwner, ApiRelease, ApiRepo, builds_release_urls_from_encoded_segments(), builds_repository_urls_from_encoded_segments(), builds_the_search_terms(), CONNECT_TIMEOUT (+22 more)

### Community 46 - "Installer Extraction"
Cohesion: 0.12
Nodes (33): get_available_space(), available_space(), available_space_measures_the_nearest_existing_folder(), CHUNK_BYTES, copy_uninstaller(), copying_the_uninstaller_onto_itself_is_a_no_op(), extract(), EXTRACT_END (+25 more)

### Community 47 - "Settings Use Case"
Cohesion: 0.11
Nodes (28): a_browser_needs_a_folder(), accepts_github_token_shapes_and_trims(), accepts_only_chromium_profile_directories(), an_invalid_bookmark_choice_keeps_the_onboarding_answer(), an_unreadable_file_is_not_onboarded_and_is_not_overwritten(), apply_update(), clean_token(), complete_onboarding() (+20 more)

### Community 48 - "Chart Tooltip & Axis"
Cohesion: 0.11
Nodes (31): selectTooltipData(), useChartPortalContainer(), ChartLabelCount, resolveResponsiveChartLabelCount(), ResponsiveChartLabelCount, ChartTooltip(), allIndexLayouts(), appendProjectionTailTicks() (+23 more)

### Community 49 - "Star History Rankings"
Cohesion: 0.11
Nodes (28): a_bundle_without_the_rankings_is_not_recognized(), ASSETS_URL, BOARD_CACHE_FOR, BUNDLE, bundle_file(), DATE_WINDOW, dates_before(), drops_numbers_the_ui_cannot_represent_exactly() (+20 more)

### Community 50 - "Agent Setup Sharing UI"
Cohesion: 0.10
Nodes (28): DETECTED, GITHUB_MCP, HALLMARK, LOCAL_DB, SETUP, renderDialog(), setupsQueryKey, useDetectedSetup() (+20 more)

### Community 51 - "Library Memory & Share Records"
Cohesion: 0.12
Nodes (16): ReadOnlyMemory, ResourceMemory, JsonShares, remembers_shared_collections(), JsonFileError, Format, Io, read() (+8 more)

### Community 52 - "Agent Connection Commands"
Cohesion: 0.14
Nodes (18): AgentConnection, get_agent_connection(), get_agent_writes(), get_star_sync(), import_github_stars(), import_stars(), set_agent_writes(), set_star_sync() (+10 more)

### Community 53 - "App Info & Updates"
Cohesion: 0.12
Nodes (16): BUILD, check_for_update(), download_and_install(), get_app_info(), install_update(), INSTALLING, newer_release(), releases_repo() (+8 more)

### Community 54 - "Community Use Case Tests"
Cohesion: 0.14
Nodes (25): FollowState, set_following(), a_copy_that_is_no_longer_ours_is_published_anew(), a_failed_account_deletion_keeps_what_was_shared(), block_on(), browsing_cleans_the_query_and_bounds_the_offset(), deleting_the_account_forgets_what_was_shared(), FakeShares (+17 more)

### Community 55 - "Self-Update Install"
Cohesion: 0.10
Nodes (21): a_broken_package_leaves_the_installed_app_alone(), aside(), aside_names(), CONNECT_TIMEOUT, DOWNLOAD_HOSTS, DOWNLOAD_TIMEOUT, downloads_only_from_github_over_https(), follow_github() (+13 more)

### Community 56 - "E2E Fake Backend"
Cohesion: 0.15
Nodes (15): Args, Call, defaultScenario(), FakeBackend, NEVER, NEWER_RELEASE, OCTOCAT, resource() (+7 more)

### Community 57 - "Frontend Dependencies"
Cohesion: 0.06
Nodes (31): dependencies, @astryxdesign/core@0.7.13, @astryxdesign/theme-neutral@0.7.13, clsx@^2.1.1, d3-array@^3.2.5, d3-scale@^4.0.3, d3-shape@^3.2.1, date-fns@^4.4.0 (+23 more)

### Community 58 - "Library Sync Settings UI"
Cohesion: 0.16
Nodes (24): LibrarySyncRunner(), renderRunner(), DIALOG_TEXT, DialogMode, PassphraseDialog(), syncedTime, SyncOn(), SyncSettings() (+16 more)

### Community 59 - "Agent Write Permissions"
Cohesion: 0.09
Nodes (12): AgentWritesStore, AppInfo, current_reports_product_name_given_version_and_host_platform(), serializes_to_the_ipc_contract_shape(), a_damaged_file_is_an_error_not_permission(), agents_may_not_write_until_allowed(), AgentWritesFile, FILE_NAME (+4 more)

### Community 60 - "backup.rs"
Cohesion: 0.11
Nodes (22): accepts_a_valid_backup(), BACKUP_VERSION, BackupAnnotation, BackupError, Invalid, TooLarge, UnsupportedVersion, build() (+14 more)

### Community 61 - "use-chart-phase-orchestrator.ts"
Cohesion: 0.13
Nodes (27): ChartContextValue, ChartPhase, ChartStatus, DEFAULT_CHART_LIFECYCLE, DEFAULT_CHART_STATUS, DEFAULT_Y_DOMAIN_TWEEN_MS, Y_DOMAIN_TWEEN_SKIP_THRESHOLD, lerpDomain() (+19 more)

### Community 62 - "github.rs"
Cohesion: 0.14
Nodes (13): Cache, cached(), changing_the_token_clears_answers_fetched_with_the_old_one(), GithubApi, GithubError, Format, Http, NotFound (+5 more)

### Community 63 - "preview.rs"
Cohesion: 0.14
Nodes (15): block_on(), does_not_cache_failures(), FakeCache, FakeSource, fetches_once_then_serves_from_cache(), get_preview(), Offline, PreviewCache (+7 more)

### Community 64 - "discovery.rs"
Cohesion: 0.13
Nodes (12): FakeActivity, FakeHistory, FakeRepos, GithubRepo, looks_up_valid_repository_names_only(), RateLimited, RateLimitedReleases, ReleaseSource (+4 more)

### Community 65 - "package.json"
Cohesion: 0.07
Nodes (29): description, devDependencies, prettier@^3.9.10, prettier-plugin-tailwindcss@^0.8.1, engines, node, pnpm, license (+21 more)

### Community 66 - "local_setup.rs"
Cohesion: 0.15
Nodes (19): LocalSetup, SetupItem, BARE_FLAGS, finds_skills_plugins_and_servers_but_keeps_no_secrets(), frontmatter(), github_source(), LocalAgentSetup, MAX_FILE_BYTES (+11 more)

### Community 67 - "discovery.rs (2)"
Cohesion: 0.15
Nodes (25): a_failed_release_lookup_keeps_star_growth_and_the_last_known_release(), activity_refuses_invalid_repository_names(), activity_source(), block_on(), checks_again_once_the_release_check_is_stale(), formats_dates_in_utc(), has_no_star_growth_on_the_first_day(), ignores_star_checks_older_than_a_week() (+17 more)

### Community 68 - "grid-lines.tsx"
Cohesion: 0.13
Nodes (21): AreaChartLoading(), useSettledYScale(), useYScale(), Grid(), GridProps, hideEdgeTicks(), GridColumns(), GridColumnsProps (+13 more)

### Community 69 - "browsers.rs"
Cohesion: 0.12
Nodes (25): Browser, .ALL, Brave, Chrome, Edge, Firefox, Opera, OperaGx (+17 more)

### Community 70 - "web_preview.rs"
Cohesion: 0.11
Nodes (15): blocks_reserved_ranges_and_private_ipv4_inside_ipv6(), classifies_public_and_private_addresses(), CONNECT_TIMEOUT, embedded_ipv4(), first_attribute(), is_missing_host(), is_public_ip(), MAX_CONCURRENT_FETCHES (+7 more)

### Community 71 - "package.json (2)"
Cohesion: 0.07
Nodes (27): devDependencies, @astryxdesign/cli@0.7.13, eslint@^10.14.0, eslint-config-prettier@^10.1.8, @eslint/js@^10.0.1, jsdom@^31.0.0, @tailwindcss/vite@^4.3.5, @tauri-apps/cli@^2.12.4 (+19 more)

### Community 72 - "organizer.rs"
Cohesion: 0.21
Nodes (15): create_group(), create_snippet(), delete_group(), delete_snippet(), list_groups(), list_removed_suggestions(), list_snippets(), Organizer (+7 more)

### Community 73 - "commands.rs"
Cohesion: 0.14
Nodes (13): APP_PAYLOAD, BusyGuard, get_install_defaults(), install(), InstallDefaults, Installed, InstallOptions, launch() (+5 more)

### Community 74 - "tauri.conf.json"
Cohesion: 0.08
Nodes (25): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+17 more)

### Community 75 - "library_sync_tests.rs"
Cohesion: 0.13
Nodes (7): RemoteCopy, RemoteHead, SyncCipher, Cipher, label(), Server, Unavailable

### Community 76 - "updates.rs"
Cohesion: 0.12
Nodes (22): a_later_build_of_the_same_version_is_an_update(), a_local_build_only_updates_to_a_newer_version(), a_signed_package_cannot_pose_as_another_release(), an_unrecognised_tag_is_never_offered(), check(), DATA, is_newer(), is_public_key() (+14 more)

### Community 77 - "community_auth.rs"
Cohesion: 0.20
Nodes (4): BrowserOpener, Session, SupabaseAuth, http_client()

### Community 78 - "community.rs"
Cohesion: 0.15
Nodes (17): browse(), collection(), CommunityError, Invalid, Source, Store, delete_account(), my_collections() (+9 more)

### Community 79 - "agent-settings.tsx"
Cohesion: 0.17
Nodes (21): AgentConnectionSettings(), agentWritesQueryKey, AgentWritesSwitch(), claudeCommand(), errorText(), GithubStarsSettings(), mcpJson(), starSyncQueryKey (+13 more)

### Community 80 - "cover_maker.rs"
Cohesion: 0.11
Nodes (13): COVER_HEIGHT, COVER_WIDTH, keeps_even_noisy_images_under_the_upload_limit(), lays_transparency_on_white(), MAX_COVER_BYTES, MAX_DECODE_BYTES, MAX_IMAGE_BYTES, MAX_SIDE (+5 more)

### Community 81 - "use-app-info.test.tsx"
Cohesion: 0.15
Nodes (17): errorText(), UpdateNavItem(), openExternal(), RELEASE, renderCheck(), useUpdateCheck(), checkForUpdate(), getAppInfo() (+9 more)

### Community 82 - "dashboard-page.tsx"
Cohesion: 0.16
Nodes (21): Collections(), DashboardPage(), heroSummary(), LatestRow(), LatestSaves(), LibraryOverview(), LibrarySlot(), LibraryState (+13 more)

### Community 83 - "snippets-page.tsx"
Cohesion: 0.19
Nodes (18): CODE_FONT, DeleteDialog(), Dialog, matches(), message(), SnippetCard(), SnippetForm(), SnippetsPage() (+10 more)

### Community 84 - "snippets.rs"
Cohesion: 0.20
Nodes (17): clean_tags(), clean_snippet(), cleans_title_language_tags_and_blank_links(), create_snippet(), delete_snippet(), input(), keeps_code_whitespace_exactly(), list_snippets() (+9 more)

### Community 85 - "agent_setups.rs"
Cohesion: 0.15
Nodes (16): browse(), report(), setup(), SetupError, Community, Invalid, Server, SetupInputError (+8 more)

### Community 86 - "tsconfig.base.json"
Cohesion: 0.09
Nodes (22): compilerOptions, forceConsistentCasingInFileNames, isolatedModules, lib, module, moduleDetection, moduleResolution, noEmit (+14 more)

### Community 87 - "viewer.service.ts"
Cohesion: 0.18
Nodes (19): SiteViewer(), SiteViewerProps, BACK_LABELS, backTarget(), NewsViewerPage(), webUrl, boundsOf(), closeViewer() (+11 more)

### Community 88 - "mcp.rs"
Cohesion: 0.29
Nodes (10): an_agent_writes_a_saved_links_note_and_nothing_else(), DevAtlasServer, json(), reading_the_library_changes_nothing(), text(), to_patch(), turns_the_agents_words_into_a_patch(), update() (+2 more)

### Community 89 - "community_auth.rs (2)"
Cohesion: 0.13
Nodes (15): body(), drops_avatars_not_hosted_by_github(), ID, is_token(), MAX_EXPIRES_IN, MAX_TOKEN_LEN, MAX_USERNAME_CHARS, parse_session() (+7 more)

### Community 90 - "rankings.rs"
Cohesion: 0.16
Nodes (14): block_on(), clean(), FakeIndexes, keeps_readable_indexes_sorted_cleaned_and_trimmed(), language_rankings(), LanguageRank, LanguageRanking, Offline (+6 more)

### Community 91 - "library.rs"
Cohesion: 0.15
Nodes (12): add(), add_remembering(), block_on(), BookmarkSource, FakeMemory, FakeSaved, FakeSource, LibraryMemory (+4 more)

### Community 92 - "community_setups.rs"
Cohesion: 0.14
Nodes (10): a_page_skips_malformed_rows_but_pages_on_the_raw_count(), ITEM_FIELDS, OWNER, parse_page(), parse_setup(), parses_a_setup_in_position_order_dropping_unsafe_items(), RawItem, RawSetup (+2 more)

### Community 93 - "account-nav-item.tsx"
Cohesion: 0.26
Nodes (15): AccountNavItem(), avatarIcon(), shortName(), GithubSignIn(), GithubSignInProps, OwnerAvatar(), CommunitySignInGate(), SignInPanel() (+7 more)

### Community 94 - "suggestions.rs"
Cohesion: 0.18
Nodes (10): block_on(), FakeStore, list_removed(), MAX_RESTORED, refuses_an_empty_id(), refuses_to_restore_too_many_at_once(), remove_suggestion(), removes_and_restores_a_suggestion() (+2 more)

### Community 95 - "backup_file.rs"
Cohesion: 0.17
Nodes (20): backup(), BackupFileError, TooLarge, Unreadable, Unrecognized, Write, ImportFile, Backup (+12 more)

### Community 96 - "add-link-form.tsx"
Cohesion: 0.19
Nodes (13): LibraryWatcher(), AddLinkForm(), addLinkSchema, AddLinkValues, ResourceViewer(), ResourceViewerPage(), libraryQueryKey, useLibrary() (+5 more)

### Community 97 - "library_sync.rs"
Cohesion: 0.21
Nodes (11): KEY_ACCOUNT, library_sync_status(), LibrarySyncSetup, with_sync!, SIGN_IN, signed_in(), start_library_sync_over(), sync_library() (+3 more)

### Community 98 - "settings.rs"
Cohesion: 0.19
Nodes (10): browser_options(), clear_github_token(), complete_onboarding(), get_onboarded(), get_settings(), load_github_token(), Secrets, set_github_token() (+2 more)

### Community 99 - "package.json (3)"
Cohesion: 0.10
Nodes (20): dependencies, @astryxdesign/core@0.7.13, @astryxdesign/theme-neutral@0.7.13, @fontsource-variable/geist@^5.3.0, lucide-react@^1.71.0, react@^19.3.1, react-dom@^19.3.1, @stylexjs/stylex@^0.19.1 (+12 more)

### Community 100 - "agent_setups.rs (2)"
Cohesion: 0.15
Nodes (15): entry(), install_commands(), InstallCommand, MAX_ITEM_DESCRIPTION_CHARS, MAX_ITEMS, MAX_NAME_LEN, MAX_OFFSET, MAX_PACKAGE_LEN (+7 more)

### Community 101 - "agent_usage.rs"
Cohesion: 0.15
Nodes (10): AgentUsage, usage_this_week(), UsageLog, a_large_log_drops_old_lookups(), counts_recent_lookups_and_remembers_the_last(), FILE_NAME, JsonlUsageLog, KEEP_MS (+2 more)

### Community 102 - "rankings.rs (2)"
Cohesion: 0.16
Nodes (13): MONTHS, parse_pypl(), parse_tiobe(), percent(), PYPL_DATA_URL, RANKING_CACHE_FOR, ranks_by_share(), ranks_pypl_shares_and_compares_with_a_year_earlier() (+5 more)

### Community 103 - "projection-utils.ts"
Cohesion: 0.19
Nodes (17): buildAutoFutureValues(), buildProjectionPath(), BuildProjectionPathOptions, buildTargetPath(), computeProjectionAnchorTangentSlope(), intervalFromAdjacentRows(), intervalFromSeriesSpan(), linearRegressionSlope() (+9 more)

### Community 104 - "system.rs"
Cohesion: 0.15
Nodes (13): APP_EXE, uninstall(), CREATE_NO_WINDOW, create_shortcut(), is_registered(), register(), schedule_removal(), uninstall_path() (+5 more)

### Community 105 - "library_sync_server.rs"
Cohesion: 0.15
Nodes (10): error_code(), reads_server_messages_as_bounded_plain_text(), server_message(), CHANGED_MEANWHILE, MAX_COPY_BYTES, RawCopy, RawHead, RemoteHead (+2 more)

### Community 106 - "community.rs (2)"
Cohesion: 0.16
Nodes (6): CommunityAuth, CommunitySource, CommunityUser, PublishOutcome, NotYours, Published

### Community 107 - "agent_setups.rs (3)"
Cohesion: 0.20
Nodes (8): detect(), detect_agent_setup(), get_shared_setup(), list_shared_setups(), report_shared_setup(), share_agent_setup(), signed_in_id(), unshare_agent_setup()

### Community 108 - "community_tests.rs"
Cohesion: 0.20
Nodes (6): CollectionFilter, PublishRequest, a_collection_says_whether_the_account_follows_it(), detail(), FakeSource, follower_counts_must_be_non_negative_integers_that_fit()

### Community 109 - "discovery.rs (3)"
Cohesion: 0.14
Nodes (16): asks_for_repositories_created_within_the_period(), passes_valid_language_names_through(), rejects_languages_that_could_inject_search_qualifiers(), RepoError, InvalidName, Source, search(), trending_repos() (+8 more)

### Community 110 - "star_history.rs"
Cohesion: 0.24
Nodes (14): is_repo_name(), boards(), caps_ranked_lists(), clean(), drops_names_that_are_not_github_repositories(), MAX_RANDOM_POOL, MAX_RANKED, repo() (+6 more)

### Community 111 - "logging.rs"
Cohesion: 0.21
Nodes (11): creates_the_folder_and_appends_to_a_small_log(), empties_an_oversized_log_it_cannot_move_and_keeps_appending(), init(), log_file_name(), MAX_LOG_BYTES, moves_an_oversized_log_aside_replacing_the_previous_one(), open_log_file(), panic_message() (+3 more)

### Community 112 - "package.json (4)"
Cohesion: 0.12
Nodes (16): tailwind-merge@^3.7.0, eslint-plugin-react-hooks@^7.1.1, eslint-plugin-react-refresh@^0.5.7, @types/d3-array@^3.2.2, typescript@~6.0.3, typescript-eslint@^8.72.2, eslint-plugin-react-hooks, eslint-plugin-react-refresh (+8 more)

### Community 113 - "package.json (5)"
Cohesion: 0.12
Nodes (17): devDependencies, @astryxdesign/cli@0.7.13, eslint@^10.14.0, @eslint/js@^10.0.1, eslint-plugin-react-hooks@^7.1.1, globals@^17.14.0, @types/node@^26.6.6, @types/react@^19.3.0 (+9 more)

### Community 114 - "tauri.conf.json (2)"
Cohesion: 0.12
Nodes (16): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+8 more)

### Community 115 - "agent_setups_tests.rs"
Cohesion: 0.21
Nodes (11): preview(), block_on(), builds_install_commands_only_from_checked_sources(), commands(), github(), item(), lists_an_item_set_up_in_both_agents_once_and_drops_unsafe_names(), npm() (+3 more)

### Community 116 - "agent.rs"
Cohesion: 0.31
Nodes (14): dependency(), FakeManifests, go_major_version_suffixes_still_match(), ids(), item(), library(), lists_one_category_by_title_a_page_at_a_time(), scoped_packages_match_by_their_package_name() (+6 more)

### Community 117 - "install_location.rs"
Cohesion: 0.15
Nodes (8): AppReplacer, InstalledApp, APP_EXE, finds_the_installed_app_only_while_it_exists(), installed_app(), installed_app_at(), set_installed_version(), UNINSTALL_KEY

### Community 118 - "BACKUPS.md"
Cohesion: 0.16
Nodes (13): One-click signed update, Backing up the Community database, Community Supabase project, Restore into a new Supabase project, In-app updater (forward-only, signature-verified), Releasing DevAtlas, Update signing key pair (update-signing.pub), DEVATLAS_BUILD run number (+5 more)

### Community 119 - "gradients.tsx"
Cohesion: 0.22
Nodes (13): GradientDarkgreenGreen(), GradientLightgreenGreen(), GradientOrangeRed(), GradientPinkBlue(), GradientPinkRed(), GradientPurpleOrange(), GradientPurpleTeal(), GradientSteelPurple() (+5 more)

### Community 120 - "community-page.tsx"
Cohesion: 0.28
Nodes (14): CollectionCard(), CollectionGrid(), CommunityContent(), Everyone(), GridSkeleton(), linkCount(), Mine(), SetupCard() (+6 more)

### Community 121 - "settings.rs (2)"
Cohesion: 0.21
Nodes (8): BookmarkSettings, BrokenStore, BrowserOption, MemoryStore, ProfileOption, SettingsStore, SettingsView, Unreadable

### Community 122 - "credentials.rs"
Cohesion: 0.22
Nodes (4): SecretStore, CredentialError, GITHUB_TOKEN_ACCOUNT, KeyringSecret

### Community 123 - "app_update.rs"
Cohesion: 0.15
Nodes (9): LatestTagSource, UpdateDownloader, DownloadError, Http, Missing, NotGithub, Status, TooLarge (+1 more)

### Community 124 - "build.rs"
Cohesion: 0.20
Nodes (6): COMMANDS, BuildResult, COMMANDS, embed_payload(), main(), target_dir()

### Community 125 - "tools.rs"
Cohesion: 0.31
Nodes (8): now_ms(), check_links(), export_backup(), import_file(), library_backup(), SAVE_FAILED, store_error(), ImportSummary

### Community 126 - "news.rs"
Cohesion: 0.27
Nodes (5): get_star_boards(), list_language_rankings(), list_news(), list_top_stories(), News

### Community 127 - "uninstall.rs"
Cohesion: 0.21
Nodes (7): UNINSTALL_KEY, UNINSTALLER_EXE, FLAG, run(), show(), TITLE, uninstaller_location()

### Community 128 - "agent_setups_tests.rs (2)"
Cohesion: 0.20
Nodes (4): PublishItem, PublishSetupRequest, FakeServer, reads_a_setup_summary_only_with_a_valid_owner_and_time()

### Community 129 - "updates.rs (2)"
Cohesion: 0.22
Nodes (5): block_on(), FakeReleases, newer_release(), no_release_means_no_update(), only_a_newer_tag_spends_a_release_api_request()

### Community 130 - "web_preview.rs (2)"
Cohesion: 0.18
Nodes (8): is_public_url(), rejects_non_public_urls_before_connecting(), WebPreviewError, Closed, Http, Image, NotAnImage, NotPublic

### Community 131 - "follow-button.tsx"
Cohesion: 0.35
Nodes (10): FollowButton(), FollowerCount(), Heart(), SlidingCount(), AddAllButton(), CollectionView(), SharedCollection(), SharedCollectionPage() (+2 more)

### Community 132 - "agent.rs (2)"
Cohesion: 0.17
Nodes (12): Dependency, Ecosystem, Cargo, Go, Npm, Python, is_major_version(), ProjectManifests (+4 more)

### Community 133 - "agent_setups.rs (4)"
Cohesion: 0.18
Nodes (9): SetupKind, McpServer, Plugin, Skill, SetupTool, ClaudeCode, Codex, untrusted_item() (+1 more)

### Community 134 - "organizer.rs (2)"
Cohesion: 0.15
Nodes (13): clean_note(), InvalidInput, CodeRequired, CodeTooLong, DescriptionTooLong, InvalidId, LanguageTooLong, NameRequired (+5 more)

### Community 135 - "preview_cache.rs"
Cohesion: 0.29
Nodes (4): JsonPreviewCache, persists_entries_across_instances(), starts_empty_when_the_file_is_missing_or_corrupt(), temp_file()

### Community 136 - "system-design.md"
Cohesion: 0.22
Nodes (8): Dependency Rules, Application data layout (app_data_dir), devatlas-application crate, devatlas-desktop crate (composition root), devatlas-domain crate, devatlas-storage crate, get_app_info reference IPC flow, System Design

### Community 137 - "README.md"
Cohesion: 0.19
Nodes (11): Let Agents Edit Notes and Tags (agent-writes.json), Bounded Log File, Local SQLite Database (bound queries), Single Instance Plugin, get_project_stack tool, get_resource tool, list_library tool, DevAtlas MCP Server (DevAtlas.exe --mcp) (+3 more)

### Community 138 - "AGENTS.md"
Cohesion: 0.20
Nodes (8): E2E fake backend (e2e/fake-backend.ts), freeze-prototype.js hardening script, Astryx design system, ADR-001: Tauri 2 and Rust, Tauri capability-based IPC permissions, Tauri 2 + Rust + React stack, WebView2, End-to-end Tests Job

### Community 139 - "date-ticker.tsx"
Cohesion: 0.29
Nodes (11): DateTicker(), DateTickerCompact, DateTickerInner, DateTickerProps, driveSpring(), segmentIndexAt(), TICKER_SPRING, TickerSegment (+3 more)

### Community 140 - "preview.rs (2)"
Cohesion: 0.24
Nodes (3): get_resource_preview(), Previews, WebPreviewFetcher

### Community 141 - "community_covers.rs"
Cohesion: 0.21
Nodes (8): MAX_LINK_IMAGES, a_card_shows_the_first_three_link_images(), BUCKET, deleting_keeps_only_the_named_images_and_drops_old_covers(), ID, image_addresses_point_at_this_projects_storage_and_change_with_their_version(), object(), stale_objects()

### Community 142 - "agent_setups.rs (5)"
Cohesion: 0.24
Nodes (6): is_npm_part(), is_word(), SetupSource, Github, Npm, Pypi

### Community 143 - "library.rs (2)"
Cohesion: 0.26
Nodes (6): SavedLink, SavedLinkStore, apply_links(), link_key(), applies_link_changes_in_place_and_hides_removed_bookmarks(), Files

### Community 144 - "PRODUCT.md"
Cohesion: 0.24
Nodes (7): Live read-only bookmark source, Network source allow-list (GitHub, HN, blogs, TIOBE/PYPL), DevAtlas Product Brief, Database Design, SQLite-first via SQLx, ADR-002: Local-first, Optional opt-in synchronization

### Community 145 - "package.json (6)"
Cohesion: 0.18
Nodes (10): jsdom@^31.0.0, @testing-library/jest-dom@^7.0.1, typescript-eslint@^8.72.2, jsdom, @testing-library/jest-dom, typescript-eslint, name, private (+2 more)

### Community 146 - "ci.yml"
Cohesion: 0.24
Nodes (8): Contributing Guide, Microsoft C++ Build Tools (MSVC), Windows Development Setup, Dependency Audit Job, CI Workflow, Windows Desktop Build Job, Frontend Checks Job, Rust Checks (Windows) Job

### Community 147 - "community.rs (3)"
Cohesion: 0.20
Nodes (11): CommunityInputError, GroupNotFound, InvalidId, NoLinks, NotFound, NotSignedIn, OwnCollection, ReasonTooLong (+3 more)

### Community 148 - "updates.rs (3)"
Cohesion: 0.25
Nodes (8): install_update(), package_name(), package_url(), UpdateError, BadSignature, Download, Install, UnknownTag

### Community 149 - "security-model.md"
Cohesion: 0.20
Nodes (8): Browser Extension Channel (paired secret), Collection Link Images (collection-covers bucket), End-to-End Encrypted Library Sync, Link Health Checks, Saved Links (saved-links.json), Backup and Import, Dead-Link Checker, Roadmap

### Community 150 - ".prettierrc.json"
Cohesion: 0.18
Nodes (10): endOfLine, overrides, plugins, printWidth, $schema, semi, singleQuote, tailwindFunctions (+2 more)

### Community 151 - "install.rs"
Cohesion: 0.22
Nodes (10): InstallError, AppRunning, Io, MissingPayload, NotEnoughSpace, Registry, Shortcut, UnsupportedPath (+2 more)

### Community 152 - "updates.rs (4)"
Cohesion: 0.31
Nodes (8): a_package_the_key_did_not_sign_is_never_installed(), a_tag_that_is_not_a_release_name_downloads_nothing(), an_older_signed_package_is_refused_under_a_newer_tag(), FakeApp, FakeDownloads, install(), installs_a_signed_package_from_the_release(), signed_downloads()

### Community 153 - "security-model.md (2)"
Cohesion: 0.22
Nodes (6): GitHub Stars Import and Sync, Collections and Snippets, DevAtlas (local-first developer bookmark manager), Discover (Repos, Star History, News, Languages), Library (browser bookmarks, saved links), Tech Stack (Tauri 2, Rust, React 19, TypeScript 6)

### Community 155 - "lib.rs"
Cohesion: 0.31
Nodes (6): remove_previous_version(), database_file(), focus_main_window(), init_tracing(), run(), run_mcp()

### Community 156 - "tsconfig.json"
Cohesion: 0.22
Nodes (8): compilerOptions, jsx, lib, paths, types, extends, include, ../../tsconfig.base.json

### Community 157 - "tsconfig.json (2)"
Cohesion: 0.22
Nodes (8): compilerOptions, jsx, lib, paths, types, extends, include, ../../tsconfig.base.json

### Community 158 - "settings.rs (3)"
Cohesion: 0.39
Nodes (3): a_file_from_before_onboarding_reads_as_not_onboarded(), JsonSettings, starts_empty_and_round_trips()

### Community 159 - "library.rs (3)"
Cohesion: 0.28
Nodes (3): FakeCache, FakePreviews, Offline

### Community 160 - "0001_organizer.sql"
Cohesion: 0.28
Nodes (7): group_resources, group_resources_by_resource, link_groups, resource_annotations, resource_tags, link_checks, snippets

### Community 161 - "web_preview.rs (3)"
Cohesion: 0.33
Nodes (8): a_success_on_another_site_means_it_moved(), a_success_on_the_same_site_is_fine(), default_icon(), judge(), only_404_and_410_mean_a_page_is_gone(), resolve_web_url(), same_site(), url()

### Community 162 - "tsconfig.json (3)"
Cohesion: 0.25
Nodes (7): compilerOptions, lib, paths, types, extends, include, ../../../tsconfig.base.json

### Community 163 - "package.json (7)"
Cohesion: 0.25
Nodes (8): scripts, build, dev, lint, tauri, test, test:e2e, typecheck

### Community 165 - "web_preview.rs (4)"
Cohesion: 0.39
Nodes (8): drops_images_and_icons_that_point_at_private_addresses(), drops_the_default_icon_of_a_private_page(), extract_preview(), extracts_og_image_and_apple_touch_icon_resolved_against_the_page(), extracts_the_title_preferring_og_title_and_tidying_whitespace(), falls_back_to_twitter_image_and_shortcut_icon(), page(), uses_favicon_ico_and_ignores_non_web_image_urls()

### Community 166 - "README.md (2)"
Cohesion: 0.29
Nodes (6): Astryx Design System (@astryxdesign/core), DevAtlas Setup Installer, In-App Update, Indigo Aurora Theme, Testing and Quality Checks, Release Pipeline (ci.yml + release.yml)

### Community 168 - "tsconfig.node.json"
Cohesion: 0.29
Nodes (6): compilerOptions, lib, types, extends, include, ../../tsconfig.base.json

### Community 169 - "package.json (8)"
Cohesion: 0.29
Nodes (7): scripts, build, dev, lint, tauri, test, typecheck

### Community 170 - "tsconfig.node.json (2)"
Cohesion: 0.29
Nodes (6): compilerOptions, lib, types, extends, include, ../../tsconfig.base.json

### Community 172 - "default.json"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, webviews

### Community 174 - "default.json (2)"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 175 - "discovery.rs (4)"
Cohesion: 0.53
Nodes (3): FakeSource, TrendingQuery, TrendingSource

### Community 176 - "organizer.rs (3)"
Cohesion: 0.40
Nodes (4): ReadingStatus, ToRead, Trying, Using

### Community 178 - "index.html"
Cohesion: 0.50
Nodes (4): Desktop app index.html, Indigo Aurora colour palette, Installer index.html (DevAtlas Setup UI), pnpm workspace (apps/*, packages/*)

### Community 179 - "y-axis-ticks.ts"
Cohesion: 0.40
Nodes (3): Y_AXIS_DEFAULT_TICK_COUNT, Y_AXIS_MAX_TICK_COUNT, Y_AXIS_MIN_TICK_COUNT

### Community 180 - "install.rs (2)"
Cohesion: 0.40
Nodes (5): Step, Configuring, Extracting, Finalizing, Preparing

### Community 181 - "library_sync.rs (2)"
Cohesion: 0.40
Nodes (5): SyncStatus, NeedsPassphrase, Off, On, SignedOut

### Community 182 - "index.html (2)"
Cohesion: 0.50
Nodes (5): DevAtlas Website Landing Page, Copy-to-Clipboard Button Script, Website FAQ, MCP Server Section, JSON-LD SoftwareApplication and FAQPage

### Community 183 - "README.md (3)"
Cohesion: 0.50
Nodes (4): Agent Setups Sharing, Community (Supabase, RLS, GitHub OAuth PKCE), Agent Setups (Community), Community Sharing

### Community 184 - "package.json (9)"
Cohesion: 0.50
Nodes (3): @playwright/test@1.64.1, isCi, @playwright/test

### Community 185 - "Cargo.toml"
Cohesion: 1.00
Nodes (4): devatlas-application, devatlas-desktop, devatlas-domain, devatlas-storage

### Community 186 - "release-notes.test.sh"
Cohesion: 0.83
Nodes (3): commit(), fail(), release-notes.test.sh script

## Ambiguous Edges - Review These
- `End-to-End Encrypted Library Sync` → `Roadmap`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to
- `In-App Update` → `Roadmap`  [AMBIGUOUS]
  README.md · relation: conceptually_related_to
- `DevAtlas Product Brief` → `Optional opt-in synchronization`  [AMBIGUOUS]
  apps/desktop/PRODUCT.md · relation: conceptually_related_to
- `Local-first architecture` → `Community Supabase project`  [AMBIGUOUS]
  docs/operations/BACKUPS.md · relation: conceptually_related_to

## Knowledge Gaps
- **214 isolated node(s):** `../../../tsconfig.base.json`, `Back`, `Forward`, `Reload`, `../../tsconfig.base.json` (+209 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 1191 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **53 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@tauri-apps/plugin-dialog` connect `Installer UI` to `package.json (6)`, `package.json (3)`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `../../../tsconfig.base.json`, `Back`, `Forward` to the rest of the system?**
  _214 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Chart Band Config` be split into smaller, more focused modules?**
  _Cohesion score 0.04005791505791506 - nodes in this community are weakly interconnected._
- **Why does `SupabaseCommunity` connect `Community Link Images Storage` to `Community Commands`, `library_sync_server.rs`, `community.rs (2)`, `community_covers.rs`, `community_auth.rs`, `Community Supabase Client`, `community_setups.rs`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Should `Desktop App Shell & Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.04302303445650105 - nodes in this community are weakly interconnected._

### Low-confidence Hints
_AMBIGUOUS edges — the extractor was unsure. Verify before acting on these._

- **What is the exact relationship between `End-to-End Encrypted Library Sync` and `Roadmap`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
- **What is the exact relationship between `In-App Update` and `Roadmap`?**
  _Edge tagged AMBIGUOUS (relation: conceptually_related_to) - confidence is low._
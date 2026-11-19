# Installer Extraction

> 36 nodes · cohesion 0.12

## Key Concepts

- **install.rs** (53 connections) — `apps/installer/src-tauri/src/install.rs`
- **install()** (16 connections) — `apps/installer/src-tauri/src/install.rs`
- **extract()** (10 connections) — `apps/installer/src-tauri/src/install.rs`
- **.new()** (10 connections) — `apps/installer/src-tauri/src/install.rs`
- **fake_uninstaller()** (7 connections) — `apps/installer/src-tauri/src/install.rs`
- **Progress** (7 connections) — `apps/installer/src-tauri/src/install.rs`
- **available_space()** (6 connections) — `apps/installer/src-tauri/src/install.rs`
- **copy_uninstaller()** (6 connections) — `apps/installer/src-tauri/src/install.rs`
- **installs_then_uninstalls_without_touching_user_files()** (5 connections) — `apps/installer/src-tauri/src/install.rs`
- **copying_the_uninstaller_onto_itself_is_a_no_op()** (4 connections) — `apps/installer/src-tauri/src/install.rs`
- **is_local_absolute()** (4 connections) — `apps/installer/src-tauri/src/install.rs`
- **refuses_to_install_without_an_embedded_app()** (4 connections) — `apps/installer/src-tauri/src/install.rs`
- **rejects_a_relative_folder_before_touching_the_disk()** (4 connections) — `apps/installer/src-tauri/src/install.rs`
- **required_bytes()** (4 connections) — `apps/installer/src-tauri/src/install.rs`
- **required_bytes_counts_the_app_and_the_uninstaller()** (4 connections) — `apps/installer/src-tauri/src/install.rs`
- **TempDir** (4 connections) — `apps/installer/src-tauri/src/install.rs`
- **write_chunked()** (4 connections) — `apps/installer/src-tauri/src/install.rs`
- **available_space_measures_the_nearest_existing_folder()** (3 connections) — `apps/installer/src-tauri/src/install.rs`
- **extract_percent()** (3 connections) — `apps/installer/src-tauri/src/install.rs`
- **extracts_the_payload_atomically_and_reports_rising_progress()** (3 connections) — `apps/installer/src-tauri/src/install.rs`
- **move_aside_and_place()** (3 connections) — `apps/installer/src-tauri/src/install.rs`
- **only_local_drive_paths_are_installable()** (3 connections) — `apps/installer/src-tauri/src/install.rs`
- **replaces_an_app_that_is_still_running()** (3 connections) — `apps/installer/src-tauri/src/install.rs`
- **replaces_the_app_while_an_earlier_copy_set_aside_still_runs()** (3 connections) — `apps/installer/src-tauri/src/install.rs`
- **Request** (3 connections) — `apps/installer/src-tauri/src/install.rs`
- *... and 11 more nodes in this community*

## Relationships

- [install.rs](install.rs.md) (9 shared connections)
- [commands.rs](commands.rs.md) (7 shared connections)
- [system.rs](system.rs.md) (7 shared connections)
- [uninstall.rs](uninstall.rs.md) (3 shared connections)
- [Agent Write Permissions](Agent_Write_Permissions.md) (2 shared connections)
- [install.rs (2)](install.rs_2.md) (2 shared connections)
- [backup.rs](backup.rs.md) (1 shared connections)
- [logging.rs](logging.rs.md) (1 shared connections)
- [build.rs](build.rs.md) (1 shared connections)
- [agent_usage.rs](agent_usage.rs.md) (1 shared connections)
- [Project Manifest Parsing](Project_Manifest_Parsing.md) (1 shared connections)
- [saved_links.rs](saved_links.rs.md) (1 shared connections)

## Source Files

- `apps/installer/src-tauri/src/commands.rs`
- `apps/installer/src-tauri/src/install.rs`

## Audit Trail

- EXTRACTED: 109 (95%)
- INFERRED: 6 (5%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*
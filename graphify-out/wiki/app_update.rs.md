# app_update.rs

> 15 nodes · cohesion 0.15

## Key Concepts

- **DownloadError** (8 connections) — `crates/storage/src/app_update.rs`
- **LatestTagSource** (6 connections) — `crates/application/src/updates.rs`
- **UpdateDownloader** (5 connections) — `crates/application/src/updates.rs`
- **UpdateDownloads** (5 connections) — `crates/storage/src/app_update.rs`
- **Output** (4 connections)
- **.download()** (4 connections) — `crates/storage/src/app_update.rs`
- **.latest_tag()** (2 connections) — `crates/application/src/updates.rs`
- **.download()** (2 connections) — `crates/application/src/updates.rs`
- **Status** (2 connections) — `crates/storage/src/app_update.rs`
- **.new()** (2 connections) — `crates/storage/src/app_update.rs`
- **Http** (1 connections) — `crates/storage/src/app_update.rs`
- **Missing** (1 connections) — `crates/storage/src/app_update.rs`
- **NotGithub** (1 connections) — `crates/storage/src/app_update.rs`
- **TooLarge** (1 connections) — `crates/storage/src/app_update.rs`
- **Client** (1 connections)

## Relationships

- [Self-Update Install](Self-Update_Install.md) (4 shared connections)
- [updates.rs](updates.rs.md) (2 shared connections)
- [updates.rs (2)](updates.rs_2.md) (2 shared connections)
- [GitHub API Client](GitHub_API_Client.md) (1 shared connections)
- [github.rs](github.rs.md) (1 shared connections)
- [discovery.rs](discovery.rs.md) (1 shared connections)
- [install_location.rs](install_location.rs.md) (1 shared connections)
- [updates.rs (4)](updates.rs_4.md) (1 shared connections)

## Source Files

- `crates/application/src/updates.rs`
- `crates/storage/src/app_update.rs`

## Audit Trail

- EXTRACTED: 29 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*
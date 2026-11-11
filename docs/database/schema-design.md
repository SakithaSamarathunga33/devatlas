# Database design

> Status: **in use** for annotations, collections, snippets and repository history; see
> `crates/storage/migrations`. Links themselves still live in browser bookmarks and
> `saved-links.json`, so resource ids carry no foreign key.

## Approach

DevAtlas is SQLite-first: one embedded database file per user, owned by the Rust backend.

- **Engine:** SQLite, accessed through SQLx from `crates/storage` only.
- **Location:** `devatlas.db` in the app-data directory resolved by Tauri's path API (see
  [system design](../architecture/system-design.md#application-data-layout-planned)). Debug builds
  use `devatlas-dev.db`, so a work-in-progress migration never touches installed data.
- **Access path:** UI → command → application use case → repository port → SQLx implementation.
  The frontend never touches the database.
- **Migrations:** versioned SQL files committed to the repository and applied at startup by the
  storage layer. Migrations are append-only once released.
- **Durability:** WAL journal mode, foreign keys enforced, regular backups to `backups/`.
- **Identifiers:** UUIDs generated in Rust, so records can later be synchronized without ID
  collisions (see [ADR-002](../decisions/ADR-002-local-first.md)).
- **Timestamps:** stored as UTC (ISO-8601 text or Unix epoch), converted for display in the UI.

## Expected areas (to be designed with their features)

These are listed to guide planning only; their schemas are decided in the milestones that build
them.

- Resources (URL, title, description, kind, ecosystem, timestamps)
- Tags and collections, and their many-to-many links to resources
- Extracted metadata cache (favicons, thumbnails — files in `cache/`, references in the DB)
- Full-text search index (SQLite FTS5)

## Out of scope until required

Semantic search, AI artifacts, sync metadata, and multi-user concerns are not part of the initial
schema and will each be introduced with an ADR when a milestone needs them.

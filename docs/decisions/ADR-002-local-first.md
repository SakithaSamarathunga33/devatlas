# ADR-002: Local-first, with synchronization as a future option

- **Status:** Accepted
- **Date:** 2026-11-10
- **Milestone:** DEVATLAS-001

## Context

DevAtlas holds a developer's personal library: bookmarks, notes, project associations, and
eventually AI-derived summaries. Users expect it to be instant, to work offline, and to keep
personal notes private. There is no team or multi-user requirement today.

## Options considered

1. **Cloud-first** (server database, accounts, the desktop app as a client) — enables sync from day
   one, but requires hosting, authentication, and an always-online dependency, and moves personal
   data off the device by default.
2. **Local-first** (embedded SQLite on the device, no account) with optional sync added later.

## Decision

DevAtlas is **local-first**. The source of truth is an embedded SQLite database in the user's
app-data directory. The app works fully offline and requires no account. Synchronization across
devices may be added later as an **optional, opt-in** capability.

## Consequences

**Positive**

- Instant reads and writes; no network latency or outages.
- Privacy by default: data stays on the device unless the user opts into a feature that sends it.
- No servers, accounts, or authentication to build or operate for the core product.
- Backups and exports are simple file operations.

**Negative / risks**

- No cross-device access until sync exists.
- Users are responsible for their device's data; mitigated by automatic local backups and export.

**Design constraints this decision imposes now**

- Use globally unique identifiers (UUIDs) and UTC timestamps so data can be merged later.
- Keep persistence behind application-layer ports so a sync engine can be added without rewriting
  use cases.
- Any feature that transmits user data (AI, sync, metadata fetches) requires explicit user consent
  and is documented in the [security model](../security/security-model.md).

# Security model

DevAtlas runs untrusted-by-default web content (the UI) in a webview and keeps all privileged
operations in Rust. The security model is about keeping that boundary narrow.

## Current protections (DEVATLAS-001)

| Protection                                                                                                                                                                                          | Where                                  |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| **Least-privilege capabilities.** The main window is granted exactly one permission, `allow-get-app-info`. No core plugin permissions, no `fs`, `shell`, `http`, or `opener` plugins are installed. | `src-tauri/capabilities/default.json`  |
| **Explicit command allow-list.** App commands are declared in `AppManifest::commands`, so an unlisted or ungranted command is rejected by Tauri's ACL.                                              | `src-tauri/build.rs`                   |
| **Strict Content Security Policy.** Scripts only from the app bundle; no remote origins; IPC endpoints only; `object-src 'none'`, `frame-ancestors 'none'`.                                         | `tauri.conf.json` → `app.security.csp` |
| **Prototype freezing** to make prototype-pollution attacks on the IPC bridge harder.                                                                                                                | `tauri.conf.json` → `freezePrototype`  |
| **Typed, validated IPC.** Rust returns typed, serializable structs; the frontend treats responses as `unknown` and validates them with Zod before use.                                              | `services/`, `types/`                  |
| **No unsafe Rust.** `unsafe_code = "forbid"` workspace-wide.                                                                                                                                        | root `Cargo.toml`                      |
| **No secrets.** No credentials, tokens, or environment secrets exist in the repo or CI.                                                                                                             | —                                      |
| **No hard-coded paths.** Paths will be resolved through Tauri's path API.                                                                                                                           | —                                      |

`style-src` allows `'unsafe-inline'` because UI libraries inject runtime styles; scripts remain
strictly same-origin.

## Requirements for future features

These are not implemented yet; they are binding requirements for the milestones that add them.

- **New permissions:** every new command or plugin permission must be granted per window, scoped
  to the minimum (e.g. file-system scopes limited to the app-data directory), and justified in
  the PR.
- **IPC input validation:** commands that accept input validate it in Rust (domain types), not
  only in the UI. Errors returned to the UI must not leak internal paths or SQL.
- **File system:** no unrestricted file-system access. The backend reads and writes only inside the
  app-data directory unless the user explicitly picks a file through a native dialog.
- **External URLs:** URLs are parsed and validated in Rust; only `http`/`https` are accepted. Links
  open in the system browser through an explicit, scoped opener permission — never inside the app
  webview.
- **Metadata extraction (SSRF prevention):** fetching happens in Rust with: `http`/`https` only;
  DNS resolution checked against loopback, link-local, private (RFC 1918/4193), and metadata
  addresses (e.g. `169.254.169.254`) — re-checked after every redirect; capped redirects, response
  size, and timeouts; no credentials or cookies forwarded; HTML treated as untrusted and sanitized
  before display.
- **AI features:** personal notes or resource content are sent to an AI provider only with explicit,
  revocable user consent, with clear indication of what is transmitted. API keys are stored in the
  OS credential store, never in plain-text config or the database.
- **Browser extension channel:** desktop ↔ extension communication must be local-only and
  authenticated (paired secret), and must reject requests from arbitrary web pages.
- **Dependencies:** new dependencies are reviewed for necessity and maintenance; lockfiles are
  committed and CI installs with `--frozen-lockfile`.

## Reporting

Until a public security policy exists, report vulnerabilities privately to the maintainers rather
than in a public issue.

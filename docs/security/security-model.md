# Security model

DevAtlas runs untrusted-by-default web content (the UI) in a webview and keeps all privileged
operations in Rust. The security model is about keeping that boundary narrow.

## Current protections (DEVATLAS-001)

| Protection                                                                                                                                                                                                                                                                                                                                                                                                         | Where                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| **Least-privilege capabilities.** The main webview is granted only its own app commands (`allow-get-app-info`, library, preview and viewer commands), `opener:allow-open-url` scoped to `http://*` and `https://*`, event listen/unlisten, and the four window permissions the frameless title bar needs (minimize, toggle-maximize, close, start-dragging). No `fs`, `shell`, or `http` plugins are installed.    | `src-tauri/capabilities/default.json`                      |
| **Explicit command allow-list.** App commands are declared in `AppManifest::commands`, so an unlisted or ungranted command is rejected by Tauri's ACL.                                                                                                                                                                                                                                                             | `src-tauri/build.rs`                                       |
| **Strict Content Security Policy.** Scripts only from the app bundle; no remote origins; IPC endpoints only; `object-src 'none'`, `frame-ancestors 'none'`.                                                                                                                                                                                                                                                        | `tauri.conf.json` → `app.security.csp`                     |
| **Prototype freezing** (`Object.freeze(Object.prototype)`) runs before any app script to make prototype-pollution attacks on the IPC bridge harder. It is applied to the app UI only, not to sites in the viewer, because freezing breaks many websites; Tauri's global `freezePrototype` is therefore off.                                                                                                        | `public/freeze-prototype.js`, `index.html`                 |
| **Typed, validated IPC.** Rust returns typed, serializable structs; the frontend treats responses as `unknown` and validates them with Zod before use.                                                                                                                                                                                                                                                             | `services/`, `types/`                                      |
| **No unsafe Rust.** `unsafe_code = "forbid"` workspace-wide.                                                                                                                                                                                                                                                                                                                                                       | root `Cargo.toml`                                          |
| **No secrets.** No credentials, tokens, or environment secrets exist in the repo or CI.                                                                                                                                                                                                                                                                                                                            | —                                                          |
| **Links added in DevAtlas stay in DevAtlas.** Pasted links are validated and normalized in Rust (http(s) only), fetched through the hardened preview fetcher, and stored in `saved-links.json` in the app data directory with atomic writes. Only these links can be removed from the UI.                                                                                                                          | `application/src/library.rs`, `storage/src/saved_links.rs` |
| **Browser bookmarks are read-only.** The library reads one fixed file, Brave's Default-profile `Bookmarks`, resolved from the OS data directory in Rust. The frontend cannot choose the path, nothing is written to the browser profile, and only the `develop` folder is returned. Removing a Brave bookmark in DevAtlas only hides it in DevAtlas's own `library-memory.json`.                                   | `storage/src/brave.rs`, `commands/library.rs`              |
| **Bookmark URLs are sanitized in Rust.** Non-http(s) links (`javascript:`, `chrome://`) are dropped, embedded credentials are stripped, and redirect wrappers are unwrapped before anything reaches the UI.                                                                                                                                                                                                        | `domain/src/resource.rs`                                   |
| **Hardened preview fetching (SSRF).** Preview images are fetched in Rust over http(s) only; every DNS answer and redirect target must be a public address (loopback, private, link-local, CGNAT and metadata ranges are refused), redirects are capped at 5, requests time out after 10 s, HTML is capped at 1 MiB, no proxy, cookies, or credentials are used, and results are cached in the app cache directory. | `storage/src/web_preview.rs`                               |
| **Isolated in-app site viewer.** Sites open in a separate native webview with no IPC access (the capability is bound to the `main` webview only). Navigation is limited to http(s), pop-ups stay inside the viewer, and the viewer is destroyed when you leave it. Remote images are allowed in the app UI (`img-src https:`) and are requested with `referrerpolicy="no-referrer"`.                               | `commands/viewer.rs`, `capabilities/default.json`          |
| **No hard-coded paths.** Paths will be resolved through Tauri's path API.                                                                                                                                                                                                                                                                                                                                          | —                                                          |

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

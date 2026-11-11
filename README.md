# DevAtlas

DevAtlas is a personal, local-first developer resource intelligence platform. It will help you
capture, organize, search, and rediscover the resources you rely on: UI components and design
systems, libraries and frameworks across ecosystems (React, Vue, Svelte, Rust, Go, Python, Java,
…), developer tools, templates, and design inspiration.

## Project status

**Early foundation (v0.1.0).** This repository currently contains the desktop application
foundation only (milestone DEVATLAS-001):

- A Tauri 2 desktop shell with a React 19 + TypeScript frontend.
- A layered Rust workspace (`domain`, `application`, `storage`).
- One end-to-end Rust ↔ frontend integration: the `get_app_info` command, shown on the dashboard.
- A **Library** that can read one bookmark folder live (read-only) from Brave, Chrome, Edge, Vivaldi,
  Opera, Opera GX or Firefox, chosen in **Settings**, or no browser at all. Links are cleaned, de-duplicated, and
  sorted into UI components, design inspiration, animation, icons, tools, and cloud consoles.
  Cards show each site's preview image, sites open inside DevAtlas, and links saved in the browser
  appear within a few seconds with a **New** tag (until you open them, or for 7 days). You can
  also paste a link into **Add link** on the Library page: DevAtlas fetches its title and preview,
  files it under the right category, and keeps it in its own data folder (the browser is never
  written to). Each link's **Edit** button changes its category and adds tags and a note.
- **Collections**: named groups of links, stored in a local SQLite database.
- **Snippets**, **Explorer** (the library and removable suggested links, by language and framework), **Ctrl K** search across
  everything, reading status, a dashboard panel that resurfaces forgotten links, and a
  **For you** filter on News and New repos.
- **Settings** also holds an optional GitHub token, a dead-link checker, and backup, export and
  import (including any browser's bookmarks file).
- **AI coding agents**: run `devatlas-desktop --mcp` as an MCP server so Claude Code, Cursor and
  others can search your library, read your notes ("why it's here"), and see which saved resources
  match a project's dependencies. Read-only; Settings shows the setup command and weekly lookups.
- **GitHub stars import**: bring in up to 1,000 repositories you starred, from Settings.
- **Repos**: new GitHub repositories collecting the most stars today, this week, or this
  month, optionally by language, with one-click **Save** to the Library. Rows expand (click
  again to collapse) to show each repository's **Star history** chart from
  [star-history.com](https://www.star-history.com). **Star History** shows that site's
  rankings of repositories of any age: Weekly (biggest star gainers), All-time, Random and
  Pyramid (how stars are distributed). **Saved repos** lists the GitHub
  repositories in your library as cards or rows, with search, language and sort filters, their
  latest release and recent star growth (details come from GitHub's API and are cached for an
  hour; release checks are stored for six). The dashboard shows this week's
  top five. GitHub has no API for its Trending page, so this uses the official Search API
  (repositories created in the period, most stars first), cached for 15 minutes to respect its
  rate limit.
- **News**: the stories developers are discussing now (Hacker News front page) and the latest
  posts from 35 official blogs, grouped into languages, frameworks, databases, and tools &
  platforms, each with its logo (from Simple Icons). Feeds are read in Rust from a fixed
  allow-list and cached for 30 minutes.
- **Languages**: how popular programming languages are, from the two indexes that update
  monthly (TIOBE and PYPL), side by side, with each language's movement over the last year.
- Linting, formatting, tests, and CI.

AI features and sync are **not implemented yet**.

## Technology stack

| Area             | Technology                                                                     |
| ---------------- | ------------------------------------------------------------------------------ |
| Desktop runtime  | Tauri 2, Rust (stable, edition 2024)                                           |
| Frontend         | React 19, TypeScript 6, Vite 8                                                 |
| UI               | Astryx design system, Tailwind CSS 4 for layout, Lucide icons, Geist fonts     |
| State & data     | TanStack Query (backend data), Zustand (shared UI state), Zod (IPC validation) |
| Forms (upcoming) | React Hook Form + @hookform/resolvers                                          |
| Charts           | Bklit UI (area chart; d3-scale, d3-shape)                                      |
| Other            | React Router, Sonner (toasts), date-fns                                        |
| Rust crates      | serde, tracing, tracing-subscriber, SQLx (SQLite)                              |
| Tooling          | pnpm 10 workspaces, Cargo workspace, ESLint, Prettier, Vitest, rustfmt, Clippy |

TypeScript is pinned to 6.0.x because `typescript-eslint` does not yet support TypeScript 7.

## Repository structure

```text
devatlas/
├── apps/
│   └── desktop/               # Tauri 2 desktop app
│       ├── public/            # Static assets (brand mark)
│       ├── src/               # React frontend (feature-oriented)
│       │   ├── app/           # Providers, router, layouts
│       │   ├── components/    # layout/, shared/
│       │   ├── features/      # dashboard/
│       │   ├── hooks/ lib/ services/ stores/ types/ styles/
│       │   └── test/          # Vitest setup
│       └── src-tauri/         # Rust delivery layer: commands, capabilities, icons, config
├── crates/
│   ├── domain/                # Core concepts — no infrastructure dependencies
│   ├── application/           # Use cases and ports — depends on domain only
│   └── storage/               # Persistence (empty until DEVATLAS-002)
├── docs/                      # Architecture, database, security, decisions, development
├── .github/workflows/ci.yml
├── Cargo.toml                 # Rust workspace
└── package.json               # pnpm workspace root
```

`packages/` is reserved in `pnpm-workspace.yaml` for shared contracts and configuration once they
exist; no empty placeholder packages are committed.

## Prerequisites

- **Node.js** ≥ 22.22 (CI uses Node 24)
- **pnpm** 10.x (`corepack enable` or `npm i -g pnpm@10`)
- **Rust** stable via [rustup](https://rustup.rs) — `rust-toolchain.toml` selects the channel and
  installs `rustfmt` and `clippy` automatically
- **Windows:** Microsoft C++ Build Tools and WebView2 — see
  [docs/development/windows-setup.md](docs/development/windows-setup.md)

## Installation

```bash
pnpm install
```

## Development

```bash
pnpm dev          # Start the desktop app (Vite dev server + Tauri window with hot reload)
```

The frontend can also be opened in a regular browser via `pnpm --filter @devatlas/desktop dev`,
but the Rust backend is only reachable inside the Tauri window — the dashboard will say so.

## Build

```bash
pnpm build        # Release build + Windows installers (NSIS .exe and .msi)
```

Installers are written to `target/release/bundle/`.

### Custom setup wizard

```bash
pnpm build:installer   # Builds DevAtlas, then DevAtlas Setup with the app embedded
```

This writes `target/release/devatlas-installer.exe`, a single-file branded installer
([apps/installer](apps/installer)): welcome, license, install options, live progress, finish.
It installs per user to `%LOCALAPPDATA%\Programs\DevAtlas` by default (no admin prompt), can add
desktop and Start Menu shortcuts, and registers in **Settings → Apps**, whose Uninstall runs
`Uninstall DevAtlas.exe --uninstall` from the install folder. Uninstalling keeps the user's library.
To iterate on the wizard UI, run `pnpm --filter @devatlas/installer tauri dev`. The Install button
then reports that no app is embedded until `pnpm build:installer` has run once.

## Quality checks

| Command             | What it runs                                            |
| ------------------- | ------------------------------------------------------- |
| `pnpm typecheck`    | `tsc --noEmit` for the app and its Vite config          |
| `pnpm lint`         | ESLint (type-aware, React Hooks, React Refresh)         |
| `pnpm format`       | Prettier write (with Tailwind class sorting)            |
| `pnpm format:check` | Prettier check                                          |
| `pnpm test`         | Vitest frontend tests, then `cargo test --workspace`    |
| `pnpm rust:check`   | `cargo check --workspace --all-targets`                 |
| `pnpm rust:fmt`     | `cargo fmt --all -- --check`                            |
| `pnpm rust:clippy`  | `cargo clippy --workspace --all-targets -- -D warnings` |
| `pnpm rust:test`    | `cargo test --workspace`                                |

## Windows notes

- The Rust toolchain must target MSVC (`stable-x86_64-pc-windows-msvc`, the rustup default).
- WebView2 ships with Windows 10/11. The installer bootstraps it on machines where it is missing.
- The NSIS installer installs per user (no administrator rights required).
- Application data will live under the per-user app-data directory resolved by Tauri
  (`%APPDATA%\com.devatlas.app` on Windows) — paths are never hard-coded.

## Current scope and known limitations

- The Library mirrors Brave's `develop` folder (Default profile);
  removing a Brave bookmark in DevAtlas hides it there without touching Brave. Categories come
  from a built-in list of known sites.
- No database or persistence yet, so DevAtlas cannot edit, tag, or store resources itself.
- No browser extension, AI, sync, or accounts.
- Dark theme only.
- Builds and CI target Windows; Linux and macOS are kept in mind architecturally but are untested.

## Documentation

- [System design](docs/architecture/system-design.md) ·
  [Dependency rules](docs/architecture/dependency-rules.md)
- [Planned database design](docs/database/schema-design.md)
- [Security model](docs/security/security-model.md)
- Decisions: [ADR-001 Tauri 2 + Rust](docs/decisions/ADR-001-tauri.md),
  [ADR-002 Local-first](docs/decisions/ADR-002-local-first.md)
- [Contributing](CONTRIBUTING.md) · [Agent instructions](AGENTS.md)

## License

[MIT](LICENSE)

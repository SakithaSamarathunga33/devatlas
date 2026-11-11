# DevAtlas

DevAtlas is a personal, local-first developer resource intelligence platform. It will help you
capture, organize, search, and rediscover the resources you rely on: UI components and design
systems, libraries and frameworks across ecosystems (React, Vue, Svelte, Rust, Go, Python, Java,
…), developer tools, templates, and design inspiration.

## Project status

**v0.1.0, in active development.** A Windows desktop app (Tauri 2, React 19, a layered Rust
workspace) with:

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
- **AI coding agents (MCP)**: Claude Code, Cursor and other agents can search your library and
  read why you saved each link. See [Use with AI coding agents](#use-with-ai-coding-agents-mcp).
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

There is no built-in AI assistant and no sync.

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
| Rust crates      | serde, tracing, SQLx (SQLite), rmcp (MCP server), reqwest, toml, winreg        |
| Tooling          | pnpm 10 workspaces, Cargo workspace, ESLint, Prettier, Vitest, rustfmt, Clippy |

TypeScript is pinned to 6.0.x because `typescript-eslint` does not yet support TypeScript 7.

## Repository structure

```text
devatlas/
├── apps/
│   ├── desktop/               # Tauri 2 desktop app
│   │   ├── public/            # Static assets (brand mark)
│   │   ├── src/               # React frontend (feature-oriented)
│   │   │   ├── app/           # Providers, router, layouts
│   │   │   ├── components/    # layout/, shared/, charts/
│   │   │   ├── features/      # dashboard, library, discovery, explorer, settings, …
│   │   │   ├── hooks/ lib/ services/ stores/ types/ styles/ themes/
│   │   │   └── test/          # Vitest setup
│   │   └── src-tauri/         # Rust delivery layer: commands, MCP server, capabilities, config
│   └── installer/             # DevAtlas Setup, the custom install wizard
├── crates/
│   ├── domain/                # Core concepts — no infrastructure dependencies
│   ├── application/           # Use cases and ports — depends on domain only
│   └── storage/               # SQLite, browser bookmarks, GitHub, project manifests
├── docs/                      # Architecture, database, security, decisions, development
├── .github/workflows/         # ci.yml (checks + Windows build), release.yml (publishing)
├── scripts/                   # release-notes.sh, used by the release workflow
├── Cargo.toml                 # Rust workspace
└── package.json               # pnpm workspace root
```

`packages/` is reserved in `pnpm-workspace.yaml` for shared contracts and configuration once they
exist; no empty placeholder packages are committed.

## Download

Every push to `main` that passes CI publishes a
[GitHub release](https://github.com/SakithaSamarathunga33/devatlas/releases) named
`v<version>-build.<CI run>`, with notes listing the changes since the previous release (grouped
into New, Fixes and Other changes from the commit messages). Pushes that only change docs
(Markdown files, `docs/`, `LICENSE`) skip CI and publish nothing. Each release has:

- `DevAtlas-Setup-<tag>.exe`: the setup wizard (recommended).
- `DevAtlas_<version>_x64-setup.exe` and `DevAtlas_<version>_x64_en-US.msi`: standard installers.

The installers are not code-signed yet, so Windows SmartScreen warns before running them. Quit
any AI agent using DevAtlas before updating, since it keeps `DevAtlas.exe` open.

## Use with AI coding agents (MCP)

DevAtlas includes an [MCP](https://modelcontextprotocol.io) server, so your coding agent can use
the library you built instead of guessing. Ask it "which date picker did I save?" or "what do I
have saved for this project's stack?" and it answers from your own links and notes.

The installed app is the server: an agent starts `DevAtlas.exe --mcp` and talks to it over
stdin/stdout. DevAtlas does not need to be open.

### Connect an agent

Open **Settings → AI coding agents** in DevAtlas. It shows both of these with the real path of
your installed copy, ready to copy.

**Claude Code** (available in every folder):

```bash
claude mcp add devatlas -s user -- "C:\Users\<you>\AppData\Local\Programs\DevAtlas\DevAtlas.exe" --mcp
```

**Cursor, Windsurf, Codex and other agents** read an `mcp.json`:

```json
{
  "mcpServers": {
    "devatlas": {
      "command": "C:\\Users\\<you>\\AppData\\Local\\Programs\\DevAtlas\\DevAtlas.exe",
      "args": ["--mcp"]
    }
  }
}
```

Run `claude mcp list` (or the agent's own MCP view) to check that `devatlas` is connected.

### Tools

| Tool                | What the agent gets                                                                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `search_library`    | Saved resources matching every word of a query, each with your "why it's here" note.                                                                                 |
| `get_resource`      | One resource by id or address: note, tags, collections, reading status, link health and attached code snippets.                                                      |
| `get_project_stack` | The dependencies of a project in the agent's folder (`package.json`, `Cargo.toml`, `go.mod`, `pyproject.toml`, `requirements.txt`) and which of them you have saved. |

### Privacy and safety

- **Read-only.** The server opens the library database read-only and cannot add, change or delete
  anything.
- **Local only.** Nothing leaves your computer: the agent and DevAtlas talk over a local pipe.
- **Confined.** `get_project_stack` only reads inside the folder the agent was started in. It
  refuses network paths and skips symbolic links.
- **Untrusted text is cleaned.** Titles and descriptions from websites have hidden and control
  characters removed and are marked as data, so a saved page cannot give the agent instructions.
- Each lookup is counted in `agent-lookups.jsonl` in the app's data folder. Settings shows the
  count for the last 7 days.

Write the reason you saved a link in its **Why it's here** field (the **Edit** button on any
Library card): that note is what makes the agent's answers useful.

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

- Browser bookmarks are read, never written: removing one in DevAtlas hides it there without
  touching the browser. Categories come from a built-in list of known sites.
- AI agents can read the library but not change it. There is no built-in AI assistant.
- No browser extension, sync, or accounts.
- Releases are unsigned, and the version number only changes when `Cargo.toml` is bumped.
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

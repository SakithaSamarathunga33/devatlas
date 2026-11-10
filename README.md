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
- A **Library** read live (read-only) from your Brave bookmarks: everything in the bookmarks-bar
  folder `develop` (including subfolders) is cleaned, de-duplicated, and sorted into UI
  components, design inspiration, animation, icons, tools, and cloud consoles. Links open in your
  default browser.
- Linting, formatting, tests, and CI.

Resource management, search, discovery, the browser extension, AI features, and sync are **not
implemented yet**. Navigation entries for them are visible but disabled and marked "Soon".

## Technology stack

| Area             | Technology                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Desktop runtime  | Tauri 2, Rust (stable, edition 2024)                                                                                           |
| Frontend         | React 19, TypeScript 6, Vite 8                                                                                                 |
| UI               | Tailwind CSS 4, shadcn/ui (Radix), Lucide icons, Motion, Geist fonts                                                           |
| UI effects       | Magic UI (Globe via cobe, MagicCard, BorderBeam, AuroraText, BlurFade), React Bits (Aurora, RotatingText), Kokonut UI (Loader) |
| State & data     | TanStack Query (backend data), Zustand (shared UI state), Zod (IPC validation)                                                 |
| Forms (upcoming) | React Hook Form + @hookform/resolvers                                                                                          |
| Other            | React Router, Sonner (toasts), date-fns                                                                                        |
| Rust crates      | serde, tracing, tracing-subscriber                                                                                             |
| Tooling          | pnpm 10 workspaces, Cargo workspace, ESLint, Prettier, Vitest, rustfmt, Clippy                                                 |
| Planned          | SQLite + SQLx (DEVATLAS-002), WXT browser extension (later milestone)                                                          |

TypeScript is pinned to 6.0.x because `typescript-eslint` does not yet support TypeScript 7.

## Repository structure

```text
devatlas/
├── apps/
│   └── desktop/               # Tauri 2 desktop app
│       ├── public/            # Static assets (brand mark)
│       ├── src/               # React frontend (feature-oriented)
│       │   ├── app/           # Providers, router, layouts
│       │   ├── components/    # layout/, shared/, ui/ (shadcn)
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

- The dashboard and Library are the only routes. The Library mirrors Brave's `develop` folder
  (Default profile); to add or remove a resource, change the bookmark in Brave. Categories come
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

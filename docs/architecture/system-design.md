# System design

## Overview

DevAtlas is a single-user desktop application. The UI is a React single-page app rendered in the
operating system's webview (WebView2 on Windows); all privileged work happens in a Rust process
managed by Tauri 2. There is no server.

```text
┌──────────────────────── DevAtlas process ─────────────────────────┐
│  WebView (React 19)                    Rust (Tauri 2 runtime)     │
│  ┌──────────────────────┐   IPC        ┌───────────────────────┐  │
│  │ features/ components │──invoke()──► │ commands/ (adapters)  │  │
│  │ hooks (TanStack Query)│ ◄──JSON──── │          │            │  │
│  │ services/ (+ Zod)    │              │          ▼            │  │
│  └──────────────────────┘              │ devatlas-application  │  │
│                                        │          │            │  │
│                                        │          ▼            │  │
│                                        │ devatlas-domain       │  │
│                                        │ devatlas-storage ─► (SQLite, future)
│                                        └───────────────────────┘  │
└───────────────────────────────────────────────────────────────────┘
```

## Frontend

`apps/desktop/src` is organized by feature:

| Folder               | Responsibility                                            |
| -------------------- | --------------------------------------------------------- |
| `app/`               | Provider composition, router, layouts                     |
| `components/layout/` | Application shell (sidebar, header, navigation config)    |
| `components/shared/` | Cross-feature components (e.g. backend status indicator)  |
| `components/ui/`     | shadcn/ui primitives                                      |
| `features/<name>/`   | Feature UI, exposed through the feature's `index.ts`      |
| `services/`          | The only place that calls `invoke()`; validates responses |
| `hooks/`             | Shared hooks (TanStack Query wrappers, routing helpers)   |
| `stores/`            | Zustand stores for shared transient UI state              |
| `types/`             | Zod schemas and inferred types for IPC contracts          |
| `lib/`, `styles/`    | Utilities, query client factory, design tokens            |

State ownership: backend data → TanStack Query; shared UI state (sidebar) → Zustand; local UI state
→ component state; future forms → React Hook Form with Zod resolvers.

## Frontend ↔ backend communication

All communication uses Tauri commands over IPC. The `get_app_info` flow is the reference
implementation:

1. `useAppInfo()` (TanStack Query) calls `getAppInfo()` in `services/app-info.service.ts`.
2. The service checks it is running inside Tauri, calls `invoke("get_app_info")`, and validates the
   untyped result with the Zod schema in `types/app-info.types.ts`. Failures become descriptive
   `Error`s that the UI renders with a retry action.
3. Tauri checks the window's capability (`allow-get-app-info`) and dispatches to
   `commands::app_info::get_app_info`.
4. The command delegates to `devatlas_application::app_info::AppInfo::current`, passing its own
   package version. The `AppInfo` struct is serialized to JSON.

Rust tests pin the serialized shape and keep `package.json`, `Cargo.toml`, and `tauri.conf.json`
identity/version in sync.

## Rust workspace

| Crate                  | Path                     | Role                                      |
| ---------------------- | ------------------------ | ----------------------------------------- |
| `devatlas-desktop`     | `apps/desktop/src-tauri` | Tauri runtime, commands, composition root |
| `devatlas-application` | `crates/application`     | Use cases, ports                          |
| `devatlas-domain`      | `crates/domain`          | Core concepts and validation              |
| `devatlas-storage`     | `crates/storage`         | Persistence implementations (future)      |

Shared metadata, dependency versions, and lints are declared once in the root `Cargo.toml`.

## Layer responsibilities

- **Domain**: business vocabulary and invariants. Pure Rust, no I/O.
- **Application**: orchestrates use cases, defines ports (traits) for persistence and external
  services, and returns serializable results. Framework-agnostic.
- **Storage**: implements application ports with SQLite (via SQLx) and file-system caches.
- **Desktop (Tauri)**: delivery and composition. Resolves paths, builds application services with
  their storage implementations, manages them as Tauri state, and exposes thin commands.

See [dependency-rules.md](dependency-rules.md) for what may depend on what.

## Application data layout (planned)

Resolved through Tauri's path API (`app_data_dir()`), never hard-coded. On Windows this is the
per-user roaming app-data directory for `com.devatlas.app`.

```text
DevAtlas application data/
├── devatlas.db
├── backups/
├── cache/
│   ├── thumbnails/
│   └── favicons/
├── logs/
└── exports/
```

Nothing is created on disk in DEVATLAS-001; directories will be created by the features that need
them.

## Future extension points

- **Persistence (DEVATLAS-002)**: repository ports in `application`, SQLx implementations in
  `storage`, wired in the desktop crate's setup hook as managed state.
- **New commands**: one module per feature under `src-tauri/src/commands/`, each explicitly
  permitted through `build.rs` + capabilities.
- **Events**: Rust → UI notifications via Tauri events, consumed in hooks.
- **Browser extension**: a separate WXT app under `apps/` talking to the desktop app through a
  narrowly scoped, authenticated local channel (design to be decided in its own ADR).
- **Shared contracts/config**: `packages/contracts` and `packages/config` once there is something
  to share between apps.

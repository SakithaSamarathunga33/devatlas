# AGENTS.md

Instructions for AI coding agents (Claude Code, Codex, …) working in this repository.

## Project purpose

DevAtlas is a local-first desktop app for capturing, organizing, searching, and discovering
developer resources. It is in its **foundation** stage: only the shell and one Rust command
(`get_app_info`) exist. See [README.md](README.md) for scope.

## Before you change anything

1. Read the code you are about to touch and its callers. Follow existing patterns.
2. Work only on the task you were given. **Do not introduce future features** (database, resource
   CRUD, search, extension, AI, sync, auth) without an explicit task for them.
3. No placeholder code: no empty modules, fake repositories, mock data in the UI, or stub pages.

## Architecture rules

```text
React UI ─► services/ ─► invoke() ─► Tauri command ─► application ─► domain
                                                      storage ─────► domain
```

- `crates/domain`: core concepts and validation. **No** Tauri, SQLx/SQLite, HTTP, or frontend deps.
- `crates/application`: use cases and ports (traits). Depends on `domain` only. No Tauri, no SQLite.
- `crates/storage`: implements application ports (SQLite from DEVATLAS-002). Depends on `domain`.
- `apps/desktop/src-tauri`: delivery layer. Commands are **thin adapters** that call the
  application layer. Never put business logic in commands or `lib.rs`, and never call storage
  directly from a command — **do not bypass the application layer.**
- Full rules: [docs/architecture/dependency-rules.md](docs/architecture/dependency-rules.md).

## Adding a feature (checklist)

1. Domain types/validation in `crates/domain` (only what the feature needs).
2. Use case + any port trait in `crates/application`, with unit tests.
3. Port implementation in `crates/storage` if persistence is involved.
4. Thin `#[tauri::command]` in `src-tauri/src/commands/<feature>.rs`; register it in `lib.rs`.
5. Add the command name to `AppManifest::commands` in `src-tauri/build.rs` and grant
   `allow-<command-name>` in `src-tauri/capabilities/default.json`. Grant nothing broader.
6. Frontend: Zod schema + type in `src/types/`, `invoke` wrapper in `src/services/`, a TanStack
   Query hook in `src/hooks/` or the feature's `hooks/`, UI in `src/features/<feature>/`.
7. Add the route in `src/app/router/router.ts` and enable its entry in
   `src/components/layout/navigation.ts`.
8. Tests on both sides, then run every check below.

## TypeScript conventions

- Strict mode; never weaken `tsconfig.base.json`. No `any`, no `@ts-ignore`, no non-null
  assertions to silence errors. Validate all IPC payloads with Zod (`unknown` → schema).
- Import via the `@/` alias. Use `import type` for types (enforced).
- Components render; logic lives in services, hooks, and the Rust application layer.
- State: TanStack Query for backend data, Zustand only for shared transient UI state, component
  state for local UI. Use semantic theme tokens (`bg-card`, `text-muted-foreground`), not hex.
- Add shadcn components only when used: `pnpm dlx shadcn@latest add <name>` inside `apps/desktop`.

## Rust conventions

- Edition 2024, workspace-inherited metadata and dependencies (`[workspace.dependencies]`).
- No `unwrap()`/`expect()` in production paths (Clippy warns; CI denies). Return `Result` and use
  `thiserror` for typed errors when a crate needs its own error type.
- `unsafe` is forbidden workspace-wide. Log with `tracing`, not `println!`.
- Do not add a dependency for something the standard library or an existing crate already does.

## Testing and formatting

Run before you finish — all must pass:

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm format:check
pnpm rust:fmt && pnpm rust:clippy
```

- Frontend: Vitest + Testing Library; mock `@tauri-apps/api/core` at the module boundary.
- Rust: unit tests next to the code (`#[cfg(test)]`). Test real behavior, never `assert!(true)`.
- Never report a check as passing unless you ran it.

## Security requirements

- Least privilege: no `fs`, `shell`, `http`, or other plugins/permissions without a task that
  needs them, and then scoped as narrowly as possible.
- Keep the CSP in `tauri.conf.json` strict. No remote scripts.
- No secrets in the repository. No hard-coded OS paths — resolve paths with Tauri's path API.
- See [docs/security/security-model.md](docs/security/security-model.md).

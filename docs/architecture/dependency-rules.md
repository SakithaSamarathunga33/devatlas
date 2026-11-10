# Dependency rules

Dependencies point inward, toward the domain. Cargo enforces direction structurally: a crate
cannot depend on a crate that depends on it.

```text
apps/desktop/src-tauri ──► crates/application ──► crates/domain
            │                                          ▲
            └──(composition only, from DEVATLAS-002)──► crates/storage
```

## Rust crates

| Crate                  | May depend on                                                                                             | Must not depend on                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `devatlas-domain`      | `std`, small pure libraries (e.g. `serde`, `uuid`, `thiserror`)                                           | Tauri, SQLx/SQLite, HTTP clients, Tokio, any other crate here |
| `devatlas-application` | `devatlas-domain`, `serde`, `thiserror`, `tracing`                                                        | Tauri, SQLx/SQLite, `devatlas-storage`, frontend code         |
| `devatlas-storage`     | `devatlas-domain`, `devatlas-application` (to implement its ports), SQLx, Tokio                           | Tauri, `devatlas-desktop`                                     |
| `devatlas-desktop`     | `devatlas-application`, Tauri, `tracing`; `devatlas-storage` only to construct and inject implementations | —                                                             |

### Rules

1. **Commands are adapters.** A Tauri command converts IPC input into an application call and the
   result back. No business rules, no SQL, no direct storage calls.
2. **No bypassing the application layer.** The frontend never reaches storage, and commands never
   call storage repositories directly — they call use cases.
3. **Ports live in `application`, implementations in `storage`.** The desktop crate wires them
   together at startup (composition root).
4. **The domain is pure.** No I/O, clocks, randomness, or async runtimes inside domain logic; pass
   values in.
5. **New dependencies need a reason.** Prefer `std` and existing workspace dependencies. Declare
   versions once in `[workspace.dependencies]`.

## Frontend

| Layer                         | May import                                                 | Must not import                                  |
| ----------------------------- | ---------------------------------------------------------- | ------------------------------------------------ |
| `components/ui`               | `lib/utils`, Radix, CVA                                    | features, services, stores                       |
| `components/layout`, `shared` | `ui`, `hooks`, `stores`, `lib`                             | `services` directly, `@tauri-apps/api`           |
| `features/<name>`             | `components`, `hooks`, `stores`, `lib`, `types`, own files | other features' internals (use their `index.ts`) |
| `hooks`                       | `services`, `types`, `lib`                                 | components                                       |
| `services`                    | `@tauri-apps/api`, `types`                                 | React, components, stores                        |
| `types`                       | `zod`                                                      | everything else                                  |

- `@tauri-apps/api` is imported **only** in `services/`.
- The frontend never accesses SQLite, the file system, or the network directly; it asks the Rust
  backend through a command.

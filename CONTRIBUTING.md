# Contributing to DevAtlas

## Development setup

1. Install the prerequisites listed in the [README](README.md#prerequisites). On Windows, follow
   [docs/development/windows-setup.md](docs/development/windows-setup.md).
2. Install dependencies: `pnpm install`
3. Start the app: `pnpm dev`

## Branches

Branch from `main` using `<type>/<short-description>`:

```text
feature/project-bootstrap
feature/database-foundation
feature/resource-management
feature/metadata-extraction
feature/global-search
feature/browser-capture
feature/discovery-engine
feature/ai-integration
fix/<what-is-broken>
docs/<topic>
chore/<topic>
```

## Commits

Use [Conventional Commits](https://www.conventionalcommits.org/): `<type>: <description>`.

| Prefix      | Use for                                  |
| ----------- | ---------------------------------------- |
| `feat:`     | New user-facing functionality            |
| `fix:`      | Bug fixes                                |
| `refactor:` | Code changes that don't change behavior  |
| `test:`     | Adding or fixing tests                   |
| `docs:`     | Documentation only                       |
| `chore:`    | Tooling, dependencies, CI, configuration |

Example: `feat: add resource capture command`

## Before opening a pull request

All of the following must pass locally (CI runs the same checks):

```bash
pnpm typecheck
pnpm lint
pnpm test            # Vitest + cargo test
pnpm format:check
pnpm rust:fmt
pnpm rust:clippy
```

Fix formatting with `pnpm format` and `cargo fmt --all`. Do not weaken lint, TypeScript, or
Clippy settings to make a check pass.

## Pull request expectations

- One focused change per PR, linked to its task (e.g. `DEVATLAS-002`).
- Describe what changed, why, and how you tested it. Include screenshots for UI changes.
- New behavior comes with tests; bug fixes come with a test that would have caught the bug.
- Respect the layer boundaries in
  [docs/architecture/dependency-rules.md](docs/architecture/dependency-rules.md).
- Update documentation (README, ADRs, architecture docs) when behavior or decisions change.
- CI must be green before review.

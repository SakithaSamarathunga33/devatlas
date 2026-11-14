# Releasing DevAtlas

Every push to `main` that passes CI becomes a release once the owner approves it. There is nothing
to tag by hand.

## How a push becomes a release

1. **CI** (`.github/workflows/ci.yml`) runs on the push: frontend checks (Ubuntu), Rust checks
   (Windows, `--locked`), then the Windows build. The build bakes the CI run number into the app
   (`DEVATLAS_BUILD`) and uploads DevAtlas Setup and the app on its own as an artifact (kept 7
   days). Pushes that only change Markdown, `docs/` or `LICENSE` skip CI and publish nothing.
2. **Release** (`.github/workflows/release.yml`) starts when CI completes. It runs only when CI
   succeeded on a `push` to `main` of this repository; pull requests and forks never release.
3. It runs in the `release` environment, whose `TAURI_SIGNING_PRIVATE_KEY` secret only `main` may
   use. The environment requires the owner's approval, so the job waits until someone opens the
   Release run in the **Actions** tab and chooses **Review deployments → release → Approve and
   deploy** (or **Reject** to ship nothing). GitHub e-mails the reviewer when a run is waiting.
   To change who approves, or to go back to automatic releases, edit **Settings → Environments →
   release → Required reviewers**. It gzips the app into `DevAtlas-Update-<tag>.gz` and signs it with the Tauri CLI from the
   lockfile. The signature names the file, so an old package can't pose as a newer release.
4. `scripts/release-notes.sh` lists the commits since the previous `v*` tag.
5. `gh release create` publishes `v<version>-build.<CI run>` (version from the root `Cargo.toml`)
   with DevAtlas Setup, the update and its `.sig`. A re-run never duplicates a release.

## How users update

The app sends a `HEAD` to `github.com/<repo>/releases/latest` at start, every 5 minutes and when
the window regains focus, and reads the tag from the redirect (no API quota). If that tag is newer
(higher version, or the same version with a higher build number), it looks the release up once
through the GitHub API and the sidebar shows **Update to &lt;tag&gt;**. **Check for updates**
checks at once.

Nothing installs until the user presses the button. The app then downloads the package from GitHub
only, verifies the signature against the public key built into it
(`apps/desktop/src-tauri/update-signing.pub`), swaps the new `DevAtlas.exe` in and restarts. The
library is kept. Running a newer DevAtlas Setup over an installed copy also updates it.

## Rollback

The updater only moves forward: it never offers a tag older than the running build. So a bad
release is fixed by shipping a newer one.

1. **Fix forward (always).** Revert or fix the bad commit and push to `main`:

   ```bash
   git revert <bad-sha>
   git push origin main
   ```

   CI and Release publish a new build with a higher number, and every installed copy, including
   those on the bad build, is offered it.

2. **Stop offering the bad release (while the fix builds).** "Latest" is GitHub's latest release:
   the newest one that isn't a draft or a pre-release. Deleting the bad release makes
   `releases/latest` point at the previous one again, so copies that haven't updated stop seeing
   it:

   ```bash
   gh release delete <tag> --cleanup-tag --yes
   ```

   `--cleanup-tag` also deletes the tag, so the next release's notes include the reverted commits.
   To keep the files downloadable instead, demote it: `gh release edit <tag> --prerelease`.
   Copies already on the bad build stay on it until the fix-forward release arrives.

3. **Users who need the old version now** download an older `DevAtlas-Setup-<tag>.exe` from
   [GitHub Releases](https://github.com/SakithaSamarathunga33/devatlas/releases) and run it; Setup
   installs over the current copy and keeps the library. While the bad release is still "latest",
   that copy offers the update again, so do step 2 first. The database tolerates migrations from a
   newer build (`set_ignore_missing`), but an older build may not understand data those migrations
   added: never ship a migration that an older build would misread.

4. **Community server changes** (`supabase/migrations/`) are not rolled back by any of this. Undo
   them with a new forward migration, and restore data only from a backup
   ([BACKUPS.md](BACKUPS.md)).

## Pre-release checklist

Pushing to `main` queues a release for approval, so check before the push and before approving:

- [ ] All checks pass locally: `pnpm typecheck && pnpm lint && pnpm test && pnpm format:check`
      and `pnpm rust:fmt && pnpm rust:clippy`.
- [ ] `Cargo.lock` and `pnpm-lock.yaml` are committed and current (CI uses `--locked` and
      `--frozen-lockfile`).
- [ ] New SQLite migrations only add (tables, nullable columns), so the previous build still works
      on the migrated database if a user rolls back.
- [ ] New Community migrations are applied to the Supabase project before the app code that needs
      them ships, and the currently released app still works against them. Take a backup first.
- [ ] New commands are listed in `src-tauri/build.rs` and granted one by one in
      `capabilities/default.json`; the CSP is unchanged or the change is reviewed.
- [ ] README, the [security model](../security/security-model.md) and the Privacy section match
      what the app now sends over the network.
- [ ] `cargo audit` reports no vulnerabilities (accepted ones are listed with a reason in
      `.cargo/audit.toml`) and `pnpm audit --prod` finds none.
- [ ] `pnpm test:e2e` passes (launch-critical journeys).
- [ ] Bump `version` in the root `Cargo.toml` for a notable release (optional: the build number
      alone orders releases).

After the release is published:

- [ ] The release has `DevAtlas-Setup-<tag>.exe`, `DevAtlas-Update-<tag>.gz` and its `.sig`.
- [ ] An installed copy of the previous build shows **Update to &lt;tag&gt;** (press **Check for
      updates**), updates, restarts and still shows its library.
- [ ] After the restart, **Check for updates** finds nothing newer.

## Signing key

The key pair was made with `pnpm --filter @devatlas/desktop tauri signer generate`. The public half
is built into the app; the private half lives only in the `release` environment secret and the
owner's offline backup. If the private key is lost or leaked, make a new pair, replace
`update-signing.pub` and the secret, and release: installed copies refuse updates signed with the
new key, so users reinstall once with DevAtlas Setup.

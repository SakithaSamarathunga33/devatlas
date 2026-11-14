# Backing up the Community database

Community (shared collections, profiles, follows, reports) lives in one Supabase project in Tokyo
(`ap-northeast-1`). Everything else in DevAtlas is on users' own computers, and each user backs that
up with **Settings → Library tools → Backup**.

## Why manual backups

The project is on Supabase's free plan:

- **No automatic backups.** Supabase backs up Pro, Team and Enterprise projects daily; free
  projects are expected to export their own data
  ([Database backups](https://supabase.com/docs/guides/platform/backups)).
- **Pauses after a week without activity.** A paused project answers nothing, so Community stops
  working in every installed copy until it is restored from the dashboard. A project left paused
  for long may no longer be restorable there, which is one more reason to keep dumps.

## Weekly backup

Once a week (and before applying any migration in `supabase/migrations/`), following Supabase's
[Backup and restore using the CLI](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore)
guide and the [`supabase db dump`](https://supabase.com/docs/reference/cli/supabase-db-dump)
reference.

You need the [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)
and Docker Desktop (the CLI runs `pg_dump` in a container).

1. In the dashboard, open **Connect** and copy the **Session pooler** connection string. Put the
   database password in it (reset it under **Database → Settings** if it is lost). Treat the string
   as a secret: don't paste it into files in the repository or shell history you share.
2. Dump into a folder **outside** this repository:

   ```bash
   mkdir -p ~/devatlas-backups/$(date +%F) && cd ~/devatlas-backups/$(date +%F)
   supabase db dump --db-url "$CONNECTION_STRING" -f roles.sql --role-only
   supabase db dump --db-url "$CONNECTION_STRING" -f schema.sql
   supabase db dump --db-url "$CONNECTION_STRING" -f data.sql --use-copy --data-only
   ```

3. Check the files are non-empty and `data.sql` has `COPY public.shared_collections` and
   `COPY public.profiles` sections.
4. Encrypt them (for example a 7-Zip archive with AES-256 and a strong password kept in a password
   manager) and store the archive somewhere **private**: a personal cloud drive or an external disk.
   Keep at least the last 4 weekly backups.

**Never** store a dump in this repository, in a GitHub Actions artifact or in a release. The
repository is public, and anyone with a GitHub account can download a public repository's
artifacts. A dump holds personal data: GitHub usernames and avatars, sign-in records (which can
include email addresses), follows and reports. Deleting a dump is part of honouring a user's
**Delete Community account**: old dumps age out by keeping only the last few.

## Restore

Restore into a **new** project rather than over a live one:

1. Create a project in the same region and apply nothing to it yet.
2. Restore with `psql` (from a Postgres install) using the new project's connection string:

   ```bash
   psql \
     --single-transaction \
     --variable ON_ERROR_STOP=1 \
     --file roles.sql \
     --file schema.sql \
     --command 'SET session_replication_role = replica' \
     --file data.sql \
     --dbname "$NEW_CONNECTION_STRING"
   ```

3. Set up sign-in again in the new project: enable the GitHub provider (with the GitHub OAuth app's
   client id and secret, and the new project's callback URL added to that OAuth app), and under
   **Authentication → URL Configuration** allow the app's loopback redirect
   (`http://127.0.0.1:<random port>/auth/callback`): copy the entry from the old project.
4. Point the app at it: update `COMMUNITY_URL` in `apps/desktop/src-tauri/src/commands/community.rs`
   and the publishable key in `apps/desktop/src-tauri/community-key.txt`, then release
   ([RELEASING.md](RELEASING.md)). Users are signed out once, since sessions belong to the old
   project.
5. Check: sign in, browse Community, share and unshare a test collection, and confirm signed-out
   reads are refused.

To restore one table after a bad migration instead, restore the dump into a scratch project as
above and copy the rows back with SQL.

## When to move to Pro

Upgrade the project to the Pro plan when any of these is true:

- Community has users whose shared collections would be painful to lose: Pro adds daily backups
  (7 days kept) and optional point-in-time recovery.
- The project pauses, or comes close to the free plan's limits (database size, egress, monthly
  active users; see [Supabase pricing](https://supabase.com/pricing)).
- Weekly manual dumps are being skipped. A backup that doesn't happen is no backup.

Keep the weekly dump on Pro too until restoring from Supabase's own backups has been tried once.

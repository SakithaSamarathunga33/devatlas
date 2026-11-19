# BACKUPS.md

> 15 nodes · cohesion 0.16

## Key Concepts

- **Release Workflow** (6 connections) — `.github/workflows/release.yml`
- **In-app updater (forward-only, signature-verified)** (5 connections) — `docs/operations/RELEASING.md`
- **Releasing DevAtlas** (5 connections) — `docs/operations/RELEASING.md`
- **Community Supabase project** (3 connections) — `docs/operations/BACKUPS.md`
- **Release tag v<version>-build.<run>** (3 connections) — `.github/workflows/release.yml`
- **Package and Sign the Update step** (3 connections) — `.github/workflows/release.yml`
- **One-click signed update** (2 connections) — `apps/desktop/PRODUCT.md`
- **Backing up the Community database** (2 connections) — `docs/operations/BACKUPS.md`
- **Update signing key pair (update-signing.pub)** (2 connections) — `docs/operations/RELEASING.md`
- **DEVATLAS_BUILD run number** (2 connections) — `.github/workflows/ci.yml`
- **devatlas-windows-installers artifact** (2 connections) — `.github/workflows/ci.yml`
- **release environment (signing key secret)** (2 connections) — `.github/workflows/release.yml`
- **Restore into a new Supabase project** (1 connections) — `docs/operations/BACKUPS.md`
- **Weekly encrypted supabase db dump** (1 connections) — `docs/operations/BACKUPS.md`
- **Fix-forward rollback** (1 connections) — `docs/operations/RELEASING.md`

## Relationships

- [ci.yml](ci.yml.md) (4 shared connections)
- [PRODUCT.md](PRODUCT.md.md) (2 shared connections)

## Source Files

- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`
- `apps/desktop/PRODUCT.md`
- `docs/operations/BACKUPS.md`
- `docs/operations/RELEASING.md`

## Audit Trail

- EXTRACTED: 20 (87%)
- INFERRED: 2 (9%)
- AMBIGUOUS: 1 (4%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*
#!/usr/bin/env bash
# Checks release-notes.sh against a throwaway repository.
set -euo pipefail

script="$(cd "$(dirname "$0")" && pwd)/release-notes.sh"
repo="$(mktemp -d)"
trap 'rm -rf "$repo"' EXIT
cd "$repo"
git init -q
git config user.name test
git config user.email test@example.com

commit() { git commit -q --allow-empty -m "$1"; }
commit "feat: shipped before the last release"
git tag v0.1.0-build.1
commit $'feat(library): add stars import\n\nImports a user\'s GitHub stars.\n\nSettings: a new section.\n\nCo-Authored-By: Someone <x@example.com>'
commit "fix: keep columns wide"
commit "chore: tidy"

notes="$(bash "$script" HEAD owner/repo)"

fail() { printf 'FAIL: %s\n---\n%s\n' "$1" "$notes"; exit 1; }
grep -q '^## New$' <<<"$notes" || fail "no New section"
grep -q '^- Add stars import (' <<<"$notes" || fail "feature subject not cleaned"
grep -q "^  Imports a user's GitHub stars.$" <<<"$notes" || fail "body not indented under its item"
grep -q '^  Settings: a new section.$' <<<"$notes" || fail "a body line that looks like a trailer was dropped"
grep -q '^## Fixes$' <<<"$notes" && grep -q '^- Keep columns wide (' <<<"$notes" || fail "no fix"
grep -q '^- Tidy (' <<<"$notes" || fail "chore not under other changes"
grep -q 'shipped before' <<<"$notes" && fail "includes a commit from the previous release"
grep -q 'Co-Authored-By' <<<"$notes" && fail "trailer leaked"
grep -q 'compare/v0.1.0-build.1...HEAD' <<<"$notes" || fail "no compare link"
echo "release-notes: ok"

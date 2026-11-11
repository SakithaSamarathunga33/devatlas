#!/usr/bin/env bash
# Prints Markdown release notes for the commits after the last v* tag up to <commit>, grouped by
# Conventional Commit type, each with its message body.
# Usage: release-notes.sh <commit> [owner/repo]
set -euo pipefail

head="${1:?usage: release-notes.sh <commit> [owner/repo]}"
repo="${2:-}"
previous="$(git describe --tags --abbrev=0 --match 'v*' "${head}^" 2>/dev/null || true)"
range="${previous:+${previous}..}${head}"

new="" fixes="" other=""
while read -r sha; do
  subject="$(git log -1 --format=%s "$sha")"
  # The body without trailers such as "Co-Authored-By: …", indented under its list item.
  body="$(git log -1 --format=%b "$sha" | grep -Eiv '^(co-authored-by|signed-off-by|reviewed-by|acked-by|helped-by): ' | sed -e 's/^\(.\)/  \1/' || true)"
  type="other"
  if [[ "$subject" =~ ^([a-z]+)(\([^\)]*\))?!?:\ (.+)$ ]]; then
    type="${BASH_REMATCH[1]}"
    subject="${BASH_REMATCH[3]}"
  fi
  entry="- ${subject^} (${sha:0:7})"$'\n'
  [[ -n "${body//[[:space:]]/}" ]] && entry+=$'\n'"${body}"$'\n\n'
  case "$type" in
    feat) new+="$entry" ;;
    fix) fixes+="$entry" ;;
    *) other+="$entry" ;;
  esac
done < <(git log --no-merges --reverse --format=%H "$range")

[[ -n "$new" ]] && printf '## New\n\n%s\n' "$new"
[[ -n "$fixes" ]] && printf '## Fixes\n\n%s\n' "$fixes"
[[ -n "$other" ]] && printf '## Other changes\n\n%s\n' "$other"
if [[ -n "$repo" && -n "$previous" ]]; then
  printf '**All changes since %s:** https://github.com/%s/compare/%s...%s\n' \
    "$previous" "$repo" "$previous" "$head"
fi
exit 0

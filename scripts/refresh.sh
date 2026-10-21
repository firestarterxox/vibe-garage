#!/usr/bin/env bash
# Refresh the Discussions snapshot and publish it when the content changed.
# GitHub Actions is unavailable while the account is billing-locked, so this
# script is how data/discussions.json and the other generated files get updated.
set -euo pipefail

cd "$(dirname "$0")/.."

git pull --rebase

node scripts/sync-discussions.mjs

# data/*.json carries a "generated" timestamp that changes on every run.
# Ignore that line (same idea as `git diff -I '"generated"'`). Commit when
# discussions, projects, members, challenges, guides, the feed, the sitemap,
# or robots.txt actually changed.
paths=(data feed.xml sitemap.xml robots.txt)

untracked=$(git ls-files --others --exclude-standard -- "${paths[@]}")

# git diff exits 1 when content differs and >1 when the command itself fails.
diff_status=0
git diff --quiet -I '"generated"' -- "${paths[@]}" || diff_status=$?
if [ "$diff_status" -gt 1 ]; then
  echo "git diff failed (exit ${diff_status})" >&2
  exit "$diff_status"
fi
if [ "$diff_status" -eq 0 ] && [ -z "$untracked" ]; then
  echo "No content changes beyond the generated timestamp."
  exit 0
fi

git add -- "${paths[@]}"

cached_status=0
git diff --cached --quiet -I '"generated"' -- "${paths[@]}" || cached_status=$?
if [ "$cached_status" -gt 1 ]; then
  echo "git diff --cached failed (exit ${cached_status})" >&2
  exit "$cached_status"
fi
if [ "$cached_status" -eq 0 ]; then
  echo "No content changes beyond the generated timestamp."
  git restore --staged -- "${paths[@]}"
  exit 0
fi

git commit -m "Sync discussions snapshot" -- "${paths[@]}"
git push

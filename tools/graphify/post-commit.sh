#!/bin/sh
# graphify post-commit hook: code-only graph rebuild (no LLM, no network), plus the Godot post-pass when present.
# Install: cp tools/graphify/post-commit.sh .git/hooks/post-commit && chmod +x .git/hooks/post-commit
# Uses the GDScript-capable build (Graphify-Labs/graphify PR #4484) when installed, else plain graphify.
[ "${GRAPHIFY_SKIP_HOOK:-0}" = "1" ] && exit 0
GIT_DIR=${GIT_DIR:-$(git rev-parse --git-dir 2>/dev/null)}
{ [ -d "$GIT_DIR/rebase-merge" ] || [ -d "$GIT_DIR/rebase-apply" ] || [ -f "$GIT_DIR/MERGE_HEAD" ]; } && exit 0
ROOT=$(git rev-parse --show-toplevel 2>/dev/null) || exit 0
BIN=${GRAPHIFY_BIN:-graphify-godot}
command -v "$BIN" >/dev/null 2>&1 || BIN=graphify
command -v "$BIN" >/dev/null 2>&1 || exit 0
LOG=${GRAPHIFY_HOOK_LOG:-$HOME/.cache/graphify-hook-$(basename "$ROOT").log}
mkdir -p "$(dirname "$LOG")"
(
  cd "$ROOT" || exit 0
  export PYTHONHASHSEED=0
  echo "[$(date '+%F %T')] rebuild $(git rev-parse --short HEAD 2>/dev/null)"
  nice -n 19 "$BIN" extract . --code-only --no-cluster || exit 1
  if [ -f tools/graphify/gd_postpass.py ]; then nice -n 19 python3 tools/graphify/gd_postpass.py . || exit 1; fi
  nice -n 19 "$BIN" cluster-only . --no-label >/dev/null || exit 1
  echo "[$(date '+%F %T')] done"
) >>"$LOG" 2>&1 &
exit 0

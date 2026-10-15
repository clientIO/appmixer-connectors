#!/usr/bin/env bash
# Testing stage launcher — TRUSTED. Validates its arguments again (defence in depth after the hook
# transform) and starts testing.mjs detached, so the agent turn ends right away.
#
#   ./start.sh <pr> <itemNodeId> <projectNodeId> <statusFieldId> <owner/repo#number>
set -euo pipefail
ROOT=/root/.openclaw/workspace-vero/pipeline-testing
PR="${1:-}"; ITEM="${2:-}"; PROJECT="${3:-}"; FIELD="${4:-}"; TARGET="${5:-}"
[[ "$PR" =~ ^[0-9]{1,7}$ ]] || { echo "REFUSED: bad PR number"; exit 0; }
[[ "$ITEM" =~ ^PVTI_[A-Za-z0-9_-]{5,80}$ ]] || { echo "REFUSED: bad item id"; exit 0; }
[[ "$PROJECT" =~ ^PVT_[A-Za-z0-9_-]{5,80}$ ]] || { echo "REFUSED: bad project id"; exit 0; }
[[ "$FIELD" =~ ^PVTSSF_[A-Za-z0-9_-]{5,80}$ ]] || { echo "REFUSED: bad field id"; exit 0; }
[[ "$TARGET" =~ ^Appmixer-ai/[A-Za-z0-9_.-]{1,100}#[0-9]{1,7}$ ]] || { echo "REFUSED: bad target"; exit 0; }

RUN="$ROOT/runs/$PR-$(date -u +%Y%m%d-%H%M%S)"
mkdir -p "$RUN"
setsid nohup node "$ROOT/testing.mjs" "$RUN" "$PR" "$ITEM" "$PROJECT" "$FIELD" "$TARGET" > "$RUN/runner.log" 2>&1 < /dev/null &
echo "STARTED: Testing of PR #$PR in $(basename "$RUN")"

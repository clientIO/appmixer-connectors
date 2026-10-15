#!/usr/bin/env bash
# apx-vero mention responder - TRUSTED push of the agent's commits to the PR head branch.
# Usage: push.sh <run-dir>     (no-op while mention-responder/SHADOW exists)
set -euo pipefail
ROOT=/root/.openclaw/workspace-vero/mention-responder
RUN="${1:?run dir}"
case "$RUN" in "$ROOT"/runs/*) ;; *) echo "refusing run dir outside $ROOT/runs"; exit 1 ;; esac
REF=$(jq -r .head_ref "$RUN/run.json")
if [ -e "$ROOT/SHADOW" ]; then
  echo "SHADOW: not pushing $(git -C "$RUN/repo" rev-parse --short HEAD) to $REF"
  exit 0
fi
TOKEN="$(grep -m1 '^GITHUB_VERO_PAT=' /root/.openclaw/.env | cut -d= -f2-)"
git -C "$RUN/repo" push -q "https://x-access-token:${TOKEN}@github.com/apx-vero/appmixer-connectors.git" "HEAD:refs/heads/$REF"
echo "pushed $(git -C "$RUN/repo" rev-parse --short HEAD) to $REF"

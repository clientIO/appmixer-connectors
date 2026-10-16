#!/usr/bin/env bash
# apx-vero mention responder - TRUSTED step 3 (port of the "Post the replies" step).
#
# Usage: post.sh <run-dir>
# Reads <run-dir>/replies.json and posts one reply per mention collected by resolve.sh, each with
# its idempotency marker. Replies aimed at anything resolve.sh did not collect are dropped.
# While the file mention-responder/SHADOW exists nothing is posted or pushed: the replies are
# appended to mention-responder/shadow-log.jsonl for comparison with the GitHub Actions run.
set -euo pipefail

ROOT=/root/.openclaw/workspace-vero/mention-responder
RUN="${1:?run dir}"
case "$RUN" in "$ROOT"/runs/*) ;; *) echo "refusing run dir outside $ROOT/runs"; exit 1 ;; esac
REPO=$(jq -r .repo "$RUN/run.json")
NUM=$(jq -r .number "$RUN/run.json")
F="$RUN/replies.json"

GH_TOKEN="$(grep -m1 '^GITHUB_VERO_PAT=' /root/.openclaw/.env | cut -d= -f2-)"
export GH_TOKEN

if [ ! -s "$F" ] || ! jq -e '.replies | type == "array"' "$F" > /dev/null 2>&1; then
  MSG="🤖 I was mentioned here but could not produce replies. The mentions stay open and will be picked up again."
  if [ -e "$ROOT/SHADOW" ]; then
    jq -nc --arg run "$RUN" --argjson num "$NUM" '{at: now|todate, run: $run, pr: $num, error: "no valid replies.json"}' >> "$ROOT/shadow-log.jsonl"
    echo "SHADOW: no valid replies.json"
  else
    gh pr comment "$NUM" --repo "$REPO" --body "$MSG"
  fi
  exit 0
fi

jq -c --slurpfile m "$RUN/mentions.json" '
  .replies[] | . as $r
  | select($m[0] | any((.kind == $r.kind) and ((.id | tostring) == ($r.id | tostring))))' "$F" \
| while read -r row; do
    KIND=$(printf '%s' "$row" | jq -r '.kind')
    ID=$(printf '%s' "$row" | jq -r '.id | tostring')
    BODY=$(printf '%s' "$row" | jq -r '.body // empty')
    case "$ID" in ''|*[!0-9]*) continue ;; esac
    [ -z "$BODY" ] && BODY="(no detail provided)"
    FULL="🤖 $BODY

<!-- apx-vero-mention:$KIND:$ID -->"
    if [ -e "$ROOT/SHADOW" ]; then
      jq -nc --arg run "$RUN" --argjson num "$NUM" --arg kind "$KIND" --arg id "$ID" --arg body "$FULL" \
        --argjson changed "$(jq '.code_changed // false' "$F")" \
        '{at: now|todate, run: $run, pr: $num, kind: $kind, id: $id, code_changed: $changed, body: $body}' >> "$ROOT/shadow-log.jsonl"
      echo "SHADOW: would reply to $KIND $ID"
    elif [ "$KIND" = "review_comment" ]; then
      gh api -X POST "repos/$REPO/pulls/$NUM/comments/$ID/replies" -f body="$FULL" > /dev/null \
        || gh pr comment "$NUM" --repo "$REPO" --body "$FULL"
    else
      gh pr comment "$NUM" --repo "$REPO" --body "$FULL"
    fi
  done

# Re-check the PR (INSTRUCTIONS.md step 8): mentions written while this run worked are not in it, and
# their own hook call may have been dropped while this turn held the PR's session. Done here rather
# than left to the agent, which chained it into one command or skipped it. Prints RUN_DIR=<dir> when
# there is more to answer, else SKIP: … — after a failed run above it is not reached, so its open
# mentions wait for the next hook instead of being retried in a loop.
echo "RE-CHECK:"
"$ROOT/resolve.sh" "$NUM" || echo "SKIP: re-check failed (resolve.sh exit $?)"

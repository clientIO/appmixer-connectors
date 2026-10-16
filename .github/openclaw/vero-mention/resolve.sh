#!/usr/bin/env bash
# apx-vero mention responder - TRUSTED step 1: resolve the PR and its pending mentions.
#
# Usage: resolve.sh <pr-number>
# Prints RUN_DIR=<dir> when there is work, or SKIP: <reason> and exits 0 when there is none.
# The run dir holds pr.json, mentions.json (the only input the agent may act on) and repo/ - a git
# worktree with the PR head branch checked out.
set -euo pipefail

ROOT=/root/.openclaw/workspace-vero/mention-responder
REPO=Appmixer-ai/appmixer-connectors
NUM="${1:-}"
case "$NUM" in ''|*[!0-9]*) echo "SKIP: invalid PR number '$NUM'"; exit 0 ;; esac

# The vero PAT lives in the gateway's ~/.openclaw/.env; read it without sourcing the file.
GH_TOKEN="$(grep -m1 '^GITHUB_VERO_PAT=' /root/.openclaw/.env | cut -d= -f2-)"
export GH_TOKEN

RUN="$ROOT/runs/$NUM-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$RUN"

gh api "repos/$REPO/pulls/$NUM" > "$RUN/pr.json"
AUTHOR=$(jq -r '.user.login // ""' "$RUN/pr.json")
HEAD_OWNER=$(jq -r '.head.repo.owner.login // ""' "$RUN/pr.json")
STATE=$(jq -r '.state' "$RUN/pr.json")
HEAD_REF=$(jq -r '.head.ref' "$RUN/pr.json")
[ "$AUTHOR" = "apx-vero" ]     || { echo "SKIP: PR #$NUM not authored by apx-vero (author=$AUTHOR)"; exit 0; }
[ "$HEAD_OWNER" = "apx-vero" ] || { echo "SKIP: PR #$NUM head not in the apx-vero fork (owner=$HEAD_OWNER)"; exit 0; }
[ "$STATE" = "open" ]          || { echo "SKIP: PR #$NUM is not open (state=$STATE)"; exit 0; }

gh api --paginate "repos/$REPO/issues/$NUM/comments" | jq -s '[ .[][] ]' > "$RUN/ic.json"
gh api --paginate "repos/$REPO/pulls/$NUM/comments"  | jq -s '[ .[][] ]' > "$RUN/rc.json"
gh api --paginate "repos/$REPO/pulls/$NUM/reviews"   | jq -s '[ .[][] ]' > "$RUN/rv.json"

# Mentions already answered: the markers on apx-vero's own posts. In shadow mode the GitHub Actions
# responder answers first and leaves those markers, so only this responder's own shadow log counts.
if [ -e "$ROOT/SHADOW" ]; then
  { [ -s "$ROOT/shadow-log.jsonl" ] && jq -s --argjson num "$NUM" \
      '[ .[] | select(.pr == $num and .kind != null) | "\(.kind):\(.id)" ] | unique' "$ROOT/shadow-log.jsonl" \
    || echo '[]'; } > "$RUN/answered.json"
else
  jq -s '[ .[][] | select(.user.login == "apx-vero") | (.body // "")
           | scan("<!-- apx-vero-mention:([a-z_]+:[0-9]+) -->") | .[0] ] | unique' \
    "$RUN/ic.json" "$RUN/rc.json" > "$RUN/answered.json"
fi

jq -n \
  --slurpfile ic "$RUN/ic.json" --slurpfile rc "$RUN/rc.json" --slurpfile rv "$RUN/rv.json" \
  --slurpfile done "$RUN/answered.json" '
  def mentions: (.body // "") | test("(^|[^A-Za-z0-9_-])@apx-vero([^A-Za-z0-9_-]|$)"; "i");
  def person: (.user.login != "apx-vero") and ((.user.type // "") != "Bot");
  def pending($kind): ("\($kind):\(.id)") as $key | ($done[0] | index($key)) == null;
  [ ($ic[0][] | select(mentions and person and pending("issue_comment"))
      | {kind: "issue_comment", id, author: .user.login, url: .html_url, created_at, body}),
    ($rc[0][] | select(mentions and person and pending("review_comment"))
      | {kind: "review_comment", id, author: .user.login, url: .html_url, created_at, body,
         path, line: (.line // .original_line), diff_hunk}),
    ($rv[0][] | select(mentions and person and pending("review"))
      | {kind: "review", id, author: .user.login, url: .html_url, created_at: .submitted_at, body})
  ] | sort_by(.created_at)' > "$RUN/mentions.json"

COUNT=$(jq 'length' "$RUN/mentions.json")
[ "$COUNT" -gt 0 ] || { echo "SKIP: no unanswered @apx-vero mention on PR #$NUM"; exit 0; }

# A worktree of the base clone with the PR head branch, so parallel runs never share a checkout.
BASE="$ROOT/repo"
(
  flock 9
  git -C "$BASE" fetch -q origin dev
  git -C "$BASE" fetch -q fork "refs/heads/$HEAD_REF:refs/remotes/fork/$HEAD_REF"
  git -C "$BASE" worktree add -q -B "mention-$NUM-$(basename "$RUN")" "$RUN/repo" "fork/$HEAD_REF"
) 9>"$ROOT/.git.lock"
ln -s "$BASE/node_modules" "$RUN/repo/node_modules"

jq -n --arg num "$NUM" --arg ref "$HEAD_REF" --arg title "$(jq -r .title "$RUN/pr.json")" \
  --arg url "$(jq -r .html_url "$RUN/pr.json")" --argjson count "$COUNT" \
  '{repo: "Appmixer-ai/appmixer-connectors", number: ($num|tonumber), head_ref: $ref, title: $title, url: $url, count: $count}' \
  > "$RUN/run.json"
echo "RUN_DIR=$RUN"

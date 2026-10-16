# apx-vero mention responder on OpenClaw

Answers people who @-mention apx-vero on its pull requests. Runs as the `vero` agent of the OpenClaw
gateway on `hetzner-appmixer-agents`; it replaced the GitHub Actions workflow
`vero-mention-responder.yml` (removed 2026-10-07). The agent keeps a warm checkout with dependencies
and, later, access to the QA instance, which a fresh runner lacked.

**Status: live since 2026-10-07.** The Appmixer integration `CI - @apx-vero mention -> OpenClaw vero
agent` calls only this hook. The shadow pilot (2026-10-02 to 2026-10-07) compared one run on PR #1363
with the reply of the former Actions workflow; they matched.

## Flow of a mention

1. `GitHub / New Mention` → `Condition` (pull request) → `HTTP Post`
   `https://91-99-144-37.nip.io/hooks/vero-mention` with `{"pr_url": "<subject.url>"}` and the hook
   token as `Authorization: Bearer …`.
2. nginx exposes only that path (rate-limited) and forwards it to the gateway on loopback.
3. The gateway hook mapping `vero-mention` runs `vero-mention.mjs`: it accepts only a pull request API
   URL of `Appmixer-ai/appmixer-connectors` (else HTTP 204, no run) and hands `vero` a fixed
   instruction with the PR number — no text from the payload reaches the agent.
4. The agent follows `INSTRUCTIONS.md`: `resolve.sh` (trusted: PR by apx-vero, head in the apx-vero
   fork, open; collects unanswered mentions by people; makes a git worktree of the head branch) →
   edits and checks → `push.sh` (trusted) → writes `replies.json` → `post.sh` (trusted: posts only
   replies to collected mentions, each with the `<!-- apx-vero-mention:<kind>:<id> -->` marker).

## Sessions

Every pull request has its own persistent session, `hook:vero:gh:appmixer-connectors:pr:<number>`
(`sessionMode: 'persistent'` in the transform). A later mention on the same PR continues the
conversation of the earlier ones, so a follow-up such as "that didn't work" has the previous turn
as context; mentions on other PRs never see it. The facts still come from GitHub: every turn starts
with a fresh `resolve.sh`, run dir and worktree (`INSTRUCTIONS.md`, "Earlier turns on the same PR").

- **One turn per PR at a time.** The gateway serializes requests of one session key. A request that
  cannot start within 15 s gets HTTP 503 and is dropped, so a mention written while its PR's turn is
  running may lose its hook call. `post.sh` therefore re-runs `resolve.sh` after posting and prints
  its output under `RE-CHECK:`; the agent handles a new `RUN_DIR` in the same turn (steps 7–8 of
  `INSTRUCTIONS.md`). It is in the script, not left to the agent: told to run it as a separate
  command, the agent still chained it to `post.sh`. Different PRs still run in parallel.
- **Lifetime.** Sessions follow the gateway's `session.maintenance`: `pruneAfter: 7d` and
  `maxEntries: 1000` on the host. The cap matters: hook sessions are the first removed when the
  store is over it, and with the former `maxEntries: 30` (vero alone keeps ~460 rows) every new
  session evicted the PR session of the previous mention — #1378's lasted 18 minutes, until #1379's
  was created. `openclaw sessions cleanup --agent vero --dry-run` shows `cap-overflow` rows when it
  bites again. A PR whose session is gone simply starts a new one, as every mention did before.
- **Host config.** The key is computed by the transform, which the gateway treats like a
  caller-supplied key: it needs `hooks.allowRequestSessionKey: true` and
  `hooks.allowedSessionKeyPrefixes: ["hook:"]`. A narrower `["hook:vero:gh:"]` is refused on reload
  ("must include 'hook:' when hooks.defaultSessionKey is unset" — generated keys are `hook:<uuid>`).
  The opt-in opens nothing from outside: nginx exposes only `/hooks/vero-mention`, whose transform
  sets the key itself, and the gateway listens on loopback. The gateway stores the session as
  `agent:vero:hook:vero:gh:appmixer-connectors:pr:<number>` (`openclaw sessions --agent vero`).

Shadow mode is still built in: while the file `SHADOW` exists, `push.sh` and `post.sh` write to
`shadow-log.jsonl` instead of GitHub and `resolve.sh` counts only that log as answered, so another
responder can answer first. Create the file to compare, remove it to go live.

## On the host

- Gateway: OpenClaw (`openclaw --version`), user systemd unit `openclaw-gateway`
  (`XDG_RUNTIME_DIR=/run/user/0 systemctl --user status openclaw-gateway`), config
  `/root/.openclaw/openclaw.json` (`hooks.*` incl. `allowRequestSessionKey` and
  `allowedSessionKeyPrefixes`, see "Sessions"; `gateway.trustedProxies`), secrets
  `/root/.openclaw/.env`.
- These files: `/root/.openclaw/workspace-vero/mention-responder/` (scripts, `INSTRUCTIONS.md`,
  `SHADOW`, `shadow-log.jsonl`, `repo/` base clone, `runs/<pr>-<timestamp>/`).
- Transform: `/root/.openclaw/hooks/transforms/vero-mention.mjs`.
- nginx site: `/etc/nginx/sites-enabled/openclaw-webhooks`. It also serves `/status/openclaw.json`
  (bearer token) for the appmixer-sanity Operations page: `build-status.js` here is the reference copy
  of `/root/openclaw-status/build-status.js`, run by the `openclaw-status` systemd timer every 5 min.
  It lists the recent runs of this responder from `runs/` (replied / skipped / pending / failed) and
  pairs each hook run of the gateway journal with its turn in the agent's session transcripts: PR,
  duration, model calls, exec steps, cost and the closing text. A PR's persistent session holds one
  turn per run; while it lives it is read with `openclaw sessions export-trajectory` (its
  `events.jsonl` — `session-branch.json` truncates entries), afterwards from the archive the gateway
  leaves in `/root/.openclaw/agents/vero/sessions/*.zst`, like the isolated sessions of older runs.
  Transcripts are split at every hook prompt and a run is paired with the turn that ended within
  30 s before the journal line. Runs the gateway rejected before starting (model policy) have none.
- Hook token: `hooks.token` in the config (copy in `/root/backups/hook-token.txt`, root-only). The
  integration wizard field "OpenClaw hook headers" carries it; never commit it.

Copies here are the reference; deploy with `scp` to the paths above.

## Known limits

- The agent runs as root with the gateway's tools. The trusted scripts keep GitHub writes out of its
  hands, but the mention text is still model input; the instructions treat it as data only.
- The HTTP Post step logs its input, so the hook token is visible in the QA flow logs. Rotate it
  (`hooks.token`, then the instance's header) if those logs are shared.
- Run worktrees are not cleaned up yet (`git -C repo worktree prune` after removing old `runs/`).

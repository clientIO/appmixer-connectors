# Doc&Verification stage of the status-driven pipeline (OpenClaw, maya)

Step 3 of [appmixer-components#2890](https://github.com/Appmixer-ai/appmixer-components/issues/2890):
moving a card to **Doc&Verification** makes the `maya` agent check, for every connector its pull
request changes, the app registration guide in
[appmixer-docs-gitbook](https://github.com/Appmixer-ai/appmixer-docs-gitbook) (`app-registrations/`,
branch `app-registrations`): is there a page, does it match the code (callback URL, scopes,
Backoffice keys). Missing or stale → maya writes it, a docs PR is opened as apx-maya and linked from
the connectors PR. Something only a person can do (no vendor app registered yet, vendor review, paid
plan) → **Needs input** with what is missing; otherwise the card stays.

## Flow of a run

1. The dispatcher calls `/hooks/maya-docs` with the same payload as Testing (one `Start the stage`
   step picks the hook from the status).
2. The transform `maya-docs.mjs` validates it and gives `maya` (model `claude-opus-5-5`) a fixed
   instruction.
3. `resolve.mjs` (trusted): PR open and by a trusted author, the changed connectors, a worktree of the
   PR head (maya's connectors clone) and a docs worktree on a fresh branch from upstream
   `app-registrations`; writes `run.json` (per connector: auth file, auth type, guide path, exists?).
4. maya follows `INSTRUCTIONS.md`: reads the code and the docs branch `CLAUDE.md` (Backoffice
   configuration section, assets, `SUMMARY.md`), writes or updates the page, commits, writes
   `decision.json` (`up-to-date`, `created`, `updated`, `not-needed`, `needs-human` per connector).
5. `finish.mjs` (trusted, the only GitHub writer): pushes the docs branch to the apx-maya fork, opens
   the docs PR into `app-registrations`, comments the link on the connectors PR, and posts the result
   to `CI - pipeline stage result` (Doc&Verification: `needs-human` → blocked → Needs input).

## On the host

- `/root/.openclaw/workspace-maya/docs-pipeline/` (`resolve.mjs`, `finish.mjs`, `INSTRUCTIONS.md`,
  `runs/<pr>-<time>/`).
- Transform `/root/.openclaw/hooks/transforms/maya-docs.mjs`; mapping `maya-docs` and `maya` in
  `hooks.allowedAgentIds` in `/root/.openclaw/openclaw.json`; nginx `location = /hooks/maya-docs`.
- Uses `GITHUB_MAYA_PAT` from `/root/.openclaw/.env` and the callback of the Testing stage
  (`/root/.openclaw/pipeline/callback.json`).

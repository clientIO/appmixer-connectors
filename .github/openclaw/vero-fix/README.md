# Fix stage of the status-driven pipeline (OpenClaw, vero)

When the **Testing** stage fails **on code** on a pull request vero may push to (apx-vero's PR whose
head branch lives in the apx-vero fork), `CI - pipeline stage result` moves the card to **In Progress**
and calls `/hooks/vero-fix`. vero (model `claude-opus-5-5`, the PR's persistent session shared with the
mention responder) reads the logs of the failed flows, fixes the connector or the E2E flow on the PR
branch, and the card goes back to **Testing**, which runs the E2E flows again on the new commit.

- At most **3 rounds** per PR (counted in the pipeline state of the item's comment, reset by a green
  Testing run); after the third failed round → **Needs input**.
- Environment problems (no account, missing scope, expired token, provider quota) are *blocked* in
  Testing and never reach this stage.
- vero cannot fix it (commits nothing) → **Needs input** with its explanation.

## Flow of a round

1. Transform `vero-fix.mjs` validates `{pr_url, item_node_id, project_node_id, status_field_id, target,
   testing_run}` and gives vero a fixed instruction.
2. `resolve.mjs` (trusted): PR open, apx-vero's, from the fork; copies the Testing run's logs to
   `<run>/testing-logs/`; checks out the head branch from the fork in `<run>/repo` (refuses if the
   head moved since Testing ran).
3. vero follows `INSTRUCTIONS.md`: diagnose, fix (never weaken an assertion), `npm run lint`,
   `validate.js --changed`, commit as apx-vero, write `decision.json`. `amx` is the appmixer CLI on
   dev-automated with the login kept out of vero's sight; `publish` and account commands are refused.
4. `finish.mjs` (trusted, the only GitHub writer): pushes the commits to the PR branch and reports
   `Fix` → passed (pushed → Testing) or blocked (→ Needs input).

## On the host

`/root/.openclaw/workspace-vero/pipeline-fix/` (`resolve.mjs`, `finish.mjs`, `INSTRUCTIONS.md`, `amx`,
`runs/<pr>-<time>/`); transform `/root/.openclaw/hooks/transforms/vero-fix.mjs`; mapping `vero-fix` in
`/root/.openclaw/openclaw.json`; nginx `location = /hooks/vero-fix`.

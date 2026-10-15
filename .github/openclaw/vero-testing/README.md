# Testing stage of the status-driven pipeline (OpenClaw)

Step 2 of [appmixer-components#2890](https://github.com/Appmixer-ai/appmixer-components/issues/2890):
moving a card of the [@appmixer-connectors](https://github.com/orgs/Appmixer-ai/projects/7) project to
**Testing** runs the E2E flows of the connectors its pull request changes on dev-automated-00001, writes
the result into the item's pipeline comment and moves the card — passed → **Review**, failed →
**In Progress**, a precondition not met → stays in Testing with the reason.

Static checks (lint, `validate.js --changed`, unit tests) are not repeated: Node.js CI runs them on every
PR, and the stage only waits for it to be green on the head commit.

## Flow of a Testing run

1. `CI - project status -> pipeline` (dispatcher, `.github/appmixer-flows/project-status-pipeline.json`)
   sees the move, resolves the card and — for a card with a PR — posts
   `{pr_url, item_node_id, project_node_id, status_field_id, target}` to `/hooks/vero-testing`.
2. The gateway transform `vero-testing.mjs` validates every value against a strict pattern and gives the
   `vero` agent (model `claude-haiku-4-5`, it only launches) a fixed instruction: `./start.sh …`.
3. `start.sh` validates again and starts `testing.mjs` detached; the agent turn ends.
4. `testing.mjs` (deterministic, no model):
   - preconditions: the PR is open; its author is apx-vero or an OWNER / MEMBER / COLLABORATOR (the PR's
     code is published to the shared QA instance); Node.js CI (`build`) is green on the head — waits up to
     25 min; the PR changes 1–3 connectors and each has `artifacts/test-flows`;
   - checks out the PR head in a worktree of the base clone (`mention-responder/repo`);
   - per connector, under a lock (the QA instance is shared): `appmixer pack` + `publish`,
     `appmixer e2e import --connectors-dir <worktree>`, `appmixer e2e list -c <ref>`, `appmixer e2e run
     <flowId> --fix` for each flow (12 min cap per flow);
   - posts the result to `CI - pipeline stage result` (`.github/appmixer-flows/pipeline-stage-result.json`).
5. The result integration rewrites the pipeline comment (same renderer as the dispatcher, so neither
   drops what the other wrote) and then moves the card; the dispatcher records that move.

## On the host

- Runner: `/root/.openclaw/workspace-vero/pipeline-testing/` (`testing.mjs`, `start.sh`,
  `INSTRUCTIONS.md`, `runs/<pr>-<time>/` with `runner.log`, publish / import / per-flow run logs and
  `result.json`).
- Transform: `/root/.openclaw/hooks/transforms/vero-testing.mjs`; mapping `vero-testing` in
  `/root/.openclaw/openclaw.json`; nginx `location = /hooks/vero-testing`.
- `/root/.openclaw/pipeline/` (root-only): `appmixer.json` (dev-automated login for the CLI, used as
  `APPMIXER_TOKEN`), `callback.json` (webhook URL of the result integration — the URL is the credential),
  `locks/`.
- The appmixer CLI is the `dev` dist-tag (`npm install -g appmixer@dev`), as in Node.js CI.

Copies here are the reference; deploy with `scp`.

## Trying it by hand

```bash
cd /root/.openclaw/workspace-vero/pipeline-testing
R=runs/<pr>-dry; mkdir -p $R
PIPELINE_DRY=1 PIPELINE_SKIP_PUBLISH=1 node testing.mjs $R <pr> PVTI_x PVT_x PVTSSF_x 'Appmixer-ai/appmixer-components#1'
```

`PIPELINE_DRY=1` skips the callback (no card moves), `PIPELINE_SKIP_PUBLISH=1` runs the flows against
the connector version already installed on the instance.

## Known limits

- Flows that need a human (`New Mention` wants a comment from a second account) fail by timeout.
- A connector without `artifacts/test-flows` blocks the stage instead of passing it.
- Plugin connectors that authenticate through the QA Auth Hub are not uploaded to the hub.

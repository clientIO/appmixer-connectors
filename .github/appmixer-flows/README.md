# Appmixer flows that drive this repo's CI

Flows here are **operational**, not connector test flows. They live outside
`src/appmixer/**/artifacts/test-flows`, so the connector e2e tooling never picks
them up and they never show in an e2e report.

## copilot-review-dispatch.json

Fires a `repository_dispatch` event of type `copilot-review` whenever GitHub
Copilot submits a review in this repo, which starts
`.github/workflows/claude-copilot-responder.yml`.

### Why it exists

The responder used to start from a `pull_request_review` event, captured by a
separate trigger workflow and handed over through `workflow_run`. That run is
raised by the **Copilot bot**, which is not a repo collaborator, on a PR whose
head lives in the **apx-vero fork** — so it fell under *Fork pull request
workflows from outside collaborators* and sat on "Approve and run" until a
maintainer clicked it; the `workflow_run` child inherited `actor=Copilot` and was
gated too. Every blocked run this repo ever had was raised by `Copilot`. The
trigger workflow and the `workflow_run` hop are removed; this flow is the only
automatic entry point, and `workflow_dispatch` remains for manual runs.

`repository_dispatch` runs are raised by the **dispatching token's owner**, always
run on the default branch and always receive secrets, so they are never gated.

### Shape

Two components:

- `GitHub / New Review` — repository `Appmixer-ai/appmixer-connectors`, author
  `copilot`, author type `bots`. One event per submitted review.
- `GitHub / Repository Dispatch` — event type `copilot-review`, client payload
  `{"pr_number": "<pull_request_number>", "review_id": "<id>"}`.

**Why New Review and not New Pull Request Review Comment.** Copilot posts one
review holding many inline comments. The comment trigger would emit — and
dispatch — once per comment, all with the same review id; the review trigger
emits once per review, which is exactly the responder's unit of work.

The author filter is a case-insensitive substring match, which matters here:
the same Copilot account is reported as `copilot-pull-request-reviewer[bot]` on
the reviews endpoint this trigger reads, `Copilot` on the review-comments
endpoint and `copilot-pull-request-reviewer` in GraphQL. `copilot` matches all
three; `authorType: bots` keeps a human whose login merely contains the word out.

New Review scans recently updated pull requests in **any** state, so an
approve-then-merge still reaches the flow. The flow deliberately does not filter
by pull request author — the responder only acts on open apx-vero PRs and says
so in its log, which is cheaper than an extra lookup per review here.

### Setup

- The GitHub account bound to both components needs **push access** to
  `Appmixer-ai/appmixer-connectors` — `POST /repos/{owner}/{repo}/dispatches`
  requires it. `apx-vero` only has `triage`, so bind a writer's account.
- The connector must be published at **github 3.3.0 or newer**; New Review and
  the `pull_request_number` field on its output landed there.
- Import with the account bound, then start it. The flow carries designer
  notes that repeat the points below next to the components they concern.

### When it breaks

- **Dispatch fails with 403 "OAuth App access restrictions".** The
  `Appmixer-ai` org has no grant for the Appmixer GitHub OAuth app (client
  `1c0ed414fe35895cb5ce`) — reads of the public repo still work, which is why
  the trigger looks healthy. An org owner approves the app; then the account
  must be **re-authorized** in Appmixer, because the old token does not pick up
  the grant. Re-authorizing stops flows bound to the account — start this one
  again.
- **Failed dispatches** land in the instance's dead-letter queue
  (`storeUnprocessed`). Retry them only while the flow is running: a retry
  delivered to a stopped flow leaves the queue and is lost.
- **Manual fallback:** run the responder from the Actions tab
  (`workflow_dispatch`) with a PR number, and optionally a review id.

### Duplicates

A retry, or a manual dispatch on top of an automatic one, can hand the same
review over twice. The responder's Resolve step is idempotent: it skips a review
for which its own summary comment already exists with a timestamp after the
review's `submitted_at`. Worst case is one extra ~15 s no-op run.

## pr-hygiene-new-pr.json and pr-hygiene-daily.json

Two integrations that keep pull requests and the
[@appmixer-connectors project](https://github.com/orgs/Appmixer-ai/projects/7)
tidy. They only **warn in Slack** — nothing on a pull request is changed.

The rules:

1. Every pull request either **links an issue** (a closing keyword in its
   description, e.g. `Fixes Appmixer-ai/appmixer-components#N`) or **is itself in
   the project**. A PR whose description says enough on its own does not need an
   issue — but then it goes into the project.
2. Every project item carries a **connector label** — `appmixer:<connector>`,
   one per `bundle.json`, e.g. `appmixer:microsoft:mail` — or
   `non-connector-task`.

### Shape

- **New pull request** — `New Pull Request` → `Wait 1h` → a GraphQL
  `resource(url:)` lookup of the PR (draft, state, linked issues) → `Find
  Project Items` → `Code Block` → `Condition` → Slack. The hour gives the author
  time to link an issue or add the PR to the project. Drafts are skipped; the
  daily check picks them up once they are ready.
- **Daily check** — Monday to Friday, 8:00 Europe/Prague. Lists the open,
  non-draft PRs breaking rule 1 and the project items breaking rule 2, in one
  message. Rule 2 only looks at items **added in the last two days** (the item's
  own `createdAt`, returned by `Find Project Items` since github 3.4.0), so the
  hundreds of older unlabelled items never flood the channel. Nothing is posted
  when both lists are empty.

Linked issues are read through GraphQL with the bound account rather than by
parsing the PR description: the issues live in the private
`appmixer-components` repo, and the account can see it.

### Setup

The wizard asks for three things:

- **GitHub account** — needs `repo` and **`read:project`**. Without the project
  scope `Find Project Items` fails at start with *"Access token not found …
  Calling factory init"*; re-authorize the account from that component.
- **Slack account** — must be a member of the channel.
- **Slack channel** — where the warnings go.

Then start it from the Automation Hub (`/automation-hub` → Use → Start
automation).

### Publishing

Both files are Automation Hub templates, published with appmixer-sanity's
script (its CLAUDE.md, *Migrating a flow to an integration*), from an
appmixer-sanity checkout whose `.env` points at dev-automated-00001:

```bash
node --env-file=.env scripts/publish-integration.js <path>/pr-hygiene-new-pr.json --dry-run
node --env-file=.env scripts/publish-integration.js <path>/pr-hygiene-new-pr.json
```

It matches the template by `name`, so re-running it updates in place. Running
instances stay on their revision until
`appmixer integration update-instances <template id>` moves them.

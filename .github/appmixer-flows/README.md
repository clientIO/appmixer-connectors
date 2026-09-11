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

## apx-vero-mention-dispatch.json

Fires a `repository_dispatch` event of type `apx-vero-mention` when a person
mentions the bot on a PR — in the conversation, inline on a line of the diff,
or in a review body — which starts
`.github/workflows/claude-mention-responder.yml`.

It replaces `claude-pr-author.yml` (#1153, removed in #1169), which listened to
the comment and review events directly. Two of those three events run without
secrets on PRs from forks, and apx-vero's PRs always come from its fork.

### Shape

- `GitHub / New Mention` — the notifications of the account bound to it,
  reason `mention`, limited to the watched repositories.
- `Condition` — the notification is about a pull request
  (`subject.type = PullRequest`). It reads `input` / `operator` / `value`; the
  `field` / `expected` keys some older flows use are ignored by the component,
  which then lets everything through.
- `GitHub / Repository Dispatch` — into the repository the mention came from
  (`repository.full_name`), with `{"pr_url": "<subject.url>"}`.

GitHub keeps one notification per PR thread, so the payload only says "something
on this PR mentions the bot". The workflow validates that `pr_url` is a pull
request of its own repository, then sweeps the PR for every mention with no
reply yet and answers each once. Every reply ends with an
`<!-- apx-vero-mention:<kind>:<id> -->` marker, which is what "answered" means;
a repeated dispatch finds nothing pending and stops.

### Accounts

- **New Mention** reads the notifications of the account it is bound to, so
  bind the **bot** (apx-vero). Its own comments never notify it, which also
  rules out reply loops.
- **Repository Dispatch** needs **push** to the repository — bind a writer.

### Setup

Published as an integration template (see below); the wizard asks for the two
accounts and the repositories to watch. Each watched repository needs
`claude-mention-responder.yml` on its default branch and the `VERO_GH_TOKEN`
and `ANTHROPIC_API_KEY` secrets — the integration only covers the Appmixer half.

## Publishing as integrations

Both flows carry a `wizard` and are published on dev-automated-00001 as
integration templates in the category (and Automation Hub tab)
**appmixer-sanity-hub** — the appmixer-sanity app's `/automation-hub` page
opens on it:

1. `POST /flows` with the JSON plus `"type": "integration-draft"` and
   `"categories": [<appmixer-sanity-hub category id>]` — the editable draft.
2. `POST /flows/<draftId>/clone` with
   `{"projection": "-sharedWith", "setOriginFlowId": true, "additional": {"type": "integration-template", "sharedWith": [{"scope": "user", "permissions": ["read"]}]}}`
   — the published template, visible to every user of the instance. `additional`
   takes only `type` and `sharedWith` (anything else is a 400), so set the
   category afterwards with `PUT /flows/<templateId>` `{"categories": [...]}`.
3. Users activate it from the Automation Hub; after changing the template,
   `appmixer integration update-instances <templateId>` moves every instance to
   the new revision.

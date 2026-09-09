# Appmixer flows that drive this repo's CI

Flows here are **operational**, not connector test flows. They live outside
`src/appmixer/**/artifacts/test-flows`, so the connector e2e tooling never picks
them up and they never show in an e2e report.

## copilot-review-dispatch.json

Fires a `repository_dispatch` event of type `copilot-review` whenever GitHub
Copilot submits a review in this repo, which starts
`.github/workflows/claude-copilot-responder.yml`.

### Why it exists

The responder's original entry point is a `pull_request_review` event. That run
is raised by the **Copilot bot**, which is not a repo collaborator, on a PR whose
head lives in the **apx-vero fork** — so it falls under *Fork pull request
workflows from outside collaborators* and sits on "Approve and run" until a
maintainer clicks it. The `workflow_run` child inherits `actor=Copilot` and is
gated too. Every blocked run this repo has had was raised by `Copilot`; nothing
else is ever gated.

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
- Import with the account bound, then start it.

### Duplicates

A retry, or a manual dispatch on top of an automatic one, can hand the same
review over twice. The responder's Resolve step is idempotent: it skips a review
for which its own summary comment already exists with a timestamp after the
review's `submitted_at`. Worst case is one extra ~15 s no-op run.

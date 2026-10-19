# Slack Connector

This connector integrates Slack APIs (events, interactive components, file upload, reactions, messaging) with Appmixer. This README focuses on the Task Approval feature ("Request Approval" flow) implemented in the `tasks` subsystem.

## Overview: Task Approval Flow
The Task Approval feature lets a flow request an approval from a designated Slack user and continue once the decision is made. It relies on:

- A persisted Task document (`SlackTaskModel`) with state tracking.
- An interactive Slack message (buttons) posted to a channel or direct context.
- A webhook endpoint `/plugins/appmixer/slack/interactions` processing button clicks.
- Periodic jobs to mark overdue tasks and retry failed webhook deliveries.
- Retrieval utilities (`FindRequestApprovals` component & direct REST API) to list/filter tasks.

### Typical Lifecycle
1. Flow invokes `tasks/RequestApproval` component with: title, description, requester (Slack user ID), approver (Slack user ID), channel, decisionBy (deadline), webhookUrl.
2. Component creates a Task (status = `pending`) and posts an interactive message with Approve / Reject buttons.
3. Approver clicks a button → Slack sends an interaction payload to `/plugins/appmixer/slack/interactions`.
4. Route validates Slack signature, parses action, loads Task, enforces approver identity, sets status `approved` or `rejected`, persists & posts a confirmation update (removes buttons, adds status line).
5. The stored Task triggers the provided webhook (flow continuation or external system).
6. Background jobs mark tasks `due` if not decided by `decisionBy`, and retry failed webhook deliveries (re-sending the status that failed to deliver, see [Overdue & Retry Logic](#overdue--retry-logic)).

### Task Statuses
| Status     | Meaning |
|------------|---------|
| pending    | Awaiting approver action. |
| approved   | Approved by approver. |
| rejected   | Rejected by approver. |
| due        | Deadline passed without decision. |
| error      | Webhook delivery failed (will be retried). |

### Key Components & Files
- `tasks/RequestApproval/RequestApproval.js` – Creates a new approval request (Task) and sends interactive Slack message.
- `list/FindRequestApprovals/FindRequestApprovals.js` – Queries Tasks via internal plugin REST API with filters (status/title/requester/approver) and exposes flexible output modes (`array`, `object`/`first`, `file`).
- `routes-tasks.js` – Exposes REST endpoints:
  - `GET /plugins/appmixer/slack/tasks` (list & filter)
  - `GET /plugins/appmixer/slack/tasks/{taskId}` (detail)
  - `POST /plugins/appmixer/slack/tasks` (create – used by component, normally you use the component not the raw route)
  - `POST /plugins/appmixer/slack/interactions` (Slack interactive callbacks)
- `jobs.js` – Schedules two maintenance jobs:
  - `slack-due-tasks`: marks overdue (`decisionBy < now`) pending tasks as `due`, deletes tasks older than 60 days, triggers webhook notifications.
  - `slack-resubmit-failed-webhooks`: retries tasks in `error` by re-triggering webhooks.
- `lib.js / isValidPayload` – Validates Slack signatures (time + HMAC) for security.
- `taskUtils.js` – Helper functions such as `triggerWebhook` used after status transitions.

### AuthHub vs Tenant Pods
The code supports a multi-tenant AuthHub deployment:
- AuthHub: Forwards Slack interaction payloads to the tenant pod (`/plugins/appmixer/slack/interactions`).
- Tenant pod: Performs the actual Task lookup, validation, status update, and webhook triggering.
- Conditional logic is guarded by `process.env.AUTH_HUB_URL` & `AUTH_HUB_TOKEN` presence.

### Interaction Handling Flow (Simplified)
```
POST /interactions (Slack) -> validate signature -> parse actions[]
  -> extract value = taskId|host (host used only in AuthHub forward case)
  -> load Task -> verify approver (payload.user.id) -> set status -> save
  -> update original message (removes buttons + adds status line) via response_url
  -> trigger webhook (async via utils)
```

### Webhook Triggering
Each Task carries a `webhookUrl` provided at creation time. After status change (approve, reject, due, or error transitions) the system sends the Task JSON (with updated status) to that URL. A failure responding 404/410 (the flow or component no longer exists) removes the Task. Any other failure sets status `error`, remembers the undelivered status in `failedStatus` and schedules a retry.

### Overdue & Retry Logic
- Overdue detection: Any `pending` Task with `decisionBy < now` becomes `due` and its webhook is triggered.
- Retry: Tasks in `error` whose `nextAttemptAt` has passed get their `failedStatus` (e.g. `approved`, `rejected`, `due`) restored and the webhook re-sent. Tasks that failed before `failedStatus` existed are re-sent as `pending`.
- Backoff: each failed attempt doubles the delay before the next one (5, 10, 20 … minutes, capped at 6 hours; configurable via `failedWebhooksBackoffBaseMs` / `failedWebhooksBackoffMaxMs`). A 404/410 removes the Task; other failures (e.g. a stopped flow) keep it in `error` until it is delivered or removed by the 60-day cleanup.

### Filtering & Query Parameters (`GET /tasks`)
| Param      | Description |
|------------|-------------|
| status     | One of pending, approved, rejected, due, error (omit for all). |
| title      | Case-insensitive partial match. |
| requester  | Slack user ID of requester. |
| approver   | Slack user ID of approver. |
| limit      | Max records (1–1000, default 100). |


### Common Pitfalls
| Issue | Cause | Mitigation |
|-------|-------|-----------|
| Interaction returns 401 | Signature mismatch | Verify Slack signing secret and timestamp window. |
| Task stuck in `error` | Webhook repeatedly failing | Inspect logs, ensure webhook endpoint reachable & returns 2xx. |
| Approver cannot act | Wrong Slack user ID stored | Confirm `approver` param is a Slack member ID (`U...`). |
| Buttons not removed after action | Response update failed | Check `response_url` POST response; inspect logs for `slack-plugin-route-interaction`. |

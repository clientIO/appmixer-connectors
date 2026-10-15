# Appmixer cli tests for GitHub project components

appmixer test component src/appmixer/github/project/FindProjectItems -i '{"in":{"projectId":"PVT_kwDOAA12oc4AGXUu","status":"Done","outputType":"array"}}'

appmixer test component src/appmixer/github/project/GetProjectItem -i '{"in":{"projectItemId":"PVTI_lADOAA12oc4AGXUuzgbi8fA"}}'

appmixer test component src/appmixer/github/project/GetProjectItem -i '{"in":{"projectItemId":"PVTI_lADOAA12oc4AGXUuzgZulYs"}}'

appmixer test component src/appmixer/github/project/GetProjectFields -i '{"in":{"projectId":"PVT_kwDOAA12oc4AGXUu","outputType":"array"}}'

appmixer test component src/appmixer/github/project/GetNodeById -i '{"in":{"nodeId":"I_kwDOAA12oc6abcde"}}'

appmixer test component src/appmixer/github/project/UpdateProjectItemField -i '{"in":{"projectId":"PVT_kwDOAA12oc4AGXUu","itemId":"PVTI_lADOAA12oc4AGXUuzgbi8fA","fieldId":"PVTSSF_lADOAA12oc4AGXUuzgnEbCE","valueType":"single_select","value":"In Progress"}}'

appmixer test component src/appmixer/github/list/RepositoryDispatch -i '{"in":{"repositoryId":"Appmixer-ai/appmixer-components","eventType":"agent-run","clientPayload":"{\"issue\":\"2834\"}"}}'

appmixer test component src/appmixer/github/list/ListComments -i '{"in":{"repositoryId":"Appmixer-ai/appmixer-components","issueNumber":"2834","outputType":"array"}}'

appmixer test component src/appmixer/github/list/UpdateComment -i '{"in":{"repositoryId":"Appmixer-ai/appmixer-components","commentId":"2384759211","body":"<!-- agent-log -->\nUpdated."}}'

## Board-driven workflows (Projects v2)

`project/OnProjectItemChanged` emits `projects_v2_item` events of an organization's boards. GitHub
delivers them only through an **organization webhook**, and only an organization owner can manage
those, so the connector does not register anything itself. The webhook is set up once per
organization, by an owner, and every flow with the trigger subscribes to it through the
connector's plugin (`plugin.js` + `routes.js`, the same listener pattern as Slack).

### Setting up the organization webhook (once, by an organization owner)

1. Give the connector a secret: Backoffice → Connector Configuration → `appmixer:github` →
   `webhookSecret` (any long random string), or
   `appmixer service-config set appmixer:github -u -d '{"webhookSecret": "<secret>"}'`
   (`-u` keeps `clientId` / `clientSecret`).
2. On GitHub: Organization → Settings → Webhooks → Add webhook:
   - Payload URL: `<API_BASE>/plugins/appmixer/github/events`
     (for example `https://api.acme.appmixer.cloud/plugins/appmixer/github/events`)
   - Content type: `application/json`
   - Secret: the same `webhookSecret`
   - Events: *Let me select individual events* → **Project v2 items** only
3. Save. GitHub sends a `ping`, which the endpoint answers with 200; the delivery log of the
   webhook shows it.

**Instances that authenticate GitHub through an Auth Hub:** the trigger's listener registers on
the hub, not on the instance, so the organization webhook has to point at the **hub's** endpoint
(`https://<auth-hub>/plugins/appmixer/github/events`), the connector has to be installed on the hub
and the `webhookSecret` set in the hub's `appmixer:github` service config. The hub relays each
delivery to the subscribed triggers of every connected instance.

One webhook serves every flow on the instance. The endpoint drops deliveries whose
`X-Hub-Signature-256` does not match (401) and routes `projects_v2_item` to the triggers whose
organization, board (`Project Node ID`, optional) and actions match. The account bound to the
trigger needs only `read:org` and `read:project` — they serve Flow Test Mode, which reads the
newest card of the board; it can be any member of the organization.

The event does not carry the repository, so consumers resolve `Content Node ID` through
`project/GetNodeById`.

For loop detection, note the login Appmixer writes with: with OAuth/PAT that is the
owner of the connected account (so a human's `sender.login` on board events is
indistinguishable from Appmixer's own writes); with a GitHub App it is the
`…[bot]` account. Flows should use that login as the "ignored sender" allowlist.

## E2E test flows (`artifacts/test-flows`)

Preconditions the flows assume on the connected account:

- `E2E GitHub - Issue Comments`, `New Assigned Issue Trigger`, `New Mention Trigger`:
  push access to `apx-vero/appmixer-test` with issues enabled (`repo` scope).
- `E2E GitHub - New Mention Trigger`: GitHub never notifies an account about its
  own mentions, so while the flow runs a **second** account has to comment
  `@<connected login>` on the probe issue the flow opens; the flow closes it afterwards.
- `E2E GitHub - Project Board`: a user-owned board of the connected account
  (`project` scope for `UpdateProjectItemField`).
- `E2E GitHub - On Project Item Changed Trigger`: an organization webhook of the
  organization pointing at the instance's `/plugins/appmixer/github/events` with the
  configured `webhookSecret` (see above), `read:org` + `project` on the account, and an
  organization board whose title contains `Appmixer E2E` with a `Backlog`
  Status option and at least one item. The flow parks the item in the second
  Status option, moves it to `Backlog`, asserts the `edited` delivery, and the
  cleanup moves it back; a Condition on `changes.field_value.to == Backlog`
  keeps the cleanup's own delivery from re-triggering the harness.

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

`project/OnProjectItemChanged` registers an **organization** webhook
(`POST /orgs/{org}/hooks`) for the `projects_v2_item` event and removes it again in
`stop()`. That needs organization admin rights — an OAuth token or PAT with
`admin:org_hook`, or a GitHub App installed on the organization. The event does not
carry the repository, so consumers resolve `Content Node ID` through
`project/GetNodeById`.

Signature verification is opt-in (`Verify Webhook Signature`). Components only see
the parsed webhook body, so the `X-Hub-Signature-256` digest has to be recomputed
over a re-serialization of it, which is not byte-exact for every payload. Leave the
toggle off unless the deliveries in your setup verify reliably.

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
- `E2E GitHub - On Project Item Changed Trigger`: `admin:org_hook` + `read:org`
  + `project` on an organization the account administers, and an organization
  board whose title contains `Appmixer E2E` with at least one item whose
  `Status` is not the first option (the flow moves it to the first option and
  the cleanup moves it back).

# Wiz mock harness

The two upload components (`UploadScan`, `UploadSecurityScan`) can only be
exercised end-to-end against a Wiz tenant that has a **real Enrichment
Integration ID**. Without one, Wiz accepts the signed-URL upload and then never
registers a system activity — every status poll answers
`Resource not found (NOT_FOUND)` and the flow fails, so the success path (and
the whole `UploadScan` drain/batching behaviour behind
[appmixer-components#2793](https://github.com/Appmixer-ai/appmixer-components/issues/2793))
is untestable on a live instance.

`mock-wiz-server.js` stands in for the Wiz GraphQL API so those paths can be
driven on a real Appmixer instance, in the real engine runtime (locks, component
state, `context.setTimeout` continuations) — only the vendor API is simulated.

## What it implements

| Route | Behaviour |
|---|---|
| `POST /graphql` `requestSecurityScanUpload` | returns an upload id, a signed URL pointing back at the mock, and a `systemActivityId` |
| `PUT /upload/<id>` | accepts the batch, records its size and the `dataSources` ids |
| `POST /graphql` `systemActivity` | `IN_PROGRESS` for the first `inProgressPolls` polls, then `SUCCESS` with matching `incoming`/`handled` stats; an unknown id answers `Resource not found (NOT_FOUND)` like the real API |
| `POST /graphql` `cloudResources` | a synthetic tenant of `resourcesTotal` resources, honouring `first`/`after` |
| `POST /oauth/token` | stand-in for `https://auth.app.wiz.io/oauth/token` |
| `GET /_state` | everything recorded so far (upload requests, PUTs with their `dataSourceIds`, poll counts, resource pages) |
| `POST /_reset[?inProgressPolls=&resourcesTotal=]` | clears the recording and re-configures the mock |

## Running a simulation

```bash
# 1. Start the mock and expose it (any tunnel works)
node src/appmixer/wiz/artifacts/mock/mock-wiz-server.js      # PORT=8080 to change the port
ngrok http 4599                                              # -> https://<id>.ngrok.app

# 2. Create an account pointing at the tunnel. auth.js validates the credentials
#    against the real Wiz auth endpoint, so for the mock run temporarily point
#    that call at the endpoint origin (do not commit that change):
#        const url = new URL(context.url).origin + '/oauth/token';
#    then pack + publish the connector and inject the account:
appmixer account create mock-account.json --no-profile-info --no-validate-scope
#    mock-account.json:
#    { "service": "appmixer:wiz", "name": "wiz mock",
#      "token": { "type": "apiKey", "url": "https://<id>.ngrok.app/graphql",
#                 "clientId": "mock-client-id", "clientSecret": "mock-client-secret",
#                 "token": "mock-access-token", "expires": 4102444800000 },
#      "profileInfo": {} }

# 3. Point the E2E flows at that account
appmixer e2e import src/appmixer/wiz/artifacts/test-flows --account <mockAccountId>

# 4. Drain/batching check: 25 documents through Each -> UploadScan
#    (threshold 10, schedule 1 minute)
appmixer e2e import src/appmixer/wiz/artifacts/mock/burst-flow.json \
    --connector appmixer:wiz --account <mockAccountId> --no-validate
appmixer flow start <flowId>
curl -s https://<id>.ngrok.app/_state | jq '[.uploads[].dataSourcesCount]'
```

Restore `auth.js`, republish, and delete the mock account when done.

## What the burst flow proved (2026-08-26, engine on dev-automated-00001)

`[10, 10, 5]` — 25 distinct documents, no duplicates, nothing stranded:

1. the threshold batch of 10 goes out on the receive() that crosses the threshold,
2. the next 10 follow from the **drain continuation** timeout ~60 s later,
3. the remaining 5 (below the threshold) go out with the **scheduled** drain.

Two defects were found this way and fixed:

- a 2 s continuation timeout is **never delivered** — the engine's timeout
  scheduler works at ~1 minute granularity, so the backlog remainder stayed in
  state until the next message arrived (`DRAIN_CONTINUATION_DELAY` is now 60 s),
- a batch prepared by one receive() could be picked up and uploaded again by a
  concurrent one (25 documents produced 60 uploads) — an upload batch is now
  claimed with a timestamp and only resumed once it is older than the lock TTL.

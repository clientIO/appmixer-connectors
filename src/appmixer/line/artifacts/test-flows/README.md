# LINE E2E test flows

```bash
appmixer e2e import src/appmixer/line/artifacts/test-flows --account <accountId>
appmixer e2e run <flowId> --fix
```

## Fixtures these flows assume

| Fixture | Value used |
|---|---|
| Bot | `@523cawgz` ("Appmixer"), userId `U59f8a8aa5337e9e39bec3461bb71615e` |
| Insight date | `20260826` — see the note below |

## Fully automatic

| Flow | Covers |
|---|---|
| `test-flow-insights.json` | GetNumberOfFollowers, GetNumberOfMessageDeliveries |
| `test-flow-makeapicall.json` | MakeApiCall (`GET /v2/bot/info`) |

`test-flow-insights.json` pins a literal `date` (`YYYYMMDD`). LINE keeps insight
data for 365 days and only aggregates it a day in arrears, so the pinned date
works for a year and then starts returning `status: "unready"`. There is no
date-formatting modifier available to compute `YYYYMMDD` from `g_now`, so bumping
the literal (or adding a CodeBlock that formats it) is the maintenance step.

## Needs one manual action

### `test-flow-messaging-manual.json`

Covers **NewMessages → SendReplyMessage → SendPushMessage**. LINE only issues a
`replyToken` for a real inbound webhook event, and the token is single-use with a
short TTL, so the chain cannot be provoked from inside the flow.

1. Start the flow.
2. Send any text message to the bot from a LINE account that has added it.
3. `NewMessages` fires; the flow replies to that message, then pushes a second
   message to the same user, and asserts the trigger payload.

`AfterAll` waits 600s to leave room for the manual step.

## Not covered, and why

| Component | Reason |
|---|---|
| `SendBroadcastMessage` | Delivers to **every follower of the bot** — 4 real accounts on this channel. An automated test must not message real people; covering it needs a channel with no human followers. |
| `LeaveGroupOrRoom` | Needs the bot to be a member of a group or room, and the call is destructive (the bot cannot re-add itself). Needs a throwaway group plus a human to re-invite the bot after each run. |

`ListRichMenus` and `GetRichMenu` are `private: true` — dynamic-output source
helpers, not user-facing actions — so they are out of scope for E2E and are
exercised through the inspector dropdowns of the components that consume them.

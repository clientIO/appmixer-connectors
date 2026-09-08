# Telegram E2E test flows

Five flows covering all 13 components. Import with:

```bash
appmixer e2e import src/appmixer/telegram/artifacts/test-flows --account <accountId>
appmixer e2e run <flowId> --fix
```

## Fixtures these flows assume

| Fixture | Value used |
|---|---|
| Bot | `@appmixer_test_bot` (id `8865231953`) |
| Chat | group **v & Appmixer QA**, `chatId` `-5393771328` |

The chat ID is a literal in every flow — change it in one place per flow if you
point these at a different group. The bot must be a **member** of that group, and
for `ListChatAdministrators` the group must have at least one administrator (the
creator always counts).

## Fully automatic flows

| Flow | Covers |
|---|---|
| `test-flow-messaging.json` | SendMessage → EditMessage → ForwardMessage, cleanup via DeleteMessage |
| `test-flow-media.json` | SendPhoto (URL) → GetFile (download) → SendDocument (**upload**), cleanup |
| `test-flow-chat.json` | GetChat, ListChatAdministrators, MakeApiCall |

`test-flow-media.json` deliberately feeds `GetFile`'s stored file back into
`SendDocument`, which is the only coverage of the multipart upload branch in
`lib.sendMedia` — the CLI harness cannot reach it, because
`appmixer test component` uses an ephemeral per-invocation file store, so a file
saved by one invocation is already gone in the next.

## Flows needing one manual action

Telegram never delivers a bot its **own** messages, so neither trigger can be
provoked from inside the flow. Both flows post a prompt into the group and then
wait; `AfterAll` timeout is 600s to leave room for a human.

### `test-flow-newmessage-trigger.json`

1. Start the flow. The bot posts *"E2E: reply to THIS message…"* into the group.
2. **Reply to that message** in Telegram (a plain new message is not enough — the
   group is a regular group and the bot's privacy mode is on, so it only receives
   replies to itself and messages that @-mention it).
3. The trigger fires; the flow asserts `message_id`, `update_kind == "message"`,
   the sender's `from.id` and `chat.type == "group"` (the variable picker offers
   nested fields directly — `From.ID`, `Chat.Type`), then deletes the bot's **own prompt** message. Your reply stays: a bot can
   delete other members' messages only as an administrator with the *Delete
   messages* right, which these flows do not assume.

Note that `from.username` is **optional** in Telegram — a user who never set a
username has none — so the flows do not assert on it. `artifacts/samples/`
holds the recorded shape of a real group reply for `appmixer connector verify
telegram --offline`; record more shapes (a private-chat message, a photo, a
document) with `--record` on a bot that has no webhook registered.

### `test-flow-callbackquery-trigger.json`

1. Start the flow. `MakeApiCall` posts a message carrying an inline keyboard with a
   **Fire E2E** button (`SendMessage` has no `reply_markup` input, so the keyboard
   goes out through the generic call).
2. **Press the button.**
3. `NewCallbackQuery` fires, `AnswerCallbackQuery` acknowledges it (the button stops
   showing its loading spinner), and the prompt message is deleted.

To disable the bot's privacy mode and let the trigger see every group message,
send `/setprivacy` to @BotFather and pick Disable. The flows do not need it.

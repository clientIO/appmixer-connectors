# AI connector E2E test flows

Flows live at the **connector** level (`src/appmixer/ai/artifacts/test-flows/`) even
though the `ai` connector is split into per-provider modules, because that is where
`appmixer e2e import -c ai` looks.

## Scope

Right now the **groq** and **typesafe** modules are covered:

| Flow | Components |
|------|------------|
| `test-flow-prompt.json` | `groq.SendPrompt` (×2 — the output contract and conversation memory) |
| `test-flow-api-call.json` | `groq.MakeApiCall` (×2 — relative `GET` path, `POST` with a JSON body) |
| `test-flow-audio.json` | `groq.CreateTranscription`, `groq.CreateTranslation` |
| `test-flow-typesafe-decisions.json` | `typesafe.ClassifyText`, `typesafe.ScoreText`, `typesafe.VerifyStatement`, `typesafe.AskQuestions` |
| `test-flow-typesafe-models-api-call.json` | `typesafe.ListModels` (`first`), `typesafe.MakeApiCall` (×2 — relative `GET /v1/models`, absolute `POST /v1/systemone` with a JSON body) |

`appmixer e2e validate` therefore reports ~60 `component-coverage` warnings for the
other modules (`openai`, `claude`, `gemini`, `bedrock`, `openrouter`, `requesty`,
`voyageai`, `agentcore`, `agenttools`). They are not regressions — those modules have
never had E2E flows. Add them here as each module is brought onto the AI connector
contract.

`groq.ListModels` is `private: true`, so it is a source helper for the model dropdowns
rather than a testable action and must not appear as a flow node
(`no-private-component-node`). It is exercised indirectly: `MakeApiCall` hits the same
`GET /openai/v1/models` endpoint, and the designer calls `ListModels` to fill the
`model` typeahead of `SendPrompt` / `CreateTranscription` / `CreateTranslation`.

## Groq account requirements

Nothing in these flows is bound to a tenant ID, but the model IDs are pinned literals
and must be available to the connected Groq account:

- `openai/gpt-oss-120b` — `SendPrompt` and the `MakeApiCall` chat completion
  (`llama-3.3-70b-versatile` was retired by Groq before the first run, 2026-09-08)
- `whisper-large-v3` — `CreateTranscription` and `CreateTranslation`

Groq retires models on its own schedule. When one of these disappears the flows fail
with a `404 model_not_found`; swap in whatever the account's `GET /models` currently
returns for the same role.

## Determinism notes

- **Prompt flow.** Both prompts run at `temperature: 0` and ask the model to echo the
  literal token `APPMIXER-E2E-GROQ`, so the asserts are `regex` rather than `equal`
  (the model may still add whitespace). `notEmpty` alone would be too weak — the Assert
  component implements it as `expect(field).to.exist`, which an empty string passes.
  The `conversationId` is suffixed with `g_timestamp`, so every run starts a fresh
  conversation instead of appending to the previous run's stored history.
  `gpt-oss` is a reasoning model: its hidden reasoning counts against
  `max_completion_tokens` (~60–80 tokens for the echo), so the flows allow 1000 —
  a 200 budget would end with `finish_reason: length` and an empty answer.
- **Audio flow.** The speech sample is downloaded at run time from
  `https://dpgr.am/spacewalk.wav` (the same public asset the deepgram flows use) —
  2.2 MB of real speech, too big to inline as base64. `appmixer.utils.files.RemoveFile`
  after `AfterAll` deletes the copy from the file store so repeated runs do not grow it.
  `create-without-cleanup` still warns here: it only counts *connector* components as
  cleanup, and `RemoveFile` is a `utils` one. Nothing is created on Groq's side.
- **`MakeApiCall` query parameters are not covered.** `url`, `method`, `body` and
  `headers` are. Groq's OpenAI-compatible endpoints take no query parameters, so
  populating `parameters` would only add an argument the API is free to reject —
  hence the standing `input-coverage-optional` warning for that field.

## TypeSafe notes

- **`AskQuestions` asserts go through the generated variables.** Its questions are
  inspector rows (one `choice`, one `score`, one `noul`) and its out port is built from
  those rows, so the asserts read `answers.<id>.<field>` directly with no `g_jsonPath` —
  a broken option list fails the import's variable check instead of hiding behind a
  raw-object path. `appmixer connector verify` skips this component (it only samples
  dynamic ports of `outputType` components), so this flow is its live check.
- All decision calls pin `model: jev-latest`, so the model assertions are `regex ^jev-`
  (the API resolves the alias to a concrete version such as `jev-1.13.0`).
- The content in each decision flow is deliberately unambiguous (a double charge →
  `billing`, an API 500 error → `technical`, an explicit "URGENT" → `true`), so the
  `equal` asserts on the choice/result are stable. `ScoreText` only asserts the level is
  one of the two upper levels, because the model may split probability between them.
- Nothing is created on TypeSafe's side, so the flows have no cleanup step.

# Deepgram E2E test flows

Every component is covered by a flow here except one.

## ⚠️ Failed Request has no E2E flow

`appmixer.ai.deepgram.FailedRequest` fires when a request fails inside a Deepgram
project. There is no deterministic way to produce such a failure from inside a test
flow, so the flow that used to try was removed rather than left failing.

The provocation it used was an unreachable audio URL. Deepgram fetches that URL while
handling the submit and rejects the whole call synchronously:

```
415 remote server failed to offer audio data.
Content-Type of remote server's response was: text/html; charset=utf-8
```

That is a rejected request, not a failed one: the component throws, the flow stops on
the first error the way E2E flows are required to, and the trigger never sees anything.
Querying the project's request log with `?status=failed` returned nothing afterwards
either — Deepgram appears to log only the requests it accepted.

Producing a genuine failed request means getting Deepgram to **accept** a job and fail
during processing — e.g. a URL that serves a correct `audio/*` content type over broken
bytes. That needs a purpose-built file on hosting somebody has to keep alive, which
costs more than the flow is worth.

**How the component is covered instead:** code review, plus its `test(context)` method,
which shares the fetch path with `tick()`, writes no state, and throws when there is no
real failed request to use rather than fabricating one. Both `NewRequest` and
`TranscriptionCompleted` poll the same endpoint with the same diffing logic and are
covered by their own flows, so the polling machinery itself is exercised.

## Provider latency

Deepgram's request log lags roughly 12–17 minutes behind reality — records created at
13:39 were absent at 13:50 and present at 13:56, and a job's detail endpoint answers
`200` with an empty body immediately after submit. The two trigger flows size their
`AfterAll` timeout (1500 s) around that, and the runner needs a matching window:

```bash
AGENT_TIMEOUT_MS=2100000 appmixer e2e run <flowId> --fix --timeout 1700
```

`Transcribe Audio` is not affected: it receives the transcript on its own webhook
(the `done` port) in seconds, without touching the request log.

## Tenant-bound values

The trigger flows carry a `projectId` in `config.properties`. Account bindings are
re-resolved at import, but this is a plain string — point it at a project the imported
account's API key can actually read, or the flow fails with
`404 A project with the submitted ID cannot be found`.

# fal.ai connector

Run any of [fal.ai](https://fal.ai)'s 1,000+ generative-media models (image, video,
audio, speech, 3D) from an Appmixer flow through a single API and key.

Because fal hosts 1,000+ models, each with its own input JSON Schema, a
component-per-model design is impossible. This connector instead ships one generic
`RunModel` action plus a thin layer of curated helpers, with the model list discovered
dynamically through `FindModels`.

## Authentication

- Create a key at [fal.ai/dashboard/keys](https://fal.ai/dashboard/keys). The secret
  is shown **only once** and belongs to your whole **account or team** — members share
  a single key.
- Requests authenticate with the header `Authorization: Key <FAL_KEY>` (the prefix is
  `Key `, **not** `Bearer`).
- Keys have an **API** scope (inference + most Platform APIs) or an **ADMIN** scope
  (adds usage, billing, serverless, key management). A `403` from an ADMIN-only endpoint
  means the connection is using an API-scoped key.
- The connection is validated against `GET /v1/models`, which accepts API-scoped keys.
  (`/v1/storage/settings` is intentionally **not** used — it is ADMIN-only and returns
  `403` for ordinary API keys, which would reject perfectly valid connections.)
  `/v1/models` permits anonymous reads, but a request that *sends* an `Authorization`
  header is authenticated strictly — empty, malformed, and wrong keys all return `401` —
  and the validator always sends one, so an invalid key cannot slip through.

## Base URLs

fal exposes four non-interchangeable base URLs:

| Base URL | Purpose |
|---|---|
| `https://fal.run/{endpoint_id}` | Synchronous inference (blocks until done) |
| `https://queue.fal.run/{endpoint_id}` | Async queue — submit / status / result / cancel |
| `https://api.fal.ai/v1` | Platform APIs — models, storage, meta |
| `https://rest.fal.ai` | Storage upload + webhook JWKS |

## Sync vs. queue — the decision rule

- **Synchronous** (`RunModel` with *Wait For Result* on, or `GenerateImage`) blocks and
  returns the result directly. Bounded to **60 seconds** — use it for fast models such
  as text-to-image.
- **Queue** (`SubmitRequest` → `GetRequestStatus` → `GetRequestResult`) is required for
  long-running work such as video or training that exceeds the sync timeout.

## Receiving completions — `SubmitRequest` + a webhook

fal has **no** account-wide webhook subscription API. A `webhook_url` is supplied **per
request** on submit, and fal POSTs once on completion. To receive completions in a flow,
wire a completion trigger's webhook URL into `SubmitRequest`'s **Webhook URL** input.
(The `GenerationCompleted` trigger ships in a later phase; until then, poll with
`GetRequestStatus` / `GetRequestResult`.)

## File handling & expiry

- Model inputs accept public URLs or data URIs. To feed an Appmixer file into a model,
  upload it first with `UploadFile`, which returns a public fal CDN URL.
- fal CDN outputs are **public by default and expire** per account/request settings. Any
  flow that needs permanence must persist the media with `DownloadFile`.

## Components

| Component | Type | Purpose |
|---|---|---|
| `RunModel` | Create | Run any model by endpoint id (sync or queued) |
| `GenerateImage` | Create | Text-to-image (default `fal-ai/flux/schnell`) |
| `SubmitRequest` | Create | Submit a queued job, return request handles |
| `GetRequestStatus` | Get | Poll a queued request's status |
| `GetRequestResult` | Get | Fetch a completed request's result |
| `CancelRequest` | Delete | Best-effort cancel of a queued request |
| `UploadFile` | Create | Appmixer file → fal CDN public URL |
| `DownloadFile` | Create | fal CDN URL → Appmixer file storage |
| `FindModels` | Find | Search the model catalogue (cursor pagination) |
| `MakeApiCall` | Create | Arbitrary authorized call to any fal base URL |

## Cost warning

Every inference call is billed pay-as-you-go (failed/queued requests are not billed).
Video and training models are significantly more expensive and slower than image models
— prefer the cheapest, fastest model (`fal-ai/flux/schnell`) when testing.

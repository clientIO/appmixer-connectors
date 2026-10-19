# tl;dv connector

Connector for [tl;dv](https://tldv.io) — an AI meeting notetaker that joins Google Meet,
Zoom and Microsoft Teams calls, records them, and produces transcripts and AI-generated
notes.

- **Base URL:** `https://pasta.tldv.io`
- **API version:** `v1alpha1` (alpha — the vendor warns of breaking changes)
- **Docs:** https://doc.tldv.io/index.html

## Authentication

API key only (no OAuth2). The personal key is created at
`https://tldv.io/app/settings/personal-settings/api-keys` and sent in the `x-api-key`
header. Credentials are validated against `GET /v1alpha1/meetings?limit=1`.

> ⚠️ **API access requires a paid plan (Pro/Business/Enterprise).** The gate is on the
> **meeting organizer's** plan, not the API-key holder's: a meeting organized by someone on
> the Free plan is visible in the web app but returns `403` via the API. This is the most
> common source of confusion and is surfaced explicitly in the `403` error message.

## Components

**Actions**

| Component | Endpoint |
|---|---|
| List Meetings | `GET /v1alpha1/meetings` (pages through all results, 10,000 ceiling) |
| Find Meetings | `GET /v1alpha1/meetings` with `query`/`from`/`to`/`meetingType`/`onlyParticipated` |
| Get Meeting | `GET /v1alpha1/meetings/{meetingId}` |
| Get Meeting Transcript | `GET /v1alpha1/meetings/{meetingId}/transcript` (`notReady` port for 404) |
| Get Meeting Notes | `GET /v1alpha1/meetings/{meetingId}/notes` (includes `markdownContent`) |
| Get Recording Download URL | `GET /v1alpha1/meetings/{meetingId}/download` (reads the 302 `Location`) |
| Download Recording | streams the recording into file storage |
| Import Meeting | `POST /v1alpha1/meetings/import` (async — returns a `jobId` only) |
| Make API Call | arbitrary authorized request |

**Triggers**

| Component | Mechanism |
|---|---|
| New Meeting | polling (`tick`) with a `happenedAt` watermark + boundary de-duplication |

## Not implemented

- OAuth2 (not supported by tl;dv).
- Webhook triggers — tl;dv documents `MeetingReady` / `TranscriptReady` payloads but exposes
  **no webhook management API**, so a trigger cannot self-register/unregister. Polling is the
  supported mechanism for v1.
- Update/Delete of anything — the API is read-only apart from meeting import.
- The deprecated `/highlights` endpoint (use notes instead).

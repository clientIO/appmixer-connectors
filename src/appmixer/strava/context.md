# Strava Connector - Context and Planning

## Service Overview
Strava is a social fitness platform focused on tracking athletic activities (running, cycling, swimming, etc.), analyzing performance metrics, and fostering community engagement via segments, clubs, and social features. The API enables applications to read athlete profile & stats, create & manage activities, access GPS stream data, work with segments and efforts, manage routes, and handle activity uploads (including FIT/TCX/GPX files).

Primary integration use cases for Appmixer workflows:
- Automatically log structured activities created in another system to Strava
- Sync Strava activities downstream to analytics, reporting, or coaching systems
- Retrieve performance stats and conditionally trigger workflows (e.g., recovery recommendations)
- React to new activities via webhooks (future phase) to enrich other data stores
- Build routes/segment-based automations (e.g., alert when a PR is achieved)

## Official Documentation
- Developer Portal: https://www.strava.com/settings/api
- API Reference: https://developers.strava.com/docs/reference/
- OAuth Authentication: https://developers.strava.com/docs/authentication/
- Webhook Events: https://developers.strava.com/docs/webhooks/

## Authentication Method (OAuth 2.0)

> **The app owner needs a paid Strava subscription.** Since Strava's Developer
> Program Standard Tier change, an API application whose owning athlete has no
> active Strava subscription is switched to *Inactive*, and **every** v3
> endpoint answers `403 Forbidden` with
> `{"resource":"Application","field":"Status","code":"Inactive"}` — including
> `GET /athlete`, which `requestProfileInfo` calls, so connecting an account
> fails outright. The OAuth handshake itself still succeeds and a real token is
> issued, which makes this look like a connector bug; it is not. Fix: give the
> owning account a subscription and reactivate the app in the API Settings
> Dashboard (https://www.strava.com/settings/api). There is no free tier.
> This is what blocks E2E runs on a fresh Strava app.

Strava uses standard OAuth 2.0 with refresh tokens. The authorization response returns an `access_token`, `refresh_token`, `expires_at`, and an embedded `athlete` object.

### Required Data
- clientId
- clientSecret
- redirect/callback URL

### Scopes
Common scopes (request only what is needed):
- `read` – Basic read (public data, own activities summary)
- `read_all` – Access to private data (detailed activities & segments)
- `profile:read_all` – Private profile fields, zones, totals
- `profile:write` – Update profile (rarely needed)
- `activity:read` – Read user activities (excluding private detailed fields)
- `activity:read_all` – Read all activities (including private & detailed)
- `activity:write` – Create, update, delete, upload activities

Minimum for basic sync (list + details + create): `read,activity:read,activity:write`.
Add `activity:read_all` when private/detailed data is required. Avoid over-scoping.

### OAuth Flow Summary
1. User redirected to: `https://www.strava.com/oauth/authorize?client_id=CLIENT_ID&response_type=code&redirect_uri=CALLBACK&approval_prompt=auto&scope=read,activity:read`
2. User authorizes; Strava redirects back with `code`.
3. Exchange code: `POST https://www.strava.com/oauth/token` with `{ client_id, client_secret, code, grant_type: 'authorization_code' }`.
4. Response: `{ token_type, access_token, expires_at, expires_in, refresh_token, athlete }`.
5. Refresh token: same endpoint with `{ grant_type: 'refresh_token', refresh_token }`.

**Important Notes:**
- Access tokens expire after **6 hours** (21,600 seconds), not 1 hour
- Both newer and older access tokens can be used until they expire during refresh
- Always use the most recent refresh token; older refresh tokens are invalidated immediately
- The athlete object is included in the initial token response

### Webhook Verification (Future Phase)
- Requires public URL for subscription validation (challenge response).
- Endpoint: `POST https://www.strava.com/api/v3/push_subscriptions` (requires `client_id`, `client_secret`, callback URL).
- Events delivered: `create`, `update`, `delete` for activities & athletes.

## Base URL
`https://www.strava.com/api/v3`

> **Upcoming migration:** Strava is migrating the API base URL to
> `https://api-v3.strava.com`, available January 4, 2027. The base URL is
> centralized in `constants.js` (`API_BASE_URL`), so switching hosts once the
> new one is live is a one-line change. See
> https://developers.strava.com/docs/changelog/

## Rate Limiting
Default (per application):
- Short term: 100 requests per 15 minutes
- Daily: 1,000 requests per 24 hours
Headers included in responses:
- `X-RateLimit-Limit: shortTerm,daily` (e.g., `100,1000`)
- `X-RateLimit-Usage: usedShort,usedDaily` (e.g., `12,345`)
If exceeded → HTTP 429. Quota module should monitor & throttle using rolling window + daily counters.

## Error Handling
Typical HTTP codes:
- 400 Validation / malformed request
- 401 Invalid/expired token (refresh when `expires_at < now`)
- 404 Resource not found (activity/segment not visible or private)
- 429 Rate limit exceeded
- 500 Strava internal error

Error payload example:
```json
{
  "message": "Bad Request",
  "errors": [{ "resource": "Activity", "field": "name", "code": "missing" }]
}
```

## Core Domains & Key Endpoints
(Only a curated subset for initial connector planning; full list in docs.)

### Athlete
- GET `/athlete` – Get current authenticated athlete
- GET `/athletes/{id}/stats` – Athlete aggregated stats (requires `read_all` for private totals)
- PUT `/athlete` – Update athlete (requires `profile:write` – low priority)

### Activities
- GET `/athlete/activities` – List recent activities (pagination via `page`, `per_page`)
- GET `/activities/{id}` – Get activity (detailed requires appropriate scope)
- POST `/activities` – Create manual activity (requires `activity:write`)
- PUT `/activities/{id}` – Update activity
- DELETE `/activities/{id}` – Delete activity
- GET `/activities/{id}/zones` – Heart rate & power zones (scoped)
- GET `/activities/{id}/comments` – Comments list
- GET `/activities/{id}/kudos` – Kudos list
- GET `/activities/{id}/laps` – Lap data
- GET `/activities/{id}/streams` – See Streams section

### Uploads (File-based Activities)
- POST `/uploads` (multipart) – Upload FIT/TCX/GPX; returns upload ID
- GET `/uploads/{upload_id}` – Poll until processed; eventually yields created activity ID

### Streams
Provides time-series data: distance, latlng, altitude, heartrate, cadence, watts, velocity_smooth, etc.
- GET `/activities/{id}/streams/{types}`
- GET `/segments/{id}/streams/{types}`
- GET `/segment_efforts/{id}/streams/{types}`

### Segments & Efforts
- GET `/segments/{id}` – Segment detail
- GET `/segments/{id}/leaderboard` – Leaderboard (rate sensitive)
- GET `/segments/explore` – Explore segments by bounding box
- GET `/segment_efforts/{id}` – Specific effort
- GET `/activities/{id}/segment_efforts` – Efforts within an activity

### Routes
- GET `/athletes/{id}/routes` – List athlete routes
- GET `/routes/{id}` – Route detail (with map/streams)
- GET `/routes/{id}/export_gpx` – Raw GPX (optional for future file outputs)

### Clubs
- GET `/athlete/clubs` – Clubs for athlete
- GET `/clubs/{id}` – Club detail
- GET `/clubs/{id}/members` – Members list (paged)
- GET `/clubs/{id}/activities` – Club activities feed

### Gear
- GET `/gear/{id}` – Gear detail (bike/shoes).

### Webhooks (Future)
- POST `/push_subscriptions` – Create subscription
- GET `/push_subscriptions` – List subscriptions
- DELETE `/push_subscriptions/{id}` – Delete subscription

## Proposed Component Set (Phased)
Only planning – no implementation yet.

### Phase 1 (Foundational: Activity Sync & Athlete Context)
1. GetAuthenticatedAthlete – Retrieve current athlete profile
2. GetAthleteStats – Aggregate stats for authenticated athlete
3. ListActivities – Paginated list (supports date range & pagination)
4. GetActivity – Detailed activity by ID (assert scope requirements)
5. CreateManualActivity – Create manual activity (distance, duration, type, start date)
6. UpdateActivity – Update name, description, commute, trainer, gear, privacy
7. DeleteActivity – Delete activity (must confirm ID required)
8. UploadActivityFile – Upload GPX/FIT/TCX and poll until processed (returns created activity ID)
9. GetActivityStreams – Selectable stream types (distance, latlng, time, altitude, heartrate, etc.)

### Phase 2 (Performance & Segments)
10. ListActivityLaps – Lap breakdown
11. ListActivitySegmentEfforts – All efforts within activity
12. GetSegment – Segment details
13. ExploreSegments – Bounding box discover (inputs: southwest, northeast, activity_type)
14. GetSegmentLeaderboard – (Use carefully; rate heavy, optional parameters: gender, age_group, weight_class)
15. GetSegmentStreams – Streams for segment

### Phase 3 (Community & Routes)
16. ListClubs – Athlete clubs
17. GetClub – Club detail
18. ListClubMembers – Paged
19. ListClubActivities – Club recent activities
20. ListAthleteRoutes – Athlete routes
21. GetRoute – Route detail
22. GetRouteStreams – Derived from route polyline (may reuse streams logic)

### Phase 4 (Ancillary & Optimization)
23. GetGear – Gear detail (linked from activities)
24. GetActivityZones – Heart rate / power zones per activity
25. ListActivityKudos – Social engagement
26. ListActivityComments – Comments
27. GetActivityLaps (already in phase 2; keep consistent) – Already covered
28. WebhookSubscriptionCreate – (future trigger support)
29. WebhookSubscriptionDelete – (future)
30. WebhookSubscriptionList – (future)

## Component Design Considerations
- All update/delete components must validate required IDs: use `throw new context.CancelError('<Field> is required!')` per standards.
- Upload polling pattern: after POST `/uploads`, poll GET `/uploads/{id}` until `activity_id` present or `error` field appears; implement backoff & max attempts.
- Streaming outputs: For large arrays (activities, streams), support output modes (array vs. one-by-one) in later iterations (mirroring other connectors' Find pattern) – not mandatory for initial phase.
- Stream type selection: `types` is a comma-separated list; provide inspector multi-select mapping internally.
- Date filters for ListActivities: `before` (epoch seconds), `after` (epoch seconds); we can expose from/to date and transform.
- Pagination: `page`, `per_page` (default 30, max 200). Implement loop vs single page (initial single page, enhance later).

## Authentication Implementation Notes (auth.js Plan)
Type: `oauth2`
Definition functions needed:
- `authUrl(context)` – Build URL with `client_id`, `response_type=code`, `redirect_uri`, `approval_prompt=auto`, `scope` (joined by comma), `state`.
- `requestAccessToken(context)` – POST to `/oauth/token`.
- `refreshAccessToken(context)` – Same endpoint with `grant_type=refresh_token`.
- `requestProfileInfo(context)` – GET `/api/v3/athlete` with Bearer token.
- `accountNameFromProfileInfo` – Use athlete `username` or fallback to `firstname lastname`.
- Handle token expiry using `expires_at` (UNIX seconds) → convert to `Date(expires_at * 1000)`.

**Critical Implementation Details:**
- Access tokens expire after **6 hours** (21,600 seconds)
- When refreshing, if existing token expires in >1 hour, existing token is returned
- If token expires in ≤1 hour, new token is issued
- Both old and new tokens work until expiry during refresh period
- Always store and use the most recent refresh token
- Include athlete object parsing from initial token response

Endpoint for token operations:
`POST https://www.strava.com/oauth/token`

Example token exchange request body:
```json
{
  "client_id": "12345",
  "client_secret": "SECRET",
  "code": "AUTHORIZATION_CODE",
  "grant_type": "authorization_code"
}
```

Example token refresh request body:
```json
{
  "client_id": "12345",
  "client_secret": "SECRET",
  "grant_type": "refresh_token",
  "refresh_token": "REFRESH"
}
```

Example token response:
```json
{
  "token_type": "Bearer",
  "expires_at": 1568775134,
  "expires_in": 21600,
  "refresh_token": "e5n567567...",
  "access_token": "a4b945687g...",
  "athlete": {
    "id": 12345,
    "username": "athlete_username",
    "firstname": "John",
    "lastname": "Doe"
  }
}
```

## Quota & Throttling Strategy
Implement `quota.js` with two layered rules:
1. 15-min window sliding limit (e.g., limit: 90–95 to stay under 100 safety margin)
2. Daily limit (e.g., 950 to stay under 1000)
Scope per user (athlete) to avoid cross-user blocking: `scope: 'userId'`.

## Data Mapping & Schema Considerations
Key objects to expose in outPorts options for variable picker:
- Activity: id, name, type, sport_type, distance, moving_time, elapsed_time, total_elevation_gain, start_date, timezone, kudos_count, comment_count, athlete.id
- Stats: ytd_ride_totals, all_run_totals, recent_swim_totals (each with distance, moving_time, count, elevation_gain)
- Streams: array of `{ type, data, original_size, resolution, series_type }`
- Upload: id, external_id, status, activity_id, error
- Segment: id, name, distance, average_grade, maximum_grade, elevation_high, elevation_low, climb_category, city, country, athlete_pr_effort.id, star_count

## Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Rate limit spikes (bulk sync) | 429 errors disrupt flows | Implement quota + backoff + optional partial pagination mode |
| Large stream payloads | Memory usage | Allow selective stream types; possibly chunk streaming in future |
| Upload processing delays | Workflow stalls | Poll with exponential backoff (e.g., 2s -> 4s -> 8s up to cap) and fail gracefully |
| Private activities missing fields | Null/undefined handling errors | Validate required fields, conditional schema population |
| Over-scoping OAuth | User privacy concerns | Request minimal scopes per component grouping |

## Future Enhancements
- Webhook trigger component: NewActivityTrigger (receives create events) – requires subscription management & secret validation.
- Automatic multi-page activity sync with state tracking (store last activity timestamp or cursor in component state).
- Route GPX export to file output component.
- Segment PR detection & notification workflow templates.

## Minimal Initial Deliverables
(Per user request: ONLY context preparation; no code components yet.)
- This `context.md` file.
- Next step would be to scaffold: `service.json`, `auth.js` (oauth2), `bundle.json`, `quota.js` before implementing components listed in Phase 1.

## References & Useful Links
- OAuth Authentication: https://developers.strava.com/docs/authentication/
- OAuth Scopes: https://developers.strava.com/docs/authentication/#details-about-requesting-access
- API Reference: https://developers.strava.com/docs/reference/
- Webhooks: https://developers.strava.com/docs/webhooks/
- Rate Limits: https://developers.strava.com/docs/rate-limits/
- Activity Types: https://developers.strava.com/docs/activity-types/
- Developer Community: https://communityhub.strava.com/
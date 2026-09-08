# Read-only YouTube integration

**Milestone:** 0.3 · **Date:** 2026-09-08

The connector is implemented, but **no real Google credentials or channel were used to verify it in
this session**. Backend tests inject a mock Google transport; browser tests mock consent and API
observations. Real consent-screen behavior, project verification, account/Brand Account combinations,
metric availability and physical-device returns still need operator-run conformance checks.

This is **YouTube account linking through Google OAuth**, not Google sign-in to TubePilot. TubePilot
accounts continue to use the existing app authentication. There is no automatic email-based account
merge or implicit channel selection.

## What this milestone implements

- Required `youtube.readonly`, with a separate **optional** `yt-analytics.readonly` opt-in.
- Authorization code flow, random state, S256 PKCE, server-side exchange and explicit channel confirmation.
- An app-session-bound completion receipt so a callback does not silently link the wrong person's channel.
- Encrypted access/refresh tokens; server-side refresh, revoked/expired-permission handling and safe errors.
- Authorized channel statistics, up to 12 recent uploads and optional daily/aggregate analytics.
- Separate actual-data dashboard/analytics views; samples are never used to fill missing connected data.
- Refresh progress, persisted snapshots, request budgets/cooldown, disconnect and a short-lived revocation queue.
- Workspace data export/deletion coverage without exporting credential envelopes or provider tokens.

No publishing, uploads, comments, subscriptions, monetary analytics, image fetching, audience profiles,
competitor scraping, derived scores or automatic AI ingestion are implemented by this connector.

## Operator setup

### 1. Configure a Google Cloud project

1. Enable **YouTube Data API v3**. Enable **YouTube Analytics API** only if historical reports will be used.
2. Configure the OAuth consent screen, supported user type, app identity, privacy policy and terms.
   Add the appropriate test users while the app is in testing. Follow Google's verification requirements
   for the requested scopes before public distribution.
3. Create an OAuth client of type **Web application**. Exchange happens on TubePilot's server, including
   when the initiating app is native. The client secret never goes into Expo public configuration.
4. Register this exact authorized redirect URI:

   ```text
   https://YOUR-APP-ORIGIN/api/v1/youtube/oauth/callback
   ```

   Scheme, host, port, path and trailing-slash behavior must match the server configuration exactly.
   For local development only, `http://localhost:3000/api/v1/youtube/oauth/callback` is supported.
   An Arena preview must use its actual HTTPS `3000-…e2b.app` origin, not the browser's localhost.

### 2. Configure server secrets

Use your deployment's secret manager or an untracked local `.env` at the repository root.
See [`.env.example`](../.env.example). Do not put secrets in chat, source control, URLs, browser
storage or variables prefixed `EXPO_PUBLIC_`.

| Variable | Purpose |
|---|---|
| `YOUTUBE_ENABLED=true` | Explicit connector opt-in; default is false |
| `GOOGLE_CLIENT_ID` | Google Web application OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Backend-only OAuth client secret |
| `APP_ORIGIN` | Exact HTTPS frontend origin; no path, wildcard, query or credentials |
| `GOOGLE_REDIRECT_URI` | Must equal `APP_ORIGIN` + `/api/v1/youtube/oauth/callback` |
| `YOUTUBE_ENCRYPTION_KEY` | Stable, canonical base64 encoding of 32 random bytes |
| `YOUTUBE_DATA_UNITS_PER_DAY` | App-level budget for implemented Data API calls; default 1,000 |
| `YOUTUBE_ANALYTICS_REQUESTS_PER_DAY` | App-level report-request budget; default 500 |

Generate a key **locally**, without sharing its output:

```sh
openssl rand -base64 32
```

Keep the encryption key separate from database backups. Do not generate a new key at every boot or
replace it while credentials still exist. Keyring/KMS rotation is a future production migration; this
version requires restoring the original key or reconnecting accounts after a controlled key change.

Restart `npm run dev` after changing backend configuration. Missing/invalid enabled configuration
fails closed. With the connector disabled, no new Google requests are made and demo mode still works.
Existing cached connection data remains subject to its expiry; disabling configuration is not revocation.

### 3. Link in the app

1. Create/sign into a TubePilot account. Anonymous demo users cannot link a channel.
2. Open **Settings → Connections** or **Connection & permissions**.
3. Choose whether to include historical analytics. Click **Connect with Google**.
4. Choose the Google/Brand Account and review Google's requested read-only permissions.
5. Back in TubePilot, review the actual channel name and the TubePilot account receiving the link.
6. Click **Confirm read-only connection**. Only now is the connection stored and the first sync started.

A previously granted broader Google scope **does not override an unchecked Analytics option**. Only
this connection's requested, granted scopes are enabled; a refresh cannot silently widen them.
Google may retain other pre-existing project grants; TubePilot does not use them.

### Popup and native return behavior

Web starts a popup synchronously from the button click. The callback posts an opaque completion
receipt only to the exact `APP_ORIGIN`. The client validates **origin, popup window and flow ID**.
If browser isolation prevents the automatic return, copy the one-time code from the callback page,
close that page, and paste it into the **original** TubePilot connection dialog. Never share that code.
It is not an access/refresh token and cannot be used without the initiating authenticated app session.

Native uses the system browser via `expo-web-browser`, never an embedded WebView. The backend returns
to the fixed `tubepilot://oauth/youtube` scheme with the receipt in the fragment. The initiating native
session verifies the scheme, host/path and expected flow ID before reviewing the channel. This requires
a development/installed build with the scheme registered in `app.json`; **Expo Go is not a substitute**.
Android/iOS browser return, app-link interception and background/foreground behavior require device QA.

## Authorization protocol and threat boundaries

1. Authenticated `POST /youtube/flows` creates a ten-minute flow linked to the **specific hashed app
   session**, not just a user ID. State is random and stored only as a hash. The PKCE verifier is encrypted.
2. The Google callback atomically claims an unexpired, unused state and checks the original session is
   still valid. The code is exchanged against a fixed Google endpoint and is never stored. Callbacks
   are not retried or replayed after failure/restart.
3. Tokens remain encrypted in temporary storage. **The callback does not link a channel or fetch its
   private metadata.** It returns a new random receipt through the initiating client; only the receipt
   hash is persisted. There is no status/polling endpoint that reveals that receipt or staged tokens.
4. Receipt + original app session are required to list authorized `mine=true` channel choices. A caller
   who merely initiated a state and sent its Google URL to another person cannot read/link that person's
   channel by polling. Foreign users, replacement sessions and forged/replayed receipts fail.
5. Explicit confirmation accepts only a channel returned in the authorized review. It compares the
   connection version observed at flow start, preventing an old callback from overwriting a newer link.
6. A new grant ID binds encrypted credentials, refreshes and sync writes. Disconnect/replacement aborts
   relevant work; late responses cannot recreate or overwrite a removed/replaced connection.

Account linking is not identity federation. Email verification/recovery and stronger app-auth/device
management remain separate release gates. The custom receipt protocol and manual/native handoff need
independent security review before public use; passing tests is not a security certification.

### Credential storage and HTTP controls

AES-256-GCM uses random nonces and authenticated context containing the record, owner and purpose.
Swapping envelopes across users/records, tampering or a wrong key fails decryption. SQLite files are
created with owner-only permissions. Google tokens/client secrets/verifiers are not in bootstrap,
workspace exports, analytics CSVs or the web bundle.

Google API destinations are fixed. There is no caller-configurable base URL, redirect target, scope
string or method. Provider redirects are refused, calls have deadlines, and JSON is bounded to 1 MiB.
Revocation error inspection is bounded separately. Errors are sanitized; unknown numbers remain null.

The callback sends `Cache-Control: no-store`, `Referrer-Policy: no-referrer` and a nonced, restrictive
CSP. **Deployment proxies, error trackers and access logs must redact the callback query/code/state,
authorization headers, token bodies and receipt bodies.** This app does not install request-body logging;
external ingress/logging behavior has not been audited.

## Data actually requested

| Surface | Endpoint / query | Notes |
|---|---|---|
| Channel choices and statistics | `channels.list`, `mine=true`, `snippet,statistics,contentDetails` | Explicitly confirm one returned channel; counts can be missing/hidden/rounded |
| Upload references | `playlistItems.list`, confirmed channel's uploads playlist, max 12 | No searching or full-history crawl |
| Video metadata/statistics | `videos.list`, authorized upload IDs, `snippet,statistics,contentDetails` | Ignore videos whose returned channel ID differs; no remote images loaded |
| Daily historical activity | Analytics `reports`, `ids=channel==CONFIRMED_ID`, `dimensions=day` | `views,estimatedMinutesWatched,subscribersGained,subscribersLost` |
| Period aggregates | Same four metrics, no day dimension, 7/28-day requested windows | End is bounded to the last returned daily observation; values are returned aggregates |

Reports use **Pacific reporting dates**, ending no later than the previous reporting day. The UI
states the requested date and the **last date actually returned**, since Google can return data only
through the last day for which all requested metrics are available. Missing days are gaps; there is
no zero imputation. Empty daily reports have no invented aggregate total. Watch time is displayed in
YouTube's reported **estimated minutes**, not an asserted real-time value.

The connected UI does **not** reuse demo CTR, audience, traffic-source, retention or growth figures.
The sample Trend Radar remains labeled as a separate sample collection. No connected-channel data is
automatically copied to brand context, prompts, embeddings or the AI gateway.

### Quotas and refreshes

- First sync starts after confirmation; later syncs are explicit user actions, not a hidden polling crawl.
- At most one active sync per connection; repeated active submissions join it. One-minute user cooldown.
- At most four active syncs in this single API process.
- Each implemented Data API request reserves one app-budget unit **before dispatch**, including failures.
  Analytics requests use a separate counter. App budgets reset at Pacific midnight.
- App budgets do **not** represent the actual remaining quota in a Google project shared with other clients.
  Google's own quota/permission errors remain possible and are displayed honestly.
- No `search.list` or `videos.insert` calls occur. The separate search/upload allocation is unused.
- The worker is single-process with persisted status, not a distributed BullMQ/lease implementation.

## Retention, disconnect and deletion

- The development connector uses a conservative **six-day** maximum without a successful refresh,
  shorter than the general 30-day metadata refresh/deletion limit. Known shorter time-limited Google
  grants cap it further. Stale channel IDs, metadata, snapshots and credentials are removed, and the
  connection requires reauthorization instead of showing fabricated or indefinitely cached data.
- Expiry is enforced at reads, startup and a 30-second maintenance interval while the API is running.
  This is not a guarantee of offline-server or backup-deletion SLAs. Production needs an independently
  monitored lifecycle worker and tested backup/checkpoint/restore deletion procedures.
- Detected invalid grants / lost channel access purge local cached data and credentials immediately.
  External revocation is detected at the next refresh or by expiry, not via a Google push webhook yet.
- Disconnect deletes local channel data immediately. Explicit Google revocation retains only an encrypted
  revocation token for up to **48 hours**, with bounded backoff. A successful / already-invalid-token
  response deletes the job. Arbitrary HTTP 400 errors are not considered proof of successful revocation.
- Account deletion removes private channel/flow/sync records. A pending encrypted revocation job loses
  the user association and still expires within 48 hours. It is never exported or returned as a token.
- Google revocation may invalidate other TubePilot connections sharing that Google account/project.
  The UI warns before revocation and blocks reconnection in the same workspace while revocation is pending.
- Discarding an unconfirmed authorization removes temporary local credentials, **not** a possibly shared
  Google grant. The UI links to Google's permission manager. Manual removal is also needed if server
  keys/configuration are unavailable or queued revocation cannot finish.
- Saved TubePilot projects remain independent. No automatic YouTube-data-to-AI pipeline exists to retain
  hidden copies in prompts or embeddings. Future derived data pipelines require deletion propagation.

## API surface

All paths below are under `/api/v1`; only the Google callback is unauthenticated.

| Method | Path | Behavior |
|---|---|---|
| GET | `/youtube` | Safe, owner-authorized connection status and authorized, unexpired observations |
| POST | `/youtube/flows` | `{client: "web"|"native", analytics: boolean}`; return auth URL/flow expiry |
| GET | `/youtube/oauth/callback` | Claim state, exchange code, return an app-bound receipt; no auto-link |
| POST | `/youtube/flows/:id/review` | `{receipt}`; original session + receipt required for channel choices |
| POST | `/youtube/flows/:id/confirm` | `{receipt, channelId}`; explicit atomic selection and initial sync |
| DELETE | `/youtube/flows/:id` | Discard an owned pending authorization locally |
| POST | `/youtube/sync` | Persist/join a read-only refresh; status appears in bootstrap |
| DELETE | `/youtube` | `{revoke: boolean}`; delete local data, optionally queue Google revocation |

`GET /bootstrap` and `GET /me/export` include the safe YouTube status/snapshot. `DELETE /me` also
performs connector cleanup and requests revocation of the active grant.

## Verification and release checklist

Automated tests cover config/crypto, PKCE/state/receipt ownership, callback replay, explicit channel
selection, stale reconnection, token refresh, scope opt-in, nullable/delayed reports, quotas, races,
restart, expiry, exports, revocation and account deletion. Browser tests cover setup, actual-data
rendering/CSV, reauthorization states, origin/window-bound popup return and explicit disconnect.
The full milestone suite passed **125 tests** (60 gateway, 51 API/store/connector, 14 browser),
along with the web build and Android/iOS Hermes exports. Tests use mocks; none proves a live Google
project is configured or approved, and bundle exports are not device/store validation.

Before enabling for real users:

- [ ] Verify Google consent screen, privacy/terms URLs, test/production users and applicable scope review.
- [ ] Perform real consent, denial, optional-scope, Brand Account, refresh and disconnect/revocation tests.
- [ ] Validate the report combinations, freshness and definitions for actual target channel types.
- [ ] Independently review the receipt/native return protocol, app auth, session management and abuse controls.
- [ ] Verify Chrome/Safari/Firefox isolation behavior and Android/iOS system-browser returns on devices.
- [ ] Deploy monitored retention/revocation workers, encrypted backups, log redaction and deletion/restore tests.
- [ ] Move to production storage/queue coordination before horizontal scaling.
- [ ] Obtain applicable policy/derived-metric/extended-retention approvals before enabling those features.

## Official references

- [Google OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server)
- [YouTube channel list](https://developers.google.com/youtube/v3/docs/channels/list)
- [YouTube playlist items](https://developers.google.com/youtube/v3/docs/playlistItems/list)
- [YouTube videos](https://developers.google.com/youtube/v3/docs/videos/list)
- [YouTube Analytics query](https://developers.google.com/youtube/analytics/reference/reports/query)
- [YouTube channel reports](https://developers.google.com/youtube/analytics/channel_reports)
- [YouTube developer policies](https://developers.google.com/youtube/terms/developer-policies)
- [Additional derived-metrics policy](https://developers.google.com/youtube/terms/derived-metrics-policy)

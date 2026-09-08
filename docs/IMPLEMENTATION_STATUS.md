# TubePilot AI — implementation status

**Date:** 2026-09-08 · **Milestone:** 0.3 — read-only YouTube connector + creator workspace

This file distinguishes implemented behavior from the full 62-feature product vision. **The product
is not 100% complete or production-ready.** A functioning, end-to-end workspace now exists; Google/YouTube linking and a read-only sync path are now implemented, but not live-verified or
configured by default. Other external integrations and advanced capabilities remain planned.

## Android packaging update — 2026-09-09

A GitHub-hosted APK workflow now generates native Android projects, compiles standalone release-mode
APKs, signs/verifies them, and uploads build artifacts. It supports test-key previews and protected,
manual private-key signing. First-launch native backend setup works when no API origin is baked in;
app sessions are now scoped to the exact backend origin. See [ANDROID_APK.md](./ANDROID_APK.md).

The first GitHub Gradle/sign/verify run succeeded and uploaded a test-key-signed arm64 APK. See the
[build and download links](./ANDROID_APK.md#verified-github-build). The full local suite also includes
11 Android build/session-isolation checks, for **136 passing tests**. Private signing and physical-device
validation were not performed; a signature is not product/store approval and the backend is not bundled
or deployed by this workflow.

## What works now

| Area | Implemented behavior |
|---|---|
| Universal client | Expo / React Native source, responsive React Native Web preview, dark/light themes, desktop sidebar, five-tab mobile navigation, keyboard workspace search |
| Onboarding | Three-step name/channel, niche/language/voice and goals flow; persisted preferences; English/Bengali demo drafts |
| Accounts | Isolated guest workspaces; email/password registration and login; guest-to-account upgrade preserves drafts; hashed opaque sessions; logout; secure native token storage |
| Dashboard | Demo mode plus a separate connected-channel view of direct API counters, upload metadata and dated reports; no sample fallback for missing/unauthorized observations |
| Trend Radar | Clearly labeled fictional collection, text/category filters, sorting, persistent bookmarks, detail views and hand-off to Studio |
| Content Studio | Ideas, scripts, titles, descriptions, Shorts outlines and thumbnail **briefs**; editable draft workflow; recent generation history; clipboard/export |
| Core creator flow | Topic → ideas → saved idea → script → title → saved project; changing a calendar date does not erase content |
| Projects | Create, read, edit, duplicate, delete, search, stage filtering, grid/list display, Markdown export and revision-conflict protection |
| Calendar | Month navigation, date selection, assigning/removing saved projects, valid-date checks; **planning only**, not YouTube scheduling |
| Analytics | Separate actual/demo views; optional owner-authorized 7/28-day reports, nullable values, delayed-data labels, missing-day gaps and source-marked CSV export |
| Assistant | Template-powered conversation interface and durable response history; optional development provider adapter |
| Tasks | Server-persisted admission, status/progress/result, owner checks, cancellation, idempotency keys, polling and owner-authorized SSE replay |
| Credits | Atomic reservations; duplicate-key protection; capped concurrent work; settlement/release ledger; cancelled demo tasks release their reservation |
| YouTube | Google code/PKCE flow, session-bound receipt + channel confirmation, encrypted access/refresh tokens, scope opt-in, single-process sync, request budgets and expiry |
| Privacy | Workspace export/deletion, cross-tenant isolation, server-only credentials, YouTube cleanup and bounded encrypted revocation queue |
| Verification | Gateway unit tests, API/store integration tests, browser workflow tests, web production bundle, Android and iOS Hermes exports |

### What “demo” means

- The default channel names, analytics, trend growth/fit scores, audience examples and sample covers
  are **fictional**. A configured, explicitly linked channel uses separate actual-data screens. No live
  Google channel or trend service was called to verify this milestone.
- Default generations use deterministic topic-aware templates, not a remote AI model. They are
  explicitly labeled **demo drafts**. The generated text is editable and can be saved/exported.
- Changes to projects, bookmarks, profiles, tasks and credits are **real persisted application state**,
  not browser-only mock interactions.
- No real YouTube upload, subscription purchase, payment or paid inference is performed by the demo
  or automated tests. A “Published” project stage is user-entered organizational metadata only.

## Runtime architecture for this milestone

```text
apps/mobile — Expo / React Native
  ├─ Vite + React Native Web preview on :3000
  └─ Native Expo entry; deployed API origin set with EXPO_PUBLIC_API_URL
       │ relative /api/v1 URLs on web; secure app bearer session on native
apps/api — NestJS on :4000
  ├─ auth, workspace, project, trend bookmark and task HTTP controllers
  ├─ YouTube OAuth / encrypted vault / read-only sync / expiry / revocation queue
  ├─ SQLite: users / sessions / projects / tasks / events / credits / YouTube records
  └─ GenerationService: persisted task states + single-process async execution
       ├─ topic-aware demo generator (default)
       └─ @tubepilot/ai-gateway (optional, explicitly configured development mode)
packages/contracts — shared TypeScript types and strict Zod input schemas
```

### Intentional development-stage decisions

1. **SQLite instead of requiring PostgreSQL/Redis locally.** Node's built-in SQLite API makes the
   preview reproducible without external services, credentials or native-addon compilation. It is
   experimental in Node 22. `DATABASE_PATH` defaults to `.data/tubepilot.sqlite` when using the npm
   workspace scripts; the directory is ignored by Git. WAL, foreign keys and transactions are enabled.
2. **Single-process task execution, not BullMQ yet.** Tasks/events/credit changes are persisted before
   execution. On restart, unfinished jobs are cancelled rather than replaying potentially billable
   work. **Run only one API process against a database.** There are no worker leases or distributed
   queue guarantees. PostgreSQL, Redis/BullMQ, an outbox and worker coordination remain required for
   the planned production architecture.
3. **Web preview uses Vite, not a separate web application.** The same React Native screen components
   render on web and native. Exact web aliases use React Native Web and SVG web elements. Native
   bundling still uses Expo/Metro. Web browsers call relative API paths through Vite's proxy; they do
   not attempt to contact a sandbox backend via browser-local localhost.
4. **Navigation is currently a lightweight shell.** Web hash navigation/back works; native uses the
   same screen state and bottom tabs. Production native stack transitions, deeper linking, safe-area,
   keyboard, accessibility and physical-device QA remain to be completed.
5. **Guest sessions are not a production account system.** Registration uses scrypt with random salts,
   sessions use random hashed tokens, and ownership checks protect resources. Email verification,
   recovery, abuse controls, session/device management and security review remain release gates.
6. **No artificial “100%” percentage.** Completion depends on acceptance tests, actual integration
   approvals and deployed/verified behavior, not the number of screens or buttons present.

## Local run and verification

Requires **Node 22.17+** (tested with 22.22.3) and npm.

```sh
npm ci
npm run dev            # builds shared packages/API; starts API and web preview
npm run check          # strict TypeScript + gateway and API/store tests
npm run build          # shared packages, API and production web assets
npm run test:e2e        # full browser workflows; reuses a running preview locally
```

- Web preview: port **3000**. API: port **4000**. Both bind `0.0.0.0`.
- Frontend edits hot-reload. Restart `npm run dev` after backend changes.
- No `.env` is needed for the default demo. Use `.env.example` as documentation, not a place to
  commit credentials. To isolate local/test data, set `DATABASE_PATH` to another path or `:memory:`.
- Native development: configure `EXPO_PUBLIC_API_URL` to the **HTTPS origin** of the deployed/proxied
  API, then run `npm run start -w @tubepilot/mobile`. It must not be a browser-local localhost address
  on a physical device. Native app sessions are stored through `expo-secure-store`.
- Native bundle verification: from `apps/mobile`, run
  `CI=1 EXPO_OFFLINE=1 npx expo export --platform android --output-dir ../../.arena/native-export`.
  Repeat with `--platform ios` and a separate output directory for iOS. Both exports were verified.
  A Hermes export is not a signed APK/IPA, physical-device test or app-store approval.
- Linux browser tests use npm-distributed headless Chromium plus its packaged runtime libraries,
  extracted into ignored `.arena` storage. Other platforms use Playwright's normal installed browser
  (`npx playwright install chromium`). Set `E2E_SYSTEM_BROWSER=true` to use that browser on Linux too.
  Browser tests do not disable web security and do not make provider calls.

### Sessions in a live preview

Web sessions use HttpOnly cookies scoped to `/api`. Local development uses SameSite=Lax. HTTPS
`*.e2b.app` previews use Secure, SameSite=None, Partitioned cookies so Chromium can retain sessions
inside an embedded preview without sharing them across top-level sites. Mutating requests validate
browser origins. The Chromium cross-site iframe flow and reload persistence are browser-tested. Cookie partitioning
/third-party behavior still needs Safari and broader device QA.
Native clients receive an opaque app bearer session over the API and keep it in platform secure storage.

## Optional live AI — development only

The host adapter is wired to the previously tested gateway. It remains **off by default** and was not
exercised against a paid provider during this milestone. To opt into a controlled development test,
an operator must supply all the documented backend configuration in `.env.example`, verify model
availability/capabilities/prices/processing terms, and explicitly enable it.

- Anonymous guests continue to get demo templates even when a provider is configured.
- Non-guest development accounts can use the configured model; this is **not proof of verified email
  ownership**. Do not expose this mode publicly before account verification and moderation exist.
- Shared daily limits are tracked in SQLite: at most 25 provider admissions/day and a configured
  dollar-equivalent budget (UTC day). A request reserves a conservative input/output estimate before
  dispatch. Retries are disabled by the host; core gateway safeguards remain in place.
- Model/feature prompts and authorized project/brand context are created on the server. Only public
  task input is accepted; the HTTP API rejects `apiKey`, `baseUrl` and arbitrary system instructions.
- Feature results are schema-checked and incomplete responses fail. **Schema validation is not
  moderation.** Live production inference is blocked until a reviewed moderation/account pipeline
  is implemented.
- Current provider accounting conservatively settles the **reservation ceiling**, not an exact
  provider invoice. Accepted failures/cancellations may consume credits and that ceiling. Detailed
  actual-token reconciliation, price-version persistence and commercial billing remain unimplemented.

## Verification results for this milestone

- **60** gateway unit tests passed.
- **51** API/store/connector tests passed, including OAuth PKCE/receipt/owner boundaries, encrypted
  credentials, scope opt-in, delayed/nullable reports, refresh/revocation, race/restart/expiry handling,
  full exports and the earlier workspace/credit/preview-cookie checks.
- **14** browser tests passed, covering the creator workflow, calendar/export, account upgrade,
  bookmarks, mobile, draft history, embedded previews, connector setup, actual-data rendering,
  origin/window-bound popup confirmation and disconnect. Google consent and observations are mocked.
- **125 tests in total** passed for milestone 0.3.
- Strict TypeScript checks and the web production bundle passed.
- Android and iOS Hermes bundle exports passed; physical device/binary/store validation is still pending.
- Locked dependency audit reported **0 known vulnerabilities** at verification time. This is not
  a substitute for security review. The xcode → uuid override uses the patched v11 interface;
  native exports verify compatibility with the installed Expo toolchain.
- The built web bundle contains no provider token/configuration or direct Hugging Face endpoint.

## Remaining work toward the full product

### Read-only channel integration: implemented; live/production validation remains

- [ ] Google sign-in and production-grade app auth, email verification/recovery, device sessions.
- [x] Implement YouTube code/PKCE/state, explicit optional analytics, encrypted tokens, disconnect/revoke.
- [x] Implement actual-data views, channel/upload/report sync, app request budgets, expiry and safe export.
- [ ] Independently review the session-bound receipt protocol and perform real Google/Brand Account conformance.
- [x] Document the requested endpoint/scope/freshness matrix and preserve missing data.
- [ ] Verify those queries against real target channel types and Google project permissions.
- [ ] Applicable derived-metric and extended-storage approval before enabling affected scores.
- [ ] Data-class retention/refresh, source-deletion propagation, backup handling and deletion deadlines.
- [ ] Licensed trend source, per-bucket quota budgeting and truthful missing-data states.
- [x] Separate connected-channel observations from sample dashboards; never silently substitute demo data.

Current YouTube details and operator setup are in [`YOUTUBE_INTEGRATION.md`](./YOUTUBE_INTEGRATION.md).
Unrefreshed connector data expires after six days (or a known earlier grant expiry), and active-grant
revocation retries retain only an encrypted token for up to 48 hours. Lifecycle workers/backups/SLA
verification remain production tasks. Google app sign-in is not implemented by channel linking.

### Production AI and infrastructure

- [ ] Input/output moderation, prompt-injection/tool boundaries, factual/citation validation and policy review.
- [ ] Versioned model capabilities/prices, conformance tests, actual usage reconciliation and provider egress controls.
- [ ] PostgreSQL migrations, Redis/BullMQ/outbox, leases, distributed cancellation and tenant load tests.
- [ ] Guest-data expiry, stronger auth/abuse limits, audit logs, backups/restores, observability and alerting.
- [ ] Controlled deployment pipeline, staging, uptime/performance checks, full accessibility/device QA.
- [ ] Verify the GitHub Android APK artifact on physical devices; privately signed distribution,
  iOS binaries and app-store/privacy reviews remain release tasks.

### Subsequent product phases

- [ ] Competitor monitoring and evidence-backed content gaps.
- [ ] Real Channel DNA/retention analysis and post-publish feedback.
- [ ] Thumbnail image analysis/generation, licensed asset pipeline and A/B guidance.
- [ ] Publishing planner with official resumable upload and explicit per-video confirmation.
- [ ] Full One-Tap orchestration, autonomous Growth Agent, missions and learning loop.
- [ ] Production localization/RTL, sponsorship, advanced reporting and agency/team permissions.
- [ ] Real subscription checkout, verified payment webhooks, entitlements and a disclosed refund policy.

The PRD and technical architecture remain the long-term requirements/design documents. Their
unchecked acceptance criteria are not automatically satisfied by this development build.

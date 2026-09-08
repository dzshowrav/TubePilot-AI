# TubePilot AI

**Your next great video starts with a good idea.**

An AI-assisted creator workspace — **Discover → Plan → Create → Optimize → Learn**.
Built with React Native / Expo, a responsive web preview, NestJS, persistent workspace storage,
and the TubePilot OpenAI-compatible AI gateway.

> **Milestone 0.3: creator workspace + read-only YouTube connector, not the completed 62-feature product.**
> Demo analytics/trends stay clearly labeled. An operator-configured Google OAuth connector can read
> your authorized channel and available reports after explicit confirmation. Generation uses demo
> templates by default. No external account, paid subscription or provider is connected automatically.

## Try the app

Requires **Node.js 22.17+** (tested on 22.22.3) and npm.

```sh
npm ci
npm run dev
```

Open the **TubePilot AI live preview on port 3000**, or the local web address printed by Vite.
The NestJS API runs on port 4000; the web app calls relative `/api/v1` URLs through the preview proxy.
Both services bind `0.0.0.0` and support Arena's preview environment.

No credentials or external services are required. Each visitor gets an isolated demo workspace.
Projects, preferences, bookmarks, tasks and credits are persisted in `.data/tubepilot.sqlite`
(ignored by Git). SQLite is built into Node; its Node 22 API is experimental.

### A workflow to try

1. Explore **Trend Radar**, filter a topic, and save an opportunity.
2. Open **Content Studio** and generate a few demo video ideas.
3. Choose **Write the script**, generate a draft, then **Find the right title**.
4. Save a title and open the resulting project. Edit your script and set a planning date.
5. Find the project in **My Projects** / **Content Calendar**, or export it as Markdown.
6. Reopen past generations from **Recent drafts**. Reopening does not spend credits.
7. Personalize your workspace or register an account to preserve it across devices.

Calendar entries are planning notes; the app never uploads or schedules anything on YouTube.

## What is implemented

- Eight screens: Overview, Trend Radar, Content Studio, Projects, Calendar, Analytics, Assistant, Settings.
- Desktop sidebar and responsive five-tab mobile navigation, dark/light themes, global search.
- Three-step onboarding, brand voice/preferences, English/Bengali demo drafts.
- Email/password and anonymous sessions, guest-to-account upgrade, isolated workspace ownership.
- Six drafting tools plus an assistant, with explicit demo/source labels, progress, cancellation and history.
- Project CRUD, optimistic revision checks, stage filters, duplication, planning dates and exports.
- Transactional credit reservations, idempotent task admission, durable results and authenticated SSE replay.
- Read-only YouTube OAuth/PKCE, session-bound channel confirmation, encrypted tokens and channel sync.
- Actual-data dashboards with nullable metrics, dated reports, request budgets and no sample fallback.
- Workspace data export/deletion, token revocation queue and server-only provider credentials.
- The existing tested `@tubepilot/ai-gateway` package, connected to a development-only provider adapter.

## Verification

```sh
npm run check       # strict TypeScript + gateway and API/store tests
npm run build       # packages, API, and production web assets
npm run test:e2e     # real browser workflows, persistence, exports and mobile viewport
npm audit           # locked dependency audit
```

Browser tests use an npm-distributed headless Chromium on Linux. On macOS/Windows, install the
normal Playwright browser with `npx playwright install chromium`. The tests never call paid AI
providers or YouTube. CI runs type checks, tests, the web build, dependency auditing and browser tests.

## Connect your YouTube channel

The connector is **off by default** and needs operator-provided Google Cloud configuration. Open
**Settings → Connections** for setup/status, or follow [the integration guide](docs/YOUTUBE_INTEGRATION.md).

It supports explicit channel selection, lifetime statistics, recent uploads and optional 7/28-day
Analytics reports. It never requests upload/edit permissions or feeds connected YouTube data to AI.
Missing reports remain unavailable rather than being filled with sample values. Google authorization
is for channel linking, **not Google sign-in to your TubePilot account**.

Backend and browser integration tests use mocks. Real Google project/scope verification and device
conformance are still required; no live channel was used to validate this milestone.

## Native and provider configuration

- Native entry: `apps/mobile/index.ts` / `App.tsx`, using Expo SDK 57 and React Native 0.86.
  Set `EXPO_PUBLIC_API_URL` to the **HTTPS API/preview origin**, then run
  `npm run start -w @tubepilot/mobile`. A physical device cannot reach the sandbox through its own localhost.
- Android and iOS Hermes bundles have been exported successfully; these are **not** signed app
  binaries or physical-device QA.
- Default AI: labeled templates. Optional backend-only configuration is documented in
  [`.env.example`](.env.example) and [the implementation guide](docs/IMPLEMENTATION_STATUS.md).
  Live inference requires explicit opt-in, verified model configuration/prices and a hard server budget.
  It is blocked in production until account verification and moderation are implemented.
- Never put provider keys or YouTube tokens in browser/mobile storage, URLs, source control or chat.

## Repository

```text
apps/mobile/          React Native screens + Vite web preview + Expo native entry
apps/api/             NestJS API, SQLite store, task runner and integration tests
packages/contracts/   Shared TypeScript types and strict request schemas
packages/ai-gateway/   Server-only OpenAI-compatible transport and its unit tests
tests/e2e/            Browser workflow tests
```

## Documentation and remaining work

| Document | Purpose |
|---|---|
| [`docs/IMPLEMENTATION_STATUS.md`](docs/IMPLEMENTATION_STATUS.md) | What actually works, runtime decisions, setup, testing and outstanding release gates. |
| [`docs/YOUTUBE_INTEGRATION.md`](docs/YOUTUBE_INTEGRATION.md) | Google Cloud setup, protocol/security design, actual metric coverage, retention and release checks. |
| [`docs/AI_GATEWAY.md`](docs/AI_GATEWAY.md) | Gateway design, secure configuration, transport contracts and production requirements. |
| [`docs/PRD.md`](docs/PRD.md) | Full product vision, source-feature mapping and acceptance criteria. |
| [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md) | Long-term architecture and the distinction between this development build and production. |

**Next:** live Google consent/Brand Account/report conformance; Google app sign-in and production auth;
policy review and licensed trend data; moderation; PostgreSQL/Redis/BullMQ; payment integration;
advanced agents/analytics/agency features; complete localization/accessibility and signed device builds.

TubePilot never promises virality, rankings or revenue. A good interface, a passing test, or an AI
label does not establish external API permissions or production readiness.

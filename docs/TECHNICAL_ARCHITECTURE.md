# TubePilot AI — Technical Architecture

**Version:** 1.3 · **Status:** Production target + milestone 0.3 development implementation · **Date:** 2026-09-08
**Stack decision:** React Native (TypeScript) client + full-stack backend (API gateway + services +
PostgreSQL + Redis + queue + AI gateway).
**Companion docs:** [`PRD.md`](./PRD.md) (requirements) · [`AI_GATEWAY.md`](./AI_GATEWAY.md)
(detailed gateway contract, migration from the supplied design and implementation status).

**Repository reality:** `apps/mobile` now contains Expo/React Native screens and a Vite-powered
React Native Web preview. `apps/api` contains NestJS endpoints, SQLite persistence, single-process
async tasks, credit reservations and event replay. Shared contracts, gateway/API tests and browser
workflow tests are implemented. A read-only YouTube OAuth/PKCE, token-vault, sync and revocation
connector now exists in `apps/api/src/youtube`; actual-data views live in `apps/mobile`. See
[`YOUTUBE_INTEGRATION.md`](./YOUTUBE_INTEGRATION.md). **Live Google conformance, Google app sign-in,
PostgreSQL/Redis/BullMQ, production billing/moderation and advanced agents remain release work.** See
[`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) for exact boundaries and current setup.
No live provider, YouTube permission, signed native binary or production deployment is validated
by a demo or mocked test.

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        React Native App (iOS + Android)                 │
│  Expo + TypeScript · React Navigation · TanStack Query · Zustand        │
│  Secure storage (Keystore/Keychain) · dark-first Material-3 theme       │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ HTTPS (REST + SSE for AI streaming)
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            API Gateway                                  │
│  AuthN/AuthZ · rate limiting · request validation · API key mgmt        │
│  (never terminates YouTube OAuth directly — proxies to services)         │
└──────────────────────────────┬──────────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        Application Backend                              │
│  users · channels · trends · ideas · scripts · projects · calendar      │
│  alerts · subscriptions · usage · reports                                │
└───────────────┬──────────────────────────────┬──────────────────────────┘
                ▼                              ▼
┌───────────────────────────┐    ┌──────────────────────────────────────┐
│      AI Orchestrator       │    │       Background Job System          │
│  Trend/Research/Idea/      │    │  Trend Scan → Research → AI Analysis │
│  Script/Title/Thumbnail/   │    │  → Score → Notification              │
│  SEO/Analytics/Competitor/ │    │  (queue workers, retries, backoff)    │
│  Growth agents             │    └──────────────────────────────────────┘
└───────────────┬───────────┘
                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                            AI Gateway                                   │
│  OpenAI-compatible chat/SSE · default Hugging Face Inference Router    │
│  Server secrets · model registry · usage · cancellation · safe errors │
└─────────────────────────────────────────────────────────────────────────┘
                │
┌───────────────┼─────────────────────────────────────────────────────────┐
│   PostgreSQL  │  Redis (cache + queue)  │  Object storage (uploads)     │
└───────────────┴─────────────────────────────────────────────────────────┘
                │
┌───────────────┴─────────────────────────────────────────────────────────┐
│   YouTube Data API v3 · YouTube Analytics API · Trend sources · AI APIs │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key decisions**
- **Stateless application services** behind the gateway; horizontal scaling.
- **Cache-first reads** for trend/analytics data (Redis) to protect YouTube quota and AI cost.
- **All heavy work is async** (queue), never blocking a request.
- **AI provider abstraction:** OpenAI-compatible chat first; verified model/provider aliases selected
  server-side. Image generation/embeddings and non-compatible APIs need separate adapters.
- **Phase 1 safety foundation:** cache, basic workers, provider gateway and hard spending controls
  precede user-facing generation. Advanced agents/automatic failover are not MVP prerequisites.
- **Modular monolith + worker first:** NestJS module boundaries do not require separate networked
  microservices. Extract services only when scaling/ownership evidence justifies the complexity.

---

## 2. Recommended Technology Stack

| Layer | Choice | Rationale |
|---|---|---|
| Client framework | **React Native + Expo (dev builds) + TypeScript** | Single codebase, OTA-able updates, TS shared with backend |
| Navigation | React Navigation (bottom tabs + native stacks) | Matches 5-tab IA (PRD §6) |
| Server state | TanStack Query | Caching, retries, optimistic UI |
| Client state | Zustand | Lightweight, minimal boilerplate |
| UI / theming | Custom design tokens + `react-native-paper` (or Unistyles) | Material-3 dark-first, dynamic cards |
| Charts | `react-native-gifted-charts` / Victory Native | Native-feel charts |
| Secure storage | `expo-secure-store` (Keystore/Keychain) | TubePilot app-session credentials only; provider and YouTube tokens stay backend-side |
| Backend | **Node.js + NestJS (TypeScript)** | Shares TS with client; modular, gateway-friendly |
| API layer | REST (JSON) + SSE for AI streaming | Simple, cacheable; SSE for token streaming |
| Database | PostgreSQL 16 | Relational core; JSONB for flexible payloads |
| ORM | Prisma (or Drizzle) | Type-safe migrations |
| Cache | Redis 7 | Trend/metric caches, session store |
| Queue | BullMQ (Redis-backed) | Trend scan, analysis, notifications |
| Object storage | S3-compatible | Thumbnail uploads, exports |
| AI providers | **Hugging Face Inference Router by default; verified OpenAI-compatible endpoints/models** | `@tubepilot/ai-gateway` chat/SSE adapter; non-compatible text, image-generation and embedding adapters later |
| Auth | Firebase Auth **or** custom JWT + OAuth2 | Email + Google sign-in |
| Observability | Sentry (client) + OpenTelemetry/Prometheus/Grafana (server) | Crash + metrics + logs |
| Infra | Docker Compose (dev) → managed cloud (EKS/Cloud Run/RDS) | Path from local to prod |

---

## 3. Client Architecture (React Native)

```
src/
  app/                 # navigation, providers, theme, routing
  features/
    home/              # dashboard, daily brief
    trends/            # radar, velocity, detail
    create/            # hub → idea/script/title/thumbnail/short/seo/plan
    analytics/         # analyzer, DNA, audience, post-publish
    ai/                # assistant, growth agent, missions
    account/           # auth, security, subscription
  shared/
    ui/                # design system (tokens, components)
    api/               # typed API client + query hooks
    store/             # zustand slices
    i18n/              # en/bn/hi/ar/es (RTL for ar, shaping for bn)
    lib/               # scoring utils, formatters, timezone
```

**Conventions**
- **Design system:** token-driven (colors, spacing, type, radius) → dark-first with light + system
  modes (source feature 56; PRD Appendix A). ≥44dp touch targets, skeleton loaders, bottom sheets, micro-animations.
- **AI streaming:** SSE over the gateway; render partial output; cancel + retry.
- **Offline:** TanStack Query cache serves read-only data; a global offline banner. In MVP, writes
  require connectivity; do not queue billable AI generations invisibly or replay a cancelled request.
- **Security:** TubePilot app-session credentials use `expo-secure-store` as required by the chosen
  auth solution. YouTube refresh/access tokens and AI provider keys never go to the device.
  Distinguish an app refresh credential from a YouTube OAuth refresh token.
- **AI preferences:** store only enabled catalog aliases and safe UI settings. Backend controls
  provider URLs, secrets, capability validation, feature prompts, context access and spending limits.
  Model changes affect new tasks; no global cancellation controller shared between screens.
- **i18n:** Bengali shaping + Arabic RTL verified in QA (PRD G-09).

---

## 4. Backend Architecture (NestJS modules)

```
modules/
  auth/           # sign-in, sessions, device mgmt, logout-all
  channels/       # YouTube connect, scope mgmt, token vault
  trends/         # radar, velocity, snapshots, scoring
  opportunities/  # opportunity + viral score engine
  competitors/    # competitor tracking, alerts
  ideas/          # idea studio, remix
  scripts/        # script studio, hooks
  packaging/      # titles, seo, thumbnails, A/B estimates
  projects/       # content workspace
  calendar/       # content calendar + publish planner
  analytics/      # analyzer, DNA, audience, post-publish, retention
  comments/       # comment intelligence
  growth/         # growth agent, missions, learning loop
  knowledge/      # knowledge base, brand voice
  policy/         # policy & risk scanner (advisory)
  localization/   # multi-language localization
  monetization/   # monetization intelligence
  billing/        # subscriptions, credits, usage
  reports/        # weekly/monthly reports
  admin/          # admin dashboard
  ai/             # orchestrator + gateway (shared)
```

**Service boundaries:** each module owns its tables and exposes an internal interface; the
orchestrator composes them (never calls other modules' DBs directly).

---

## 5. AI Gateway & Agents

### 5.1 Adopted transport (implemented foundation)

The supplied gateway is adopted as a **server-only OpenAI-compatible Chat Completions adapter**,
not copied as a browser credential proxy. Default upstream:
`https://router.huggingface.co/v1/chat/completions`.

```ts
import { AiGateway, ModelRegistry } from '@tubepilot/ai-gateway';
// AiGateway exposes:
// chat(request: ChatRequest, options?: GenerationOptions): Promise<ChatResult>
// stream(request: ChatRequest, options?: GenerationOptions): AsyncGenerator<GatewayEvent>
// GatewayEvent = start | delta | usage | complete; failures throw a safe GatewayError.
```

- `ProviderConfig`: trusted provider ID/base URL, exact HTTPS-origin allowlist and a backend
  `getApiKey()` secret resolver. No API keys in localStorage/AsyncStorage, application DTOs or logs.
  Redirects are disabled; production DNS/egress controls are additionally required.
- `ModelRegistry`: immutable validated model records, custom-model registration, enabled catalog,
  modality/parameter/streaming support, context/output limits and provider-specific token-limit field.
  The supplied DeepSeek/Qwen/Llama/MiniMax IDs are disabled reference entries until verified.
- `buildGatewayPayload`: immutable TubePilot policy instructions, trusted feature guidance,
  authorized Channel DNA/Brand Voice/source context as data, full-turn history trimming, bounded
  PNG/JPEG/WebP inputs, supported sampling defaults and output-token reservation.
- Reasoning controls use supported `reasoning_effort`, not a forced private chain-of-thought prompt.
  Separate reasoning fields are ignored; standard inline thinking tags are filtered across chunks.
- `chat()` explicitly requests JSON; `stream()` explicitly requests SSE. Stream framing handles
  split UTF-8/CRLF/multiline/final events and usage-only frames; invalid/unfinished streams fail.
  Missing input/output/total usage stays null, not zero. Completion records model/provider aliases,
  context packing, finish reason and attempt count.
- Per-call AbortController/deadline; bounded retries only for explicit HTTP 429/503 rejection before
  an accepted response. Honor Retry-After seconds/dates. No replay after accepted/partial/ambiguous
  work, no silent streaming-to-JSON repeat, and no automatic cross-provider failover in this package.

See [`AI_GATEWAY.md`](./AI_GATEWAY.md) for exact limits, errors, configuration and tested behavior.

### 5.2 Host integration and trust gates (development host implemented; production gates remain)

```text
authenticated feature request
  → authorize tenant/project/assets/model → validate payload → reserve worst-case credits
  → persist task/outbox → BullMQ worker → secret resolver → AI gateway
  → moderate/schema-check output → persist task/events → settle or reconcile usage
```

The library itself is not an API, authorizer, image decoder, moderation system or ledger. The new
`apps/api` development host implements ownership, durable task/event records and a credit-reservation
ledger with a single-process runner. It does **not** implement the production image/moderation,
distributed queue, verified-account or actual provider-cost reconciliation gates.
Clients cannot submit upstream URLs, keys, trusted instructions or arbitrary context pointers.

- Model selection is filtered by plan, feature, capabilities and approved processing terms, including
  downstream providers behind a router. Configuration/model-price versions are frozen per task.
- Image generation and embeddings are **not** implemented by `/chat/completions`; reserve separate
  adapters/interfaces for those capabilities. Structured-output/tool execution also requires explicit
  provider support and host validation before activation.
- Input/output moderation precedes persistence/display. Until streaming moderation is available,
  buffer the final answer rather than forwarding raw transport deltas.
- Any future automatic failover is consent/capability/budget-aware and attributed to the actual model;
  it cannot splice outputs, re-run partial generations or bypass task idempotency.

### 5.3 Agents (planned feature layer, not one mega-prompt)

```text
TrendAgent · ResearchAgent · IdeaAgent · ScriptAgent · TitleAgent · ThumbnailAgent ·
SEOAgent · AnalyticsAgent · CompetitorAgent · GrowthAgent
                              ▲
                    Workflow Orchestrator
```

Each agent uses a bounded feature prompt, authorized context, explicit tool permissions and a
validated output schema. Deterministic One-Tap orchestration arrives in Phase 2; autonomous planning
in Phase 3. Untrusted research/comments cannot authorize tools or publishing. Metrics come from
validated sources, not generated text; research citations are checked and linked to source timestamps.
API-derived scores/storage remain gated on the applicable YouTube approval (PRD §9.2–9.3).

---

## 6. Data Model (PostgreSQL)

Proposed entities (not migrations yet). Explicitly separate source observations, model configuration,
user task state and the financial ledger:

| Entity | Key fields |
|---|---|
| `users` | id, email, auth_provider, role, timezone, locale, plan |
| `channels` | id, user_id, youtube_channel_id, title, avatar, country, refresh_token_enc, scopes[], status |
| `channel_metrics` | channel_id, period_start/end, observed_at, available_through, source, nullable metrics_json, expires_at |
| `channel_dna` | channel_id, version, video_count, source_snapshot_ids, traits_json, confidence, computed_at, expires_at |
| `videos` | id, channel_id, youtube_video_id, title, kind(short/long), published_at, duration |
| `video_metrics` | video_id, observed_at, window, period_start/end, source, nullable metrics_json, expires_at |
| `competitors` | user_id, channel_id, youtube_channel_id, added_at |
| `trends` | id, topic, category, source, first_seen_at, state(emerging…declining) |
| `trend_snapshots` | trend_id, ts, score, demand, velocity, competition, freshness, opportunity |
| `ideas` | id, project_id, topic, hook, format, audience, competition, opportunity_score |
| `scripts` | id, project_id, format, sections_json, voice |
| `titles` | id, project_id, title, scores_json |
| `thumbnails` | id, project_id, concept_json, image_url, status |
| `projects` | id, user_id, channel_id, name, stage, workflow_state |
| `content_calendar` | user_id, date, video_id, topic, format, priority, window |
| `alerts` | user_id, type, severity, payload_json, read_at |
| `ai_providers` | id, approved_base_url, secret_ref (not plaintext key), processing_policy, config_version, enabled |
| `ai_models` | id, provider_id, upstream_model, capabilities_json, context/output limits, price_version, config_version, enabled |
| `ai_tasks` | id, user_id, project_id, agent, model/config/price snapshot, idempotency_key, request_hash, status, result_json, safe_error, created/finished_at |
| `ai_attempts` | task_id, attempt_no, provider/model, status, nullable input/output/total tokens, latency, reconciliation_status |
| `ai_task_events` | task_id, sequence, type, moderated_payload, created_at, expires_at |
| `credit_ledger` | id, user_id, task_id, reservation_id, kind(reserve/settle/release/adjust), amount, price_version, created_at |
| `outbox_events` | id, task_id, kind, published_at, created_at |
| `subscriptions` | user_id, plan, status, current_period_end |
| `usage` | user_id, date, derived totals from settled ledger/attempts; not the source of truth |
| `sessions` | user_id, device_id, refresh_token_hash, created/revoked_at |
| `knowledge_docs` | user_id, kind, content, embedding_id, deleted_at |
| `reports` | user_id, type, period, payload_json, generated_at |

**Constraints:** unique `(user_id, idempotency_key)` on tasks, `(task_id, sequence)` on events,
`(task_id, attempt_no)` on attempts, and unique settlement/release operations per reservation.
Authorize child resources through their project/channel/task owner. MVP uses user-owned workspaces;
Agency requires explicit workspace memberships and per-channel permissions before activation.

**Encryption:** `channels.refresh_token_enc` uses KMS/envelope encryption; `secret_ref` points to a
vault entry. App session refresh-token hashes are distinct from YouTube tokens.

**Retention:** enforce PRD §9.3 by source/data class. Applicable metadata needs 30-day refresh/deletion;
accepted additional-analytics use cases can retain qualifying statistics/derived data for at most
36 months. No indefinite “active account” exemption. Source deletion/revocation propagates to DNA,
embeddings, prompts, reports, cached views and event replay; define backup handling before release.

**Analytics feasibility:** maintain a metric/API/scope/granularity/availability matrix. Use timestamped
snapshots only for supported early-window counters; delayed/unavailable CTR, audience and retention
metrics stay null with freshness metadata, never inferred as if they were official measurements.

---

## 7. API Design (REST)

Production API design. A subset is now implemented by the development host under `/api/v1`: auth,
profile, projects, trend bookmarks, tasks/events/cancellation, usage and read-only YouTube linking/sync.
The connector endpoint/retention matrix is documented separately; the full surface below is
**not** implemented; consult IMPLEMENTATION_STATUS for current endpoints and external-integration gaps.
Auth uses opaque app sessions (HttpOnly cookies on web, secure bearer storage on native).

```
POST   /v1/auth/signin            POST /v1/auth/signout
GET    /v1/auth/sessions          POST /v1/auth/sessions/revoke-all
GET    /v1/channels               POST /v1/channels/connect   (starts OAuth)
DELETE /v1/channels/:id           GET  /v1/channels/:id/overview
GET    /v1/trends                 GET  /v1/trends/:id
POST   /v1/trends/scan            (admin/worker-triggered)
GET    /v1/opportunities          GET  /v1/opportunities/:topic
GET    /v1/channels/:id/analysis  GET  /v1/channels/:id/dna
GET    /v1/channels/:id/audience  GET  /v1/competitors
POST   /v1/competitors            DELETE /v1/competitors/:id
GET    /v1/gaps
POST   /v1/ideas/generate         POST /v1/ideas/remix
POST   /v1/scripts/generate       POST /v1/hooks/generate
POST   /v1/titles/generate        POST /v1/seo/generate
POST   /v1/thumbnails/concepts    POST /v1/thumbnails/generate   (Phase 4)
POST   /v1/packaging/ab-estimate
POST   /v1/shorts/generate        POST /v1/shorts/convert
GET    /v1/projects               POST /v1/projects
GET    /v1/calendar?month=        POST /v1/calendar/generate
POST   /v1/publish/plan           POST /v1/publish/upload        (opt-in scope)
GET    /v1/videos/:id/health      GET  /v1/videos/:id/retention
GET    /v1/comments/classify
POST   /v1/growth/agent           POST /v1/growth/missions
GET    /v1/brief                 GET  /v1/alerts
POST   /v1/policy/scan            POST /v1/knowledge
GET    /v1/reports/:type
POST   /v1/ai/assistant           (submits a typed assistant task)
GET    /v1/ai/models              POST /v1/ai/tasks
GET    /v1/ai/tasks/:id            GET  /v1/ai/tasks/:id/events
POST   /v1/ai/tasks/:id/cancel
GET    /v1/billing/usage
```

- **AI-heavy endpoints return 202 + task ID**, with an idempotency key and a transactional credit
  reservation. Stream persisted normalized events or poll the existing task; reconnection never
  starts another generation. Do not place session credentials in an SSE query string.
- Task reads/events/cancellation require owner checks, as do all channel/project/attachment lookups.
  Use explicit worker cancellation; disconnecting one subscriber does not cancel a persisted task.
  Headers/replay/error semantics are defined in AI_GATEWAY §7.
- **All YouTube reads** go through the backend (never client-to-YouTube), so quota/caching/token
  handling are centralized.

---

## 8. Cache Layer (Redis)

- **Trend data** (TTL 10–30 min) — radar lists, snapshots, scores.
- **Channel/video metrics** (TTL 15–60 min) — protects the 10,000-unit/day YouTube quota.
- **Competitor metrics** (TTL 15–60 min).
- **AI responses where safe** (deterministic/idempotent requests only — TTL 1h; never cache
  per-user-generated creative content across users).
- **User session data** (short TTL) for gateway auth checks.

**Invalidation:** write-through + explicit invalidation on channel sync, trend scan, and upload
events. Trend scans write snapshots to Postgres and refresh cache.

**Trend data sources (no scraping):** YouTube Data API `search.list` (own daily bucket), Google
Trends (via licensed/official access), public RSS/news feeds, and licensed third-party trend APIs.
Every trend row stores its `source` and retrieval time for traceability (PRD G-04, G-13).

**Capacity gate:** the default separate search allowance is 100 calls/day, not 10,000 searches.
One hourly search for each of five niches already needs 120 calls/day, before pagination. Pick a
licensed source and a per-bucket sampling budget before enabling categories; share discovery scans
where permitted. Monitor actual project quotas and stop/throttle at a configured reserve rather than
retrying daily exhaustion. Cache private channel/DNA/AI data by tenant/model/configuration version.

---

## 9. Background Job System (BullMQ)

| Queue | Jobs | Schedule |
|---|---|---|
| `trend-scan` | scan → research → AI analysis → approved score → notification | scheduled against source licenses and per-bucket daily budgets, not unconditional hourly fan-out |
| `channel-analysis` | sync available metrics → recompute versioned DNA/health | daily baseline plus explicit supported 1h/6h/24h/48h/7d observation jobs; disclose lag |
| `ai-tasks` | any AI generation (ideas, scripts, titles, …) | on demand |
| `competitor-watch` | poll new uploads → spike detection → alert | every 15–30 min |
| `notifications` | push + in-app digest | on demand |
| `reports` | weekly/monthly report build | cron |

- Basic queues ship in Phase 1; autonomous schedules expand in Phase 3.
- Idempotency keys, transactional outbox and dead-letter handling prevent duplicate task admission.
  Do not wrap ambiguous/accepted/partial AI calls in generic BullMQ retries: the transport owns its
  narrow pre-response 429/503 retry policy. Other idempotent jobs may use exponential backoff.
- Worker concurrency scales independently, bounded per user/provider and by reserved budget.
  Persist safe terminal states and propagate cancellation/revocation across workers.

---

## 10. Security & Authentication

- **Sign-in:** Firebase Auth (or custom JWT) for email + Google; short-lived access JWT +
  rotating refresh tokens; server-side session + device registry (supports "log out all devices").
- **YouTube OAuth:** backend-owned OAuth flow (PKCE), least-privilege incremental scopes; refresh
  token encrypted in vault; YouTube access token stays server-side. App-session credentials alone
  use `expo-secure-store` on device.
- **AI secrets/transport:** backend secret manager, trusted HTTPS upstream allowlist, no redirects;
  deployment egress/DNS restrictions. Never expose AI keys through mobile storage, bundles or URLs.
  Production uses vault-managed secrets; untracked local environment variables are for development only.
- **Rate limiting** at the gateway per user/IP; per-endpoint limits for AI endpoints.
- **RBAC + ownership:** user/member/admin roles do not replace resource authorization. Validate
  ownership of every channel, project, task, event subscription and asset. Provider/model changes
  require audited admin access; persisted context is reauthorized at worker dispatch.
- **Data hygiene:** PII minimized in logs; no tokens/raw prompts/raw provider errors/private reasoning;
  admin shows masked emails. Approved processing consent and source deletion apply to AI artifacts.
- **Untrusted inputs:** validate before parsing/dispatch, authorize and decode uploaded assets, isolate
  reference material from trusted instructions, moderate output before display, and grant agents only
  explicit feature tools. System prompts are not a security boundary.

---

## 11. Observability

- **Client:** Sentry crash reporting + performance traces; analytics SDK for funnel events
  (activation, One-Tap Workflow completion).
- **Server:** structured logs (request id), OpenTelemetry traces, Prometheus metrics
  (latency, error rate, queue depth, cache hit-rate).
- **AI dashboard (admin):** per-provider/model attempts, input/output/total usage or unknown state,
  latency, safe error codes, retries, cancellations, partial results and cost reconciliation status.
- **Alerts:** queue depth, provider error spike, YouTube quota remaining, cost budget breach.

---

## 12. Admin Dashboard

Roles: `admin` only. Modules (spec §50): Users · AI (token/cost/errors/provider perf) · System
(API health, queue, DB, error logs) · Business (free/pro/premium, revenue, conversion). Audit log
on admin actions; PII masked.

---

## 13. Subscription & Credits

- Plans: Free / Creator / Pro / Agency (PRD §7.14) — feature flags + limits stored per plan.
- **Phase 1 hard caps:** before inference, atomically authorize/reserve worst-case input/output and
  permitted-attempt spend. Freeze model configuration/pricing and enforce daily/monthly limits under
  concurrency; free users cannot create unbounded queued reservations.
- **Append-only ledger:** reserve → settle known usage → release remainder, each operation unique
  and transactional. `usage` rows are aggregates, not an auditable balance source.
- **Unknown/partial usage:** missing counters, cancellation and ambiguous upstream failures are not
  zero-cost events. Keep conservative pending reservations until reconciled under the disclosed
  policy; do not automatically refund/re-run work that may already be billable.
- **Task idempotency:** unique user/key plus request hash; same request returns existing task, changed
  request with same key returns 409. Queue retries cannot repeat accepted/partial provider calls.
- **Paid subscriptions (Phase 3):** verified, replay-safe payment webhooks with unique event IDs;
  plan changes/grace periods are distinct from the Phase 1 usage/budget safety layer.
- These are host integration requirements; the gateway package reports usage but does not implement
  the database ledger or payment provider. See AI_GATEWAY §8 for transaction/reconciliation flow.

---

## 14. Monorepo Layout (implemented foundation + planned applications)

The mobile app, NestJS API, contracts, gateway, tests and CI now exist. Separate workers, admin and
production infrastructure remain planned. The development runner currently lives in the API process.

```
TubePilot-AI/
  package.json         # implemented npm workspaces; build/typecheck/test/check
  .github/workflows/ci.yml # implemented offline gateway checks
  apps/
    mobile/            # IMPLEMENTED universal React Native client; Expo + Vite web preview
    api/               # IMPLEMENTED NestJS development API / SQLite store / task runner
    worker/            # PLANNED BullMQ workers
    admin/             # admin web (optional)
  packages/
    contracts/         # IMPLEMENTED shared TS DTOs and strict Zod request schemas
    ai-gateway/        # IMPLEMENTED server-only chat/SSE transport + registry + tests
    ui/                # design tokens / shared components
  infra/
    docker-compose.yml # postgres, redis, minio (dev)
    migrations/
  docs/
    PRD.md
    TECHNICAL_ARCHITECTURE.md
    AI_GATEWAY.md      # adopted gateway design, implemented contracts and release gates
    IMPLEMENTATION_STATUS.md # actual milestone scope, setup and remaining production work
    YOUTUBE_INTEGRATION.md # read-only connector, operator setup and verification gates
```

---

## 15. Environments & Deployment

- **Current local app:** Node 22.17+, `npm ci`, `npm run dev`. Vite web preview :3000 proxies relative
  API requests to NestJS :4000. SQLite state lives in ignored `.data`; no external DB or credentials
  are required. This is a single-process development setup, not horizontally scalable infrastructure.
- **Verification:** `npm run check`, `npm run build`, `npm run test:e2e`. API/store tests use isolated
  SQLite databases; browser tests exercise the running application; no paid inference is invoked.
  Android and iOS Hermes exports are verified, not native runtime/device/store readiness.
- **Planned local stack:** Docker Compose (Postgres + Redis + MinIO) + Expo dev build. Any browser
  preview server binds `0.0.0.0`, accepts the preview host, and proxies relative API URLs; browser
  code must not call a sandbox service through localhost.
- **Staging/Prod:** API + workers on managed containers; managed Postgres/Redis; object storage for
  thumbnails/exports; CI builds signed app binaries + EAS updates.
- **Before live inference:** authenticated API/worker, tenant-isolation tests, vault/egress controls,
  verified model/capability/pricing configuration, moderation/asset validation, hard budgets, durable
  tasks/ledger, cancellation/reconciliation and staging conformance tests.
- **Before affected YouTube features:** API metric/source validation, per-bucket quota plan, required
  derived-metric/storage permission and tested refresh/deletion workflows. OAuth verification,
  app-store review and privacy policy are additional release gates—not substitutes for permission.

---

## 16. References

Prefer official documentation over third-party “latest quota/model” claims. Revalidate model/API
support and actual project limits at activation and release.

- [Hugging Face OpenAI-compatible chat-completion API](https://huggingface.co/docs/inference-providers/tasks/chat-completion)
- [YouTube default quota allocation and audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)
- [YouTube derived metrics and data storage](https://developers.google.com/youtube/terms/derived-metrics-policy)
- [YouTube developer-policy compliance guide](https://developers.google.com/youtube/terms/developer-policies-guide)
- [YouTube Analytics query availability and scopes](https://developers.google.com/youtube/analytics/reference/reports/query)
- [YouTube Analytics metrics and retention segments](https://developers.google.com/youtube/analytics/metrics)
- [YouTube current three-minute Shorts guidance](https://support.google.com/youtube/answer/15424877?hl=en)
- [YouTube resumable uploads](https://developers.google.com/youtube/v3/guides/using_resumable_upload_protocol)
- [YouTube thumbnail Test & Compare guidance](https://support.google.com/youtube/answer/13861714?hl=en)

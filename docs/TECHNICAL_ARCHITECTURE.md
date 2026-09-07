# TubePilot AI — Technical Architecture

**Version:** 1.0 · **Status:** Draft for review · **Date:** 2026-09-08
**Stack decision:** React Native (TypeScript) client + full-stack backend (API gateway + services +
PostgreSQL + Redis + queue + AI gateway).
**Companion doc:** [`PRD.md`](./PRD.md) (requirements; this document is the how).

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
│  Primary AI · Secondary AI · Image AI · Embedding/Search AI             │
│  (provider-agnostic interface; failover, cost metering, safety filter)  │
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
- **AI provider abstraction** so switching providers never changes app UI or business logic.

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
| Secure storage | `expo-secure-store` (Keystore/Keychain) | OAuth access-token cache |
| Backend | **Node.js + NestJS (TypeScript)** | Shares TS with client; modular, gateway-friendly |
| API layer | REST (JSON) + SSE for AI streaming | Simple, cacheable; SSE for token streaming |
| Database | PostgreSQL 16 | Relational core; JSONB for flexible payloads |
| ORM | Prisma (or Drizzle) | Type-safe migrations |
| Cache | Redis 7 | Trend/metric caches, session store |
| Queue | BullMQ (Redis-backed) | Trend scan, analysis, notifications |
| Object storage | S3-compatible | Thumbnail uploads, exports |
| AI providers | OpenAI / Anthropic / Google Gemini (text) · image model (DALL·E/Flux) · embeddings (OpenAI/Cohere) | Behind the gateway |
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
  modes (PRD §56). ≥44dp touch targets, skeleton loaders, bottom sheets, micro-animations.
- **AI streaming:** SSE over the gateway; render partial output; cancel + retry.
- **Offline:** TanStack Query cache serves read-only data; a global "offline" banner; writes queue
  for retry or are blocked with clear messaging.
- **Security:** access token in `expo-secure-store` only; refresh token **never** on device — the
  backend vault holds it (PRD §9.4). Sensitive screens behind biometric lock (optional).
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

## 5. AI Provider Gateway & Agents

### 5.1 Gateway interface (provider-agnostic)
```ts
interface AiGateway {
  chat(req: ChatRequest): Promise<ChatResult>;          // primary → failover secondary
  stream(req: ChatRequest): AsyncIterable<string>;      // SSE token stream
  image(req: ImageRequest): Promise<ImageResult>;       // thumbnail generation
  embed(texts: string[]): Promise<number[][]>;          // search/semantic features
}
```
- **Routing:** `PrimaryAI` (default), `SecondaryAI` (failover/cheap model), `ImageAI`, `EmbeddingAI`
  — each an adapter implementing the same interface, so provider swaps never touch UI/logic (PRD §44).
- **Failover:** on primary error/timeout → retry → secondary; log and meter per provider.
- **Cost metering:** every call records tokens/cost/latency/provider — feeds the admin AI dashboard
  and the credit system.
- **Safety filter:** input/output moderation before persisting or returning generated content.

### 5.2 Agents (modular, not one mega-prompt)
```
TrendAgent · ResearchAgent · IdeaAgent · ScriptAgent · TitleAgent · ThumbnailAgent ·
SEOAgent · AnalyticsAgent · CompetitorAgent · GrowthAgent
                              ▲
                    Orchestrator Agent
```
- Each agent = bounded prompt template + tool context (Channel DNA, Brand Voice, Knowledge Base,
  recent metrics) + structured output schema.
- The **Orchestrator** sequences agents for One-Tap Workflow, Growth Agent plans, and Viral Missions,
  and merges results into a single package (PRD C12/C14).
- Agents never fabricate metrics: they consume passed-in data; ResearchAgent returns citations.

---

## 6. Data Model (PostgreSQL)

Core entities (from spec §47), with key fields:

| Entity | Key fields |
|---|---|
| `users` | id, email, auth_provider, role, timezone, locale, plan |
| `channels` | id, user_id, youtube_channel_id, title, avatar, country, refresh_token_enc, scopes[], status |
| `channel_metrics` | channel_id, date, subs, views, watch_time, ctr, retention, engagement |
| `videos` | id, channel_id, youtube_video_id, title, kind(short/long), published_at, duration |
| `video_metrics` | video_id, date, views, ctr, retention_json, likes, comments, shares |
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
| `ai_tasks` | id, user_id, agent, status, credits_used, result_json, error |
| `subscriptions` | user_id, plan, status, current_period_end |
| `usage` | user_id, date, credits_used, requests, tokens |
| `sessions` | user_id, device_id, refresh_token_hash, created/revoked_at |
| `knowledge_docs` | user_id, kind, content, embedding_id, deleted_at |
| `reports` | user_id, type, period, payload_json, generated_at |

**Encryption:** `channels.refresh_token_enc` is encrypted at rest (KMS/envelope encryption).
**Retention:** raw metrics purged after a bounded window; derived DNA/scores retained while account
is active and deleted on account deletion (PRD §9.3).

---

## 7. API Design (REST)

Auth via bearer JWT. Naming: `/v1/<resource>`. Representative surface:

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
POST   /v1/ai/assistant           (streaming SSE)
GET    /v1/billing/usage
```

- **AI-heavy endpoints return 202 + task id** and stream via SSE or poll `GET /v1/ai/tasks/:id`.
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
Every trend row stores its `source` for traceability (PRD G-04, G-13).

---

## 9. Background Job System (BullMQ)

| Queue | Jobs | Schedule |
|---|---|---|
| `trend-scan` | scan → research → AI analysis → score → notification | periodic (e.g. hourly per active category) |
| `channel-analysis` | sync metrics → recompute DNA/health | daily per connected channel |
| `ai-tasks` | any AI generation (ideas, scripts, titles, …) | on demand |
| `competitor-watch` | poll new uploads → spike detection → alert | every 15–30 min |
| `notifications` | push + in-app digest | on demand |
| `reports` | weekly/monthly report build | cron |

- Retries with exponential backoff, dead-letter queue, idempotency keys.
- Worker concurrency scales independently of the API.

---

## 10. Security & Authentication

- **Sign-in:** Firebase Auth (or custom JWT) for email + Google; short-lived access JWT +
  rotating refresh tokens; server-side session + device registry (supports "log out all devices").
- **YouTube OAuth:** backend-owned OAuth flow (PKCE), least-privilege incremental scopes; refresh
  token encrypted in vault; access token kept server-side or in `expo-secure-store`.
- **Transport:** TLS everywhere; secrets in a vault (never in env files/repos).
- **Rate limiting** at the gateway per user/IP; per-endpoint limits for AI endpoints.
- **RBAC:** user / member / admin; admin endpoints role-gated and audit-logged.
- **Data hygiene:** PII minimized in logs; tokens never logged; admin shows masked emails.

---

## 11. Observability

- **Client:** Sentry crash reporting + performance traces; analytics SDK for funnel events
  (activation, One-Tap Workflow completion).
- **Server:** structured logs (request id), OpenTelemetry traces, Prometheus metrics
  (latency, error rate, queue depth, cache hit-rate).
- **AI dashboard (admin):** per-provider token usage, cost, latency, error rate, failover counts.
- **Alerts:** queue depth, provider error spike, YouTube quota remaining, cost budget breach.

---

## 12. Admin Dashboard

Roles: `admin` only. Modules (spec §50): Users · AI (token/cost/errors/provider perf) · System
(API health, queue, DB, error logs) · Business (free/pro/premium, revenue, conversion). Audit log
on admin actions; PII masked.

---

## 13. Subscription & Credits

- Plans: Free / Creator / Pro / Agency (PRD §7.14) — feature flags + limits stored per plan.
- **Credit meter:** `usage` rows incremented per AI task; credits deducted before execution; the
  gateway reports tokens → cost → credits. Free tier has daily + monthly caps.
- **Enforcement:** billing module authorizes each AI call (or returns 402 / "upgrade" prompt).
- **Webhooks:** Stripe (or equivalent) for plan changes; grace period on payment failure.

---

## 14. Monorepo Layout (proposed)

```
TubePilot-AI/
  apps/
    mobile/            # React Native (Expo) client
    api/               # NestJS gateway + services
    worker/            # BullMQ workers
    admin/             # admin web (optional)
  packages/
    contracts/         # shared TS types (API DTOs), zod schemas
    ai-gateway/        # provider adapters + orchestrator (shared lib)
    ui/                # design tokens / shared components
  infra/
    docker-compose.yml # postgres, redis, minio (dev)
    migrations/
  docs/
    PRD.md
    TECHNICAL_ARCHITECTURE.md
```

---

## 15. Environments & Deployment

- **Local:** Docker Compose (Postgres + Redis + MinIO) + `apps/mobile` Expo dev build.
- **Staging/Prod:** API + workers on managed containers; managed Postgres/Redis; object storage for
  thumbnails/exports; CI builds signed app binaries + EAS updates.
- **Pre-GA checklist:** YouTube API quota-extension application, OAuth consent-screen verification,
  Play Store review, privacy policy + data deletion flow.

---

## 16. References

- YouTube Data API quota model & upload buckets (post-2026 changes): [1](https://www.blotato.com/blog/youtube-api-pricing) · [3](https://postproxy.dev/blog/youtube-upload-api-guide/) · [5](https://bundle.social/blog/youtube-shorts-api-secrets)
- YouTube upload & Shorts via `videos.insert` (resumable): [2](https://posteverywhere.ai/blog/post-to-youtube-api) · [4](https://www.veed.io/learn/youtube-shorts-api)
- YouTube official "Test & Compare" (native thumbnail/title A/B): [1](https://monitoryt.com/blog/thumbnail-ab-testing) · [2](https://influencermarketinghub.com/youtube-test-compare/) · [3](https://growthos.in/blog/youtube-thumbnail-a-b-testing-best-practices)

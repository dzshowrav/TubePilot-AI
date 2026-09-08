# TubePilot AI — Product Requirements Document (PRD)

**Version:** 1.3 · **Status:** Product requirements; milestone 0.3 read-only connector implemented · **Date:** 2026-09-08
**Author:** TubePilot AI product team
**Source:** 62-point feature architecture ("Complete Professional Feature Architecture")
**Language:** English (বাংলা retained where the original spec is in Bengali)

> **How to read this document.** This PRD refines the original 62-point spec and records both
> adopted requirements and unresolved release gates. It is not proof that APIs, policies or product
> acceptance criteria have been validated in production. Source features map through Appendix A.
> The gateway design is in [`AI_GATEWAY.md`](./AI_GATEWAY.md). A runnable development workspace
> now implements the core draft/project/calendar flow; see [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md)
> for tested behavior, demo boundaries and remaining work. Passing development tests does not
> automatically satisfy the full production acceptance criteria below.
> The read-only Google/YouTube connector is implemented but not live-verified; see
> [`YOUTUBE_INTEGRATION.md`](./YOUTUBE_INTEGRATION.md). Channel authorization is not Google app sign-in.

---

## 1. Executive Summary

**TubePilot AI** is an AI-powered YouTube Growth Studio — a mobile-first workspace where a creator
can run the full content loop in one place:

> **Discover → Research → Plan → Create → Optimize → Publish → Analyze → Improve**

The product's core promise is precision, not hype:

> "Right topic, right audience, right packaging, right timing."

**TubePilot AI will never claim to make videos go viral.** It delivers *growth opportunity detection,
prediction, and optimization* — scored and explained — and always labels predictions as estimates,
never guarantees.

Five features form the product's defensible core (the "5 Killer USPs"):

1. **Trend Velocity** — attempt to detect opportunity *before* a trend peaks.
2. **Channel DNA** — per-channel strategy, not generic AI output.
3. **Content Gap Engine** — what competitors are *not* doing, not just what they are.
4. **One-Tap Viral Workflow** — topic → complete video strategy in one flow.
5. **Autonomous Growth Agent** — a persistent digital YouTube strategist.

The product ships in **four phases** (§12): an MVP that proves core value (connect → analyze →
trends → ideas → script → title → basic analytics), then a growth engine, then the autonomous AI
layer, then advanced capabilities.

---

## 2. Vision, Mission & Positioning

### 2.1 Vision
A single AI copilot that sits alongside a YouTube creator from the first idea to the post-publish
retrospective — and gets measurably smarter with every video the creator publishes.

### 2.2 Mission
Give every serious creator the strategy layer that was previously only available to channels with
paid teams: trend timing, audience intelligence, packaging science, and continuous learning.

### 2.3 Positioning statement
> For YouTube creators who publish consistently, **TubePilot AI** is the growth studio that
> combines trend radar, channel-specific strategy, and packaging science so they always know *what
> to make next and how to package it* — unlike generic AI script tools, it learns from *their*
> channel over time.

### 2.4 What TubePilot AI is **not**
| Not | Why it matters |
|---|---|
| Not a "go viral" guarantee | Misleading, harms trust, risky under ad/consumer rules |
| Not an SEO "rankings guarantee" | YouTube ranking is algorithmic; tags/keywords are inputs, not entitlements |
| Not a fake engagement / bot service | Violates YouTube ToS; never in scope |
| Not legal or copyright advice | The Policy & Risk Scanner is advisory only (§9) |
| Not a replacement for YouTube's own A/B testing | We *guide* packaging; YouTube runs the experiment (§7.9) |

---

## 3. Goals & Non-Goals

### 3.1 Product goals (measurable)
- **G1** — A connected creator can go from *topic* to a *complete publish plan* (research + idea +
  script + title + thumbnail concept + SEO + schedule) in under 10 minutes (One-Tap Workflow).
- **G2** — ≥ 60% of a creator's daily brief items are *actionable* (each item links to a specific
  next step, not just a chart).
- **G3** — Recommendations are channel-specific: every score uses Channel DNA where available.
- **G4** — Creator trust: 100% of prediction/score UI carries a clear "estimate, not guarantee"
  affordance.
- **G5** — Cost control: AI spend per free user is hard-capped by the credit system (§7.14).

### 3.2 Non-goals (explicitly out of scope)
- Buying views, subscribers, watch time, or engagement.
- Scraping YouTube or bypassing official APIs (ToS risk — see §9.2).
- Promising specific subscriber/revenue outcomes.
- Replacing YouTube Studio; we complement it.
- Auto-publishing without explicit, per-video user confirmation and valid OAuth scope.

---

## 4. Target Users & Personas

| Persona | Who they are | Core pains | Top 3 jobs-to-be-done |
|---|---|---|---|
| **P1 — New Creator** | < 1K subs, 0–3 uploads/month | Don't know what to make; no data to read | Find low-competition topics, get first scripts/titles, learn packaging basics |
| **P2 — Growing Creator** | 1K–100K subs, weekly uploads | Inconsistent growth; burned out on ideation | Trend timing, content gaps, packaging optimization, calendar planning |
| **P3 — Established / Monetized** | 100K+ subs, monetized | Scaling output, keeping retention, revenue | Analytics depth, competitor intel, monetization tracking, delegation |
| **P4 — Agency / Team** | Manages multiple channels | Many channels, no unified strategy view | Multi-channel management, team roles, reporting, white-label |

**Cold-start note:** P1 creators have little or no channel history. Channel DNA, Channel Analyzer,
and Audience Intelligence must degrade gracefully to *niche/benchmark-based* defaults and clearly
say so ("not enough channel data yet — using niche benchmarks"). *(Gap G-07, §8.)*

---

## 5. Product Principles

1. **Honest scores over hype.** Every prediction is a score with an explanation and an uncertainty
   caveat. "Viral" is a *score name*, never a promise.
2. **Channel-first, not generic.** No recommendation is produced without Channel DNA when it exists.
3. **Right timing over more content.** Velocity and freshness matter more than raw volume.
4. **Actionable over informative.** Every insight ends in a "What should I do next?" action.
5. **Progressive trust.** Small value first (trends, ideas), deep integration only with explicit
   consent (OAuth scopes, competitor tracking).
6. **Provider-agnostic AI.** No single AI vendor is a hard dependency (§TECHNICAL_ARCHITECTURE §5).
7. **Native-first feel.** Material-3-inspired, dark-first, bottom-nav UX — not a wrapped website.

---

## 6. Scope Overview — Capability Map

The original 62 features are consolidated into **16 capabilities**. Appendix A maps every source
feature (1–62) → capability → phase.

| # | Capability | Source features | Phase |
|---|---|---|---|
| C1 | **Account, Auth & Security** | 42 | 1 |
| C2 | **YouTube Integration** | 43 | 1 |
| C3 | **Dashboard & AI Daily Brief** | 2, 30, 31 | 1 dashboard / 2 alerts / 3 brief |
| C4 | **Trend Radar & Velocity** | 3, 4, 6 | 1 |
| C5 | **Opportunity & Viral Score** | 5, 40 | 1 |
| C6 | **Channel Analyzer & DNA** | 7, 8, 9 | 1 |
| C7 | **Competitor Intelligence & Content Gaps** | 10, 11 | 2 |
| C8 | **Ideation (Idea Studio + Remix)** | 12, 13 | 1 |
| C9 | **Scripting (Script + Hooks)** | 14, 15 | 1 |
| C10 | **Packaging (Title, SEO, Thumbnail, A/B)** | 16, 17, 18, 19, 20 | 1/2/4 |
| C11 | **Shorts Studio & Converter** | 21, 22 | 2 |
| C12 | **Planning (Calendar, Publish Planner, Workflow)** | 23, 24, 38, 59 | 1 saved drafts / 2 full workflow |
| C13 | **Post-Publish Analytics** | 25, 26, 27, 28 | 1 basic / 2 advanced |
| C14 | **AI Growth Agent & Missions** | 29, 41, 45, 60, 61 | 2 recommendations/workflow / 3 agent / 4 missions/learning |
| C15 | **Localization, Monetization & Sponsorship** | 32, 33, 34 | 2 monetization / 4 advanced |
| C16 | **Platform (Gateway, Knowledge, Voice, Policy, Admin, Billing)** | 35, 36, 37, 39, 44, 50, 51, 52, 53 | 1 foundation / 2–4 extensions |

> **Note on navigation.** The spec's two navigation models (bottom-nav of 5 + a Create Hub of 7
> tools) are reconciled as: **5 bottom tabs — Home · Trends · Create · Analytics · AI** — where
> **Create** is the hub that fans out to Idea / Script / Title / Thumbnail / Short / SEO / Plan.
> This keeps IA shallow (the spec's §58) without duplicating entry points. *(Resolution R-01.)*

---

## 7. Feature Requirements

Each requirement lists source features, functional requirements, and acceptance criteria (AC).

### C1 — Account, Auth & Security *(src: 42)*

**Requirements**
- Email + Google sign-in. Session management with refresh/rotation.
- Device management and **"Log out all devices"**.
- Permissions model: user-level roles (owner/member) for Agency tier.
- **Token boundaries:** YouTube access tokens stay in backend memory; YouTube refresh tokens are
  encrypted in the backend vault. AI provider keys are also backend-only. The device stores only
  TubePilot authentication/session credentials using Keystore/Keychain, including a rotating app
  refresh credential if required by the chosen auth solution. Never put any secret in ordinary
  local storage, AsyncStorage, logs or a plaintext DB field. *(Hard requirement.)*

**AC**
- [ ] Signing in with Google and email both work; sessions survive app restart.
- [ ] "Log out all devices" invalidates all sessions within 60s.
- [ ] A DB dump shows no plaintext refresh/access tokens.

### C2 — YouTube Integration *(src: 43)*

**Requirements**
- **YouTube OAuth** with least-privilege scopes, requested incrementally and explained in plain
  language *before* consent:
  - Read-only analytics — use exact, verified scopes such as
    `https://www.googleapis.com/auth/youtube.readonly` and
    `https://www.googleapis.com/auth/yt-analytics.readonly` for the chosen reports.
    Monetary reports additionally require `yt-analytics-monetary.readonly` when needed;
    `yt-analytics` alone is not a scope identifier.
  - Read-only content (playlists, videos list) — needed for analyzer.
  - Publish (videos.insert) — **only** when the user actively uses the Publish Planner; never bundled
    into first sign-in. *(Gap G-05, G-11.)*
- Respect YouTube quota: the documented defaults are **100 `search.list` calls/day**,
  **100 `videos.insert` calls/day**, and **10,000 units/day for other endpoints combined**.
  Check the actual project allocation; quota resets midnight Pacific. Budget each bucket separately,
  cache from Phase 1, and obtain required extensions before traffic exceeds capacity (§9.2).
- **Publishing capability is limited to what YouTube officially supports** via `videos.insert`
  (resumable upload). Current new-upload Shorts guidance includes square or vertical videos up to
  **three minutes**; `#Shorts` is not a substitute for eligibility checks. Classification remains
  YouTube's. Present "upload as Short," not a classification or monetization guarantee (§15 sources).

**AC**
- [ ] Connecting a channel shows the exact scopes and why, before Google consent.
- [ ] Disconnecting revokes the server-side token and clears cached channel data.
- [ ] The app functions (in read-only mode) for users who grant analytics but not publish scope.
- [ ] Publish actions are gated behind explicit per-video confirmation + `youtube.upload` scope.

### C3 — Dashboard & AI Daily Brief *(src: 2, 30, 31)*

**Requirements**
- **Header:** channel avatar, name, subscriber count, notifications bell, AI Assistant button.
- **Growth Overview cards:** subscribers, views, watch time, CTR, average retention, engagement,
  estimated growth (each labelled "estimate" where derived).
- **AI Daily Brief:** top opportunities/topics/alerts, e.g. "🔥 3 opportunities · ⚡ 2 rising trends ·
  💎 1 low-competition topic · 🚨 1 competitor spike."
- **Quick Actions:** Find Trends, Generate Ideas, Create Script, Optimize Title, Thumbnail Lab,
  Analyze Channel.
- **Smart Alerts** (src: 31): trend rising, competitor spike, video performance spike, CTR drop,
  retention drop, subscriber milestone, topic opportunity, content gap.
- **Notification controls:** per-alert-type toggles + quiet hours + daily-brief delivery time
  (creator's local timezone). *(Gap G-10.)*

**AC**
- [ ] Every brief item is tappable and lands on the relevant screen with the item pre-selected.
- [ ] Brief renders correctly for a brand-new channel (empty-state, not error).
- [ ] User can silence any alert type and set delivery time; settings persist.

### C4 — Trend Radar & Velocity *(src: 3, 4, 6)*

**Requirements**
- Trend categories: Technology, AI, Gaming, News, Education, Entertainment, Finance, Lifestyle,
  Sports, Islamic content, Fashion, Beauty, Custom niche.
  - "Islamic content" is treated as a *content category* with moderation guardrails, not a
    religious determination (§9.6).
- Trend metrics: search growth, velocity, audience interest, competition, content saturation,
  recency, engagement, creator adoption.
- **Trend Score** (0–100) with sub-scores (Demand, Velocity, Competition, Freshness, Opportunity).
- **Velocity states:** Emerging → Rising → Hot → Peak → Declining; the UI surfaces Emerging and
  Rising first ("get in early").
- **Personalized Trend Matching:** global score vs **Your Channel Fit** (0–100) with reasons
  ("audience watches AI tools", "previous related video performed well", "moderate competition").

**AC**
- [ ] Trend list is sortable by Trend Score and by Channel Fit.
- [ ] Each trend shows its state badge and a "why now" line.
- [ ] Trends include recency/freshness timestamps and source attribution (§8 gap G-13).

### C5 — Opportunity & Viral Score Engine *(src: 5, 40)*

**Requirements**
- Opportunity inputs: demand, competition, freshness, creator fit, audience fit, search potential,
  recommendation potential, content gap.
- **Opportunity Score** 0–100 with band (HIGH/MEDIUM/LOW) + a one-line explanation.
- **Unified Viral Opportunity Score** = weighted composite of Topic Demand + Trend Velocity +
  Audience Fit + Content Gap + Packaging Strength + Competition + Freshness. Weights are
  configurable and visible in "Why this score?".
- **Every score screen shows:** "Prediction, not a guarantee" + the factors + confidence level.
- **Launch gate:** API-derived metrics require the applicable YouTube analytics-use-case approval
  (§9.2). A disclaimer does not grant permission to calculate them.
- **Score contract:** version the formula, weights, normalization, evidence timestamps and
  confidence method. Unsupported inputs (including Phase 2 competitor/gap signals during MVP)
  are omitted with an explicit reduced-coverage label; never generated by an LLM as fake metrics.
  Validate against held-out outcomes before claiming predictive value.

**AC**
- [ ] Any score is expandable to show contributing factors and their weights.
- [ ] Score explanations are plain-language, not just numbers.
- [ ] No score UI omits the "estimate, not guarantee" affordance.

### C6 — Channel Analyzer, DNA & Audience Intelligence *(src: 7, 8, 9)*

**Requirements**
- **Analyzer metrics:** subscribers, views, watch time, CTR, retention, likes, comments, shares,
  upload frequency, long-form vs Shorts performance, returning vs new viewers.
- **AI diagnosis** with **Channel Health** sub-scores (Content, Packaging, Retention, Consistency,
  Growth) and a top-3 priorities list.
- **Channel DNA:** best topic, best format, best length, strongest hook pattern, best thumbnail
  style, best title style, audience age band, growth pattern (e.g. Search → Suggested). Stored as
  a reusable profile that feeds **all** downstream recommendations.
- **Audience Intelligence:** what the audience wants, preferred topics/formats/language, abandon
  points, repeat-demand signals.
- **Audience Questions:** AI surfaces themes like "People are asking for Part 2" / "Audience wants
  a tutorial."
- **Cold start:** with < N videos (recommended N=10), show niche-benchmark defaults and a clear
  "needs more data" label. *(Gap G-07.)*

**AC**
- [ ] DNA is recomputed after every channel sync and versioned (date + video count used).
- [ ] Every DNA-derived recommendation links back to which DNA trait it used.
- [ ] Cold-start state is an intentional empty-state, not an error screen.

### C7 — Competitor Intelligence & Content Gaps *(src: 10, 11)*

**Requirements**
- Add competitor channels manually (and by URL). Track: new uploads, views, growth velocity,
  topics, titles, thumbnail patterns, duration, upload frequency, engagement.
- **Competitor Alerts:** "🚨 Competitor video detected — 12K views in 45 minutes → [Analyze]".
- **Content Gap Finder** combines competitor + trend + channel data. Gap types: topic, format,
  audience, language, tutorial, Shorts, comparison.
- Gaps are phrased as *opportunity statements*: "Market demand exists here, but quality supply is
  low — and it matches your Channel DNA."

**AC**
- [ ] Competitor tracking only uses public/official API data; no scraping.
- [ ] Every gap statement cites the demand signal and the supply signal it compared.
- [ ] User can remove a competitor at any time (data retention note in UI).

### C8 — Ideation — Idea Studio & Remix *(src: 12, 13)*

**Requirements**
- **Idea Studio:** input a topic/niche → 20–50 ideas; each idea has Topic, Hook, Format, Audience,
  Competition, Opportunity score. Respects Channel DNA and Brand Voice.
- **Idea Remix:** one existing video → 10 new concepts (shown as concrete variants).

**AC**
- [ ] Idea count is user-selectable (20/50); response streams or paginates.
- [ ] Each idea carries an Opportunity score and one "why" line.
- [ ] Remix uses the user's own video (or a competitor video) as the seed and states the source.

### C9 — Scripting — Script Studio & Hooks *(src: 14, 15)*

**Requirements**
- **Formats:** YouTube Short, Long-form, Tutorial, Review, Documentary, Storytelling, News,
  Explainer, Listicle.
- **Structure:** HOOK → PROBLEM → CURIOSITY → VALUE → PROOF → PAYOFF → CTA (configurable per format).
- **Hook Generator** types: curiosity, contrarian, question, shock, story, problem, pattern
  interrupt; each with a **Hook Strength Score**.
- Scripts respect Brand Voice and target length (from Channel DNA best length).

**AC**
- [ ] Script editor supports editing and re-generating individual sections.
- [ ] Hook strength score is explained with reasons, not just a number.
- [ ] Generated scripts include a short disclaimer where they make factual/statistical claims
  ("verify before publishing").

### C10 — Packaging — Title, SEO, Thumbnail, A/B *(src: 16, 17, 18, 19, 20)*

**Requirements**
- **Title Lab:** generate 10/20/50 titles; score on curiosity, clarity, search intent, emotional
  pull, specificity, length. Show Title Score (CTR potential / search fit / curiosity).
- **SEO Studio:** primary keyword, secondary keywords, search intent, description, tags (where
  applicable), hashtag suggestions, chapters, metadata.
  - **Mandatory honesty rule:** SEO output never claims tags/keywords guarantee rankings. UI must
    say: "Keywords help YouTube understand your video; they don't guarantee placement."
- **Thumbnail Lab:** analyze composition, subject placement, text size, contrast, facial
  expression, object focus, curiosity, mobile readability; generate 3+ concepts (Concept A/B/C).
- **Thumbnail Generator** *(Phase 4, premium):* prompt → image, plus user-uploaded image,
  background removal, face positioning, text overlay, multiple variations. Built on an image AI
  provider behind the AI gateway.
- **Packaging A/B Lab:** compare Title A+Thumbnail A vs Title B+Thumbnail B and *estimate* which
  has stronger potential.
  - **Hard rule:** the app does **not** run YouTube experiments itself. It estimates, then guides
    the creator to use YouTube's official **Test & Compare** (native thumbnail/title A/B in YouTube
    Studio — up to 3 variants; long-form only; requires Advanced Features). The app never claims to
    control YouTube experiments. *(Gap G-06 resolved.)*

**AC**
- [ ] SEO screen always displays the "no guaranteed rankings" note.
- [ ] A/B Lab always links to YouTube Test & Compare guidance and never claims the app runs the test.
- [ ] Thumbnail concepts include mobile-readability warnings (text legibility at small size).

### C11 — Shorts Studio & Converter *(src: 21, 22)*

**Requirements**
- Shorts Studio: opportunity discovery, hook generation, 15/30/45/60/90/180s presets, script, caption,
  title, description, hashtags, loop ending, retention structure.
- Shorts-to-Long converter: "Turn this Short into a 7-minute video" → full outline, script, title,
  thumbnail concept, CTA.

**AC**
- [ ] Duration selector drives structure length (15/30/45/60/90/180s); platform eligibility is checked separately.
- [ ] Loop-ending suggestions are included for retention.
- [ ] Converter asks for target length and produces an outline + script + packaging.

### C12 — Planning — Calendar, Publish Planner, Workspace, One-Tap Workflow *(src: 23, 24, 38, 59)*

**Requirements**
- **AI Content Calendar:** monthly grid; AI suggests topic, format, frequency, priority, and a
  suggested publishing window (in the creator's timezone). Shorts ("S") and long-form ("V")
  placements.
- **Publishing Planner:** per video — title, description, thumbnail, tags/metadata, playlist,
  audience-settings checklist (made-for-kids flag, etc.), all in one place.
- **Content Workspace:** per project — Research / Ideas / Script / Titles / Thumbnail / Description /
  SEO / Analytics.
- **One-Tap Viral Workflow:** Topic → Analyze runs Trend → Competition → Audience → Idea → Hook →
  Script → Title → Thumbnail → SEO → Publish Plan, ending in "🚀 READY TO CREATE" with a
  downloadable/exportable package.

**AC**
- [ ] Calendar respects the creator's local timezone and lets them edit/override suggestions.
- [ ] One-Tap Workflow completes ≤ 10 minutes end-to-end (G1) and produces one consolidated export.
- [ ] Publishing windows are suggestions, never presented as required times.

### C13 — Post-Publish Analytics *(src: 25, 26, 27, 28)*

**Requirements**
- **Post-Publish Analyzer:** compare available observations at 1h, 6h, 24h, 48h, 7d against
  comparable channel baselines. Early windows require scheduled timestamped snapshots for supported
  counters; delayed analytics are not presented as real-time data.
- Maintain a metric-to-API/scope/granularity/availability matrix before release, especially for CTR,
  returning viewers, revenue and retention. Display unavailable/stale/insufficient-data states;
  a value visible in YouTube Studio is not proof of API availability.
- **Video Health Score:** CTR, retention, engagement, topic demand, velocity → overall 0–100.
- **Retention Doctor:** detect the largest retention drop ("⚠️ Major drop at 00:43") and give a
  specific, plain-language fix ("start this section with the payoff").
- **Comment Intelligence:** classify comments into Questions, Praise, Complaints, Feature requests,
  Content requests, Negative feedback → "Top audience request: Tutorial."

**AC**
- [ ] Analyzer states which comparison window is being used (1h/6h/24h/48h/7d).
- [ ] Retention Doctor cites the available segment/time range and metric (e.g. retention fell X%);
  bucketed API observations are not presented as exact second-level measurements.
- [ ] Comment classification shows counts per category and example comments (anonymized).

### C14 — AI Growth Agent, Missions & Continuous Learning *(src: 29, 60, 61)*

**Requirements**
- **AI Growth Agent** (natural-language): "আমার channel grow করার জন্য আগামী 30 দিনের plan বানাও"
  → the orchestrator runs channel analysis → trends → competitors → opportunities → ideas →
  calendar → monitoring → strategy updates, and presents a plan with milestones.
- **Viral Mission:** "এই সপ্তাহে আমার channel-এর জন্য সবচেয়ে promising 3টা video বানাও" →
  Mission #1/#2/#3, each with a complete production package (research + idea + script + title +
  thumbnail + SEO + schedule).
- **Continuous Learning Loop:** TREND → IDEA → VIDEO → PUBLISH → ANALYTICS → AI LEARNS → BETTER
  RECOMMENDATION → NEXT VIDEO. Implemented as: outcomes feed back into Channel DNA, scoring
  weights, and recommendation priors. *(Gap G-12 — this is the moat; ensure it's instrumented.)*

**AC**
- [ ] Agent plans are generated as background jobs with progress + result summary.
- [ ] Each mission item links to a full production package (not just a list).
- [ ] Learning loop is observable: the app can show "this recommendation was influenced by your
  last 3 videos' outcomes."

### C15 — Localization, Monetization & Sponsorship *(src: 32, 33, 34)*

**Requirements**
- **Multi-language growth:** Bengali, English, Hindi, Arabic, Spanish, + others. AI performs
  *cultural + audience localization*, not just translation.
  - **Bengali** uses proper shaping/rendering; **Arabic** requires **RTL** layout. *(Gap G-09.)*
- **Monetization Intelligence:** subscriber progress, watch-hour progress, Shorts performance,
  revenue trends, RPM/CPM **where available** (YouTube Analytics API returns revenue metrics only
  for monetized channels with the right scope). Clearly state data availability.
- **Sponsorship Assistant** *(Phase 4):* media kit, creator profile, audience summary, sponsorship
  pitch, brand proposal. Must include disclosure guidance (FTC/local ad-disclosure rules).

**AC**
- [ ] All five languages render correctly (incl. RTL Arabic, Bengali shaping).
- [ ] Revenue metrics show "not available" state when the channel isn't monetized/authorized.
- [ ] Sponsorship templates include a disclosure reminder.

### C16 — Platform: Gateway, Knowledge, Voice, Policy, Search, Admin, Billing *(src: 35, 36, 37, 39, 44, 50, 51, 52, 53)*

**Requirements**
- **AI Knowledge Base:** user uploads brand guidelines, scripts, past videos, content notes,
  audience persona, product info; used as channel-specific context (with clear "delete" controls).
- **Brand Voice:** tone set (Professional/Funny/Emotional/Educational/Aggressive/Cinematic/Friendly)
  applied to all generated content.
- **Search & Research Workspace:** topic/competitor/question/keyword/trend research + content gap
  analysis; **every result keeps source/context** so claims are traceable. *(Gap G-13.)*
- **Policy & Risk Scanner** *(advisory only — §9):* misleading claims, spam-like metadata, copyright
  *concerns*, reused-content concerns, advertiser suitability, sensitive content, dangerous claims.
  Output: 🟢 Low / 🟡 Review / 🔴 High.
- **Admin Dashboard:** users (list, plan, usage, status), AI (token usage, cost, requests, errors,
  provider performance), system (API health, queue, DB, error logs), business (free/pro/premium,
  revenue, conversion). Access restricted to admin role; PII minimized.
- **Subscription & Credits** *(§7.14):* Phase 1 hard limits and usage accounting; paid plans/reports later.
- **AI Gateway** *(src: 44, §7.15):* OpenAI-compatible chat completions, default Hugging Face
  Inference Router, server-managed credentials/model registry, vision-capability gating, safe
  JSON/SSE responses, per-task cancellation and bounded rate-limit handling.

**AC**
- [ ] Knowledge-base documents are deletable and never leak across accounts.
- [ ] Research results render with source links/timestamps.
- [ ] Policy Scanner always displays "This is guidance, not legal advice."
- [ ] Admin is role-gated and audited.

---

### 7.14 Subscription & Credit System *(src: 51, 52)*

| Plan | Audience | Included (proposed) |
|---|---|---|
| **Free** | New creators | Limited trends/day, limited AI requests, basic analytics, monthly credit cap |
| **Creator** | P2 | Advanced trends, more AI generations, competitor analysis (1–3 channels), content calendar |
| **Pro** | P3 | AI Growth Agent, advanced analytics, Thumbnail AI, advanced competitor intelligence |
| **Agency** | P4 | Multiple channels, team members, white-label/reporting |

**Credit model (proposed, configurable):** Script 5 · Research 3 · Thumbnail 10 · Deep Analysis 15.
Daily/monthly **hard spending caps and transactional reservation/settlement are Phase 1 gates**
before enabling real inference. Concurrent tasks cannot overspend a shared balance. Missing usage
is unknown, not zero; failed/cancelled/ambiguous calls follow a disclosed reconciliation/refund
policy. Paid-plan upgrades may follow in Phase 3. *(Open question O-03; AI_GATEWAY §8.)*

---

### 7.15 AI Gateway System *(src: 44; Phase 1 foundation)*

**Requirements**
- Adopt an OpenAI-compatible `/chat/completions` transport, defaulting to the Hugging Face router.
  Feature services (ideas/scripts/titles/assistant) call the backend package, never provider APIs
  from the device. Image generation/embeddings/tool execution use later, separate adapters.
- Backend-only API keys from a secret manager. Custom base URLs and models are operator-approved,
  capability-validated and audited. Client preferences may store an enabled model alias and safe
  generation settings, not credentials or trusted system directives.
- Model selection respects user plan, feature, modality, context/output limits and approved provider
  processing terms. Reference model names do not guarantee current availability.
- Pack Channel DNA/Brand Voice/research as authorized context. Token-budget history by complete
  turns; bound attachment size/count; preserve the latest user request or return a context error.
- Support JSON and SSE modes with normalized events and nullable input/output/total usage. A
  truncated, malformed, cancelled or interrupted response is not a completed production package.
- Use provider-supported reasoning effort where available; never request or display private
  chain-of-thought. Provide concise explanations, evidence and uncertainty instead.
- Isolate cancellation per task, honor deadlines and valid Retry-After hints, and never replay an
  accepted/partial/ambiguous generation automatically. Model switching starts a new task.
- Moderate input/output and validate feature output schemas at the host service before exposing
  results. The transport package alone does not implement these trust gates.

**AC**
- [ ] No provider secret is present in client bundles, persisted client state, URLs or logs.
- [ ] Enabled model catalog is filtered by plan/feature; unsupported settings/images fail preflight.
- [ ] JSON and streaming generations retain model/provider attribution and known/unknown usage.
- [ ] Unicode, split SSE events, final frames, provider failures and partial output are covered by tests.
- [ ] Concurrent jobs have independent cancellation; reconnecting does not create duplicate calls.
- [ ] Usage reservation is atomic, retries are idempotent at the task boundary, and missing usage
  cannot bypass free-tier caps.
- [ ] API task reads/events/cancel and uploaded context/assets pass cross-tenant authorization tests.
- [ ] Streamed text passes the host moderation gate before display; full results pass schema checks.

**Implementation note:** the transport exists in `packages/ai-gateway`; `apps/api` now adds a
development task host with SQLite persistence, credit reservations, cancellation and event replay.
`apps/mobile` adds the universal client and browser-tested creator workflow. Production moderation,
verified accounts, distributed workers, exact cost reconciliation and external integrations remain gates.
See [`AI_GATEWAY.md`](./AI_GATEWAY.md) for exact contracts and remaining release gates.

---

## 8. Gap Analysis & Validation Findings

These are material gaps, contradictions and risks with adopted design responses. An adopted
response is not evidence that the implementation or an external approval is complete.

| ID | Type | Finding | Recommendation (adopted) |
|---|---|---|---|
| G-01 | Gap | **No onboarding / first-run flow.** Channel connect appears in Phase 1 but there's no guided setup (niche selection, goals, language, brand voice). | Add a 3-step onboarding: niche + goals → language/voice → connect YouTube (optional, skippable). Cold-start defaults fill the rest. |
| G-02 | Gap | **Empty/error/loading states** not specified for a data-heavy app. | Define skeleton loading, empty states ("connect channel", "no trends yet"), and offline/error banners as a UX standard (§10). |
| G-03 | Contradiction | §7 "one place" strategy vs §50 admin + §54 "not a website" — IA ambiguity between bottom-nav and Create Hub. | Reconciled: 5 bottom tabs + Create Hub fan-out (R-01, §6). |
| G-04 | Risk | **Trend data source undefined.** "Trend Sources" are mentioned but never specified; scraping YouTube is a ToS violation. | Use only official/authorized sources: Google Trends API (unofficial endpoints flagged), YouTube Data API `search.list` (own quota bucket), public RSS/news, and licensed third-party trend APIs. Never scrape. *(§TECHNICAL_ARCHITECTURE §8.)* |
| G-05 | Risk | **Publishing scope under-specified.** YouTube Data API `videos.insert` allows upload but quota-limited; Shorts classification is YouTube's. | Publish only via official `videos.insert`; label as "upload as Short"; obtain required capacity before exceeding the project allocation; treat publish as opt-in scope (C2). |
| G-06 | Contradiction | §20 hedges A/B correctly but could still read as "app runs experiments." | Hard rule added: app never runs YouTube experiments; it estimates and directs users to YouTube **Test & Compare** (native thumbnail/title A/B, up to 3 variants, long-form only, requires Advanced Features). |
| G-07 | Gap | **Cold start** for Analyzer/DNA/Audience with zero channel history. | Niche-benchmark defaults + "needs more data" label; DNA versioned with data volume used. |
| G-08 | Gap | **Time zones** for calendar/publish windows and daily-brief delivery. | Store creator timezone; all windows are local-time suggestions. |
| G-09 | Gap | **RTL + shaping** for Arabic/Bengali not addressed. | Explicit RTL layout and Bengali font-shaping requirements (C15). |
| G-10 | Gap | **Notification controls** missing (alert fatigue risk with 8 alert types). | Per-type toggles + quiet hours + delivery time (C3). |
| G-11 | Gap | **OAuth scope granularity** not defined. | Least-privilege, incremental scopes with plain-language consent (C2). |
| G-12 | Gap | **Continuous learning loop** is named but not instrumented. | Outcome → DNA/weights feedback with observability ("why" on recommendations) (C14). |
| G-13 | Gap | **Source/context traceability** for research & trend claims. | Every research result keeps source + timestamp (C16). |
| G-14 | Risk | **Revenue/RPM/CPM** availability not qualified. | Clarify these come only from YouTube Analytics API for monetized channels with scope; show "not available" otherwise (C15). |
| G-15 | Risk | **"Islamic content"** category naming/sensitivity. | Treat as a content category with moderation guardrails, not a religious determination (§9.6). |
| G-16 | Gap | **Retention/abandon granularity** limits not stated. | Note YouTube analytics retention is bucketed; Doctor works at the granularity the API provides. |
| G-17 | Gap | **Accessibility** (screen reader, contrast, target sizes) not specified. | Add WCAG-aligned mobile accessibility requirements (§10). |
| G-18 | Gap | **Observability** (crash reporting, analytics SDK, logging) absent. | Add client crash reporting + backend metrics/alerting (§TECHNICAL_ARCHITECTURE §11). |
| G-19 | Gap | **Data retention & deletion** (GDPR/CCPA) not specified. | Define retention policy + account deletion + data export (§9.3). |
| G-20 | Gap | **Offline behavior** undefined. | Read-only cached views + graceful degradation; writes require connectivity. |
| G-21 | Release gate | Custom scores and retained analytics need policy permission. | Obtain applicable YouTube derived-metric approval; enforce data-class retention (§9.2–9.3). |
| G-22 | Dependency | Cache, queues and spend controls were scheduled after their consumers. | Move basic gateway/cache/workers/credits to Phase 1; keep advanced agents and paid subscriptions later. |
| G-23 | Capacity | Hourly niche searches can exceed the separate search allowance. | Licensed-source decision plus per-bucket sampling budget before Trend Radar launch. |
| G-24 | Feasibility | Early analytics windows and exact retention timestamps were over-specified. | Validate metric availability; timestamp supported snapshots; disclose freshness and bucket granularity. |
| G-25 | Security | Browser-style gateway would expose secrets and arbitrary upstream routing. | Backend-only credentials, trusted URL/model registry, tenant authorization and egress controls (§7.15). |
| G-26 | Reliability | Partial SSE, cancellation and missing usage could be treated as successful/free work. | Explicit terminal states, bounded retries, nullable usage and transactional budget reconciliation. |

---

## 9. Legal, Policy & Compliance Requirements

> These are product requirements, not legal advice. Final wording should be reviewed by counsel.

### 9.1 Honest-marketing baseline (non-negotiable)
- The product never claims it can make content go viral, guarantee rankings, or guarantee any
  subscriber/revenue outcome.
- "Viral Opportunity Score," "Viral Mission," and "Viral Score Engine" are **score labels**, and
  every surface carrying them shows "prediction/estimate, not a guarantee."
- SEO guidance always includes: keywords help discovery but don't guarantee placement.

### 9.2 YouTube API compliance
- Use **only** official YouTube Data API v3 / YouTube Analytics API / YouTube Reporting API.
- Comply with the **YouTube API Services Terms of Service**: no scraping, no bypassing, proper
  Google/YouTube branding on any third-party screens, and correct attribution.
- Respect separate daily buckets: default 100 searches, 100 uploads and 10,000 units for other
  endpoints combined. Verify the project's actual limits and budget discovery, pagination and sync.
  Apply for necessary extensions before exceeding capacity, not after traffic is blocked.
- Request only scopes needed per feature and per user action.
- **Derived-metric approval:** YouTube's additional analytics policies apply only to audited
  developers whose relevant use case/permission has been accepted. Complete that process before
  enabling API-derived scores or extended statistical storage. Until then, restrict functionality
  to uses/data retention permitted by the base policies; no workaround through AI-generated labels.
  Official policy references are in §15.

### 9.3 Privacy & data protection (GDPR/CCPA alignment)
- Clear consent for competitor tracking and channel-data processing.
- Export/delete controls must cover channel data, prompts, reports, embeddings, object storage and
  caches. Disconnect/deletion immediately stops new processing and revokes access. Define and test
  purge deadlines (including backup handling) before launch; an active account is not a retention exemption.
- **API data retention:** titles, descriptions, names and comment text remain subject to the
  applicable 30-day refresh/deletion policy. For an accepted additional-analytics use case, eligible
  statistics and derived metrics may be retained for at most 36 calendar months; choose shorter
  product windows where possible. Without acceptance, apply the base developer policies.
- Derived Channel DNA, prompts, embeddings and reports containing API data inherit its applicable
  deletion/refresh obligations. Propagate source deletion and authorization revocation; do not retain
  copied data indefinitely in an AI artifact or training dataset.
- Minimal PII in admin dashboards and logs; API tokens never logged.

### 9.4 OAuth token security (hard requirement)
- YouTube refresh tokens are encrypted in the backend vault; YouTube access tokens stay in backend
  memory. AI provider keys are backend-only. TubePilot app-session credentials use platform secure
  storage as required by the selected auth flow. "Log out all devices" revokes server-side sessions.
- Do not send YouTube OAuth tokens, AI keys, unneeded PII or unauthorized channel data to a model.

### 9.5 Advertising & disclosure
- Sponsorship Assistant output must include sponsorship-disclosure guidance (FTC and local ad
  rules) — it helps creators comply, it doesn't comply for them.
- Monetization estimates are labeled as estimates; not financial advice.

### 9.6 Content categories & moderation
- "Islamic content" (and any religion/culture-adjacent category) is handled as a content category
  with neutral wording and moderation guardrails; the app does not make religious determinations.
- Policy & Risk Scanner is explicitly **advisory** ("guidance, not legal advice"); it flags
  *concerns* (e.g., potential copyright issues) but does not detect infringement or guarantee
  policy compliance.

### 9.7 Age-appropriateness
- If a video is made-for-kids, the app must pass through the correct audience flag and remind the
  creator that YouTube's Test & Compare and some analytics are unavailable for such content.

---

## 10. Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | Dashboard first paint ≤ 2s on mid-range device; AI streaming responses show partial output; trend list loads from cache ≤ 500ms |
| Scalability | Backend stateless services behind gateway; queue workers horizontally scalable; cache-first reads |
| Reliability | Capability-checked model switching; bounded pre-response retries; no replay of accepted/partial/ambiguous work; deadlines, cancellation and cached-read degradation. Automated consent-aware failover is later scope. |
| Security | See §9; encrypted tokens; rate limiting; role-based access; secrets in a vault |
| Observability | Client crash reporting; structured logs; per-provider AI cost/latency/error metrics; queue depth & failure alerts |
| Accessibility | WCAG 2.1 AA-aligned mobile: ≥44dp touch targets, contrast, screen-reader labels, RTL support |
| Localization | All 5 languages incl. Bengali shaping + Arabic RTL; locale detection + manual override |
| Offline | Cached read-only views; explicit "you're offline" state; no silent write failures |
| Privacy | PII minimization, consent surfaces, export/delete, retention policy |

---

## 11. Success Metrics (KPIs)

| KPI | Target (proposed) | Notes |
|---|---|---|
| Activation | ≥ 40% of signups complete channel connect or niche onboarding | Cold-start friendly |
| One-Tap Workflow completion | ≥ 60% of starts reach "READY TO CREATE" | Core loop health |
| Daily brief actionability | ≥ 60% of items open a specific action | G2 |
| 7-day retention | ≥ 25% | Proxy for continuous value |
| AI cost per free user | Hard-capped, monitor $/MAU | Credit system |
| Publishing adoption (Phase 2+) | % of plans that lead to an upload | Requires publish scope |
| Learning-loop lift | Uplift in DNA-based recommendation engagement vs generic | Instrumented (G-12) |

---

## 12. Development Roadmap

**Phase 1 — MVP + safe infrastructure foundation**
Auth (42) · YouTube connect (43) · Dashboard (2) · Channel analyzer (7) · Trend radar (3,4) ·
Approved opportunity score (5) · Idea generator (12) · Script generator (14) · Title generator (16) ·
Basic analytics (25-lite) · Saved generation drafts (38-lite) · **OpenAI-compatible gateway (44),
cache (48), basic workers (49), hard budget/credit enforcement (52)**.
*Exit: a creator can connect (or use niche onboarding), analyze available evidence, generate and save
an idea + script + title; API-source/derived-metric permissions and inference spend gates are met.*

**Phase 2 — Growth Engine**
Competitors (10) · Content gaps (11) · Shorts Studio (21,22) · Thumbnail Lab (18) · SEO (17) ·
Content calendar (23,24) · Comment intelligence (28) · Alerts (31) · AI recommendations (41) ·
Full workspace/One-Tap Workflow (38,59) with deterministic orchestration (45 foundation).

**Phase 3 — AI Agent**
Advanced orchestrator (45) · Growth Agent (29) · Daily brief (30) · Autonomous analysis/scheduled jobs
(49 extension) · Consent-aware multi-provider routing/failover (44 extension) · Reports (53) ·
Paid subscriptions/credit upgrades (51,52 extension). Basic gateway/queues/spend caps are not deferred here.

**Phase 4 — Advanced**
Thumbnail generation (19) · Advanced A/B insights (20) · Multi-language (32) · Sponsorship
assistant (34) · Agency mode (51-Agency) · Advanced missions (60) · Continuous learning (61).

---

## 13. Open Questions & Decisions Needed

| ID | Question | Owner | Blocking? |
|---|---|---|---|
| O-01 | Exact pricing per plan (Free/Creator/Pro/Agency) | Business | No (stub config) |
| O-02 | Default text router: Hugging Face. Which verified model IDs, capabilities, prices and processing terms may be enabled? Image/embedding adapters later. | Eng/Biz | Before real text inference; later adapters by feature phase |
| O-03 | Free-tier hard caps, price ceilings, reservation/refund and unknown-usage policy | Product/Eng | Before real inference (Phase 1) |
| O-04 | Licensed trend-data source(s) and budget | Biz | Phase 1 dependency |
| O-05 | YouTube per-bucket traffic budget and quota-extension timing | Eng | Before traffic exceeds approved allocation |
| O-06 | App store compliance review (Google Play) timing | Eng/Legal | Before release |
| O-07 | Report export formats (PDF) — in-app vs email | Product | Phase 3 |
| O-08 | "Agency" multi-channel UX specifics | Product | Phase 4 |
| O-09 | YouTube analytics-use-case/derived-metric approval and retention schedule | Eng/Legal | Before affected scores/storage are enabled |
| O-10 | Verified metric/API/scope/freshness matrix and licensed cold-start benchmarks | Eng/Product | Phase 1 evidence features |
| O-11 | App auth choice, tenant ownership, moderation and AI task/ledger persistence | Eng | Before exposing the gateway to users |

---

## 14. Appendix A — Feature ID Map

| Source § | Feature | Capability | Phase |
|---|---|---|---|
| 1 | Product vision | — | — |
| 2 | Main Dashboard | C3 | 1 |
| 3 | Trend Radar | C4 | 1 |
| 4 | Trend Velocity Engine | C4 | 1 |
| 5 | Viral Opportunity Engine | C5 | 1 |
| 6 | Personalized Trend Matching | C4 | 1 |
| 7 | Channel Analyzer | C6 | 1 |
| 8 | Channel DNA | C6 | 1 |
| 9 | Audience Intelligence | C6 | 1 |
| 10 | Competitor Intelligence | C7 | 2 |
| 11 | Content Gap Finder | C7 | 2 |
| 12 | AI Idea Studio | C8 | 1 |
| 13 | Idea Remix Engine | C8 | 1 |
| 14 | AI Script Studio | C9 | 1 |
| 15 | Hook Generator | C9 | 1 |
| 16 | Title Lab | C10 | 1 |
| 17 | SEO Studio | C10 | 2 |
| 18 | Thumbnail Lab | C10 | 2 |
| 19 | Thumbnail Generator | C10 | 4 |
| 20 | Packaging A/B Lab | C10 | 4 |
| 21 | Shorts Studio | C11 | 2 |
| 22 | Shorts-to-Long Converter | C11 | 2 |
| 23 | AI Content Calendar | C12 | 2 |
| 24 | Publishing Planner | C12 | 2 |
| 25 | Post-Publish Analyzer | C13 | 1 basic / 2 advanced |
| 26 | Video Health Score | C13 | 2 |
| 27 | Retention Doctor | C13 | 2 |
| 28 | Comment Intelligence | C13 | 2 |
| 29 | AI Growth Agent | C14 | 3 |
| 30 | Autonomous Daily Brief | C3 | 3 |
| 31 | Smart Alerts | C3 | 2 |
| 32 | Multi-Language Growth | C15 | 4 |
| 33 | Monetization Intelligence | C15 | 2 |
| 34 | Sponsorship Assistant | C15 | 4 |
| 35 | Policy & Risk Scanner | C16 | 2 |
| 36 | AI Knowledge Base | C16 | 2 |
| 37 | Brand Voice | C16 | 1 |
| 38 | Content Workspace | C12 | 1 saved drafts / 2 full |
| 39 | Search & Research Workspace | C16 | 2 |
| 40 | Viral Score Engine | C5 | 1 |
| 41 | Recommendation Engine | C14 | 2 |
| 42 | Account & Security | C1 | 1 |
| 43 | YouTube Integration | C2 | 1 |
| 44 | AI Provider Architecture | C16 | 1 gateway / 3 advanced routing |
| 45 | AI Agent Architecture | C14 | 2 workflow / 3 autonomous |
| 46 | Backend Architecture | — | 1 |
| 47 | Database Architecture | — | 1 |
| 48 | Cache Layer | — | 1 |
| 49 | Background Job System | — | 1 basic / 3 autonomous |
| 50 | Admin Dashboard | C16 | 3 |
| 51 | Subscription System | C16 | 3 |
| 52 | Usage & Credit System | C16 | 1 enforcement / 3 paid upgrades |
| 53 | Reports | C16 | 3 |
| 54 | Native Android UX | — | 1 |
| 55 | Design System | — | 1 |
| 56 | Theme System | — | 1 |
| 57 | Main Navigation | — | 1 |
| 58 | Create Hub | — | 1 |
| 59 | One-Tap Viral Workflow | C12 | 2 |
| 60 | Viral Mission | C14 | 4 |
| 61 | Continuous Learning Loop | C14 | 4 |
| 62 | Roadmap | — | — |


---

## 15. Official API/policy references

Recheck these sources and the actual project/model configuration at implementation and release;
external permission and API availability are not established by this PRD.

- [YouTube quota allocation and compliance audits](https://developers.google.com/youtube/v3/guides/quota_and_compliance_audits)
- [YouTube derived metrics and data storage](https://developers.google.com/youtube/terms/derived-metrics-policy)
- [YouTube developer-policy compliance guide](https://developers.google.com/youtube/terms/developer-policies-guide)
- [YouTube Analytics report queries and availability](https://developers.google.com/youtube/analytics/reference/reports/query)
- [YouTube Analytics metric definitions and retention segments](https://developers.google.com/youtube/analytics/metrics)
- [Current three-minute Shorts eligibility](https://support.google.com/youtube/answer/15424877?hl=en)
- [Hugging Face OpenAI-compatible chat completion](https://huggingface.co/docs/inference-providers/tasks/chat-completion)

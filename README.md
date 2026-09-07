# TubePilot AI

An AI-powered YouTube Growth Studio for creators — **Discover → Research → Plan → Create →
Optimize → Publish → Analyze → Improve**.

> "Right topic, right audience, right packaging, right timing."
> TubePilot AI never promises virality or rankings. Predictions are estimates with evidence,
> uncertainty and appropriate API permissions—not guarantees.

## Current status

**Implemented:** a server-only TypeScript AI gateway foundation with an OpenAI-compatible Chat
Completions transport, defaulting to **Hugging Face Inference Router**.

- Configured providers, validated model registry and custom model IDs.
- Text/vision payloads, token-budgeted context and capability-aware settings.
- JSON completions and incremental SSE, including split Unicode and usage-only events.
- Independent cancellation/deadlines, bounded rate-limit retries and safe typed errors.
- Provider token usage with explicit unknown values; no client-side API-key storage.
- Strict TypeScript checks, mocked-provider tests and GitHub Actions CI.

**Not implemented yet:** the Expo app, NestJS endpoints, persistent tasks/BullMQ workers, database,
credit ledger, moderation pipeline, YouTube integration and deployment. Reference models are disabled
until their availability, capabilities, processing terms and pricing are verified. No paid inference
calls are made by the tests.

## Local development

Requires **Node.js 22+** and npm.

```sh
npm ci
npm run check       # TypeScript + build + mocked gateway tests
npm run build       # Compile workspace packages
```

No provider credentials, database or app server are needed for these checks. Never commit API keys
or put them in client storage. The host application will resolve provider secrets server-side.

## Documentation

| Doc | Description |
|---|---|
| [`docs/AI_GATEWAY.md`](docs/AI_GATEWAY.md) | Adopted gateway system, refinements, implemented API, integration example, security and remaining release gates. |
| [`docs/PRD.md`](docs/PRD.md) | Product requirements for the 62 source features, acceptance criteria, revised phases and open decisions. |
| [`docs/TECHNICAL_ARCHITECTURE.md`](docs/TECHNICAL_ARCHITECTURE.md) | Target React Native/NestJS architecture, gateway integration, data model, queues, billing and deployment. |
| [`packages/ai-gateway`](packages/ai-gateway/) | Implemented server-only transport package and tests. |

## Roadmap

1. **Phase 1 — MVP + foundations:** auth, YouTube connect, dashboard, available channel analytics,
   licensed trends/approved scores, idea/script/title generation and saved drafts. Basic gateway,
   cache, workers and hard AI spending controls belong in this phase.
2. **Phase 2 — Growth Engine:** competitors, content gaps, Shorts Studio, Thumbnail Lab, SEO,
   calendar, comment intelligence, alerts and deterministic One-Tap Workflow orchestration.
3. **Phase 3 — AI Agent:** Growth Agent, daily brief, autonomous schedules, advanced consent-aware
   provider routing, reports and paid subscription/credit upgrades.
4. **Phase 4 — Advanced:** image generation, A/B insights, multi-language growth, sponsorship,
   agency mode, missions and continuous learning.

YouTube-derived metrics, retention, actual API availability and per-bucket quota capacity are explicit
release gates. A specification or an AI-generated disclaimer does not establish external approval.

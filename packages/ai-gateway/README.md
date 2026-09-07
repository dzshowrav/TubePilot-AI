# @tubepilot/ai-gateway

Server-only Node.js 22+ / TypeScript foundation for TubePilot AI. No runtime npm dependencies.

The adapter uses OpenAI-compatible `/chat/completions`, with Hugging Face Inference Router as the
default. It implements model/capability validation, bounded text/vision context, JSON/SSE responses,
usage counters, safe errors, cancellation and narrow pre-response retries.

```sh
# From the repository root:
npm ci
npm run check
```

## Public API

- `AiGateway.chat(request, options)` → `Promise<ChatResult>`
- `AiGateway.stream(request, options)` → async `start | delta | usage | complete` events
- `ModelRegistry.register/get/list` and disabled `REFERENCE_MODELS`
- `buildGatewayPayload`, `normalizeBaseUrl`, `encodeSseEvent`
- `GatewayError`, `formatGatewayError`, `parseRetryAfter`
- Shared request/result/configuration types

All failures use typed, sanitized errors. `usage: null` means unknown, not zero. A `complete` event
with `finishReason: 'length'` is truncated output, not a complete production package. Accepted/partial
responses and ambiguous transport failures are never automatically replayed.

**Not a public API server or complete security/billing solution.** The host must implement auth,
tenant ownership, secret/egress policy, real model verification, image decoding, moderation,
transactional credits, persistent tasks/events and distributed cancellation before live user access.
The package does not implement image generation, embeddings, tool execution or automated failover.

See the [complete gateway design and integration example](../../docs/AI_GATEWAY.md).

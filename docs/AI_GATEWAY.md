# TubePilot AI — AI Gateway System

**Version:** 1.2 · **Date:** 2026-09-08

**Decision:** Adopt the supplied OpenAI-compatible gateway design, refined for a multi-tenant,
backend-first creator product. Hugging Face Inference Router is the default upstream:
`https://router.huggingface.co/v1/chat/completions`.

## 1. Implementation status

**Milestone 0.2 update:** a universal client and NestJS development host now integrate this transport.
The host has SQLite task/event persistence, ownership checks, cancellation, a credit-reservation
ledger and an explicitly enabled development provider adapter. Default generation is template-based.
This does **not** complete the production requirements in this document. See
[`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) for the runnable app and exact gaps.

**Milestone 0.3 boundary:** the read-only YouTube connector keeps its token vault and API snapshots
separate from this gateway. It does not automatically copy YouTube data into prompts, embeddings,
brand context or scoring. See [`YOUTUBE_INTEGRATION.md`](./YOUTUBE_INTEGRATION.md) for current behavior.

| Available in this repository | Still required before a production launch |
|---|---|
| Server-only TypeScript package: [`@tubepilot/ai-gateway`](../packages/ai-gateway/) | Production verification of the new NestJS/Expo host; separate BullMQ workers |
| Configured providers, model registry and capability validation | Admin authorization, persistent registry, model health/availability probes |
| Text and inline raster-image chat payloads | Tenant-authorized asset storage, full image decoding/resizing, malware/content checks |
| JSON completions and normalized streaming events | Production streaming moderation; authenticated persisted task/events are now implemented in the dev host |
| Per-generation cancellation, deadlines, bounded retries | Distributed cancellation, admission limits and provider circuit breakers |
| Provider usage counters, typed safe errors, mocked tests | Actual provider-price/usage reconciliation; a conservative reservation ledger exists in the dev host |

This is a **transport foundation**, not a deployed AI service. It does not grant access to YouTube
metrics, implement billing, guarantee model availability, or make model output trustworthy by itself.
Image **analysis** is supported for configured vision models; image **generation**, embeddings,
function/tool execution and provider-specific structured-output APIs are separate future adapters.

## 2. Refinements to the supplied system

| Supplied behavior | TubePilot decision |
|---|---|
| API key and base URL in `localStorage` | API keys resolved from the backend secret manager; operator-approved URLs only. Never ship a provider key in Expo/browser bundles, AsyncStorage, URLs, telemetry or chat. |
| One mutable `gatewayConfig`, controller and `isGenerating` | Immutable provider/model snapshots; independent controller/deadline for each generation. UI generation state is per task. |
| User-supplied base URL | Trusted operator configuration with exact HTTPS-origin allowlisting, no credentials/query/fragment/private IP literals, and no redirects. Deployment also enforces DNS/egress restrictions. |
| Static models described as “latest” | Explicit, versioned model IDs and verified capability/limit/pricing configuration. Reference IDs are disabled until verified. |
| Ten-message sliding window | Token-budgeted packing: reserve output + framing headroom; drop complete old turns; preserve system instructions, authorized evidence and latest user input. |
| Force `<think>` chain-of-thought output | Optional supported `reasoning_effort` only. Ask for conclusions/evidence, not private reasoning. Ignore separate reasoning fields; filter standard inline thinking tags across chunk boundaries. |
| Any image `dataUrl` | PNG/JPEG/WebP only, bounded sizes/counts, base64 and signature checks; full asset validation remains a host responsibility. No arbitrary remote URL fetches. |
| Split on newlines and ignore JSON failures | Incremental UTF-8/SSE framing, CRLF/LF/CR support, multiline events, final-buffer handling, explicit protocol errors and terminal-event checks. |
| Completion tokens only, defaulting to zero | Input/output/total counters from the provider. Missing counters are `null`, never “free usage.” |
| Every quota error is model-specific and temporary | Distinguish rate limits, exhausted account quota, auth, context, network, timeout, refusal and protocol failures. Retry hints are not recovery promises. |
| Global stop-generation function | Abort one generation without touching concurrent work; cancellation does not promise zero upstream cost. |

## 3. Trust boundary and configuration

```text
Expo client (TubePilot session, selected catalog model, user input, asset IDs)
  → NestJS API: authenticate → authorize project/assets/model → validate → reserve budget
  → persisted task → BullMQ worker: load authorized evidence + trusted feature instructions
  → @tubepilot/ai-gateway: prepare payload → resolve provider secret → chat/completions
  → normalize response → host moderation/schema checks → persist → authorized event subscribers
```

### Secrets and URLs

- `ProviderConfig.getApiKey()` resolves a rotated secret **at dispatch time**. Production uses a
  vault/KMS-backed secret service. An untracked local environment variable is acceptable for local
  development; the library does not read environment variables or browser storage itself.
- Default base URL: `https://router.huggingface.co/v1`. Custom OpenAI-compatible providers can use
  paths such as `/v1` or `/openai/v1`, but must have an exact origin in server-owned `allowedOrigins`.
- The HTTP/queue DTO must **not** accept `baseUrl`, `allowedOrigins`, `apiKey`, `getApiKey`, or arbitrary
  task/system instructions from the client. Never construct provider configuration from an AI output.
- URL validation is **not complete SSRF protection on its own**. Deploy an egress proxy/firewall
  that rejects private/link-local/reserved IPv4/IPv6 destinations after DNS resolution, handles DNS
  rebinding, and limits access to approved provider destinations. Automatic HTTP redirects are disabled.
- Hugging Face can route to downstream inference providers. Verify the selected model/provider suffix,
  data-processing terms, region, retention and consent; host allowlisting alone does not establish
  downstream data residency. End-user bring-your-own-key/base-URL configuration is out of MVP scope.

### Model registry

`ModelRegistry.register()` is an **internal** operation, not a public unauthenticated endpoint.
The host persists/audits changes and constructs a fresh registry snapshot for configuration updates.
Duplicates are rejected. `list()` returns enabled records without secrets or endpoint URLs; the API
must additionally filter that list by user plan, feature and provider-processing permissions.

Each `ModelDefinition` requires a public alias, provider ID, exact upstream model ID, display name,
category, enabled flag, context/output limits and capabilities:

- `streaming`, `streamUsage`, `vision`;
- supported sampling parameters;
- supported reasoning efforts (`low`, `medium`, `high`, when verified);
- `max_tokens` versus `max_completion_tokens`;
- a verified input-token budget per preprocessed low-detail image for vision models.

The supplied models are retained as **disabled reference configurations**, not availability claims:

| Public alias | Exact upstream ID |
|---|---|
| `deepseek-r1-0528` | `deepseek-ai/DeepSeek-R1-0528` |
| `deepseek-v3-0324` | `deepseek-ai/DeepSeek-V3-0324` |
| `qwen-2-5-72b` | `Qwen/Qwen2.5-72B-Instruct` |
| `llama-3-3-70b` | `meta-llama/Llama-3.3-70B-Instruct` |
| `minimax-m2-5-novita` | `MiniMaxAI/MiniMax-M2.5:novita` |

Their 4,096/1,024 token limits are conservative **placeholders**; sampling/vision/reasoning support
must be verified rather than inferred from a name. None is automatically enabled. Activation requires
a successful operator-controlled probe and approved token pricing/limits. Probes are not run in CI.

## 4. Payload and context contract

- `ChatRequest.messages` contains alternating `user`/`assistant` messages, beginning and ending with
  a user message. System/tool roles supplied through history are rejected. Incomplete assistant
  drafts from cancelled tasks are excluded by the application unless the user explicitly edits them
  into a new request.
- A fixed TubePilot system instruction prohibits product-level guarantees and asks the model to use
  supplied evidence. `instructions` is trusted application-owned feature guidance, **not** a client
  prompt override. Prompts are defense in depth, not authorization or factual verification.
- Authorized Channel DNA, Brand Voice, research citations and other evidence go in `context` as
  reference **data**, with `id`, `source`, `updatedAt`, and `text`. The host resolves these from the
  authenticated project; it never trusts a user-supplied channel ID without an ownership check.
- Token packing reserves the requested output limit plus 128 tokens of headroom, with per-message
  framing allowance. The default text estimator uses UTF-8 byte length, intentionally conservative
  for common tokenizers, including Bengali/Arabic input. Inject the selected model's tokenizer for
  accurate accounting; the estimate is **not** a billing metric or a universal tokenizer guarantee.
- Old user/assistant pairs can be removed. The system instruction, context documents and latest
  user input cannot be silently truncated. If those do not fit, return `CONTEXT_LIMIT`. Report
  `trimmedMessages` so the UI can say earlier context was omitted.
- Hard request limits: 101 history messages, 256 KiB combined text, 4 images, 5 MiB per image and
  10 MiB combined image bytes. Apply a matching ingress body limit before JSON parsing as well.
- The host loads assets by tenant-authorized ID, fully decodes/re-encodes them, strips metadata,
  bounds dimensions and scans them before building data URLs. Package signature checks do not
  detect decompression bombs or replace image decoding. Vision payloads request `detail: low`;
  enable only providers whose behavior/token bounds have been verified.
- Defaults are temperature 0.7, top-p 0.95 and zero penalties **only where supported**. Explicit
  unsupported settings fail before dispatch. Output tokens default to `min(1024, model maximum)`.
  `chat()` always sends `stream: false`; `stream()` always sends `stream: true`.

## 5. Runtime use

Run the local checks without provider credentials or external inference calls:

```sh
npm ci
npm run check
```

Integration example (server-side TypeScript; `verifiedModel` and `secretStore` are application-owned):

```ts
import {
  AiGateway, ModelRegistry, GatewayError, formatGatewayError,
  type ModelDefinition,
} from '@tubepilot/ai-gateway';

function createCreatorGateway(
  verifiedModel: ModelDefinition,
  secretStore: { read(name: string): Promise<string> },
) {
  // verifiedModel.providerId must be 'huggingface' for this one-provider example.
  return new AiGateway({
    providers: [{
      id: 'huggingface',
      getApiKey: () => secretStore.read('tubepilot/huggingface/inference-token'),
    }],
    models: new ModelRegistry([verifiedModel]),
    retry: { maxRetries: 1, baseDelayMs: 500, maxDelayMs: 10_000 },
  });
}

async function generateIdea(gateway: AiGateway, enabledModelId: string) {
  const controller = new AbortController(); // owned by this request/task, not global state
  try {
    for await (const event of gateway.stream({
      modelId: enabledModelId,
      instructions: 'Produce three actionable tutorial ideas. Cite the supplied evidence.',
      context: [{
        id: 'brand-voice-v1', source: 'Creator-approved Brand Voice',
        updatedAt: '2026-09-08', text: 'Friendly, educational, Bengali language.',
      }],
      messages: [{ role: 'user', content: 'আমার AI tools channel-এর জন্য ৩টি আইডিয়া দাও।' }],
    }, { signal: controller.signal, timeoutMs: 90_000 })) {
      // Pass to the host's moderation, task persistence and authorized delivery pipeline.
      // event.type: start | delta | usage | complete
      // A complete event with finishReason === 'length' is still truncated content.
      void event;
    }
  } catch (error) {
    if (error instanceof GatewayError) {
      // Persist only safe metadata: code, status, attempts, partial, retryAfterMs.
      // Do not mark failed/cancelled/partial output as a completed publish package.
      return { error: formatGatewayError(error) };
    }
    throw error;
  }
}
```

Use `gateway.chat(request, options)` for JSON/non-streaming completion with the same validation.
The returned `ChatResult` includes content, selected model/provider aliases, finish reason, context
packing metadata, attempt count and nullable provider usage. Switching models selects a different
registered alias **for a new task**; an existing task keeps its model/configuration snapshot.

## 6. Streaming and error behavior

### Library contract (implemented)

- Stream events: `start`, `delta`, `usage`, `complete`. Errors throw `GatewayError`; no success event
  follows a malformed/incomplete stream. `encodeSseEvent(event, sequence)` serializes normalized
  events for the host's delivery layer; it is not an HTTP endpoint or replay store.
- SSE framing tolerates byte splits inside UTF-8 characters, split CRLF, multiline `data:` fields,
  comments, usage-only events and a final complete event without its blank-line delimiter.
- `[DONE]` stops reading; a valid finish reason is also required. EOF without `[DONE]` is accepted
  only after a valid finish reason. Early EOF, invalid JSON, invalid UTF-8 and upstream error frames
  fail explicitly. An accepted 200 response is never replayed automatically.
- Limits: 256 KiB event/line buffer, 8 MiB total SSE transport bytes, 2 MiB accumulated final text,
  4 MiB JSON response and 64 KiB inspected HTTP-error text. Errors never expose raw upstream text.
- Separate `reasoning`, `reasoning_content`, and `reasoning_details` fields are not consumed. Standard
  inline `<think>`/`<analysis>` sections are suppressed across chunks; unterminated sections fail
  closed. Other provider-specific encodings need adapter/conformance tests before model activation.
  This filter is **not** a general content moderator or a guarantee about an arbitrary model.
- `finishReason` is `stop`, `length` or `content_filter`. Refusals are typed errors. Function/tool
  completions are rejected rather than silently treated as empty successful answers.
- Default deadline: 90 seconds; configurable 1–300,000 ms. It includes secret resolution, fetch,
  backoff and body consumption. Breaking out of the async iterator cancels that direct call.

### Retry rules (implemented)

| Failure | Automatic action |
|---|---|
| Explicit HTTP 429 rate limit or 503, before accepting a response | At most one retry by default (configurable 0–2), exponential backoff with jitter |
| `Retry-After` seconds or HTTP date | Honor it; if it exceeds the retry window, return the hint instead of retrying early |
| Exhausted account quota/billing, 400 context/input, 401/403, disabled/unknown model | No retry; safe actionable error |
| Network ambiguity, timeout, 408, other 5xx, invalid JSON/SSE, accepted response or partial output | No automatic replay; it may already have incurred cost |
| User cancellation or deadline while waiting | Abort immediately; no fallback or completion event |

There is **no automatic cross-provider failover** in this package. Manual model switching is supported.
Future failover must preserve capabilities, budget, data-processing consent and actual model attribution;
it must not splice two models' answers or charge the user twice for the same idempotent task.

## 7. NestJS/worker integration contract (production target; task endpoints implemented in dev host)

| Method / route | Contract |
|---|---|
| `GET /v1/ai/models` | Enabled catalog filtered by plan, feature and provider permissions; no secrets |
| `POST /v1/ai/tasks` | Auth + ownership + input validation + budget reservation; `Idempotency-Key`; return 202 + task ID |
| `GET /v1/ai/tasks/:id` | Owner-authorized status/result; support polling when SSE is unavailable |
| `GET /v1/ai/tasks/:id/events` | Owner-authorized SSE subscription with monotonic event IDs and bounded replay |
| `POST /v1/ai/tasks/:id/cancel` | Idempotent owner-authorized cancellation propagated to the worker |
| Admin-only provider/model configuration | Vault secret references, capability probes, validation and audited updates |

The current host exposes `/api/v1/ai/tasks`, task status/history/events/cancellation and usage. It
does not yet expose a per-user model catalog or admin configuration endpoints; those table entries
remain planned. Future idea/script/title endpoints can submit typed tasks internally. Never expose the transport as
an unrestricted, key-bearing proxy. Every task read, event subscription, cancellation, project and
attachment lookup must enforce resource ownership—not just a global `user` role.

For SSE delivery use `text/event-stream`, `Cache-Control: no-store`, proxy buffering disabled,
heartbeat comments and a compatible authenticated mobile streaming transport. Do not put bearer
credentials in query strings. Reconnect with `Last-Event-ID` to **replay persisted events**, not to
start a second generation. If replay has expired, fetch the task snapshot. A subscriber disconnect
does not cancel a persisted background task; explicit cancellation controls the worker-owned signal.
A direct, non-persisted HTTP generation should abort on disconnect.

Before forwarding text, the host must implement input/output moderation and schema/factual checks.
Until a streaming moderation gate is implemented, buffer the final answer rather than exposing raw
transport deltas. Clinical/financial/policy-sensitive output and factual research require additional
review rules; source material cannot authorize agent tool calls or publishing actions.

## 8. Credits, task state and observability (production requirements; conservative dev ledger exists)

1. Authenticate, authorize assets/context/model and run payload preflight **before** reserving credits.
2. In one DB transaction, check plan caps and reserve worst-case input/output/attempt cost using a
   versioned model-price snapshot. Unique `(user_id, idempotency_key)` prevents concurrent duplicate
   reservations. Store a request hash; the same key with different input returns 409.
3. Enqueue once with a transactional outbox. Worker attempts are tracked separately from UI retry
   clicks. Disable opaque BullMQ retries after an ambiguous/accepted upstream request unless a
   provider-supported idempotency/reconciliation mechanism proves the repeat safe.
4. State machine: `queued → running → completed | partial | failed | cancelled`. Persist available
   output and safe error metadata, but distinguish `length`/`content_filter` from complete deliverables.
5. Settle actual provider usage when available and release unused reservation transactionally.
   Missing usage, cancellations and ambiguous timeouts stay conservatively reserved/pending
   reconciliation; do not record zero spend or promise a full refund. Bound reconciliation time and
   define the user-facing refund policy before release. Keep an append-only ledger, not just counters.
6. Log task/attempt IDs, model/provider aliases, latency, finish reason, retry/cancel/error counts,
   nullable usage and reconciliation status. Never log secrets, raw prompts, raw upstream error
   bodies, attachments or private reasoning. `usage` is a reporting projection, not the ledger.

Provider cost, free-user hard caps, concurrency limits and basic workers are **Phase 1 requirements**.
Paid subscriptions, autonomous routing and advanced agents can arrive later.

## 9. Verification and remaining release gates

`npm run check` runs strict TypeScript checks plus Node's built-in test runner with injected fake
providers. Tests cover routing/configuration, context packing, image limits, malformed responses,
usage uncertainty, Unicode/SSE boundaries, partial failures, cancellation, deadlines and retries.
Gateway tests need no API keys, network model calls, app server or database. The wider repository
now also has isolated SQLite API tests and browser tests; see IMPLEMENTATION_STATUS.

Before enabling real inference:

- [ ] Deploy the authenticated host and tenant-isolation tests.
- [ ] Verify each model's availability, system-role support, sampling/vision/streaming behavior,
  reasoning encodings, token counting, provider terms and price ceiling.
- [ ] Integrate the vault, egress restrictions, rate/concurrency limits and circuit breakers.
- [ ] Implement credit ledger, task/outbox/event persistence, cancellation and reconciliation tests.
- [ ] Implement asset decoding/scanning and moderation/schema validation before display.
- [ ] Prove data minimization, deletion propagation and API-derived-data policy compliance.
- [ ] Add staging conformance/load tests with approved credentials; CI remains offline/mocked.

## 10. References

- [Hugging Face chat-completion API and router examples](https://huggingface.co/docs/inference-providers/tasks/chat-completion)
- [OpenAI Chat Completions API reference](https://platform.openai.com/docs/api-reference/chat)
- [SSE event-stream interpretation](https://html.spec.whatwg.org/multipage/server-sent-events.html#event-stream-interpretation)
- [HTTP Retry-After semantics](https://www.rfc-editor.org/rfc/rfc9110.html#name-retry-after)
- [YouTube derived-metric permission and storage rules](https://developers.google.com/youtube/terms/derived-metrics-policy)
- [YouTube developer-policy compliance guide](https://developers.google.com/youtube/terms/developer-policies-guide)

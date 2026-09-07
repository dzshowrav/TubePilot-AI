import { Buffer } from 'node:buffer';
import { GatewayError, classifyHttpError, isRecord } from './errors.js';
import { resolveProvider } from './config.js';
import type { ResolvedProvider } from './config.js';
import { abortable, readBodyText, wait } from './io.js';
import { ModelRegistry } from './models.js';
import { buildGatewayPayload } from './payload.js';
import { FinalAnswerFilter } from './reasoning.js';
import { readSse } from './sse.js';
import type {
  ChatRequest, ChatResult, FinishReason, GatewayEvent, GenerationOptions,
  OpenAiPayload, ProviderConfig, RetryPolicy, TextTokenEstimator, TokenUsage,
} from './types.js';

export interface AiGatewayOptions {
  readonly providers: readonly ProviderConfig[];
  readonly models: ModelRegistry;
  readonly fetch?: typeof globalThis.fetch;
  readonly retry?: RetryPolicy;
  readonly countTextTokens?: TextTokenEstimator;
}

function json(text: string): Record<string, unknown> {
  try {
    const data: unknown = JSON.parse(text);
    if (isRecord(data)) return data;
  } catch { /* Raw provider text is deliberately not attached to the error. */ }
  throw new GatewayError('INVALID_RESPONSE');
}

function usage(value: unknown): TokenUsage | null {
  if (value === null || value === undefined) return null;
  if (!isRecord(value)) throw new GatewayError('INVALID_RESPONSE');
  const token = (key: string): number | null => {
    const n = value[key];
    if (n === null || n === undefined) return null;
    if (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0) throw new GatewayError('INVALID_RESPONSE');
    return n;
  };
  const inputTokens = token('prompt_tokens');
  const outputTokens = token('completion_tokens');
  const totalTokens = token('total_tokens');
  if (inputTokens === null && outputTokens === null && totalTokens === null) return null;
  return { inputTokens, outputTokens, totalTokens, source: 'provider' };
}

function finish(value: unknown): FinishReason {
  if (value === 'stop' || value === 'length' || value === 'content_filter') return value;
  // Tools are not implemented by this transport package; never report a tool call as final text.
  throw new GatewayError('INVALID_RESPONSE');
}

function normalizeError(error: unknown, signal: AbortSignal): GatewayError {
  if (signal.aborted) {
    return new GatewayError(signal.reason instanceof GatewayError && signal.reason.code === 'TIMEOUT' ? 'TIMEOUT' : 'CANCELLED');
  }
  return error instanceof GatewayError ? error : new GatewayError('INVALID_RESPONSE');
}

function scope(options: GenerationOptions): { signal: AbortSignal; dispose: () => void } {
  const timeoutMs = options.timeoutMs ?? 90_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 300_000 ||
    (options.signal !== undefined && !(options.signal instanceof AbortSignal))) {
    throw new GatewayError('INVALID_REQUEST');
  }
  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([options.signal, controller.signal]) : controller.signal;
  const timer = setTimeout(() => controller.abort(new GatewayError('TIMEOUT')), timeoutMs);
  return { signal, dispose: () => { clearTimeout(timer); controller.abort(); } };
}

function firstChoice(data: Record<string, unknown>): Record<string, unknown> | undefined {
  if (data.error !== undefined) {
    const error = isRecord(data.error) ? data.error : {};
    const code = typeof error.code === 'string' ? error.code : '';
    const status = typeof error.status === 'number' && error.status >= 400 && error.status <= 599
      ? error.status : /rate_limit/.test(code) ? 429 : 500;
    throw classifyHttpError(status, JSON.stringify(data.error), null);
  }
  if (!Array.isArray(data.choices) || data.choices.some(choice => !isRecord(choice))) {
    throw new GatewayError('INVALID_RESPONSE');
  }
  return data.choices.find(choice => choice.index === 0 || choice.index === undefined) as Record<string, unknown> | undefined;
}

/** Server-only transport. The host API must enforce identity, ownership, budgets and moderation. */
export class AiGateway {
  #providers = new Map<string, ResolvedProvider>();
  #models: ModelRegistry;
  #fetch: typeof globalThis.fetch;
  #retry: Required<RetryPolicy>;
  #countTextTokens: TextTokenEstimator | undefined;

  constructor(options: AiGatewayOptions) {
    if (typeof globalThis.document !== 'undefined' || !options || !(options.models instanceof ModelRegistry) ||
      !Array.isArray(options.providers) || !options.providers.length) {
      throw new GatewayError('INVALID_CONFIGURATION');
    }
    for (const config of options.providers) {
      const provider = resolveProvider(config);
      if (this.#providers.has(provider.id)) throw new GatewayError('INVALID_CONFIGURATION');
      this.#providers.set(provider.id, provider);
    }
    this.#models = options.models;
    this.#fetch = options.fetch ?? globalThis.fetch;
    this.#countTextTokens = options.countTextTokens;
    this.#retry = {
      maxRetries: options.retry?.maxRetries ?? 1,
      baseDelayMs: options.retry?.baseDelayMs ?? 500,
      maxDelayMs: options.retry?.maxDelayMs ?? 10_000,
    };
    if (typeof this.#fetch !== 'function' ||
      (this.#countTextTokens !== undefined && typeof this.#countTextTokens !== 'function') ||
      !Number.isSafeInteger(this.#retry.maxRetries) || this.#retry.maxRetries < 0 || this.#retry.maxRetries > 2 ||
      !Number.isSafeInteger(this.#retry.baseDelayMs) || this.#retry.baseDelayMs < 1 ||
      !Number.isSafeInteger(this.#retry.maxDelayMs) || this.#retry.maxDelayMs < this.#retry.baseDelayMs ||
      this.#retry.maxDelayMs > 60_000) throw new GatewayError('INVALID_CONFIGURATION');
  }

  #prepare(request: ChatRequest, stream: boolean) {
    if (!isRecord(request) || typeof request.modelId !== 'string') throw new GatewayError('INVALID_REQUEST');
    const model = this.#models.get(request.modelId);
    const provider = this.#providers.get(model.providerId);
    if (!provider) throw new GatewayError('INVALID_CONFIGURATION');
    return { model, provider, built: buildGatewayPayload(request, model, stream, this.#countTextTokens) };
  }

  async #open(body: OpenAiPayload, provider: ResolvedProvider, signal: AbortSignal) {
    let attempts = 0;
    try {
      for (let retry = 0; ; retry++) {
        let key: string;
        try {
          key = await abortable(async () => provider.getApiKey(), signal);
          if (typeof key !== 'string' || !key.trim() || /\s/.test(key.trim()) || key.length > 4096) {
            throw new GatewayError('INVALID_CONFIGURATION');
          }
        } catch {
          throw normalizeError(new GatewayError('INVALID_CONFIGURATION'), signal);
        }
        let response: Response;
        try {
          response = await abortable(() => {
            attempts++;
            return this.#fetch(provider.endpoint, {
              method: 'POST', redirect: 'error', cache: 'no-store', signal,
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key.trim()}` },
              body: JSON.stringify(body),
            });
          }, signal);
        } catch {
          // An ambiguous transport failure may already be billable; do not automatically replay it.
          throw normalizeError(new GatewayError('NETWORK_ERROR'), signal);
        }
        if (response.ok) return { response, attempts };
        const error = classifyHttpError(response.status,
          await readBodyText(response, signal, 64 * 1024, true), response.headers.get('retry-after'));
        if (!error.retryable || retry >= this.#retry.maxRetries) throw error;
        const jitter = Math.ceil(this.#retry.baseDelayMs * 2 ** retry * (0.5 + Math.random() * 0.5));
        const delay = Math.max(jitter, error.retryAfterMs ?? 0);
        // Never shorten Retry-After or keep a worker waiting beyond the configured retry window.
        if (delay > this.#retry.maxDelayMs) throw error;
        await wait(delay, signal);
      }
    } catch (error) {
      const safe = normalizeError(error, signal);
      safe.attempts = attempts;
      throw safe;
    }
  }

  async chat(request: ChatRequest, options: GenerationOptions = {}): Promise<ChatResult> {
    const { model, provider, built } = this.#prepare(request, false);
    const call = scope(options);
    let attempts = 0;
    let activeBody: ReadableStream<Uint8Array> | null = null;
    try {
      const opened = await this.#open(built.body, provider, call.signal);
      attempts = opened.attempts;
      activeBody = opened.response.body;
      if (!/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(opened.response.headers.get('content-type') ?? '')) {
        void opened.response.body?.cancel().catch(() => {});
        throw new GatewayError('INVALID_RESPONSE');
      }
      const data = json(await readBodyText(opened.response, call.signal, 4 * 1024 * 1024));
      const choice = firstChoice(data);
      if (!choice || !isRecord(choice.message)) throw new GatewayError('INVALID_RESPONSE');
      if (choice.message.refusal) throw new GatewayError('REFUSED');
      if (typeof choice.message.content !== 'string') throw new GatewayError('INVALID_RESPONSE');
      const filter = new FinalAnswerFilter();
      const content = filter.push(choice.message.content) + filter.finish();
      return {
        modelId: model.id, providerId: provider.id, content, finishReason: finish(choice.finish_reason),
        usage: usage(data.usage), context: built.context, attempts,
      };
    } catch (error) {
      const safe = normalizeError(error, call.signal);
      safe.attempts = Math.max(safe.attempts, attempts);
      throw safe;
    } finally {
      call.dispose();
      if (activeBody && !activeBody.locked) void activeBody.cancel().catch(() => {});
    }
  }

  async *stream(request: ChatRequest, options: GenerationOptions = {}): AsyncGenerator<GatewayEvent> {
    const { model, provider, built } = this.#prepare(request, true);
    const call = scope(options);
    let attempts = 0;
    let activeBody: ReadableStream<Uint8Array> | null = null;
    let content = '';
    let contentBytes = 0;
    let tokenUsage: TokenUsage | null = null;
    let finishReason: FinishReason | undefined;
    const filter = new FinalAnswerFilter();
    try {
      const opened = await this.#open(built.body, provider, call.signal);
      attempts = opened.attempts;
      activeBody = opened.response.body;
      const response = opened.response;
      if (!response.body || !/^text\/event-stream(?:\s*;|$)/i.test(response.headers.get('content-type') ?? '')) {
        void response.body?.cancel().catch(() => {});
        throw new GatewayError('INVALID_RESPONSE');
      }
      yield { type: 'start', modelId: model.id, providerId: provider.id, context: built.context, attempts };
      for await (const frame of readSse(response.body, call.signal)) {
        if (frame.data.trim() === '[DONE]') break;
        if (frame.event === 'error') throw new GatewayError('UPSTREAM_UNAVAILABLE');
        const data = json(frame.data);
        const choice = firstChoice(data);
        if (choice) {
          if (!isRecord(choice.delta)) throw new GatewayError('INVALID_RESPONSE');
          if (choice.delta.refusal) throw new GatewayError('REFUSED');
          const delta = choice.delta.content;
          if (delta !== undefined && delta !== null) {
            if (typeof delta !== 'string' || (delta && finishReason)) throw new GatewayError('INVALID_RESPONSE');
            const text = filter.push(delta);
            if (text) {
              contentBytes += Buffer.byteLength(text, 'utf8');
              if (contentBytes > 2 * 1024 * 1024) throw new GatewayError('OUTPUT_LIMIT');
              content += text;
              yield { type: 'delta', text };
            }
          }
          // Deliberately ignore reasoning_content / reasoning / reasoning_details fields.
          if (choice.finish_reason !== undefined && choice.finish_reason !== null) {
            const nextReason = finish(choice.finish_reason);
            if (finishReason && finishReason !== nextReason) throw new GatewayError('INVALID_RESPONSE');
            finishReason = nextReason;
          }
        }
        const nextUsage = usage(data.usage);
        if (nextUsage) { tokenUsage = nextUsage; yield { type: 'usage', usage: nextUsage }; }
      }
      if (call.signal.aborted) throw new GatewayError('CANCELLED');
      if (!finishReason) throw new GatewayError('INVALID_RESPONSE');
      filter.finish();
      yield { type: 'complete', result: {
        modelId: model.id, providerId: provider.id, content, finishReason,
        usage: tokenUsage, context: built.context, attempts,
      } };
    } catch (error) {
      const safe = normalizeError(error, call.signal);
      safe.partial = content.length > 0;
      safe.attempts = Math.max(safe.attempts, attempts);
      throw safe;
    } finally {
      call.dispose();
      if (activeBody && !activeBody.locked) void activeBody.cancel().catch(() => {});
    }
  }
}

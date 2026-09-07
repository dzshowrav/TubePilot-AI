/** Server-side contracts. Do not expose ProviderConfig or ChatRequest.instructions as client DTOs. */
export type SamplingParameter = 'temperature' | 'topP' | 'frequencyPenalty' | 'presencePenalty';
export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface ProviderConfig {
  readonly id: string;
  /** Defaults to Hugging Face's OpenAI-compatible router. Trusted operator config only. */
  readonly baseUrl?: string;
  /** Exact HTTPS origins approved by the operator; never populated from request input. */
  readonly allowedOrigins?: readonly string[];
  /** Resolve from a backend secret manager at dispatch time, allowing rotation. */
  readonly getApiKey: () => string | Promise<string>;
}

export interface ModelDefinition {
  readonly id: string;
  readonly providerId: string;
  readonly upstreamModel: string;
  readonly name: string;
  readonly category: string;
  readonly enabled: boolean;
  readonly contextWindowTokens: number;
  readonly maxOutputTokens: number;
  readonly capabilities: {
    readonly streaming: boolean;
    readonly streamUsage: boolean;
    readonly vision: boolean;
    /** Verified upper input-token budget per preprocessed image for this model. */
    readonly imageInputTokenBudget?: number;
    readonly sampling: readonly SamplingParameter[];
    readonly reasoningEfforts?: readonly ReasoningEffort[];
    readonly outputTokenParameter: 'max_tokens' | 'max_completion_tokens';
  };
}

export interface ChatMessage {
  readonly role: 'user' | 'assistant';
  readonly content: string;
  /** Backend-authorized, decoded/re-encoded image assets, not arbitrary remote URLs. */
  readonly images?: readonly { readonly dataUrl: string }[];
}

export interface ChatSettings {
  readonly temperature?: number;
  readonly topP?: number;
  readonly frequencyPenalty?: number;
  readonly presencePenalty?: number;
  readonly maxOutputTokens?: number;
  readonly reasoningEffort?: ReasoningEffort;
}

export interface ContextDocument {
  readonly id: string;
  readonly source: string;
  readonly updatedAt: string;
  readonly text: string;
}

export interface ChatRequest {
  readonly modelId: string;
  /** Alternating user/assistant turns, ending with a user turn. */
  readonly messages: readonly ChatMessage[];
  /** Trusted application instructions (e.g. Idea Studio), never a client system prompt. */
  readonly instructions?: string;
  /** Authorized Channel DNA, Brand Voice and source material, treated as untrusted data. */
  readonly context?: readonly ContextDocument[];
  readonly settings?: ChatSettings;
}

export type OpenAiContent = string | Array<
  { type: 'text'; text: string } |
  { type: 'image_url'; image_url: { url: string; detail: 'low' } }
>;
export interface OpenAiMessage {
  role: 'system' | 'user' | 'assistant';
  content: OpenAiContent;
}
export interface OpenAiPayload {
  model: string;
  messages: OpenAiMessage[];
  stream: boolean;
  max_tokens?: number;
  max_completion_tokens?: number;
  stream_options?: { include_usage: true };
  temperature?: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
  reasoning_effort?: ReasoningEffort;
}

export interface ContextUsage {
  trimmedMessages: number;
  estimatedInputTokens: number;
  maxOutputTokens: number;
}
export interface BuiltPayload {
  body: OpenAiPayload;
  context: ContextUsage;
}
export interface TokenUsage {
  /** Missing upstream counters remain null; never interpret missing usage as free. */
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  source: 'provider';
}
export type FinishReason = 'stop' | 'length' | 'content_filter';
export interface ChatResult {
  modelId: string;
  providerId: string;
  content: string;
  finishReason: FinishReason;
  usage: TokenUsage | null;
  context: ContextUsage;
  attempts: number;
}
export type GatewayEvent =
  | { type: 'start'; modelId: string; providerId: string; context: ContextUsage; attempts: number }
  | { type: 'delta'; text: string }
  | { type: 'usage'; usage: TokenUsage }
  | { type: 'complete'; result: ChatResult };

export interface GenerationOptions {
  readonly signal?: AbortSignal;
  /** Whole-call deadline, including secret resolution, retries and response consumption. */
  readonly timeoutMs?: number;
}
export interface RetryPolicy {
  /** Additional attempts, not total attempts; 0–2. Only explicit HTTP 429/503 rejections. */
  readonly maxRetries?: number;
  readonly baseDelayMs?: number;
  readonly maxDelayMs?: number;
}
export type TextTokenEstimator = (text: string) => number;

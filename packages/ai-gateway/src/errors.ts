export type GatewayErrorCode =
  | 'INVALID_CONFIGURATION' | 'INVALID_REQUEST' | 'MODEL_UNAVAILABLE'
  | 'UNSUPPORTED_CAPABILITY' | 'CONTEXT_LIMIT' | 'AUTHENTICATION_FAILED'
  | 'PERMISSION_DENIED' | 'RATE_LIMITED' | 'QUOTA_EXCEEDED'
  | 'UPSTREAM_UNAVAILABLE' | 'NETWORK_ERROR' | 'TIMEOUT' | 'CANCELLED'
  | 'INVALID_RESPONSE' | 'OUTPUT_LIMIT' | 'REFUSED';

const messages: Record<GatewayErrorCode, string> = {
  INVALID_CONFIGURATION: 'The AI gateway configuration is invalid. Contact the operator.',
  INVALID_REQUEST: 'The generation request is invalid. Check the input and settings.',
  MODEL_UNAVAILABLE: 'The selected model is unavailable or disabled. Choose an enabled model.',
  UNSUPPORTED_CAPABILITY: 'The selected model does not support this input or setting.',
  CONTEXT_LIMIT: 'The required context exceeds this model’s limit. Shorten it or choose a larger model.',
  AUTHENTICATION_FAILED: 'The upstream AI credentials were rejected. Contact the operator.',
  PERMISSION_DENIED: 'The upstream AI provider denied access. Contact the operator.',
  RATE_LIMITED: 'The AI provider is rate limiting requests. Try again later.',
  QUOTA_EXCEEDED: 'The AI provider’s account quota or billing limit was reached. Contact the operator.',
  UPSTREAM_UNAVAILABLE: 'The AI provider is temporarily unavailable. Try again later.',
  NETWORK_ERROR: 'The connection to the AI provider failed. The request may have been processed.',
  TIMEOUT: 'The generation deadline was reached. The provider may have processed part of the request.',
  CANCELLED: 'Generation was cancelled. Work already performed may still incur usage.',
  INVALID_RESPONSE: 'The AI provider returned an invalid or incomplete response.',
  OUTPUT_LIMIT: 'The AI response exceeded the gateway’s response size limit.',
  REFUSED: 'The AI provider declined this request. Review the input before trying again.',
};

export class GatewayError extends Error {
  readonly code: GatewayErrorCode;
  readonly status: number | undefined;
  readonly retryAfterMs: number | undefined;
  readonly retryable: boolean;
  /** True if final-answer text was already delivered; never automatically replay it. */
  partial = false;
  attempts = 0;

  constructor(code: GatewayErrorCode, options: {
    status?: number;
    retryAfterMs?: number;
    retryable?: boolean;
  } = {}) {
    super(messages[code]);
    this.name = 'GatewayError';
    this.code = code;
    this.status = options.status;
    this.retryAfterMs = options.retryAfterMs;
    this.retryable = options.retryable ?? false;
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Retry-After supports delta-seconds AND HTTP dates. This is a hint, not an availability promise. */
export function parseRetryAfter(value: string | null, now = Date.now()): number | undefined {
  if (!value?.trim()) return undefined;
  const text = value.trim();
  if (/^\d+(\.\d+)?$/.test(text)) {
    const ms = Math.ceil(Number(text) * 1000);
    return Number.isSafeInteger(ms) ? ms : undefined;
  }
  // Do not let Date.parse interpret malformed numeric strings as calendar years.
  if (!/[a-z]/i.test(text)) return undefined;
  const date = Date.parse(text);
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}

/** Inspect bounded upstream text only for classification. Never return it, log it or attach a cause. */
export function classifyHttpError(status: number, body: string, retryAfter: string | null): GatewayError {
  const hint = body.toLowerCase();
  let code: GatewayErrorCode;
  if (status === 401) code = 'AUTHENTICATION_FAILED';
  else if (status === 403) code = 'PERMISSION_DENIED';
  else if (status === 404) code = 'MODEL_UNAVAILABLE';
  else if (/insufficient_quota|quota_exceeded|billing_hard_limit/.test(hint)) code = 'QUOTA_EXCEEDED';
  else if (status === 429) code = 'RATE_LIMITED';
  else if ((status === 400 || status === 413) && /context.{0,30}(length|limit)|maximum context|too many tokens/.test(hint)) code = 'CONTEXT_LIMIT';
  else if (status >= 500 || status === 408) code = 'UPSTREAM_UNAVAILABLE';
  else code = 'INVALID_REQUEST';
  const retryAfterMs = parseRetryAfter(retryAfter);
  return new GatewayError(code, {
    status,
    ...(retryAfterMs === undefined ? {} : { retryAfterMs }),
    retryable: code !== 'QUOTA_EXCEEDED' && (status === 429 || status === 503),
  });
}

export function formatGatewayError(error: unknown): string {
  if (!(error instanceof GatewayError)) return messages.UPSTREAM_UNAVAILABLE;
  const retryHint = error.retryAfterMs === undefined ? '' :
    ` The provider suggests waiting at least ${Math.ceil(error.retryAfterMs / 1000)} seconds; availability is not guaranteed.`;
  const partialHint = error.partial ? ' The partial response is incomplete; retry as a new generation.' : '';
  return error.message + retryHint + partialHint;
}

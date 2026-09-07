import { isIP } from 'node:net';
import { GatewayError } from './errors.js';
import type { ProviderConfig } from './types.js';

export const DEFAULT_BASE_URL = 'https://router.huggingface.co/v1';
export const DEFAULT_ALLOWED_ORIGINS = Object.freeze(['https://router.huggingface.co']);

function parsePublicHttpsUrl(value: string): URL {
  try {
    const url = new URL(value);
    const host = url.hostname.replace(/^\[|\]$/g, '');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
      (url.port && url.port !== '443') || isIP(host) || !host.includes('.') ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(host) || host.endsWith('.')) {
      throw new Error();
    }
    return url;
  } catch {
    // Never echo a URL which might contain credentials or internal host names.
    throw new GatewayError('INVALID_CONFIGURATION');
  }
}

/** Configuration-time validation; public DNS resolution still needs deployment egress controls. */
export function normalizeBaseUrl(
  baseUrl = DEFAULT_BASE_URL,
  allowedOrigins: readonly string[] = DEFAULT_ALLOWED_ORIGINS,
): string {
  if (typeof baseUrl !== 'string' || !Array.isArray(allowedOrigins) || !allowedOrigins.length) {
    throw new GatewayError('INVALID_CONFIGURATION');
  }
  const url = parsePublicHttpsUrl(baseUrl.trim());
  const approved = allowedOrigins.map(origin => {
    if (typeof origin !== 'string') throw new GatewayError('INVALID_CONFIGURATION');
    const parsed = parsePublicHttpsUrl(origin);
    if (parsed.pathname !== '/') throw new GatewayError('INVALID_CONFIGURATION');
    return parsed.origin;
  });
  if (!approved.includes(url.origin) || !/^\/[a-zA-Z0-9_./-]*$/.test(url.pathname)) {
    throw new GatewayError('INVALID_CONFIGURATION');
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, '')}`;
}

export interface ResolvedProvider {
  readonly id: string;
  readonly endpoint: string;
  readonly getApiKey: ProviderConfig['getApiKey'];
}

export function resolveProvider(config: ProviderConfig): ResolvedProvider {
  if (!config || typeof config.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(config.id) || typeof config.getApiKey !== 'function') {
    throw new GatewayError('INVALID_CONFIGURATION');
  }
  return Object.freeze({
    id: config.id,
    endpoint: `${normalizeBaseUrl(config.baseUrl, config.allowedOrigins)}/chat/completions`,
    getApiKey: config.getApiKey,
  });
}

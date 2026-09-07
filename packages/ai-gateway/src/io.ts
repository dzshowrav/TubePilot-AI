import { GatewayError } from './errors.js';

/** Races even injected transports/secret resolvers which do not implement AbortSignal themselves. */
export function abortable<T>(operation: () => Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const aborted = () => reject(new GatewayError('CANCELLED'));
    if (signal.aborted) return aborted();
    signal.addEventListener('abort', aborted, { once: true });
    Promise.resolve().then(() => {
      if (signal.aborted) throw new GatewayError('CANCELLED');
      return operation();
    }).then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
  });
}

export function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new GatewayError('CANCELLED'));
    const abort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', abort);
      reject(new GatewayError('CANCELLED'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', abort);
      resolve();
    }, ms);
    signal.addEventListener('abort', abort, { once: true });
  });
}

export function closeReader(reader: ReadableStreamDefaultReader<Uint8Array>): void {
  // Do not await cancellation: a custom/tee'd stream may never resolve cancel().
  void reader.cancel().catch(() => {});
  reader.releaseLock();
}

export async function readBodyText(
  response: Response, signal: AbortSignal, limit: number, truncate = false,
): Promise<string> {
  if (!response.body) throw new GatewayError('INVALID_RESPONSE');
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: !truncate });
  let size = 0;
  let text = '';
  try {
    while (true) {
      const { done, value } = await abortable(() => reader.read(), signal);
      if (done) break;
      const remaining = limit - size;
      size += value.byteLength;
      if (size > limit) {
        if (!truncate) throw new GatewayError('OUTPUT_LIMIT');
        text += decoder.decode(value.subarray(0, remaining), { stream: true });
        break;
      }
      text += decoder.decode(value, { stream: true });
    }
    return text + decoder.decode();
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    throw new GatewayError('INVALID_RESPONSE');
  } finally {
    closeReader(reader);
  }
}

import { Buffer } from 'node:buffer';
import { GatewayError } from './errors.js';
import { abortable, closeReader } from './io.js';

export interface SseFrame { event: string; data: string }

/** Incremental UTF-8 + SSE framing; a transport chunk is neither a line nor a JSON event. */
export async function* readSse(
  body: ReadableStream<Uint8Array>, signal: AbortSignal,
): AsyncGenerator<SseFrame> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const maxEventBytes = 256 * 1024;
  const maxTotalBytes = 8 * 1024 * 1024;
  let buffer = '';
  let data: string[] = [];
  let event = 'message';
  let eventBytes = 0;
  let totalBytes = 0;

  function line(value: string): SseFrame | undefined {
    if (value === '') {
      const frame = data.length ? { event, data: data.join('\n') } : undefined;
      data = []; event = 'message'; eventBytes = 0;
      return frame;
    }
    if (value.startsWith(':')) return;
    eventBytes += Buffer.byteLength(value, 'utf8');
    if (eventBytes > maxEventBytes) throw new GatewayError('OUTPUT_LIMIT');
    const colon = value.indexOf(':');
    const field = colon === -1 ? value : value.slice(0, colon);
    const content = colon === -1 ? '' : value.slice(colon + 1).replace(/^ /, '');
    if (field === 'data') data.push(content);
    if (field === 'event') event = content;
    return;
  }

  function* drain(eof: boolean): Generator<SseFrame> {
    while (true) {
      const index = buffer.search(/[\r\n]/);
      if (index === -1 || (!eof && buffer[index] === '\r' && index === buffer.length - 1)) break;
      const length = buffer[index] === '\r' && buffer[index + 1] === '\n' ? 2 : 1;
      const frame = line(buffer.slice(0, index));
      buffer = buffer.slice(index + length);
      if (frame) yield frame;
    }
    if (Buffer.byteLength(buffer, 'utf8') > maxEventBytes) throw new GatewayError('OUTPUT_LIMIT');
    if (eof) {
      if (buffer) { const frame = line(buffer); if (frame) yield frame; buffer = ''; }
      // Some compatible servers omit the final blank line; JSON validation still happens upstream.
      const frame = line('');
      if (frame) yield frame;
    }
  }

  try {
    while (true) {
      const { done, value } = await abortable(() => reader.read(), signal);
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxTotalBytes) throw new GatewayError('OUTPUT_LIMIT');
      buffer += decoder.decode(value, { stream: true });
      yield* drain(false);
    }
    buffer += decoder.decode();
    yield* drain(true);
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    throw new GatewayError('INVALID_RESPONSE');
  } finally {
    closeReader(reader);
  }
}

/** Encode only normalized gateway events, not arbitrary upstream data/reasoning/errors. */
export function encodeSseEvent(event: { type: string }, sequence: number): string {
  if (!/^[a-z]+$/.test(event.type) || !Number.isSafeInteger(sequence) || sequence < 0) {
    throw new GatewayError('INVALID_REQUEST');
  }
  return `id: ${sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

import { AiGateway, ModelRegistry } from '../dist/index.js';

export const model = {
  id: 'test-chat', providerId: 'huggingface', upstreamModel: 'org/test-model:provider',
  name: 'Test chat model', category: 'Test', enabled: true,
  contextWindowTokens: 32_000, maxOutputTokens: 2048,
  capabilities: {
    streaming: true, streamUsage: true, vision: false,
    sampling: ['temperature', 'topP', 'frequencyPenalty', 'presencePenalty'],
    outputTokenParameter: 'max_tokens',
  },
};
export const request = { modelId: model.id, messages: [{ role: 'user', content: 'Suggest a Bengali YouTube tutorial idea.' }] };
export const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1sAAAAASUVORK5CYII=';
export function gateway(fetch, options = {}) {
  return new AiGateway({
    providers: [{ id: 'huggingface', getApiKey: () => 'test-only-key' }],
    models: new ModelRegistry([model]), retry: { maxRetries: 0 }, fetch, ...options,
  });
}
export function completion(options = {}) {
  return Response.json({
    choices: [{ index: 0, message: { role: 'assistant', content: 'Make an AI tools tutorial.' }, finish_reason: 'stop' }],
    usage: { prompt_tokens: 80, completion_tokens: 12, total_tokens: 92 },
    ...options,
  });
}
export function chunk(content, finish_reason = null, extra = {}) {
  return { choices: [{ index: 0, delta: content === undefined ? {} : { content }, finish_reason }], ...extra };
}
export function data(value) {
  return `data: ${typeof value === 'string' ? value : JSON.stringify(value)}\n\n`;
}
export function sse(text, { bytewise = false, close = true, onCancel = () => {} } = {}) {
  const bytes = new TextEncoder().encode(text);
  return new Response(new ReadableStream({
    start(controller) {
      if (bytewise) for (const byte of bytes) controller.enqueue(new Uint8Array([byte]));
      else controller.enqueue(bytes);
      if (close) controller.close();
    },
    cancel: onCancel,
  }), { headers: { 'content-type': 'text/event-stream; charset=utf-8' } });
}
export async function collect(iterable) {
  const events = [];
  for await (const event of iterable) events.push(event);
  return events;
}
export const code = expected => error => error.code === expected;

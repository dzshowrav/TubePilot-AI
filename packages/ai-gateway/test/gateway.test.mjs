import test from 'node:test';
import assert from 'node:assert/strict';
import { ModelRegistry, parseRetryAfter, formatGatewayError } from '../dist/index.js';
import { model, request, gateway, completion, chunk, data, sse, collect, code } from './helpers.mjs';

test('JSON dispatch sets server authorization, forbids redirects and reports full usage', async () => {
  let sent;
  const ai = gateway(async (url, options) => { sent = { url, ...options }; return completion(); });
  const result = await ai.chat(request);
  assert.equal(sent.url, 'https://router.huggingface.co/v1/chat/completions');
  assert.equal(sent.headers.Authorization, 'Bearer test-only-key');
  assert.equal(sent.redirect, 'error');
  assert.equal(JSON.parse(sent.body).stream, false);
  assert.deepEqual(result.usage, { inputTokens: 80, outputTokens: 12, totalTokens: 92, source: 'provider' });
  assert.equal(result.attempts, 1);
  assert.equal(result.finishReason, 'stop');
  assert.ok(!JSON.stringify(result).includes('test-only-key'));
  assert.ok(!JSON.stringify(ai).includes('test-only-key'));
});

test('model switching selects the matching trusted provider and resolves rotated keys', async () => {
  const alternate = { ...model, id: 'alternate', providerId: 'other', upstreamModel: 'other/model' };
  const seen = [];
  let key = 'old-key';
  const ai = gateway(async (url, options) => { seen.push([url, options.headers.Authorization, JSON.parse(options.body).model]); return completion(); }, {
    models: new ModelRegistry([model, alternate]),
    providers: [
      { id: 'huggingface', getApiKey: () => key },
      { id: 'other', baseUrl: 'https://api.openai.com/v1', allowedOrigins: ['https://api.openai.com'], getApiKey: () => 'other-key' },
    ],
  });
  await ai.chat(request);
  key = 'rotated-key';
  await ai.chat(request);
  const result = await ai.chat({ ...request, modelId: alternate.id });
  assert.equal(seen[0][1], 'Bearer old-key');
  assert.equal(seen[1][1], 'Bearer rotated-key');
  assert.deepEqual(seen[2], ['https://api.openai.com/v1/chat/completions', 'Bearer other-key', 'other/model']);
  assert.equal(result.modelId, alternate.id);
});

test('missing usage remains unknown, and legitimate zero usage is preserved', async () => {
  assert.equal((await gateway(async () => completion({ usage: undefined })).chat(request)).usage, null);
  assert.equal((await gateway(async () => completion({ usage: { completion_tokens: 0 } })).chat(request)).usage.outputTokens, 0);
  await assert.rejects(gateway(async () => completion({ usage: { prompt_tokens: -1 } })).chat(request), code('INVALID_RESPONSE'));
});

test('SSE supports fragmented UTF-8, split CRLF, heartbeat comments, usage-only frames and DONE', async () => {
  const text = ': ping\r\n\r\n' + [
    data(chunk('হ্যালো 🌍')), data(chunk(' TubePilot')), data(chunk(undefined, 'stop')),
    data({ choices: [], usage: { prompt_tokens: 120, completion_tokens: 8, total_tokens: 128 } }), data('[DONE]'),
  ].join('').replaceAll('\n', '\r\n');
  const events = await collect(gateway(async () => sse(text, { bytewise: true })).stream(request));
  assert.deepEqual(events.map(event => event.type), ['start', 'delta', 'delta', 'usage', 'complete']);
  assert.equal(events.at(-1).result.content, 'হ্যালো 🌍 TubePilot');
  assert.equal(events.at(-1).result.usage.totalTokens, 128);
});

test('SSE joins multiple data lines and flushes a final event without a blank line', async () => {
  const frame = 'data: {\n' + 'data: "choices": [{"index":0,"delta":{"content":"Answer"},"finish_reason":"stop"}]\n' + 'data: }';
  const events = await collect(gateway(async () => sse(frame, { bytewise: true })).stream(request));
  assert.equal(events.at(-1).result.content, 'Answer');
  assert.equal(events.at(-1).result.usage, null);
});

test('DONE terminates a still-open body and cancels the reader', async () => {
  let cancelled = false;
  const events = await collect(gateway(async () => sse(data(chunk('done', 'stop')) + data('[DONE]'), {
    close: false, onCancel: () => { cancelled = true; },
  })).stream(request, { timeoutMs: 1000 }));
  assert.equal(events.at(-1).type, 'complete');
  assert.equal(cancelled, true);
});

test('separate reasoning fields and fragmented inline thinking tags never reach final output', async () => {
  const pieces = [
    { choices: [{ index: 0, delta: { reasoning_content: 'private upstream reasoning' }, finish_reason: null }] },
    ...['<th', 'ink>hidden', '</thi', 'nk>', 'Visible ', '<analysis>private</analysis>', 'answer'].map(value => chunk(value)),
    chunk(undefined, 'stop'),
  ];
  const events = await collect(gateway(async () => sse(pieces.map(data).join('') + data('[DONE]'))).stream(request));
  const publicText = JSON.stringify(events);
  assert.ok(!publicText.includes('hidden'));
  assert.ok(!publicText.includes('private'));
  assert.equal(events.at(-1).result.content, 'Visible answer');
  const jsonResult = await gateway(async () => completion({
    choices: [{ message: { content: '<think>private</think>Final', reasoning_content: 'private' }, finish_reason: 'stop' }],
  })).chat(request);
  assert.equal(jsonResult.content, 'Final');
});

test('unterminated reasoning, malformed JSON, incomplete streams and premature DONE never complete', async () => {
  for (const wire of [
    data(chunk('<think>not final', 'stop')) + data('[DONE]'),
    data(chunk('partial')) + 'data: {broken}\n\n',
    data(chunk('partial')),
    data('[DONE]'),
  ]) {
    const events = [];
    let calls = 0;
    await assert.rejects(async () => {
      for await (const event of gateway(async () => { calls++; return sse(wire); }, { retry: { maxRetries: 2 } }).stream(request)) events.push(event);
    }, code('INVALID_RESPONSE'));
    assert.ok(!events.some(event => event.type === 'complete'));
    assert.equal(calls, 1);
  }
});

test('errors after visible text are marked partial and are never replayed', async () => {
  let calls = 0;
  const ai = gateway(async () => { calls++; return sse(data(chunk('Partial idea')) + data({ error: { status: 503, message: 'internal secret' } })); }, { retry: { maxRetries: 2 } });
  await assert.rejects(collect(ai.stream(request)), error => {
    assert.equal(error.code, 'UPSTREAM_UNAVAILABLE');
    assert.equal(error.partial, true);
    assert.equal(error.attempts, 1);
    assert.ok(!formatGatewayError(error).includes('internal secret'));
    return true;
  });
  assert.equal(calls, 1);
});

test('length-limited output is distinguishable and unsupported tool-call output is rejected', async () => {
  const events = await collect(gateway(async () => sse(data(chunk('Truncated', 'length')))).stream(request));
  assert.equal(events.at(-1).result.finishReason, 'length');
  await assert.rejects(collect(gateway(async () => sse(data(chunk(undefined, 'tool_calls')))).stream(request)), code('INVALID_RESPONSE'));
});

test('wrong response types and malformed JSON are not silently retried as non-streaming', async () => {
  let calls = 0;
  await assert.rejects(collect(gateway(async () => { calls++; return completion(); }).stream(request)), code('INVALID_RESPONSE'));
  assert.equal(calls, 1);
  await assert.rejects(gateway(async () => new Response('not JSON', { headers: { 'content-type': 'application/json' } })).chat(request), code('INVALID_RESPONSE'));
});

test('response and event size limits stop oversized providers', async () => {
  await assert.rejects(collect(gateway(async () => sse('data: ' + 'x'.repeat(300_000))).stream(request)), code('OUTPUT_LIMIT'));
  await assert.rejects(gateway(async () => completion({ junk: 'x'.repeat(4 * 1024 * 1024) })).chat(request), code('OUTPUT_LIMIT'));
});

for (const [status, body, expected] of [
  [401, 'secret-key and raw auth error', 'AUTHENTICATION_FAILED'],
  [403, 'private account details', 'PERMISSION_DENIED'],
  [404, 'raw model error', 'MODEL_UNAVAILABLE'],
  [400, 'maximum context length is exceeded', 'CONTEXT_LIMIT'],
  [429, '{"error":{"code":"insufficient_quota"}}', 'QUOTA_EXCEEDED'],
  [500, 'possibly already billed', 'UPSTREAM_UNAVAILABLE'],
]) {
  test(`HTTP ${status}/${expected} is classified safely and not retried`, async () => {
    let calls = 0;
    await assert.rejects(gateway(async () => { calls++; return new Response(body, { status }); }, { retry: { maxRetries: 2 } }).chat(request), error => {
      assert.equal(error.code, expected);
      assert.ok(!formatGatewayError(error).includes(body));
      assert.ok(!JSON.stringify(error).includes(body));
      return true;
    });
    assert.equal(calls, 1);
  });
}

test('transient HTTP 429/503 retries are bounded and account for attempts', async () => {
  let calls = 0;
  const result = await gateway(async () => {
    calls++;
    if (calls <= 2) return new Response('busy', { status: calls === 1 ? 429 : 503, headers: { 'retry-after': '0' } });
    return completion();
  }, { retry: { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 20 } }).chat(request);
  assert.equal(calls, 3);
  assert.equal(result.attempts, 3);
});

test('Retry-After is honored, not shortened or presented as guaranteed recovery', async () => {
  let calls = 0;
  await assert.rejects(gateway(async () => {
    calls++;
    return new Response('limit', { status: 429, headers: { 'retry-after': '3600' } });
  }, { retry: { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 10 } }).chat(request), error => {
    assert.equal(error.retryAfterMs, 3_600_000);
    assert.ok(formatGatewayError(error).includes('availability is not guaranteed'));
    return true;
  });
  assert.equal(calls, 1);
  const now = Date.parse('2026-09-08T00:00:00Z');
  assert.equal(parseRetryAfter('120', now), 120_000);
  assert.equal(parseRetryAfter('Tue, 08 Sep 2026 00:02:00 GMT', now), 120_000);
  assert.equal(parseRetryAfter('Tue, 08 Sep 2026 00:00:00 GMT', now), 0);
  assert.equal(parseRetryAfter('nonsense', now), undefined);
  assert.equal(parseRetryAfter('-2', now), undefined);
});

test('transport failures are ambiguous, sanitized, and never automatically retried', async () => {
  let calls = 0;
  await assert.rejects(gateway(async () => { calls++; throw new Error('key=secret in private URL'); }, { retry: { maxRetries: 2 } }).chat(request), error => {
    assert.equal(error.code, 'NETWORK_ERROR');
    assert.ok(!formatGatewayError(error).includes('key=secret'));
    return true;
  });
  assert.equal(calls, 1);
  assert.ok(!formatGatewayError(new Error('sensitive')).includes('sensitive'));
});

test('unknown models and invalid capabilities fail before making a billable request', async () => {
  let calls = 0;
  const ai = gateway(async () => { calls++; return completion(); });
  await assert.rejects(ai.chat({ ...request, modelId: 'missing' }), code('MODEL_UNAVAILABLE'));
  await assert.rejects(ai.chat({ ...request, settings: { reasoningEffort: 'high' } }), code('UNSUPPORTED_CAPABILITY'));
  assert.equal(calls, 0);
});

test('provider refusals are safe typed errors', async () => {
  await assert.rejects(gateway(async () => completion({
    choices: [{ message: { content: null, refusal: 'upstream refusal details' }, finish_reason: 'stop' }],
  })).chat(request), code('REFUSED'));
});

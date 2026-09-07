import test from 'node:test';
import assert from 'node:assert/strict';
import { request, gateway, completion, chunk, data, sse, collect, code } from './helpers.mjs';

const never = () => new Promise(() => {});

test('pre-cancelled requests do not fetch', async () => {
  let calls = 0;
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(gateway(async () => { calls++; return completion(); }).chat(request, { signal: controller.signal }), code('CANCELLED'));
  assert.equal(calls, 0);
});

test('whole-call deadline bounds an uncooperative transport', async () => {
  await assert.rejects(gateway(never).chat(request, { timeoutMs: 20 }), code('TIMEOUT'));
});

test('whole-call deadline also bounds secret resolution', async () => {
  let calls = 0;
  await assert.rejects(gateway(async () => { calls++; return completion(); }, {
    providers: [{ id: 'huggingface', getApiKey: never }],
  }).chat(request, { timeoutMs: 20 }), code('TIMEOUT'));
  assert.equal(calls, 0);
});

test('invalid secrets are sanitized and never dispatched', async () => {
  let calls = 0;
  for (const getApiKey of [() => '', () => 'key\r\nheader: inject', () => { throw new Error('vault secret details'); }]) {
    await assert.rejects(gateway(async () => { calls++; return completion(); }, {
      providers: [{ id: 'huggingface', getApiKey }],
    }).chat(request), code('INVALID_CONFIGURATION'));
  }
  assert.equal(calls, 0);
});

test('a stalled SSE body times out without a success event', async () => {
  const events = [];
  await assert.rejects(async () => {
    for await (const event of gateway(async () => sse(data(chunk('Partial')), { close: false })).stream(request, { timeoutMs: 20 })) events.push(event);
  }, error => error.code === 'TIMEOUT' && error.partial);
  assert.ok(!events.some(event => event.type === 'complete'));
});

test('cancelling one concurrent generation does not cancel another', async () => {
  let calls = 0;
  let firstStarted;
  let secondStarted;
  const firstReady = new Promise(resolve => { firstStarted = resolve; });
  const secondReady = new Promise(resolve => { secondStarted = resolve; });
  const controller = new AbortController();
  const ai = gateway(async () => {
    if (++calls === 1) {
      firstStarted();
      return sse(data(chunk('Partial')), { close: false });
    }
    secondStarted();
    return completion();
  });
  const first = (async () => {
    const events = [];
    try {
      for await (const event of ai.stream(request, { signal: controller.signal })) {
        events.push(event);
        if (event.type === 'delta') {
          await secondReady; // both calls have entered the provider before cancellation
          controller.abort();
        }
      }
      assert.fail('cancelled stream unexpectedly completed');
    } catch (error) {
      assert.equal(error.code, 'CANCELLED');
      assert.equal(error.partial, true);
    }
    assert.ok(!events.some(event => event.type === 'complete'));
  })();
  await firstReady;
  const second = ai.chat(request);
  const [, result] = await Promise.all([first, second]);
  assert.equal(result.finishReason, 'stop');
  assert.equal(calls, 2);
});

test('cancellation interrupts Retry-After backoff without another upstream call', async () => {
  let calls = 0;
  const controller = new AbortController();
  const ai = gateway(async () => {
    calls++;
    setTimeout(() => controller.abort(), 10);
    return new Response('busy', { status: 429, headers: { 'retry-after': '1' } });
  }, { retry: { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 2000 } });
  await assert.rejects(ai.chat(request, { signal: controller.signal }), code('CANCELLED'));
  assert.equal(calls, 1);
});

test('consumer iterator exit cancels the upstream request and releases its reader', async () => {
  let cancelled = false;
  let signal;
  const ai = gateway(async (_url, options) => {
    signal = options.signal;
    return sse(data(chunk('Partial')), { close: false, onCancel: () => { cancelled = true; } });
  });
  for await (const event of ai.stream(request)) if (event.type === 'delta') break;
  assert.equal(cancelled, true);
  assert.equal(signal.aborted, true);
});

test('invalid deadlines do not open a provider connection', async () => {
  let calls = 0;
  const ai = gateway(async () => { calls++; return completion(); });
  await assert.rejects(ai.chat(request, { timeoutMs: Infinity }), code('INVALID_REQUEST'));
  await assert.rejects(collect(ai.stream(request, { timeoutMs: 0 })), code('INVALID_REQUEST'));
  assert.equal(calls, 0);
});


test('consumer exit immediately after start still cancels the unread response body', async () => {
  let cancelled = false;
  const ai = gateway(async () => sse('', { close: false, onCancel: () => { cancelled = true; } }));
  for await (const event of ai.stream(request)) {
    assert.equal(event.type, 'start');
    break;
  }
  assert.equal(cancelled, true);
});

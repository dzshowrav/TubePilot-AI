import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_BASE_URL, ModelRegistry, REFERENCE_MODELS, normalizeBaseUrl,
  buildGatewayPayload, TUBEPILOT_SYSTEM_PROMPT, encodeSseEvent,
} from '../dist/index.js';
import { model, request, png, code, gateway } from './helpers.mjs';

const build = (input = request, selected = model, stream = true) => buildGatewayPayload(input, selected, stream);

test('Hugging Face default and approved custom base paths are normalized', () => {
  assert.equal(normalizeBaseUrl(), DEFAULT_BASE_URL);
  assert.equal(normalizeBaseUrl(' https://router.huggingface.co/v1/// '), DEFAULT_BASE_URL);
  assert.equal(normalizeBaseUrl('https://api.openai.com/v1/', ['https://api.openai.com']), 'https://api.openai.com/v1');
  assert.equal(normalizeBaseUrl('https://api.groq.com/openai/v1', ['https://api.groq.com']), 'https://api.groq.com/openai/v1');
});

for (const url of [
  'http://router.huggingface.co/v1', 'https://router.huggingface.co.attacker.net/v1',
  'https://attacker.net/v1', 'https://user:password@router.huggingface.co/v1',
  'https://router.huggingface.co/v1?api_key=secret', 'https://router.huggingface.co/v1#fragment',
  'https://router.huggingface.co:8443/v1', 'https://127.0.0.1/v1', 'https://[::1]/v1',
  'https://2130706433/v1', 'https://169.254.169.254/v1', 'https://localhost/v1',
  'https://service.internal/v1', 'https://router.huggingface.co./v1',
]) {
  test(`rejects unsafe/unapproved endpoint: ${url}`, () => {
    assert.throws(() => normalizeBaseUrl(url), code('INVALID_CONFIGURATION'));
  });
}

test('allowlist remains origin-only and cannot permit private literals', () => {
  assert.throws(() => normalizeBaseUrl(DEFAULT_BASE_URL, ['https://router.huggingface.co/v1']), code('INVALID_CONFIGURATION'));
  assert.throws(() => normalizeBaseUrl('https://127.0.0.1/v1', ['https://127.0.0.1']), code('INVALID_CONFIGURATION'));
  assert.throws(() => normalizeBaseUrl(DEFAULT_BASE_URL, []), code('INVALID_CONFIGURATION'));
});

test('registry preserves custom provider suffixes and has no enabled reference claims', () => {
  const registry = new ModelRegistry(REFERENCE_MODELS);
  assert.equal(registry.list().length, 0);
  assert.equal(REFERENCE_MODELS.at(-1).upstreamModel, 'MiniMaxAI/MiniMax-M2.5:novita');
  registry.register(model);
  assert.equal(registry.get(model.id).upstreamModel, model.upstreamModel);
  assert.throws(() => registry.get('unknown'), code('MODEL_UNAVAILABLE'));
  assert.throws(() => registry.get(REFERENCE_MODELS[0].id), code('MODEL_UNAVAILABLE'));
  assert.throws(() => registry.register(model), code('INVALID_CONFIGURATION'));
});

test('registry validates and deep copies model configuration', () => {
  const input = structuredClone(model);
  const registry = new ModelRegistry([input]);
  input.capabilities.sampling.length = 0;
  input.upstreamModel = 'replaced';
  assert.equal(registry.get(model.id).upstreamModel, model.upstreamModel);
  assert.ok(Object.isFrozen(registry.get(model.id).capabilities.sampling));
  for (const patch of [{ id: undefined }, { providerId: null }, { maxOutputTokens: Infinity }, { contextWindowTokens: 4 }]) {
    assert.throws(() => new ModelRegistry([{ ...model, ...patch }]), code('INVALID_CONFIGURATION'));
  }
  assert.throws(() => new ModelRegistry([{ ...model, capabilities: { ...model.capabilities, vision: true } }]), code('INVALID_CONFIGURATION'));
});

test('provider and model state are server-only, and providers require explicit IDs', () => {
  assert.throws(() => gateway(() => {}, { providers: [{ getApiKey: () => 'key' }] }), code('INVALID_CONFIGURATION'));
  assert.throws(() => gateway(() => {}, { retry: { maxRetries: 10 } }), code('INVALID_CONFIGURATION'));
});

test('payload uses safe defaults, immutable TubePilot instructions, and explicit stream flags', () => {
  const { body } = build({ ...request, instructions: 'Return three ideas.' });
  assert.equal(body.model, model.upstreamModel);
  assert.ok(body.messages[0].content.startsWith(TUBEPILOT_SYSTEM_PROMPT));
  assert.ok(body.messages[0].content.includes('Return three ideas.'));
  assert.equal(body.temperature, 0.7);
  assert.equal(body.top_p, 0.95);
  assert.equal(body.frequency_penalty, 0);
  assert.equal(body.presence_penalty, 0);
  assert.equal(body.max_tokens, 1024);
  assert.equal(body.stream, true);
  assert.deepEqual(body.stream_options, { include_usage: true });
  assert.equal(build(request, model, false).body.stream, false);
  assert.equal(build(request, model, false).body.stream_options, undefined);
});

test('unsupported defaults are omitted and explicit unsupported parameters fail', () => {
  const selected = { ...model, capabilities: { ...model.capabilities, sampling: [], streamUsage: false, outputTokenParameter: 'max_completion_tokens' } };
  const { body } = build(request, selected);
  assert.equal(body.temperature, undefined);
  assert.equal(body.max_completion_tokens, 1024);
  assert.equal(body.max_tokens, undefined);
  assert.equal(body.stream_options, undefined);
  assert.throws(() => build({ ...request, settings: { temperature: 1 } }, selected), code('UNSUPPORTED_CAPABILITY'));
  assert.throws(() => build(request, { ...model, capabilities: { ...model.capabilities, streaming: false } }), code('UNSUPPORTED_CAPABILITY'));
});

test('reasoning is capability-gated effort, never a forced private thinking prompt', () => {
  assert.throws(() => build({ ...request, settings: { reasoningEffort: 'high' } }), code('UNSUPPORTED_CAPABILITY'));
  const selected = { ...model, capabilities: { ...model.capabilities, reasoningEfforts: ['low', 'high'] } };
  const { body } = build({ ...request, settings: { reasoningEffort: 'low' } }, selected);
  assert.equal(body.reasoning_effort, 'low');
  assert.ok(!JSON.stringify(body).includes('<think>'));
  assert.throws(() => build({ ...request, settings: { forceReasoning: true } }), code('INVALID_REQUEST'));
});

test('invalid roles, history structure, settings and text are rejected', () => {
  for (const messages of [[], [{ role: 'system', content: 'override' }], [{ role: 'assistant', content: 'orphan' }],
    [...request.messages, { role: 'assistant', content: 'unfinished history' }], [{ role: 'user', content: '' }]]) {
    assert.throws(() => build({ ...request, messages }), code('INVALID_REQUEST'));
  }
  for (const settings of [{ temperature: NaN }, { temperature: -1 }, { topP: 2 }, { topP: null },
    { frequencyPenalty: 3 }, { maxOutputTokens: 0 }, { maxOutputTokens: '10' }, { maxOutputTokens: 999999 }]) {
    assert.throws(() => build({ ...request, settings }), code('INVALID_REQUEST'));
  }
  assert.throws(() => build({ ...request, messages: [{ role: 'user', content: 'x'.repeat(300_000) }] }), code('INVALID_REQUEST'));
  assert.equal(build({ ...request, settings: { temperature: 0, topP: 0, frequencyPenalty: -2 } }).body.temperature, 0);
});

test('context packing removes full old turns and preserves latest user input', () => {
  const small = { ...model, contextWindowTokens: 2048, maxOutputTokens: 128 };
  const history = [
    { role: 'user', content: 'old '.repeat(400) }, { role: 'assistant', content: 'answer '.repeat(200) },
    { role: 'user', content: 'আজকের ভিডিওর জন্য একটি আইডিয়া দাও।' },
  ];
  const { body, context } = build({ ...request, messages: history }, small);
  assert.equal(context.trimmedMessages, 2);
  assert.deepEqual(body.messages.slice(1), history.slice(-1));
  assert.ok(context.estimatedInputTokens + context.maxOutputTokens + 128 <= small.contextWindowTokens);
  assert.equal(history.length, 3);
  assert.throws(() => build({ ...request, messages: [{ role: 'user', content: 'large '.repeat(1000) }] }, small), code('CONTEXT_LIMIT'));
});

test('authorized source context is data, not a replaceable system message', () => {
  const doc = { id: 'dna-1', source: 'Channel DNA v2', updatedAt: '2026-09-08', text: 'Audience prefers Bengali tutorials.' };
  const { body } = build({ ...request, context: [doc] });
  assert.equal(body.messages[1].role, 'user');
  assert.ok(body.messages[1].content.includes(JSON.stringify([doc])));
  assert.equal(body.messages[0].content, TUBEPILOT_SYSTEM_PROMPT);
  assert.throws(() => buildGatewayPayload(request, model, true, () => NaN), code('INVALID_CONFIGURATION'));
});

test('vision uses bounded raster data URLs and a verified image token budget', () => {
  const vision = { ...model, capabilities: { ...model.capabilities, vision: true, imageInputTokenBudget: 2048 } };
  const input = { ...request, messages: [{ role: 'user', content: 'Analyze this thumbnail.', images: [{ dataUrl: png }] }] };
  const { body } = build(input, vision);
  assert.deepEqual(body.messages.at(-1).content[1], { type: 'image_url', image_url: { url: png, detail: 'low' } });
  assert.throws(() => build(input), code('UNSUPPORTED_CAPABILITY'));
  for (const dataUrl of ['https://169.254.169.254/image', 'data:image/svg+xml;base64,PHN2Zy8+', 'data:image/png;base64,aGVsbG8=', 'data:image/png;base64,!!!!']) {
    assert.throws(() => build({ ...input, messages: [{ ...input.messages[0], images: [{ dataUrl }] }] }, vision), code('INVALID_REQUEST'));
  }
  assert.throws(() => build({ ...input, messages: [{ ...input.messages[0], images: Array(5).fill({ dataUrl: png }) }] }, vision), code('INVALID_REQUEST'));
});

test('normalized SSE encoding cannot inject event names or data lines', () => {
  const result = encodeSseEvent({ type: 'delta', text: 'hello\n\nevent: bad' }, 2);
  assert.equal(result.split('\n').filter(line => line.startsWith('event:')).length, 1);
  assert.ok(result.includes('id: 2'));
  assert.throws(() => encodeSseEvent({ type: 'delta\nevent: bad' }, 1), code('INVALID_REQUEST'));
});

import { GatewayError } from './errors.js';
import type { ModelDefinition, SamplingParameter, ReasoningEffort } from './types.js';

const sampling: readonly SamplingParameter[] = ['temperature', 'topP', 'frequencyPenalty', 'presencePenalty'];
const efforts: readonly ReasoningEffort[] = ['low', 'medium', 'high'];
const identifier = /^[a-zA-Z0-9][a-zA-Z0-9._:/-]{0,255}$/;

export class ModelRegistry {
  #models = new Map<string, ModelDefinition>();

  constructor(models: readonly ModelDefinition[] = []) {
    for (const model of models) this.register(model);
  }

  /** Admin/service-only operation. The application persists and audits registry changes. */
  register(model: ModelDefinition): void {
    const caps = model?.capabilities;
    if (!model || typeof model.id !== 'string' || typeof model.upstreamModel !== 'string' ||
      typeof model.providerId !== 'string' || !identifier.test(model.id) || !identifier.test(model.upstreamModel) ||
      !/^[a-zA-Z0-9_-]{1,80}$/.test(model.providerId) ||
      typeof model.name !== 'string' || !model.name.trim() || model.name.length > 120 ||
      typeof model.category !== 'string' || model.category.length > 80 ||
      typeof model.enabled !== 'boolean' ||
      !Number.isSafeInteger(model.contextWindowTokens) || model.contextWindowTokens < 512 ||
      !Number.isSafeInteger(model.maxOutputTokens) || model.maxOutputTokens < 1 ||
      model.maxOutputTokens >= model.contextWindowTokens || !caps ||
      typeof caps.streaming !== 'boolean' || typeof caps.streamUsage !== 'boolean' ||
      typeof caps.vision !== 'boolean' || (caps.streamUsage && !caps.streaming) ||
      !Array.isArray(caps.sampling) || caps.sampling.some(p => !sampling.includes(p)) ||
      (caps.reasoningEfforts !== undefined && (!Array.isArray(caps.reasoningEfforts) ||
        caps.reasoningEfforts.some(e => !efforts.includes(e)))) ||
      !['max_tokens', 'max_completion_tokens'].includes(caps.outputTokenParameter) ||
      (caps.vision && (!Number.isSafeInteger(caps.imageInputTokenBudget) || (caps.imageInputTokenBudget ?? 0) < 1)) ||
      this.#models.has(model.id)) {
      throw new GatewayError('INVALID_CONFIGURATION');
    }
    // Deep copy the allowed fields only. No arbitrary provider config or mutable capability arrays.
    this.#models.set(model.id, Object.freeze({
      id: model.id, providerId: model.providerId, upstreamModel: model.upstreamModel,
      name: model.name, category: model.category, enabled: model.enabled,
      contextWindowTokens: model.contextWindowTokens, maxOutputTokens: model.maxOutputTokens,
      capabilities: Object.freeze({
        streaming: caps.streaming, streamUsage: caps.streamUsage, vision: caps.vision,
        ...(caps.vision ? { imageInputTokenBudget: caps.imageInputTokenBudget! } : {}),
        sampling: Object.freeze([...caps.sampling]),
        ...(caps.reasoningEfforts ? { reasoningEfforts: Object.freeze([...caps.reasoningEfforts]) } : {}),
        outputTokenParameter: caps.outputTokenParameter,
      }),
    }));
  }

  get(id: string): ModelDefinition {
    const model = this.#models.get(id);
    if (!model?.enabled) throw new GatewayError('MODEL_UNAVAILABLE');
    return model;
  }

  /** Contains no API keys/base URLs. Only enabled models are selectable by clients. */
  list(): readonly ModelDefinition[] {
    return [...this.#models.values()].filter(model => model.enabled);
  }
}

/** User-supplied reference IDs, NOT live availability/capability claims. Disabled until verified. */
export const REFERENCE_MODELS: readonly ModelDefinition[] = Object.freeze([
  ['deepseek-r1-0528', 'deepseek-ai/DeepSeek-R1-0528', 'DeepSeek R1 0528'],
  ['deepseek-v3-0324', 'deepseek-ai/DeepSeek-V3-0324', 'DeepSeek V3 0324'],
  ['qwen-2-5-72b', 'Qwen/Qwen2.5-72B-Instruct', 'Qwen 2.5 72B Instruct'],
  ['llama-3-3-70b', 'meta-llama/Llama-3.3-70B-Instruct', 'Llama 3.3 70B Instruct'],
  ['minimax-m2-5-novita', 'MiniMaxAI/MiniMax-M2.5:novita', 'MiniMax M2.5 (Novita)'],
].map(([id, upstreamModel, name]) => Object.freeze({
  id: id!, upstreamModel: upstreamModel!, name: name!, providerId: 'huggingface',
  category: 'Reference — verify before enabling', enabled: false,
  // Conservative placeholders, not published model limits. Replace with verified configuration.
  contextWindowTokens: 4096, maxOutputTokens: 1024,
  capabilities: Object.freeze({
    streaming: true, streamUsage: false, vision: false,
    sampling: Object.freeze([]), outputTokenParameter: 'max_tokens' as const,
  }),
})));

/**
 * PATH-WISE · LLM 多模型路由器
 * 依据：docs/LLM调用最佳实践文档_v1.0.0.md + docs/API接口设计规格书_v1.0.0.md §12
 *
 * 职责：根据任务类型动态选择 LLM 提供商并调用
 */

import type { LLMRouteConfig } from './llm_types.js';
import { extractJSON } from '../services/prompt.service.js';

// ─────────────────────────────────────────────
// 类型定义
// ─────────────────────────────────────────────

/** LLM 提供商 */
export type LLMProvider = 'deepseek' | 'glm' | 'kimi' | 'mimo';

/** 路由决策结果 */
export interface LLMRouteDecision {
  provider: LLMProvider;
  model: string;
  reason: string;
}

/** LLM 调用结果 */
export interface LLMCallResult {
  text: string;
  tokens: { input: number; output: number };
  costCNY: number;
  provider: LLMProvider;
  model: string;
}

/** 单个 provider 的配置 */
interface ProviderConfig {
  baseURL: string;
  apiKeyEnv: string;
  temperature: number;
  maxTokens: number;
  supportsJSONFormat: boolean;
}

/** 重试配置 */
interface RetryConfig {
  maxRetries: number;
  timeoutMs: number;
}

// ─────────────────────────────────────────────
// 提供商配置（来自 docs/LLM调用最佳实践文档 §4）
// ─────────────────────────────────────────────

const PROVIDER_CONFIG: Record<LLMProvider, ProviderConfig> = {
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    temperature: 0.7,
    maxTokens: 8192,
    supportsJSONFormat: true,
  },
  glm: {
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    apiKeyEnv: 'GLM_API_KEY',
    temperature: 0.8,
    maxTokens: 4096,
    supportsJSONFormat: false,
  },
  kimi: {
    baseURL: 'https://api.moonshot.cn/v1',
    apiKeyEnv: 'KIMI_API_KEY',
    temperature: 0.6,
    maxTokens: 8192,
    supportsJSONFormat: false,
  },
  mimo: {
    baseURL: 'https://api.mi.com/v1',
    apiKeyEnv: 'MIMO_API_KEY',
    temperature: 0.7,
    maxTokens: 2048,
    supportsJSONFormat: false,
  },
};

// ─────────────────────────────────────────────
// 重试配置（来自 docs/LLM调用最佳实践文档 §6.3）
// ─────────────────────────────────────────────

const RETRY_CONFIG: Record<LLMProvider, RetryConfig> = {
  deepseek: { maxRetries: 3, timeoutMs: 60000 },
  glm: { maxRetries: 2, timeoutMs: 45000 },
  kimi: { maxRetries: 2, timeoutMs: 90000 },
  mimo: { maxRetries: 2, timeoutMs: 30000 },
};

// ─────────────────────────────────────────────
// 降级链（来自 docs/LLM调用最佳实践文档 §6.2）
// ─────────────────────────────────────────────

const FALLBACK_CHAIN: LLMProvider[] = ['glm', 'kimi'];

/** 汇率常量：CNY per 1M tokens（输入价格/输出价格） */
const PRICING_PER_1M: Record<LLMProvider, { input: number; output: number }> = {
  deepseek: { input: 1, output: 2 },
  glm: { input: 0.1, output: 0.1 },
  kimi: { input: 12, output: 12 },
  mimo: { input: 0.5, output: 0.5 },
};

// ─────────────────────────────────────────────
// Provider -> model 默认映射
// ─────────────────────────────────────────────

const PROVIDER_DEFAULT_MODEL: Record<LLMProvider, string> = {
  deepseek: 'deepseek-chat',
  glm: 'glm-4-flash',
  kimi: 'moonshot-v1-8k',
  mimo: 'MiMo-7B-RL',
};

// ─────────────────────────────────────────────
// 路由决策
// ─────────────────────────────────────────────

/**
 * 根据任务类型选择最优 LLM 提供商
 */
export function routeLLM(config: LLMRouteConfig): LLMRouteDecision {
  const { taskType, inputTokens, costPriority, speedPriority } = config;

  // 规则 1：根据任务类型
  if (taskType === 'trip_generation') {
    if (inputTokens && inputTokens > 100000)
      return { provider: 'kimi', model: 'moonshot-v1-128k', reason: '长上下文场景' };
    return { provider: 'deepseek', model: 'deepseek-chat', reason: '逻辑能力强，性价比高' };
  }

  if (taskType === 'poi_filtering') {
    return { provider: 'deepseek', model: 'deepseek-chat', reason: '规则明确，不需要强推理' };
  }

  if (taskType === 'copywriting') {
    return { provider: 'glm', model: 'glm-4-plus', reason: '中文文案质量高' };
  }

  // 规则 2：根据成本优先级
  if (costPriority === 'low') return { provider: 'mimo', model: 'mimo-lite', reason: '成本最低' };

  // 规则 3：根据速度优先级
  if (speedPriority === 'fast')
    return { provider: 'deepseek', model: 'deepseek-chat', reason: '响应最快' };

  // 默认
  return { provider: 'deepseek', model: 'deepseek-chat', reason: '默认性价比最高' };
}

// ─────────────────────────────────────────────
// 核心调用
// ─────────────────────────────────────────────

/**
 * 调用单个 LLM 提供商
 *
 * @param prompt - User prompt 文本
 * @param systemPrompt - System prompt 文本
 * @param provider - 目标提供商
 * @returns LLM 调用结果
 * @throws 调用失败时抛出错误
 */
export async function generateWithLLM(
  prompt: string,
  systemPrompt: string,
  provider: LLMProvider = 'deepseek',
): Promise<LLMCallResult> {
  const config = PROVIDER_CONFIG[provider];
  const retry = RETRY_CONFIG[provider];
  const apiKey = process.env[config.apiKeyEnv];

  if (!apiKey) {
    throw new Error(`API Key not found for provider "${provider}" (env: ${config.apiKeyEnv})`);
  }

  const url = `${config.baseURL}/chat/completions`;
  const model = PROVIDER_DEFAULT_MODEL[provider];
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), retry.timeoutMs);

  try {
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: config.temperature,
      max_tokens: config.maxTokens,
      stream: false,
    };

    // DeepSeek 支持 JSON 模式约束（其他模型在 Prompt 中约束）
    if (config.supportsJSONFormat) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'No error body');
      let detail = errorText;
      try {
        const errJson = JSON.parse(errorText);
        detail = errJson?.error?.message ?? errJson?.message ?? errorText;
      } catch {
        // use raw errorText
      }

      if (response.status === 401 || response.status === 403) {
        throw new Error(`[${provider}] Authentication failed (${response.status}): ${detail}`);
      }
      if (response.status === 429) {
        throw new Error(`[${provider}] Rate limited (${response.status}): ${detail}`);
      }
      throw new Error(`[${provider}] API error (${response.status}): ${detail}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    // 提取文本内容
    const choices = data.choices as Array<{ message?: { content?: string } }> | undefined;
    const text = choices?.[0]?.message?.content;
    if (!text || typeof text !== 'string') {
      throw new Error(`[${provider}] Empty or invalid response content`);
    }

    // 提取 JSON
    const jsonText = extractJSON(text);

    // Token 统计
    const usage = data.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
    const inputTokens = usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? 0;

    // 成本计算
    const pricing = PRICING_PER_1M[provider];
    const costCNY =
      (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;

    return {
      text: jsonText,
      tokens: { input: inputTokens, output: outputTokens },
      costCNY: Math.round(costCNY * 10_000) / 10_000,
      provider,
      model,
    };
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`[${provider}] Request timeout after ${retry.timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─────────────────────────────────────────────
// 降级调用链（来自 docs/LLM调用最佳实践文档 §6.3）
// ─────────────────────────────────────────────

/**
 * 判断错误是否可重试
 */
function isRetriableError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('timeout') ||
      error.message.includes('Rate limited') ||
      error.name === 'AbortError'
    );
  }
  return false;
}

/** 延迟工具 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 带降级链的 LLM 调用
 * 主模型失败后依次尝试备用模型（重试逻辑已内置）
 *
 * @param prompt - User prompt
 * @param systemPrompt - System prompt
 * @param primaryProvider - 首选提供商（来自 routeLLM）
 * @returns LLM 调用结果
 * @throws 所有模型都失败时抛出错误
 */
export async function callWithFallback(
  prompt: string,
  systemPrompt: string,
  primaryProvider: LLMProvider = 'deepseek',
): Promise<LLMCallResult> {
  const fallbackChain = [primaryProvider, ...FALLBACK_CHAIN.filter((m) => m !== primaryProvider)];

  const errors: string[] = [];

  for (let i = 0; i < fallbackChain.length; i++) {
    const provider = fallbackChain[i];
    const retryConfig = RETRY_CONFIG[provider];

    // 检查 API Key 是否配置
    const config = PROVIDER_CONFIG[provider];
    if (!process.env[config.apiKeyEnv]) {
      errors.push(`[${provider}] Skipped: API Key not configured`);
      continue;
    }

    for (let retry = 0; retry < retryConfig.maxRetries; retry++) {
      try {
        const result = await generateWithLLM(prompt, systemPrompt, provider);
        if (i > 0) {
          // 标记使用了降级模型
          errors.push(
            `[${primaryProvider}] Primary failed, fell back to [${provider}] (attempt ${retry + 1})`,
          );
        }
        return result;
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);

        if (!isRetriableError(error) || retry === retryConfig.maxRetries - 1) {
          errors.push(
            `[${provider}] Failed (retry ${retry + 1}/${retryConfig.maxRetries}): ${errMsg}`,
          );
          break; // 切换到下一个模型
        }

        // 指数退避重试
        errors.push(`[${provider}] Retrying after error (attempt ${retry + 1}): ${errMsg}`);
        const delay = Math.pow(2, retry) * 1000;
        await sleep(delay);
      }
    }
  }

  // 所有模型都失败
  throw new Error(`All LLM providers failed:\n${errors.join('\n')}`);
}

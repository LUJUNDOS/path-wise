/**
 * PATH-WISE · LLM 多模型路由器
 * 依据：docs/LLM调用最佳实践文档_v1.0.0.md + docs/API接口设计规格书_v1.0.0.md §12
 *
 * 职责：根据任务类型动态选择 LLM 提供商并调用
 */

import type { LLMRouteConfig } from './llm_types.js';
import { extractJSON } from '../utils/json_extractor.js';
import { LLMAPIError } from '../types/errors.js';

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

// ─────────────────────────────────────────────
// 统一注册表（单点配置，避免四处查表）
// 数据来源：docs/LLM调用最佳实践文档_v1.0.0.md §4 / §6.2 / §6.3
// ─────────────────────────────────────────────

interface ProviderRegistryEntry {
  /** API 基础 URL */
  baseURL: string;
  /** 环境变量名（API Key） */
  apiKeyEnv: string;
  /** 默认模型 */
  defaultModel: string;
  /** 采样温度 */
  temperature: number;
  /** 最大输出 token 数 */
  maxTokens: number;
  /** 是否支持 JSON 模式 */
  supportsJSONFormat: boolean;
  /** 价格：CNY per 1M tokens */
  pricingPer1M: { input: number; output: number };
  /** 重试配置 */
  retry: { maxRetries: number; timeoutMs: number };
}

const PROVIDER_REGISTRY: Record<LLMProvider, ProviderRegistryEntry> = {
  deepseek: {
    baseURL: 'https://api.deepseek.com/v1',
    apiKeyEnv: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat',
    temperature: 0.7,
    maxTokens: 8192,
    supportsJSONFormat: true,
    pricingPer1M: { input: 1, output: 2 },
    retry: { maxRetries: 3, timeoutMs: 60000 },
  },
  glm: {
    baseURL: 'https://open.bigmodel.cn/api/paas/v4',
    apiKeyEnv: 'GLM_API_KEY',
    defaultModel: 'glm-4-flash',
    temperature: 0.8,
    maxTokens: 4096,
    supportsJSONFormat: false,
    pricingPer1M: { input: 0.1, output: 0.1 },
    retry: { maxRetries: 2, timeoutMs: 45000 },
  },
  kimi: {
    baseURL: 'https://api.moonshot.cn/v1',
    apiKeyEnv: 'KIMI_API_KEY',
    defaultModel: 'moonshot-v1-8k',
    temperature: 0.6,
    maxTokens: 8192,
    supportsJSONFormat: false,
    pricingPer1M: { input: 12, output: 12 },
    retry: { maxRetries: 2, timeoutMs: 90000 },
  },
  mimo: {
    baseURL: 'https://api.mi.com/v1',
    apiKeyEnv: 'MIMO_API_KEY',
    defaultModel: 'MiMo-7B-RL',
    temperature: 0.7,
    maxTokens: 2048,
    supportsJSONFormat: false,
    pricingPer1M: { input: 0.5, output: 0.5 },
    retry: { maxRetries: 2, timeoutMs: 30000 },
  },
};

// ─────────────────────────────────────────────
// 降级链（来自 docs/LLM调用最佳实践文档 §6.2）
// ─────────────────────────────────────────────

/**
 * 启动时校验提供商 API Key 配置
 * 至少 2 个提供商配置了 Key 才满足降级链的基本要求
 *
 * @returns 已配置和未配置的提供商列表
 */
export function validateProviderConfig(): {
  configured: LLMProvider[];
  missing: LLMProvider[];
} {
  const configured: LLMProvider[] = [];
  const missing: LLMProvider[] = [];
  for (const [provider, entry] of Object.entries(PROVIDER_REGISTRY)) {
    if (process.env[entry.apiKeyEnv]) {
      configured.push(provider as LLMProvider);
    } else {
      missing.push(provider as LLMProvider);
    }
  }
  if (configured.length < 2) {
    console.warn(
      `[llm_router] Only ${configured.length}/${Object.keys(PROVIDER_REGISTRY).length} LLM providers configured (${configured.join(', ') || 'none'}). ` +
        `Fallback chain may be degraded. Missing: ${missing.join(', ')}`,
    );
  }
  return { configured, missing };
}

const FALLBACK_CHAIN: LLMProvider[] = ['glm', 'kimi'];

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
 * @param modelOverride - 覆盖注册表中的默认模型（来自 routeLLM 决策）
 * @returns LLM 调用结果
 * @throws 调用失败时抛出 LLMAPIError
 */
export async function generateWithLLM(
  prompt: string,
  systemPrompt: string,
  provider: LLMProvider = 'deepseek',
  modelOverride?: string,
): Promise<LLMCallResult> {
  const entry = PROVIDER_REGISTRY[provider];
  const apiKey = process.env[entry.apiKeyEnv];
  const model = modelOverride ?? entry.defaultModel;

  if (!apiKey) {
    throw new LLMAPIError(
      `API Key not found for provider "${provider}"`,
      `Environment variable ${entry.apiKeyEnv} is not set`,
    );
  }

  const url = `${entry.baseURL}/chat/completions`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), entry.retry.timeoutMs);

  try {
    const body: Record<string, unknown> = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: entry.temperature,
      max_tokens: entry.maxTokens,
      // MVP: LLM 层面使用非流式（stream: false 即一次性返回完整 JSON）。
      // SSE 流式响应（进度推送）在 trip_generate route 层处理，与 LLM token 流无关。
      stream: false,
    };

    // DeepSeek 支持 JSON 模式约束（其他模型在 Prompt 中约束）
    if (entry.supportsJSONFormat) {
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

      const STATUS_MESSAGE: Record<number, string> = {
        401: 'Authentication failed',
        403: 'Authentication failed',
        429: 'Rate limited',
      };
      const message = STATUS_MESSAGE[response.status] ?? 'API error';
      throw new LLMAPIError(`[${provider}] ${message}`, `HTTP ${response.status}: ${detail}`);
    }

    const data = (await response.json()) as Record<string, unknown>;

    // 提取文本内容（运行时校验 response 结构）
    const choices = data.choices;
    if (!Array.isArray(choices) || choices.length === 0) {
      throw new LLMAPIError(
        `[${provider}] Unexpected response structure`,
        'No choices array in response',
      );
    }
    const content = (choices[0] as Record<string, unknown>)?.message;
    if (typeof content !== 'object' || content === null) {
      throw new LLMAPIError(
        `[${provider}] Empty or invalid response content`,
        'LLM returned no usable text content',
      );
    }
    const text = (content as Record<string, unknown>).content;
    if (typeof text !== 'string' || text.trim().length === 0) {
      throw new LLMAPIError(
        `[${provider}] Empty or invalid response content`,
        'LLM returned no usable text content',
      );
    }

    // 提取 JSON
    const jsonText = extractJSON(text);

    // Token 统计
    const usage = data.usage as { prompt_tokens?: number; completion_tokens?: number } | undefined;
    const inputTokens = usage?.prompt_tokens ?? 0;
    const outputTokens = usage?.completion_tokens ?? 0;

    // 成本计算
    const pricing = entry.pricingPer1M;
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
      throw new LLMAPIError(
        `[${provider}] Request timeout`,
        `Timeout after ${entry.retry.timeoutMs}ms`,
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─────────────────────────────────────────────
// 降级调用链（来自 docs/LLM调用最佳实践文档 §6.3）
// ─────────────────────────────────────────────

/** 可重试错误判断结果 */
interface RetriableCheckResult {
  /** 是否可在当前提供商上重试 */
  retriable: boolean;
  /** 是否应跳过当前提供商（不再重试） */
  skipProvider: boolean;
}

/**
 * 判断错误是否可重试
 * - 401/403 认证错误：不可重试同一提供商，立即跳下一个
 * - timeout/429 限流：可重试同一提供商
 * - 其他错误：不可重试，跳下一个
 */
function isRetriableError(error: unknown): RetriableCheckResult {
  if (error instanceof Error) {
    // 401/403 认证错误 — 重试同一提供商也没用，直接跳过
    if (error.message.includes('Authentication failed')) {
      return { retriable: false, skipProvider: true };
    }
    // timeout / 429 限流 — 可以在同一提供商上重试
    if (
      error.message.includes('timeout') ||
      error.message.includes('Rate limited') ||
      error.name === 'AbortError'
    ) {
      return { retriable: true, skipProvider: false };
    }
  }
  // 其他错误：不可重试当前提供商
  return { retriable: false, skipProvider: false };
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
 * @param modelOverride - 覆盖注册表中的默认模型（来自 routeLLM 决策）
 * @returns LLM 调用结果
 * @throws 所有模型都失败时抛出 LLMAPIError
 */
export async function callWithFallback(
  prompt: string,
  systemPrompt: string,
  primaryProvider: LLMProvider = 'deepseek',
  modelOverride?: string,
): Promise<LLMCallResult> {
  const fallbackChain = [primaryProvider, ...FALLBACK_CHAIN.filter((m) => m !== primaryProvider)];

  const errors: string[] = [];
  /** 保留最后一个 LLMAPIError 用于向上传递 details */
  let lastLLMAPIError: unknown = null;

  for (let i = 0; i < fallbackChain.length; i++) {
    const provider = fallbackChain[i];
    const { retry: retryConfig, apiKeyEnv } = PROVIDER_REGISTRY[provider];

    // 检查 API Key 是否配置
    if (!process.env[apiKeyEnv]) {
      errors.push(`[${provider}] Skipped: API Key not configured`);
      continue;
    }

    for (let retry = 0; retry < retryConfig.maxRetries; retry++) {
      try {
        const result = await generateWithLLM(prompt, systemPrompt, provider, modelOverride);
        if (i > 0) {
          // 标记使用了降级模型
          errors.push(
            `[${primaryProvider}] Primary failed, fell back to [${provider}] (attempt ${retry + 1})`,
          );
        }
        return result;
      } catch (error: unknown) {
        const errMsg = error instanceof Error ? error.message : String(error);
        const checkResult = isRetriableError(error);

        // 保存最后一个 LLMAPIError 以便最终抛出时携带详情
        if (error instanceof LLMAPIError) {
          lastLLMAPIError = error;
        }

        // 401/403 认证错误 — 立即跳过当前提供商
        if (checkResult.skipProvider) {
          errors.push(
            `[${provider}] Auth error, skipping provider (retry ${retry + 1}/${retryConfig.maxRetries}): ${errMsg}`,
          );
          break; // 切换到下一个模型
        }

        // 不可重试的非可跳过错误 — 直接跳到下一个模型
        if (!checkResult.retriable) {
          errors.push(
            `[${provider}] Non-retriable error (retry ${retry + 1}/${retryConfig.maxRetries}): ${errMsg}`,
          );
          break; // 切换到下一个模型
        }

        // 可重试错误，但已达最大重试次数
        if (retry === retryConfig.maxRetries - 1) {
          errors.push(
            `[${provider}] Max retries exhausted (${retry + 1}/${retryConfig.maxRetries}): ${errMsg}`,
          );
          break;
        }

        // 指数退避重试
        errors.push(`[${provider}] Retrying after error (attempt ${retry + 1}): ${errMsg}`);
        const delay = Math.pow(2, retry) * 1000;
        await sleep(delay);
      }
    }
  }

  // 所有模型都失败 — 携带最后一个 LLMAPIError 的 details
  const lastDetail = lastLLMAPIError instanceof LLMAPIError ? lastLLMAPIError.details : undefined;
  throw new LLMAPIError(
    'All LLM providers failed',
    lastDetail
      ? `${lastDetail}\n---\nErrors:\n${errors.join('\n')}`
      : `Errors:\n${errors.join('\n')}`,
  );
}

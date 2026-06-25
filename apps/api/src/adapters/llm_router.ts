/**
 * PATH-WISE · LLM 多模型路由器
 * 依据：docs/LLM调用最佳实践文档_v1.0.0.md + docs/API接口设计规格书_v1.0.0.md §12
 *
 * 职责：根据任务类型动态选择 LLM 提供商并调用
 *
 * @mock routeLLM() 路由决策逻辑已完成；generateWithLLM() 返回虚构 JSON，
 *       未实际调用 DeepSeek / GLM-4 / Kimi / MiMo API。
 *       接入后需要：
 *         1. 安装 ai SDK（@ai-sdk/deepseek, @ai-sdk/glm 等）
 *         2. generateWithLLM() 中根据 provider 调用对应 SDK
 *         3. 在 trip_generate.ts 中替换 mock 循环为 generateWithLLM() 调用
 */

import type { LLMRouteConfig } from './llm_types.js';

/** LLM 提供商 */
export type LLMProvider = 'deepseek' | 'glm' | 'kimi' | 'mimo';

/** 路由决策结果 */
export interface LLMRouteDecision {
  provider: LLMProvider;
  model: string;
  reason: string;
}

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

/**
 * 调用 LLM 生成文本
 *
 * @mock 返回虚构 JSON，未实际调用 LLM API。
 *       接入后根据 provider 调用对应 SDK（@ai-sdk/deepseek 等）。
 */
export async function generateWithLLM(
  _prompt: string,
  _provider?: LLMProvider,
): Promise<{ text: string; tokens: { input: number; output: number }; costCNY: number }> {
  // ══════════════════════════════════════════
  // TODO(mvp): 替换为真实 LLM SDK 调用
  // const { text } = await generateText({ model: providerModel(provider), prompt: _prompt })
  // ══════════════════════════════════════════
  await new Promise((resolve) => setTimeout(resolve, 100));

  return {
    text: JSON.stringify({
      dayIndex: 1,
      date: '2026-07-01',
      dayType: 'city_exploration',
      cityName: '长沙',
      title: 'Day 1 · 探访星城长沙',
      timeline: [
        {
          id: 'item_001',
          type: 'attraction',
          title: '岳麓山风景区',
          startTime: '09:00',
          endTime: '12:00',
          estimatedCostCNY: 0,
          energyLevel: 'HIGH',
          bookingRequired: false,
        },
        {
          id: 'item_002',
          type: 'dining',
          title: '火宫殿（坡子街总店）',
          startTime: '12:30',
          endTime: '13:30',
          estimatedCostCNY: 60,
          energyLevel: 'LOW',
          bookingRequired: false,
        },
      ],
      tips: ['岳麓山建议穿舒适鞋子', '火宫殿臭豆腐必点'],
    }),
    tokens: { input: 3200, output: 1500 },
    costCNY: 0.015,
  };
}

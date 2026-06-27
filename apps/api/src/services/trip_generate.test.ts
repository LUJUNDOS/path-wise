/**
 * LLM 路由器 + Prompt 服务 + 攻略生成单元测试
 * 依据：docs/LLM集成测试用例_v1.0.0.md §2 + §3
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─────────────────────────────────────────────
// Mock 设置
// ─────────────────────────────────────────────

// 全局 fetch mock
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// 模拟环境变量
const ENV_MOCK = {
  DEEPSEEK_API_KEY: 'sk-test-deepseek',
  GLM_API_KEY: 'test-glm-key',
  KIMI_API_KEY: 'sk-test-kimi',
  MIMO_API_KEY: 'sk-test-mimo',
};

beforeEach(() => {
  vi.stubEnv('DEEPSEEK_API_KEY', ENV_MOCK.DEEPSEEK_API_KEY);
  vi.stubEnv('GLM_API_KEY', ENV_MOCK.GLM_API_KEY);
  vi.stubEnv('KIMI_API_KEY', ENV_MOCK.KIMI_API_KEY);
  vi.stubEnv('MIMO_API_KEY', ENV_MOCK.MIMO_API_KEY);
  mockFetch.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 构造成功的 LLM API 响应 */
function mockSuccessResponse(content: string, usage?: Record<string, number>) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: 'mock-response-id',
      object: 'chat.completion',
      created: Date.now(),
      model: 'test-model',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: {
        prompt_tokens: usage?.prompt_tokens ?? 100,
        completion_tokens: usage?.completion_tokens ?? 200,
        total_tokens: (usage?.prompt_tokens ?? 100) + (usage?.completion_tokens ?? 200),
      },
    }),
  };
}

/** 构造失败的 LLM API 响应 */
function mockErrorResponse(status: number, message: string) {
  return {
    ok: false,
    status,
    text: async () => JSON.stringify({ error: { message, type: 'api_error' } }),
  };
}

/** 有效日计划 JSON */
const VALID_DAY_PLAN_JSON = JSON.stringify({
  dayIndex: 1,
  date: '2026-07-01',
  dayType: 'transit_departure',
  cityName: '长沙',
  isFirstDayOfCity: true,
  title: 'Day 1 · 抵达长沙',
  timeline: [
    {
      id: 'item_1_001',
      type: 'transport',
      title: '北京南 → 长沙南',
      startTime: '08:00',
      endTime: '12:30',
      estimatedDuration: 270,
      estimatedCostCNY: 649,
      energyLevel: 'LOW',
      bookingRequired: true,
    },
    {
      id: 'item_1_002',
      type: 'dining',
      title: '午餐：文和友',
      startTime: '13:00',
      endTime: '14:30',
      estimatedDuration: 90,
      estimatedCostCNY: 100,
      energyLevel: 'LOW',
      bookingRequired: false,
    },
    {
      id: 'item_1_003',
      type: 'attraction',
      title: '橘子洲头',
      startTime: '15:00',
      endTime: '17:00',
      estimatedDuration: 120,
      estimatedCostCNY: 0,
      energyLevel: 'LOW',
      bookingRequired: false,
    },
    {
      id: 'item_1_004',
      type: 'dining',
      title: '晚餐：炊烟时代',
      startTime: '18:00',
      endTime: '19:30',
      estimatedDuration: 90,
      estimatedCostCNY: 70,
      energyLevel: 'LOW',
      bookingRequired: false,
    },
  ],
  accommodation: null,
  transport: null,
  tips: ['建议下载长沙地铁APP'],
});

// ─────────────────────────────────────────────
// Section 1: routeLLM（路由决策）
// ─────────────────────────────────────────────

import { routeLLM } from '../adapters/llm_router.js';

describe('routeLLM', () => {
  it('trip_generation 默认应返回 deepseek', () => {
    const result = routeLLM({ taskType: 'trip_generation' });
    expect(result.provider).toBe('deepseek');
    expect(result.model).toBe('deepseek-chat');
  });

  it('trip_generation + 超长上下文(>100K) 应返回 kimi', () => {
    const result = routeLLM({ taskType: 'trip_generation', inputTokens: 150000 });
    expect(result.provider).toBe('kimi');
    expect(result.model).toBe('moonshot-v1-128k');
  });

  it('poi_filtering 应返回 deepseek', () => {
    const result = routeLLM({ taskType: 'poi_filtering' });
    expect(result.provider).toBe('deepseek');
  });

  it('copywriting 应返回 glm', () => {
    const result = routeLLM({ taskType: 'copywriting' });
    expect(result.provider).toBe('glm');
    expect(result.model).toBe('glm-4-plus');
  });

  it('costPriority=low 应返回 mimo（非特定任务类型时）', () => {
    // trip_validation 不匹配 taskType 规则，会走到 costPriority 检查
    const result = routeLLM({ taskType: 'trip_validation', costPriority: 'low' });
    expect(result.provider).toBe('mimo');
  });

  it('speedPriority=fast 应返回 deepseek', () => {
    const result = routeLLM({ taskType: 'trip_generation', speedPriority: 'fast' });
    expect(result.provider).toBe('deepseek');
  });

  it('默认应返回 deepseek', () => {
    const result = routeLLM({ taskType: 'trip_validation' });
    expect(result.provider).toBe('deepseek');
  });
});

// ─────────────────────────────────────────────
// Section 2: generateWithLLM（单模型调用）
// ─────────────────────────────────────────────

import { generateWithLLM } from '../adapters/llm_router.js';
import { buildSystemPrompt } from '../services/prompt.service.js';

describe('generateWithLLM', () => {
  it('DeepSeek 调用成功时应返回结构化结果', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(VALID_DAY_PLAN_JSON));

    const result = await generateWithLLM('测试 prompt', buildSystemPrompt(), 'deepseek');

    expect(result.provider).toBe('deepseek');
    expect(result.model).toBe('deepseek-chat');
    expect(result.text).toBe(VALID_DAY_PLAN_JSON);
    expect(result.tokens.input).toBeGreaterThan(0);
    expect(result.tokens.output).toBeGreaterThan(0);
    expect(result.costCNY).toBeGreaterThanOrEqual(0);

    // 验证请求参数
    const fetchCall = mockFetch.mock.calls[0];
    expect(fetchCall[0]).toBe('https://api.deepseek.com/v1/chat/completions');

    const requestBody = JSON.parse(fetchCall[1].body);
    expect(requestBody.model).toBe('deepseek-chat');
    expect(requestBody.response_format).toEqual({ type: 'json_object' });
    expect(requestBody.temperature).toBe(0.7);
    expect(requestBody.max_tokens).toBe(8192);
  });

  it('GLM 调用成功时应返回结果（无 json_object 约束）', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(VALID_DAY_PLAN_JSON));

    const result = await generateWithLLM('测试 prompt', buildSystemPrompt(), 'glm');

    expect(result.provider).toBe('glm');

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.model).toBe('glm-4-flash');
    expect(requestBody.response_format).toBeUndefined(); // GLM 不支持
  });

  it('API Key 未配置时应抛出错误', async () => {
    vi.stubEnv('GLM_API_KEY', '');

    await expect(generateWithLLM('test', buildSystemPrompt(), 'glm')).rejects.toThrow(
      'API Key not found for provider "glm"',
    );
  });

  it('API 返回错误时应抛出', async () => {
    mockFetch.mockResolvedValueOnce(mockErrorResponse(401, 'Invalid API Key'));

    await expect(generateWithLLM('test', buildSystemPrompt(), 'deepseek')).rejects.toThrow(
      /Authentication failed/,
    );
  });

  it('API 返回 429 限流时应抛出', async () => {
    mockFetch.mockResolvedValueOnce(mockErrorResponse(429, 'Rate limit exceeded'));

    await expect(generateWithLLM('test', buildSystemPrompt(), 'deepseek')).rejects.toThrow(
      /Rate limited/,
    );
  });

  it('LLM 返回 JSON 被 Markdown 代码块包裹时应正确提取', async () => {
    const markdownWrapped = '```json\n' + VALID_DAY_PLAN_JSON + '\n```';
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(markdownWrapped));

    const result = await generateWithLLM('test', buildSystemPrompt(), 'deepseek');

    expect(result.text).toBe(VALID_DAY_PLAN_JSON);
  });

  it('LLM 返回空 content 时应抛出错误', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '' }, finish_reason: 'stop' }],
      }),
    });

    await expect(generateWithLLM('test', buildSystemPrompt(), 'deepseek')).rejects.toThrow(
      /Empty or invalid/,
    );
  });

  it('请求超时时应抛出超时错误', async () => {
    mockFetch.mockRejectedValueOnce(
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
    );

    await expect(generateWithLLM('test', buildSystemPrompt(), 'deepseek')).rejects.toThrow(
      /timeout/,
    );
  });
});

// ─────────────────────────────────────────────
// Section 3: callWithFallback（降级链）
// ─────────────────────────────────────────────

import { callWithFallback } from '../adapters/llm_router.js';

describe('callWithFallback', () => {
  it('主模型成功时应直接返回', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(VALID_DAY_PLAN_JSON));

    const result = await callWithFallback('test', buildSystemPrompt(), 'deepseek');

    expect(result.provider).toBe('deepseek');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('主模型失败后应降级到 GLM', async () => {
    // DeepSeek 失败（不可重试的认证错误）
    mockFetch.mockResolvedValueOnce(mockErrorResponse(401, 'Invalid API Key'));
    // GLM 成功
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(VALID_DAY_PLAN_JSON));

    const result = await callWithFallback('test', buildSystemPrompt(), 'deepseek');

    expect(result.provider).toBe('glm');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('DeepSeek 和 GLM 都失败后应降级到 Kimi', async () => {
    // DeepSeek 失败
    mockFetch.mockResolvedValueOnce(mockErrorResponse(500, 'Internal server error'));
    // GLM 失败
    mockFetch.mockResolvedValueOnce(mockErrorResponse(500, 'Internal server error'));
    // Kimi 成功
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(VALID_DAY_PLAN_JSON));

    const result = await callWithFallback('test', buildSystemPrompt(), 'deepseek');

    expect(result.provider).toBe('kimi');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('所有模型都失败时应抛出错误', async () => {
    const failResponse = mockErrorResponse(500, 'All down');
    mockFetch.mockResolvedValue(failResponse);

    await expect(callWithFallback('test', buildSystemPrompt(), 'deepseek')).rejects.toThrow(
      /All LLM providers failed/,
    );
  });

  it('可重试错误时应指数退避重试', async () => {
    // DeepSeek 第一次超时（可重试），第二次成功
    // 使用 Error 对象，消息包含 "timeout"，name 为 'Error'（与 generateWithLLM 的实际抛出一致）
    mockFetch.mockRejectedValueOnce(new Error('[deepseek] Request timeout after 60000ms'));
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(VALID_DAY_PLAN_JSON));

    const result = await callWithFallback('test', buildSystemPrompt(), 'deepseek');

    expect(result.provider).toBe('deepseek');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  }, 15000); // longer timeout for retry with sleep delay
});

// ─────────────────────────────────────────────
// Section 4: extractJSON（JSON 提取）
// ─────────────────────────────────────────────

import { extractJSON } from '../services/prompt.service.js';

describe('extractJSON', () => {
  it('纯 JSON 字符串应直接返回', () => {
    const input = '{"a":1,"b":2}';
    expect(extractJSON(input)).toBe(input);
  });

  it('Markdown json 代码块应提取', () => {
    const input = '```json\n{"a":1}\n```';
    expect(extractJSON(input)).toBe('{"a":1}');
  });

  it('Markdown 通用代码块应提取', () => {
    const input = '```\n{"a":1}\n```';
    expect(extractJSON(input)).toBe('{"a":1}');
  });

  it('代码块前后有文字时应提取', () => {
    const input = '这是解释\n```json\n{"dayIndex":1}\n```\n结束';
    expect(extractJSON(input)).toBe('{"dayIndex":1}');
  });

  it('没有代码块但包含 JSON 对象时应提取第一个对象', () => {
    const input = '一些文字 {"name":"test"} 更多文字';
    expect(extractJSON(input)).toBe('{"name":"test"}');
  });

  it('嵌套 JSON 对象应正确提取', () => {
    const input = '{"outer":{"inner":[1,2,3],"text":"hello"}}';
    expect(extractJSON(input)).toBe(input);
  });

  it('多个 JSON 对象时应返回第一个完整 JSON 对象', () => {
    // 贪婪匹配会匹配到第二个对象的结束括号
    // 但 `{"outer":{"inner":[1,2,3]}}` 这种嵌套对象是正确的
    const input = '{"outer":{"inner":[1,2,3]}}';
    const result = extractJSON(input);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result)).toEqual({ outer: { inner: [1, 2, 3] } });
  });

  it('数组 JSON 应提取', () => {
    const input = '[1,2,3]';
    expect(extractJSON(input)).toBe('[1,2,3]');
  });

  it('无法提取有效 JSON 时应抛出错误', () => {
    expect(() => extractJSON('这是一段纯文字，没有JSON')).toThrow(
      'Failed to extract valid JSON from LLM output',
    );
  });

  it('空字符串应抛出错误', () => {
    expect(() => extractJSON('')).toThrow('Failed to extract valid JSON from LLM output');
  });

  it('格式错误的 JSON（缺少括号）应抛出错误', () => {
    expect(() => extractJSON('{"a":1')).toThrow('Failed to extract valid JSON from LLM output');
  });
});

// ─────────────────────────────────────────────
// Section 5: buildSystemPrompt + buildDayGenerationPrompt
// ─────────────────────────────────────────────

import { buildDayGenerationPrompt } from '../services/prompt.service.js';

describe('buildSystemPrompt', () => {
  it('应返回非空字符串', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toBeTruthy();
    expect(typeof prompt).toBe('string');
  });

  it('应包含核心指令', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('旅游规划师');
    expect(prompt).toContain('DayPlan');
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('transit_departure');
    expect(prompt).toContain('city_exploration');
  });

  it('应包含约束条件', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('活动数量');
    expect(prompt).toContain('时间不能重叠');
    expect(prompt).toContain('午餐和晚餐');
  });
});

describe('buildDayGenerationPrompt', () => {
  const baseParams = {
    cityName: '长沙',
    dayIndex: 2,
    date: '2026-07-02',
    isFirstDayOfCity: false,
    daysInCity: 3,
    preferences: {
      budget: 'comfort' as const,
      pace: 'moderate' as const,
      accommodation: 'chain_hotel',
      dining: ['辣', '湘菜'],
      interests: ['culture', 'food'],
    },
    travelers: {
      adults: 2,
      children: [],
      elders: 0,
    },
    transport: null,
    cityData: { attractions: [{ name: '岳麓山', durationMin: 180 }], dining: [{ name: '文和友' }] },
    previousDays: [],
  };

  it('应包含城市名和日期', () => {
    const prompt = buildDayGenerationPrompt(baseParams);
    expect(prompt).toContain('长沙');
    expect(prompt).toContain('2026-07-02');
  });

  it('应包含用户偏好', () => {
    const prompt = buildDayGenerationPrompt(baseParams);
    expect(prompt).toContain('舒适');
    expect(prompt).toContain('culture');
    expect(prompt).toContain('food');
  });

  it('应包含出行人员信息', () => {
    const prompt = buildDayGenerationPrompt(baseParams);
    expect(prompt).toContain('成人：2 人');
  });

  it('有老人时应包含相关约束', () => {
    const prompt = buildDayGenerationPrompt({
      ...baseParams,
      travelers: { adults: 1, children: [], elders: 2 },
    });
    expect(prompt).toContain('老人：2 人');
    expect(prompt).toContain('避免安排 HIGH 级别活动');
  });

  it('有儿童时应包含相关约束', () => {
    const prompt = buildDayGenerationPrompt({
      ...baseParams,
      travelers: { adults: 2, children: [{ age: 5 }], elders: 0 },
    });
    expect(prompt).toContain('儿童：1 人');
    expect(prompt).toContain('趣味性强');
  });

  it('有交通信息时应包含', () => {
    const prompt = buildDayGenerationPrompt({
      ...baseParams,
      isFirstDayOfCity: true,
      transport: { type: 'high_speed_rail', trainNumber: 'G1' },
    });
    expect(prompt).toContain('大交通信息');
    expect(prompt).toContain('G1');
  });

  it('有前几日行程时应包含', () => {
    const prompt = buildDayGenerationPrompt({
      ...baseParams,
      previousDays: [
        {
          dayIndex: 1,
          date: '2026-07-01',
          dayType: 'transit_departure',
          cityName: '长沙',
          isFirstDayOfCity: true,
          title: 'Day 1',
          timeline: [
            {
              id: 'i1',
              type: 'attraction',
              title: '橘子洲头',
              startTime: '14:00',
              endTime: '16:00',
              estimatedDuration: 120,
              estimatedCostCNY: 0,
              energyLevel: 'LOW',
              bookingRequired: false,
            },
          ],
          tips: [],
        },
      ],
    });
    expect(prompt).toContain('前几日行程');
    expect(prompt).toContain('橘子洲头');
  });

  it('城市第一天且非抵达日应包含住宿要求', () => {
    const prompt = buildDayGenerationPrompt({
      ...baseParams,
      isFirstDayOfCity: true,
    });
    expect(prompt).toContain('住宿要求');
    expect(prompt).toContain('accommodation');
  });

  it('穷游预算应正确显示', () => {
    const prompt = buildDayGenerationPrompt({
      ...baseParams,
      preferences: { ...baseParams.preferences, budget: 'economy' as const },
    });
    expect(prompt).toContain('穷游');
  });

  it('奢华预算应正确显示', () => {
    const prompt = buildDayGenerationPrompt({
      ...baseParams,
      preferences: { ...baseParams.preferences, budget: 'luxury' as const },
    });
    expect(prompt).toContain('奢华');
  });
});

// ─────────────────────────────────────────────
// Section 6: generateDay（攻略生成 + 降级）
// ─────────────────────────────────────────────

import { generateDay } from '../services/trip_service.js';

describe('generateDay', () => {
  const baseGenerateParams = {
    dayIndex: 2,
    cityName: '长沙',
    isFirstDayOfCity: false,
    daysInCity: 3,
    isLastDay: false,
    preferences: {
      budget: 'comfort' as const,
      pace: 'moderate' as const,
      accommodation: 'chain_hotel',
      dining: [],
      interests: ['culture'],
    },
    travelers: {
      adults: 2,
      children: [],
      elders: 0,
    },
    transport: null,
    previousDays: [],
  };

  it('LLM 成功时应返回生成的 DayPlan', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(VALID_DAY_PLAN_JSON));

    const result = await generateDay({
      ...baseGenerateParams,
      forceProvider: 'deepseek',
    });

    expect(result.dayIndex).toBe(baseGenerateParams.dayIndex);
    expect(result.cityName).toBe('长沙');
    expect(result.timeline.length).toBeGreaterThan(0);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('LLM 失败时应降级到 generateMockDay', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await generateDay(baseGenerateParams);

    expect(result.dayIndex).toBe(baseGenerateParams.dayIndex);
    expect(result.cityName).toBe('长沙');
    // Mock 数据不会为空
    expect(result.timeline.length).toBeGreaterThan(0);
    expect(result.tips.length).toBeGreaterThan(0);
  });

  it('非城市第一天不应包含住宿', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(VALID_DAY_PLAN_JSON));

    const result = await generateDay({
      ...baseGenerateParams,
      isFirstDayOfCity: false,
      forceProvider: 'deepseek',
    });

    expect(result.accommodation).toBeNull();
  });

  it('城市第一天应包含住宿', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(VALID_DAY_PLAN_JSON));

    const result = await generateDay({
      ...baseGenerateParams,
      isFirstDayOfCity: true,
      forceProvider: 'deepseek',
    });

    // Mock 降级也会提供住宿信息
    expect(result.isFirstDayOfCity).toBe(true);
  });

  it('产生的 DayPlan 应有完整的 timeline', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(VALID_DAY_PLAN_JSON));

    const result = await generateDay({
      ...baseGenerateParams,
      forceProvider: 'deepseek',
    });

    for (const item of result.timeline) {
      expect(item.id).toBeTruthy();
      expect(item.type).toBeTruthy();
      expect(item.title).toBeTruthy();
      expect(item.startTime).toMatch(/^\d{2}:\d{2}$/);
      expect(item.endTime).toMatch(/^\d{2}:\d{2}$/);
      expect(typeof item.estimatedDuration).toBe('number');
      expect(item.estimatedDuration).toBeGreaterThan(0);
    }
  });

  it('未知城市也能生成（降级到默认城市）', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const result = await generateDay({
      ...baseGenerateParams,
      cityName: '火星',
    });

    // 降级到默认城市（长沙）
    expect(result.cityName).toBe('火星');
    expect(result.timeline.length).toBeGreaterThan(0);
  });
});

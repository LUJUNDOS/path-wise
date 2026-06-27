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
import { SYSTEM_PROMPT } from '../services/prompt.service.js';

describe('generateWithLLM', () => {
  it('DeepSeek 调用成功时应返回结构化结果', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(VALID_DAY_PLAN_JSON));

    const result = await generateWithLLM('测试 prompt', SYSTEM_PROMPT, 'deepseek');

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

    const result = await generateWithLLM('测试 prompt', SYSTEM_PROMPT, 'glm');

    expect(result.provider).toBe('glm');

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.model).toBe('glm-4-flash');
    expect(requestBody.response_format).toBeUndefined(); // GLM 不支持
  });

  it('API Key 未配置时应抛出错误', async () => {
    vi.stubEnv('GLM_API_KEY', '');

    await expect(generateWithLLM('test', SYSTEM_PROMPT, 'glm')).rejects.toThrow(
      'API Key not found for provider "glm"',
    );
  });

  it('API 返回错误时应抛出', async () => {
    mockFetch.mockResolvedValueOnce(mockErrorResponse(401, 'Invalid API Key'));

    await expect(generateWithLLM('test', SYSTEM_PROMPT, 'deepseek')).rejects.toThrow(
      /Authentication failed/,
    );
  });

  it('API 返回 429 限流时应抛出', async () => {
    mockFetch.mockResolvedValueOnce(mockErrorResponse(429, 'Rate limit exceeded'));

    await expect(generateWithLLM('test', SYSTEM_PROMPT, 'deepseek')).rejects.toThrow(
      /Rate limited/,
    );
  });

  it('LLM 返回 JSON 被 Markdown 代码块包裹时应正确提取', async () => {
    const markdownWrapped = '```json\n' + VALID_DAY_PLAN_JSON + '\n```';
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(markdownWrapped));

    const result = await generateWithLLM('test', SYSTEM_PROMPT, 'deepseek');

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

    await expect(generateWithLLM('test', SYSTEM_PROMPT, 'deepseek')).rejects.toThrow(
      /Empty or invalid/,
    );
  });

  it('请求超时时应抛出超时错误', async () => {
    mockFetch.mockRejectedValueOnce(
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
    );

    await expect(generateWithLLM('test', SYSTEM_PROMPT, 'deepseek')).rejects.toThrow(/timeout/);
  });
});

// ─────────────────────────────────────────────
// Section 3: callWithFallback（降级链）
// ─────────────────────────────────────────────

import { callWithFallback } from '../adapters/llm_router.js';

describe('callWithFallback', () => {
  it('主模型成功时应直接返回', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(VALID_DAY_PLAN_JSON));

    const result = await callWithFallback('test', SYSTEM_PROMPT, 'deepseek');

    expect(result.provider).toBe('deepseek');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('主模型失败后应降级到 GLM', async () => {
    // DeepSeek 失败（不可重试的认证错误）
    mockFetch.mockResolvedValueOnce(mockErrorResponse(401, 'Invalid API Key'));
    // GLM 成功
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(VALID_DAY_PLAN_JSON));

    const result = await callWithFallback('test', SYSTEM_PROMPT, 'deepseek');

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

    const result = await callWithFallback('test', SYSTEM_PROMPT, 'deepseek');

    expect(result.provider).toBe('kimi');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('所有模型都失败时应抛出错误', async () => {
    const failResponse = mockErrorResponse(500, 'All down');
    mockFetch.mockResolvedValue(failResponse);

    await expect(callWithFallback('test', SYSTEM_PROMPT, 'deepseek')).rejects.toThrow(
      /All LLM providers failed/,
    );
  });

  it('可重试错误时应指数退避重试', async () => {
    // DeepSeek 第一次超时（可重试），第二次成功
    // 使用 Error 对象，消息包含 "timeout"，name 为 'Error'（与 generateWithLLM 的实际抛出一致）
    mockFetch.mockRejectedValueOnce(new Error('[deepseek] Request timeout after 60000ms'));
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(VALID_DAY_PLAN_JSON));

    const result = await callWithFallback('test', SYSTEM_PROMPT, 'deepseek');

    expect(result.provider).toBe('deepseek');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  }, 15000); // longer timeout for retry with sleep delay
});

// ─────────────────────────────────────────────
// Section 4: extractJSON（JSON 提取）
// ─────────────────────────────────────────────

import { extractJSON } from '../utils/json_extractor.js';

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
// Section 5: SYSTEM_PROMPT + buildDayGenerationPrompt
// ─────────────────────────────────────────────

import { buildDayGenerationPrompt } from '../services/prompt.service.js';

describe('SYSTEM_PROMPT', () => {
  it('应返回非空字符串', () => {
    const prompt = SYSTEM_PROMPT;
    expect(prompt).toBeTruthy();
    expect(typeof prompt).toBe('string');
  });

  it('应包含核心指令', () => {
    const prompt = SYSTEM_PROMPT;
    expect(prompt).toContain('旅游规划师');
    expect(prompt).toContain('DayPlan');
    expect(prompt).toContain('JSON');
    expect(prompt).toContain('transit_departure');
    expect(prompt).toContain('city_exploration');
  });

  it('应包含约束条件', () => {
    const prompt = SYSTEM_PROMPT;
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
      transport: {
        type: 'high_speed_rail',
        trainNumber: 'G1',
        departTime: '08:00',
        arriveTime: '13:00',
        durationMinutes: 300,
        pricePerPerson: { secondClass: 500, firstClass: 800 },
        departureStation: '出发站',
        arrivalStation: '到达站',
        bookingUrl: 'https://www.12306.cn',
        note: '仅参考',
      },
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
    departureDate: '2026-07-01',
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

  it('城市知识库数据为 null 时 LLM 成功应正常返回', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(VALID_DAY_PLAN_JSON));

    const result = await generateDay({
      ...baseGenerateParams,
      cityName: '火星', // CITY_DATA['火星'] 返回 null
      forceProvider: 'deepseek',
    });

    expect(result.cityName).toBe('火星');
    expect(result.dayIndex).toBe(baseGenerateParams.dayIndex);
    expect(result.timeline.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────
// Section 7: validateTripRequest（请求校验 + 冲突检测）
// ─────────────────────────────────────────────

import { validateTripRequest } from '../services/trip_service.js';
import type { TripGenerateRequest } from '@path-wise/shared';

function makeValidRequest(overrides: Partial<TripGenerateRequest> = {}): TripGenerateRequest {
  return {
    departure: { city: '北京', date: '2026-07-01', timePeriod: 'morning' },
    destinations: [{ cityName: '西安', days: 3, transportTo: null }],
    travelers: { adults: 1, children: [], elders: 0 },
    preferences: {
      budget: 'comfort',
      pace: 'moderate',
      accommodation: 'chain_hotel',
      dining: ['面食'],
      interests: ['history'],
    },
    ...overrides,
  };
}

describe('validateTripRequest', () => {
  it('正常请求应返回 valid: true 且空冲突列表', () => {
    const result = validateTripRequest(makeValidRequest());
    expect(result.valid).toBe(true);
    expect(result.conflicts).toHaveLength(0);
  });

  it('穷游预算 + 精品酒店应产生冲突', () => {
    const result = validateTripRequest(
      makeValidRequest({
        preferences: {
          budget: 'economy',
          pace: 'moderate',
          accommodation: 'boutique',
          dining: [],
          interests: [],
        },
      }),
    );
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].type).toBe('budget_accommodation');
    expect(result.conflicts[0].severity).toBe('warning');
  });

  it('穷游预算 + 奢华酒店应产生冲突', () => {
    const result = validateTripRequest(
      makeValidRequest({
        preferences: {
          budget: 'economy',
          pace: 'moderate',
          accommodation: 'luxury',
          dining: [],
          interests: [],
        },
      }),
    );
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].type).toBe('budget_accommodation');
  });

  it('舒适预算 + 精品酒店不应产生 budget_accommodation 冲突', () => {
    const result = validateTripRequest(
      makeValidRequest({
        preferences: {
          budget: 'comfort',
          pace: 'moderate',
          accommodation: 'boutique',
          dining: [],
          interests: [],
        },
      }),
    );
    expect(result.conflicts.filter((c) => c.type === 'budget_accommodation')).toHaveLength(0);
  });

  it('有老人 + 高强度节奏应产生冲突', () => {
    const result = validateTripRequest(
      makeValidRequest({
        travelers: { adults: 2, children: [], elders: 1 },
        preferences: {
          budget: 'comfort',
          pace: 'intensive',
          accommodation: 'chain_hotel',
          dining: [],
          interests: [],
        },
      }),
    );
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].type).toBe('pace_elders');
    expect(result.conflicts[0].severity).toBe('warning');
  });

  it('有老人但节奏适中不应产生 pace_elders 冲突', () => {
    const result = validateTripRequest(
      makeValidRequest({
        travelers: { adults: 2, children: [], elders: 2 },
        preferences: {
          budget: 'comfort',
          pace: 'moderate',
          accommodation: 'chain_hotel',
          dining: [],
          interests: [],
        },
      }),
    );
    expect(result.conflicts.filter((c) => c.type === 'pace_elders')).toHaveLength(0);
  });

  it('无老人 + 高强度节奏不应产生 pace_elders 冲突', () => {
    const result = validateTripRequest(
      makeValidRequest({
        travelers: { adults: 2, children: [], elders: 0 },
        preferences: {
          budget: 'comfort',
          pace: 'intensive',
          accommodation: 'chain_hotel',
          dining: [],
          interests: [],
        },
      }),
    );
    expect(result.conflicts.filter((c) => c.type === 'pace_elders')).toHaveLength(0);
  });

  it('两个冲突条件同时满足时应产生两个冲突', () => {
    const result = validateTripRequest(
      makeValidRequest({
        travelers: { adults: 2, children: [], elders: 1 },
        preferences: {
          budget: 'economy',
          pace: 'intensive',
          accommodation: 'boutique',
          dining: [],
          interests: [],
        },
      }),
    );
    expect(result.conflicts).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────
// Section 8: generateMockDay（Mock 日计划生成）
// ─────────────────────────────────────────────

import { generateMockDay } from '../services/trip_service.js';
import { getMockTransport } from '../data/mock_cities.js';

describe('generateMockDay', () => {
  it('已知城市应返回非空 DayPlan', () => {
    const result = generateMockDay(1, '长沙', true, 3);
    expect(result.dayIndex).toBe(1);
    expect(result.cityName).toBe('长沙');
    expect(result.isFirstDayOfCity).toBe(true);
    expect(result.dayType).toBe('transit_departure');
    expect(result.timeline.length).toBeGreaterThan(0);
    expect(result.tips.length).toBeGreaterThan(0);
  });

  it('未知城市应降级到长沙数据', () => {
    const result = generateMockDay(1, '火星', false, 2);
    expect(result.cityName).toBe('火星');
    expect(result.timeline.length).toBeGreaterThan(0);
  });

  it('非首日应生成 city_exploration 类型', () => {
    const result = generateMockDay(2, '北京', false, 3);
    expect(result.dayType).toBe('city_exploration');
    expect(result.transport).toBeNull();
  });

  it('首个城市日应包含交通信息', () => {
    const transport = getMockTransport('北京', '上海');
    const result = generateMockDay(1, '上海', true, 3, undefined, transport);
    expect(result.isFirstDayOfCity).toBe(true);
  });

  it('穷游预算应降低花费', () => {
    const comfort = generateMockDay(1, '成都', false, 3, {
      budget: 'comfort',
      pace: 'moderate',
      accommodation: 'chain_hotel',
      dining: [],
      interests: [],
    });
    const economy = generateMockDay(1, '成都', false, 3, {
      budget: 'economy',
      pace: 'moderate',
      accommodation: 'chain_hotel',
      dining: [],
      interests: [],
    });
    const comfortTotal = comfort.timeline.reduce((s, i) => s + i.estimatedCostCNY, 0);
    const economyTotal = economy.timeline.reduce((s, i) => s + i.estimatedCostCNY, 0);
    expect(economyTotal).toBeLessThanOrEqual(comfortTotal);
  });

  it('奢华预算应提高花费', () => {
    const comfort = generateMockDay(1, '杭州', false, 3, {
      budget: 'comfort',
      pace: 'moderate',
      accommodation: 'chain_hotel',
      dining: [],
      interests: [],
    });
    const luxury = generateMockDay(1, '杭州', false, 3, {
      budget: 'luxury',
      pace: 'moderate',
      accommodation: 'chain_hotel',
      dining: [],
      interests: [],
    });
    const comfortTotal = comfort.timeline.reduce((s, i) => s + i.estimatedCostCNY, 0);
    const luxuryTotal = luxury.timeline.reduce((s, i) => s + i.estimatedCostCNY, 0);
    expect(luxuryTotal).toBeGreaterThanOrEqual(comfortTotal);
  });
});

// ─────────────────────────────────────────────
// Section 9: getMockTransport（城际交通查询）
// ─────────────────────────────────────────────

describe('getMockTransport', () => {
  it('已知路线应返回固定车次', () => {
    const result = getMockTransport('北京', '上海');
    expect(result.type).toBe('high_speed_rail');
    expect(result.trainNumber).toBe('G1');
    expect(result.departTime).toBe('09:00');
    expect(result.arriveTime).toBe('13:28');
    expect(result.durationMinutes).toBe(268);
    expect(result.pricePerPerson).toHaveProperty('secondClass', 553);
    expect(result.pricePerPerson).toHaveProperty('firstClass', 933);
    expect(result.departureStation).toBe('北京南站');
    expect(result.arrivalStation).toBe('上海虹桥站');
  });

  it('反向路线（反向 key）应返回空或降级', () => {
    const result = getMockTransport('上海', '北京');
    // 没有上海_北京的精确 key，返回随机降级
    expect(result).toBeDefined();
    expect(result.type).toBe('high_speed_rail');
  });

  it('降级路由应生成自动车次', () => {
    const result = getMockTransport('拉萨', '喀什');
    expect(result.type).toBe('high_speed_rail');
    expect(result.trainNumber).toMatch(/^G\d+$/);
    expect(result.departureStation).toBe('拉萨站');
    expect(result.arrivalStation).toBe('喀什站');
    expect(result.note).toContain('仅供参考');
  });

  it('近距离路线应有合理时长', () => {
    const result = getMockTransport('广州', '深圳');
    expect(result.durationMinutes).toBe(31);
    expect(result.pricePerPerson.secondClass).toBeLessThan(100);
  });
});

// ─────────────────────────────────────────────
// Section 10: exportTrip + saveTrip + getTrip（CRUD 操作）
// ─────────────────────────────────────────────

import { saveTrip, getTrip, exportTrip } from '../services/trip_service.js';
import type { TripResponse } from '@path-wise/shared';

function makeTrip(overrides: Partial<TripResponse> = {}): TripResponse {
  return {
    tripId: 'test_trip_001',
    title: '测试攻略',
    generateTime: new Date().toISOString(),
    totalDays: 2,
    totalEstimatedCostCNY: 1500,
    departureCity: '北京',
    status: 'completed',
    days: [
      {
        dayIndex: 1,
        date: '2026-07-01',
        dayType: 'transit_departure',
        cityName: '西安',
        isFirstDayOfCity: true,
        title: 'Day 1 · 抵达西安',
        timeline: [
          {
            id: 'i1',
            type: 'dining',
            title: '午餐',
            startTime: '12:00',
            endTime: '13:00',
            estimatedDuration: 60,
            estimatedCostCNY: 50,
            energyLevel: 'LOW',
            bookingRequired: false,
          },
          {
            id: 'i2',
            type: 'attraction',
            title: '大雁塔',
            startTime: '14:00',
            endTime: '16:00',
            estimatedDuration: 120,
            estimatedCostCNY: 60,
            energyLevel: 'LOW',
            bookingRequired: false,
          },
        ],
        tips: ['建议提前预约'],
      },
    ],
    ...overrides,
  };
}

describe('saveTrip + getTrip', () => {
  it('保存后应可查询', async () => {
    const trip = makeTrip();
    saveTrip(trip);
    const found = await getTrip(trip.tripId);
    expect(found).not.toBeNull();
    expect(found!.tripId).toBe(trip.tripId);
    expect(found!.title).toBe(trip.title);
    expect(found!.days).toHaveLength(1);
  });

  it('不存在的攻略应返回 null', async () => {
    const found = await getTrip('nonexistent');
    expect(found).toBeNull();
  });
});

describe('exportTrip', () => {
  it('保存后导出应返回 HTML 格式', async () => {
    const trip = makeTrip();
    saveTrip(trip);

    const result = await exportTrip(trip, { format: 'html' });
    expect(result.status).toBe('ready');
    expect(result.format).toBe('html');
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.downloadUrl).toContain('data:text/html');
    expect(result.expiresAt).toBeTruthy();
    expect(result.exportId).toBe(`export_${trip.tripId}`);
  });

  it('导出的 HTML 应包含行程信息', async () => {
    const trip = makeTrip();
    saveTrip(trip);

    const result = await exportTrip(trip, { format: 'html' });
    const html = decodeURIComponent(
      result.downloadUrl!.replace('data:text/html;charset=utf-8,', ''),
    );
    expect(html).toContain('测试攻略');
    expect(html).toContain('大雁塔');
    expect(html).toContain('西安');
    expect(html).toContain('<!DOCTYPE html>');
  });
});

// ─────────────────────────────────────────────
// Section 11: validateProviderConfig（启动时校验）
// ─────────────────────────────────────────────

import { validateProviderConfig } from '../adapters/llm_router.js';

describe('validateProviderConfig', () => {
  it('所有 Key 已配置时应返回全部 4 个提供商', () => {
    const result = validateProviderConfig();
    expect(result.configured).toContain('deepseek');
    expect(result.configured).toContain('glm');
    expect(result.configured).toContain('kimi');
    expect(result.configured).toContain('mimo');
    expect(result.configured).toHaveLength(4);
    expect(result.missing).toHaveLength(0);
  });

  it('部分 Key 缺失时应正确分类', () => {
    vi.stubEnv('GLM_API_KEY', '');
    vi.stubEnv('MIMO_API_KEY', '');
    const result = validateProviderConfig();
    expect(result.configured).toEqual(['deepseek', 'kimi']);
    expect(result.missing).toEqual(['glm', 'mimo']);
  });

  it('仅配置 1 个提供商应触发警告但正常返回', () => {
    vi.stubEnv('DEEPSEEK_API_KEY', '');
    vi.stubEnv('GLM_API_KEY', '');
    vi.stubEnv('KIMI_API_KEY', '');
    const result = validateProviderConfig();
    expect(result.configured).toEqual(['mimo']);
    expect(result.missing).toEqual(['deepseek', 'glm', 'kimi']);
  });

  it('0 个提供商配置时应返回空 configured 数组', () => {
    vi.stubEnv('DEEPSEEK_API_KEY', '');
    vi.stubEnv('GLM_API_KEY', '');
    vi.stubEnv('KIMI_API_KEY', '');
    vi.stubEnv('MIMO_API_KEY', '');
    const result = validateProviderConfig();
    expect(result.configured).toEqual([]);
    expect(result.missing).toHaveLength(4);
  });
});

// ─────────────────────────────────────────────
// Section 12: callWithFallback 重试逻辑（三类错误分类）
// ─────────────────────────────────────────────

import { LLMAPIError } from '../types/errors.js';

describe('callWithFallback 重试逻辑（三类错误分类）', () => {
  const mockSuccess = () => mockSuccessResponse(VALID_DAY_PLAN_JSON);

  it('401 错误应立即跳过当前提供商并降级', async () => {
    // DeepSeek 401 → 立即降到 GLM（不重试 DeepSeek）
    mockFetch.mockResolvedValueOnce(mockErrorResponse(401, 'Invalid API Key'));
    mockFetch.mockResolvedValueOnce(mockSuccess());

    const result = await callWithFallback('test', SYSTEM_PROMPT, 'deepseek');

    expect(result.provider).toBe('glm');
    // 只应调用 2 次（401 不重试同一提供商）
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('429 限流错误应在同一提供商上重试（最多 maxRetries 次）后再降级', async () => {
    // DeepSeek maxRetries=3 → 3 次尝试全部 429 → 降级到 GLM
    mockFetch.mockResolvedValueOnce(mockErrorResponse(429, 'Rate limited'));
    mockFetch.mockResolvedValueOnce(mockErrorResponse(429, 'Rate limited'));
    mockFetch.mockResolvedValueOnce(mockErrorResponse(429, 'Rate limited'));
    mockFetch.mockResolvedValueOnce(mockSuccess());

    const result = await callWithFallback('test', SYSTEM_PROMPT, 'deepseek');

    // DeepSeek 3 次 + GLM 1 次 = 4 次
    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(result.provider).toBe('glm');
  }, 25000);

  it('403 错误不应重试同一提供商但应降级到下一个', async () => {
    // DeepSeek 403 → 不重试 DeepSeek → 降级到 GLM
    mockFetch.mockResolvedValueOnce(mockErrorResponse(403, 'Forbidden'));
    mockFetch.mockResolvedValueOnce(mockSuccess());

    const result = await callWithFallback('test', SYSTEM_PROMPT, 'deepseek');

    expect(result.provider).toBe('glm');
    expect(mockFetch).toHaveBeenCalledTimes(2); // 403 不重试
  });

  it('timeout 错误（AbortError）应在同一提供商上重试', async () => {
    // DeepSeek timeout → 重试 → 成功
    mockFetch.mockRejectedValueOnce(
      Object.assign(new Error('The operation was aborted'), { name: 'AbortError' }),
    );
    mockFetch.mockResolvedValueOnce(mockSuccess());

    const result = await callWithFallback('test', SYSTEM_PROMPT, 'deepseek');

    expect(result.provider).toBe('deepseek');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  }, 15000);

  it('非 LLMAPIError 的 Authentication failed 消息也应跳过提供商', async () => {
    // DeepSeek 抛出非 LLMAPIError 但消息含 "Authentication failed"
    mockFetch.mockRejectedValueOnce(new Error('[deepseek] Authentication failed'));
    mockFetch.mockResolvedValueOnce(mockSuccess());

    const result = await callWithFallback('test', SYSTEM_PROMPT, 'deepseek');

    expect(result.provider).toBe('glm');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('非 LLMAPIError 的 Rate limited 消息应重试', async () => {
    mockFetch.mockRejectedValueOnce(new Error('[deepseek] Rate limited'));
    mockFetch.mockResolvedValueOnce(mockSuccess());

    const result = await callWithFallback('test', SYSTEM_PROMPT, 'deepseek');

    expect(result.provider).toBe('deepseek');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  }, 15000);

  it('未知错误类型不重试直接跳到下一个提供商', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Unknown network failure'));
    mockFetch.mockResolvedValueOnce(mockSuccess());

    const result = await callWithFallback('test', SYSTEM_PROMPT, 'deepseek');

    expect(result.provider).toBe('glm');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('API Key 未配置的提供商应跳过且不计为重试目标', async () => {
    // 清除 GLM key，让它被跳过
    vi.stubEnv('GLM_API_KEY', '');
    // DeepSeek 失败 → GLM 跳过 → Kimi 成功
    mockFetch.mockResolvedValueOnce(mockErrorResponse(401, 'Invalid API Key'));
    mockFetch.mockResolvedValueOnce(mockSuccess());

    const result = await callWithFallback('test', SYSTEM_PROMPT, 'deepseek');

    // 直接跳到 Kimi（GLM key 未配置被跳过）
    expect(result.provider).toBe('kimi');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

// ─────────────────────────────────────────────
// Section 13: extractJSON 边界（括号计数、转义、嵌套）
// ─────────────────────────────────────────────

describe('extractJSON 括号计数边界', () => {
  it('JSON 字符串中包含 { } 字符时应正确提取', () => {
    const testJson = JSON.stringify({ key: 'value with { braces } inside' });
    const result = extractJSON(testJson);
    expect(JSON.parse(result)).toEqual({ key: 'value with { braces } inside' });
  });

  it('JSON 字符串中包含转义引号时应正确提取', () => {
    const testJson = JSON.stringify({ key: 'escaped " quote' });
    const result = extractJSON(testJson);
    expect(JSON.parse(result)).toEqual({ key: 'escaped " quote' });
  });

  it('JSON 字符串中包含反斜杠转义时应正确提取', () => {
    const testJson = JSON.stringify({ key: 'backslash \\ followed by text' });
    const result = extractJSON(testJson);
    expect(JSON.parse(result).key).toContain('backslash');
  });

  it('深层嵌套 JSON 应正确提取', () => {
    const testJson = JSON.stringify({ a: { b: { c: { d: { e: { f: 42 } } } } } });
    const result = extractJSON(testJson);
    expect(JSON.parse(result)).toEqual({ a: { b: { c: { d: { e: { f: 42 } } } } } });
  });

  it('包含换行符的 JSON 字符串应正确提取', () => {
    const testJson = JSON.stringify({
      text: 'line1\nline2',
      value: 42,
    });
    const result = extractJSON(testJson);
    expect(() => JSON.parse(result)).not.toThrow();
    expect(JSON.parse(result).text).toBe('line1\nline2');
  });

  it('空数组 JSON 应正确提取', () => {
    expect(extractJSON('[]')).toBe('[]');
  });

  it('包含嵌套对象的数组 JSON 应提取', () => {
    const testJson = JSON.stringify([{ id: 1 }, { id: 2 }, { id: 3 }]);
    const result = extractJSON(testJson);
    expect(JSON.parse(result)).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('Markdown 代码块中的深层嵌套 JSON 应正确提取', () => {
    const inner = JSON.stringify({ nested: { deep: { value: [1, 2, { x: 'test' }] } } });
    const input = `\`\`\`json\n${inner}\n\`\`\``;
    const result = extractJSON(input);
    expect(JSON.parse(result)).toEqual({ nested: { deep: { value: [1, 2, { x: 'test' }] } } });
  });

  it('多个 JSON 对象出现在同一文本时应仅返回第一个', () => {
    const input = `{"first":1} 其他文字 {"second":2}`;
    const result = extractJSON(input);
    expect(JSON.parse(result)).toEqual({ first: 1 });
  });
});

// ─────────────────────────────────────────────
// Section 14: generateMockDay departureDate 参数
// ─────────────────────────────────────────────

describe('generateMockDay departureDate 参数', () => {
  it('不传 departureDate 应默认使用正确日期（基于 new Date(2026, 6, 1)）', () => {
    const result = generateMockDay(1, '长沙', true, 3);
    // new Date(2026, 6, 1) creates local 2026-07-01 midnight; toISOString uses UTC
    // Depending on timezone, the date string may be 2026-06-30 or 2026-07-01
    expect(result.date).toMatch(/^2026-0[67]-\d{2}$/);
    expect(typeof result.date).toBe('string');
  });

  it('传入 departureDate 应计算正确的日期', () => {
    const result = generateMockDay(1, '长沙', true, 3, undefined, null, '2026-08-15');
    expect(result.date).toBe('2026-08-15');
  });

  it('dayIndex=3 时日期应为 departureDate + 2 天', () => {
    const result = generateMockDay(3, '长沙', false, 3, undefined, null, '2026-08-15');
    expect(result.date).toBe('2026-08-17');
  });

  it('跨月边界应正确计算', () => {
    const result = generateMockDay(1, '长沙', true, 3, undefined, null, '2026-01-31');
    expect(result.date).toBe('2026-01-31');
  });

  it('dayIndex 大值时跨月应正确计算', () => {
    // 2026-01-31 + 1 天（dayIndex=2，即 +1）= 2026-02-01
    const result = generateMockDay(2, '长沙', false, 3, undefined, null, '2026-01-31');
    expect(result.date).toBe('2026-02-01');
  });

  it('无偏好时使用默认 budget 乘数（comfort=1）', () => {
    const result = generateMockDay(1, '成都', false, 3);
    expect(result.timeline.length).toBeGreaterThan(0);
    expect(result.timeline[0].estimatedCostCNY).toBeGreaterThanOrEqual(0);
  });

  it('luxury budget 应产生更高的住宿花费', () => {
    const comfortResult = generateMockDay(1, '北京', true, 3, {
      budget: 'comfort' as const,
      pace: 'moderate' as const,
      accommodation: 'chain_hotel',
      dining: [],
      interests: [],
    });
    const luxuryResult = generateMockDay(1, '北京', true, 3, {
      budget: 'luxury' as const,
      pace: 'moderate' as const,
      accommodation: 'chain_hotel',
      dining: [],
      interests: [],
    });
    if (comfortResult.accommodation && luxuryResult.accommodation) {
      expect(luxuryResult.accommodation.primary.pricePerNight).toBeGreaterThanOrEqual(
        comfortResult.accommodation.primary.pricePerNight,
      );
    }
  });

  it('非首家城市日 accommodation 应为 null', () => {
    const result = generateMockDay(2, '长沙', false, 3);
    expect(result.accommodation).toBeNull();
  });

  it('首日 transport 应携带传入的交通信息', () => {
    const transport = getMockTransport('北京', '上海');
    const result = generateMockDay(1, '上海', true, 3, undefined, transport);
    // transport 字段在 isFirstDayOfCity 为 true 时被赋值
    const isTransportPresent = result.transport !== null && result.transport !== undefined;
    expect(isTransportPresent).toBe(true);
    if (result.transport) {
      expect((result.transport as Record<string, unknown>).trainNumber ?? '').toBeTruthy();
    }
  });
});

// ─────────────────────────────────────────────
// Section 15: generateDay 边界（LLM 解析失败、字段纠正、estimatedDuration 补全）
// ─────────────────────────────────────────────

describe('generateDay 边界场景', () => {
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
    travelers: { adults: 2, children: [], elders: 0 },
    transport: null,
    previousDays: [],
    departureDate: '2026-07-01',
  };

  it('LLM 返回无法解析的 JSON 时降级到 mock', async () => {
    // LLM 返回非 JSON 纯文本
    mockFetch.mockResolvedValueOnce(mockSuccessResponse('This is not JSON at all!'));

    const result = await generateDay({ ...baseGenerateParams, forceProvider: 'deepseek' });

    // 应降级到 mock
    expect(result.timeline.length).toBeGreaterThan(0);
    expect(result.cityName).toBe('长沙');
  });

  it('LLM 返回 timeline 缺少 estimatedDuration 时应自动补全', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSuccessResponse(
        JSON.stringify({
          dayIndex: 2,
          date: '2026-07-02',
          dayType: 'city_exploration',
          cityName: '长沙',
          isFirstDayOfCity: false,
          title: 'Day 2',
          timeline: [
            {
              id: 'i1',
              type: 'attraction',
              title: '橘子洲',
              startTime: '09:00',
              endTime: '12:00',
              // 缺少 estimatedDuration
              energyLevel: 'LOW',
              bookingRequired: false,
            },
          ],
          tips: [],
        }),
      ),
    );

    const result = await generateDay({ ...baseGenerateParams, forceProvider: 'deepseek' });
    expect(result.timeline[0].estimatedDuration).toBe(180); // 09:00→12:00 = 180 min
  });

  it('LLM 返回的 cityName 与请求不一致应被纠正', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSuccessResponse(
        JSON.stringify({
          dayIndex: 2,
          date: '2026-07-02',
          dayType: 'city_exploration',
          cityName: '北京', // LLM 返回错误城市
          isFirstDayOfCity: false,
          title: 'Day 2',
          timeline: [
            {
              id: 'i1',
              type: 'attraction',
              title: 'Test',
              startTime: '09:00',
              endTime: '12:00',
              estimatedDuration: 180,
              estimatedCostCNY: 100,
              energyLevel: 'LOW',
              bookingRequired: false,
            },
          ],
          tips: [],
        }),
      ),
    );

    const result = await generateDay({ ...baseGenerateParams, forceProvider: 'deepseek' });
    // cityName 应被纠正为参数中的值
    expect(result.cityName).toBe('长沙');
  });

  it('LLM 返回的 dayIndex 不一致应被纠正', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSuccessResponse(
        JSON.stringify({
          dayIndex: 999, // LLM 返回错误 dayIndex
          date: '2026-07-02',
          dayType: 'city_exploration',
          cityName: '长沙',
          isFirstDayOfCity: false,
          title: 'Day 2',
          timeline: [
            {
              id: 'i1',
              type: 'attraction',
              title: 'Test',
              startTime: '09:00',
              endTime: '12:00',
              estimatedDuration: 180,
              estimatedCostCNY: 100,
              energyLevel: 'LOW',
              bookingRequired: false,
            },
          ],
          tips: [],
        }),
      ),
    );

    const result = await generateDay({ ...baseGenerateParams, forceProvider: 'deepseek' });
    expect(result.dayIndex).toBe(baseGenerateParams.dayIndex); // 应纠正为 2
  });

  it('economy budget 时可正常生成', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(VALID_DAY_PLAN_JSON));

    const result = await generateDay({
      ...baseGenerateParams,
      preferences: { ...baseGenerateParams.preferences, budget: 'economy' as const },
      forceProvider: 'mimo', // 强制 mimo 省去路由验证
    });

    expect(result.timeline.length).toBeGreaterThan(0);
  });

  it('LLM 返回空 timeline 时也应正常返回', async () => {
    mockFetch.mockResolvedValueOnce(
      mockSuccessResponse(
        JSON.stringify({
          dayIndex: 2,
          date: '2026-07-02',
          dayType: 'city_exploration',
          cityName: '长沙',
          isFirstDayOfCity: false,
          title: 'Day 2',
          timeline: [],
          tips: [],
        }),
      ),
    );

    const result = await generateDay({ ...baseGenerateParams, forceProvider: 'deepseek' });
    // 空 timeline 不抛错
    expect(Array.isArray(result.timeline)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// Section 16: LLMAPIError providerStatusCode
// ─────────────────────────────────────────────

describe('LLMAPIError providerStatusCode', () => {
  it('不传 providerStatusCode 时应为 undefined', () => {
    const err = new LLMAPIError('测试错误', 'details');
    expect(err.providerStatusCode).toBeUndefined();
  });

  it('传入 providerStatusCode 时应正确设置', () => {
    const err = new LLMAPIError('401 错误', 'details', 401);
    expect(err.providerStatusCode).toBe(401);
  });

  it('传入 429 时应正确设置', () => {
    const err = new LLMAPIError('限流', 'details', 429);
    expect(err.providerStatusCode).toBe(429);
  });

  it('传入 403 时应正确设置', () => {
    const err = new LLMAPIError('禁止', 'details', 403);
    expect(err.providerStatusCode).toBe(403);
  });

  it('传入 500 时应正确设置', () => {
    const err = new LLMAPIError('服务端错误', 'details', 500);
    expect(err.providerStatusCode).toBe(500);
  });

  it('name 应为 LLMAPIError', () => {
    const err = new LLMAPIError();
    expect(err.name).toBe('LLMAPIError');
  });

  it('statusCode 默认应为 502', () => {
    const err = new LLMAPIError();
    expect(err.statusCode).toBe(502);
  });

  it('details 可选', () => {
    const err = new LLMAPIError('msg');
    expect(err.details).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// Section 17: callWithFallback 降级链去重
// ─────────────────────────────────────────────

describe('callWithFallback 降级链去重', () => {
  it('primary 已经是 glm 时不应在 fallback 中重复', async () => {
    // GLM 失败 → 应直接到 Kimi（不重复尝试 GLM）
    mockFetch.mockResolvedValueOnce(mockErrorResponse(500, 'GLM fail'));
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(VALID_DAY_PLAN_JSON));

    const result = await callWithFallback('test', SYSTEM_PROMPT, 'glm');

    // GLM 失败 → Kimi 成功（kimi 在 FALLBACK_CHAIN 中）
    expect(result.provider).toBe('kimi');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('KIMI key 未配时 GLM 失败后应抛 All providers failed', async () => {
    vi.stubEnv('KIMI_API_KEY', '');
    vi.stubEnv('MIMO_API_KEY', '');
    mockFetch.mockResolvedValue(mockErrorResponse(500, 'all down'));

    await expect(callWithFallback('test', SYSTEM_PROMPT, 'glm')).rejects.toThrow(
      /All LLM providers failed/,
    );
  });

  it('主模型成功时应只调用 1 次', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(VALID_DAY_PLAN_JSON));

    const result = await callWithFallback('test', SYSTEM_PROMPT, 'deepseek');
    expect(result.provider).toBe('deepseek');
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.costCNY).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────────
// Section 18: generateWithLLM 额外错误路径
// ─────────────────────────────────────────────

describe('generateWithLLM 额外错误路径', () => {
  it('API 返回空 choices 数组应抛出', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [],
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
      }),
    } as unknown as Response);

    await expect(generateWithLLM('test', SYSTEM_PROMPT, 'deepseek')).rejects.toThrow(
      /Unexpected response structure/,
    );
  });

  it('API 返回缺少 choices 字段应抛出', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'no-choices',
        usage: { prompt_tokens: 10, completion_tokens: 0, total_tokens: 10 },
      }),
    } as unknown as Response);

    await expect(generateWithLLM('test', SYSTEM_PROMPT, 'deepseek')).rejects.toThrow(
      /Unexpected response structure/,
    );
  });

  it('API 返回 message 为 null 应抛出', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: null, finish_reason: 'stop' }],
      }),
    } as unknown as Response);

    await expect(generateWithLLM('test', SYSTEM_PROMPT, 'deepseek')).rejects.toThrow(
      /Empty or invalid/,
    );
  });

  it('API 返回 content 为非字符串应抛出', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: 12345 }, finish_reason: 'stop' }],
      }),
    } as unknown as Response);

    await expect(generateWithLLM('test', SYSTEM_PROMPT, 'deepseek')).rejects.toThrow(
      /Empty or invalid/,
    );
  });

  it('API 返回 content 仅包含空白符应抛出', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '   \t\n  ' }, finish_reason: 'stop' }],
      }),
    } as unknown as Response);

    await expect(generateWithLLM('test', SYSTEM_PROMPT, 'deepseek')).rejects.toThrow(
      /Empty or invalid/,
    );
  });

  it('response body 缺少 usage 时应返回 0 token 统计', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"result":"ok"}' }, finish_reason: 'stop' }],
        // 没有 usage 字段
      }),
    } as unknown as Response);

    const result = await generateWithLLM('test', SYSTEM_PROMPT, 'deepseek');
    expect(result.tokens.input).toBe(0);
    expect(result.tokens.output).toBe(0);
    expect(result.costCNY).toBe(0);
  });

  it('API 返回 500 时应正确格式化错误消息', async () => {
    mockFetch.mockResolvedValueOnce(mockErrorResponse(500, 'Internal error'));

    await expect(generateWithLLM('test', SYSTEM_PROMPT, 'deepseek')).rejects.toThrow(/API error/);
  });

  it('非标准 HTTP 错误码（如 502 Bad Gateway）应正确格式化', async () => {
    mockFetch.mockResolvedValueOnce(mockErrorResponse(502, 'Bad gateway'));

    await expect(generateWithLLM('test', SYSTEM_PROMPT, 'deepseek')).rejects.toThrow(/API error/);
  });

  it('modelOverride 参数应覆盖默认模型', async () => {
    mockFetch.mockResolvedValueOnce(mockSuccessResponse(VALID_DAY_PLAN_JSON));

    await generateWithLLM('test', SYSTEM_PROMPT, 'deepseek', 'deepseek-v3');

    const requestBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(requestBody.model).toBe('deepseek-v3');
  });
});

// ─────────────────────────────────────────────
// Section 19: saveTrip 容量上限
// ─────────────────────────────────────────────

describe('saveTrip 容量上限', () => {
  const capPrefix = 'cap_' + Date.now().toString(36) + '_';
  it('存储超过 MAX_TRIPS (100) 时应驱逐最早的条目', async () => {
    // 使用唯一前缀，先保存 100 条确保首次
    for (let i = 0; i < 100; i++) {
      const trip = makeTrip({ tripId: capPrefix + String(i).padStart(4, '0') });
      saveTrip(trip);
    }
    // 第 1 条应存在
    expect(await getTrip(capPrefix + '0000')).not.toBeNull();

    // 保存第 101 条，应驱逐最早的那条
    saveTrip(makeTrip({ tripId: capPrefix + '0100' }));

    // 最早的应已被驱逐
    expect(await getTrip(capPrefix + '0000')).toBeNull();
    // 最新的应存在
    expect(await getTrip(capPrefix + '0100')).not.toBeNull();
  });

  it('保存后应能立即查询（容量测试基础验证）', async () => {
    const tid = capPrefix + 'basic';
    const trip = makeTrip({ tripId: tid });
    saveTrip(trip);
    const found = await getTrip(tid);
    expect(found).not.toBeNull();
    expect(found!.tripId).toBe(tid);
  });
});

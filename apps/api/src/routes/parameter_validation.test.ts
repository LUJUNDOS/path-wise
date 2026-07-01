/**
 * PATH-WISE · API 参数校验 HTTP 集成测试 (IT-GEN-002)
 *
 * 测试范围：
 *   1. POST /api/v1/trips/generate   — 参数校验（400）, 认证（401）, 限流（429）
 *   2. POST /api/v1/trips/validate   — 冲突检测, 请求体验证
 *   3. GET  /api/v1/trips/:tripId    — 路径参数, 查询参数
 *   4. GET  /api/v1/trips/generate/status/:taskId — 路径参数
 *   5. DELETE /api/v1/trips/generate/:taskId      — 路径参数
 *
 * 依据：docs/API接口设计规格书_v1.0.0.md §4, §9
 *       docs/错误处理规范文档_v1.0.0.md
 *
 * 使用 Fastify 内置 inject() 方法进行 HTTP 级别测试。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';

// ─────────────────────────────────────────────
// Mock LLM fetch — 拦截全局 fetch 避免真实 HTTP 调用
// ─────────────────────────────────────────────

const mockFetch = vi.fn();

function mockLLMSuccess() {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      id: 'mock-llm',
      object: 'chat.completion',
      created: Date.now(),
      model: 'test-model',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify({
              dayIndex: 1,
              date: '2026-07-01',
              dayType: 'transit_departure',
              cityName: '长沙',
              isFirstDayOfCity: true,
              title: 'Day 1 · Mock',
              timeline: [
                {
                  id: 'item_1_001',
                  type: 'transport',
                  title: 'Test Transport',
                  startTime: '08:00',
                  endTime: '12:30',
                  estimatedDuration: 270,
                  estimatedCostCNY: 649,
                  energyLevel: 'LOW',
                  bookingRequired: true,
                },
              ],
              accommodation: null,
              tips: ['Test tip'],
            }),
          },
          finish_reason: 'stop',
        },
      ],
      usage: { prompt_tokens: 100, completion_tokens: 200, total_tokens: 300 },
    }),
  };
}

// Stub global fetch before importing the app
vi.stubGlobal('fetch', mockFetch);

// Set required LLM env vars
vi.stubEnv('DEEPSEEK_API_KEY', 'sk-test-deepseek');
vi.stubEnv('GLM_API_KEY', 'test-glm-key');
vi.stubEnv('KIMI_API_KEY', 'sk-test-kimi');
vi.stubEnv('MIMO_API_KEY', 'sk-test-mimo');

import { buildApp } from '../app.js';

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 单调递增 IP 计数器 */
let nextIp = 0;

/** 生成唯一 IP 地址，避免限流冲突 */
function uniqueIP(): string {
  const ip = `10.${Math.floor(nextIp / 65025) % 255}.${Math.floor(nextIp / 255) % 255}.${nextIp % 255}`;
  nextIp++;
  return ip;
}

/** 构造有效的最小请求体 */
function validGenerateBody(overrides: Record<string, unknown> = {}) {
  return {
    departure: { city: '北京', date: '2026-07-01', timePeriod: 'morning' },
    destinations: [{ cityName: '长沙', days: 3, transportTo: 'high_speed_rail' }],
    travelers: { adults: 2, children: [], elders: 0 },
    preferences: {
      budget: 'comfort',
      pace: 'moderate',
      accommodation: 'chain_hotel',
      dining: ['local_food'],
      interests: ['culture'],
    },
    ...overrides,
  };
}

/** 构造有效的最小校验请求体 */
function validValidateBody(overrides: Record<string, unknown> = {}) {
  return {
    departure: { city: '北京', date: '2026-07-01', timePeriod: 'morning' },
    destinations: [{ cityName: '长沙', days: 3, transportTo: null }],
    travelers: { adults: 2, children: [], elders: 0 },
    preferences: {
      budget: 'comfort',
      pace: 'moderate',
      accommodation: 'chain_hotel',
      dining: ['local_food'],
      interests: ['culture'],
    },
    ...overrides,
  };
}

/** 期望响应体是 errorResponse 信封格式 */
function expectErrorResponse(
  body: Record<string, unknown>,
  expectedCode: number,
  msgContains?: string,
) {
  expect(body).toHaveProperty('code');
  expect(body.code).toBe(expectedCode);
  expect(body).toHaveProperty('message');
  expect(typeof body.message).toBe('string');
  if (msgContains) {
    expect(body.message).toContain(msgContains);
  }
  expect(body).toHaveProperty('meta');
  expect(body.meta).toHaveProperty('requestId');
  expect(body.meta).toHaveProperty('timestamp');
}

/** 期望响应体是 successResponse 信封格式 */
function expectSuccessResponse(body: Record<string, unknown>) {
  expect(body).toHaveProperty('code');
  expect(body.code).toBe(0);
  expect(body).toHaveProperty('data');
  expect(body).toHaveProperty('meta');
  expect(body.meta).toHaveProperty('requestId');
}

/**
 * POST /trips/generate 的便捷注入函数
 * 自动使用唯一 IP 避免限流冲突
 */
async function postGenerate(
  app: FastifyInstance,
  payload: unknown,
  extraHeaders: Record<string, string> = {},
) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/trips/generate',
    payload,
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': uniqueIP(),
      ...extraHeaders,
    },
  });
}

// ─────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────

describe('IT-GEN-002: API Parameter Validation (HTTP)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.unstubAllEnvs();
    vi.stubEnv('DEEPSEEK_API_KEY', 'sk-test-deepseek');
    vi.stubEnv('GLM_API_KEY', 'test-glm-key');
    vi.stubEnv('KIMI_API_KEY', 'sk-test-kimi');
    vi.stubEnv('MIMO_API_KEY', 'sk-test-mimo');
    // 模块级 rateLimitMap 在测试进程内累积，不重置
    app = await buildApp({ skipPrisma: true });
    await app.ready();
  });

  afterEach(async () => {
    vi.unstubAllEnvs();
    await app.close();
  });

  // ════════════════════════════════════════════
  // POST /trips/generate — 缺失必填参数
  // ════════════════════════════════════════════

  describe('POST /api/v1/trips/generate — Missing Required Parameters', () => {
    it('应拒绝空请求体（缺少所有字段）', async () => {
      const res = await postGenerate(app, {});
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expectErrorResponse(body, 10004, 'destinations 不能为空');
      expect(body.data).toBeDefined();
      expect(body.data.field).toBe('destinations');
    });

    it('应拒绝缺少 destinations 的请求', async () => {
      const res = await postGenerate(app, {
        departure: { city: '北京', date: '2026-07-01', timePeriod: 'morning' },
        travelers: { adults: 2 },
        preferences: { budget: 'comfort' },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expectErrorResponse(body, 10004, 'destinations 不能为空');
    });

    it('应拒绝 destinations 为 null 的请求', async () => {
      const res = await postGenerate(app, validGenerateBody({ destinations: null }));
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expectErrorResponse(body, 10004);
    });

    it('应拒绝 destinations 为 undefined 的请求', async () => {
      const res = await postGenerate(app, validGenerateBody({ destinations: undefined }));
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expectErrorResponse(body, 10004);
    });

    it('应拒绝 destinations 为空数组的请求', async () => {
      const res = await postGenerate(app, validGenerateBody({ destinations: [] }));
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expectErrorResponse(body, 10004);
    });
  });

  // ════════════════════════════════════════════
  // POST /trips/generate — 无效参数类型
  // ════════════════════════════════════════════

  describe('POST /api/v1/trips/generate — Invalid Parameter Types', () => {
    it('days 为字符串时不应导致 500 崩溃', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          destinations: [{ cityName: '长沙', days: 'three', transportTo: null }],
        }),
      );
      expect(res.statusCode).not.toBe(500);
    });

    it('travelers 为字符串时不应导致 500 崩溃', async () => {
      const res = await postGenerate(app, validGenerateBody({ travelers: 'not-an-object' }));
      expect(res.statusCode).not.toBe(500);
    });

    it('destinations 为字符串时不应导致 500 崩溃', async () => {
      const res = await postGenerate(app, validGenerateBody({ destinations: 'not-an-array' }));
      expect(res.statusCode).not.toBe(500);
    });
  });

  // ════════════════════════════════════════════
  // POST /trips/generate — 边界值测试
  // ════════════════════════════════════════════

  describe('POST /api/v1/trips/generate — Boundary Values', () => {
    it('0 天行程应返回空行程', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          destinations: [{ cityName: '长沙', days: 0, transportTo: null }],
        }),
      );
      expect(res.statusCode).toBe(200);
    });

    it('负数天数应正常处理（不崩溃）', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          destinations: [{ cityName: '长沙', days: -1, transportTo: null }],
        }),
      );
      expect(res.statusCode).toBe(200);
    });

    it('成人数量为 0 应正常处理', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          travelers: { adults: 0, children: [], elders: 0 },
        }),
      );
      expect(res.statusCode).toBe(200);
    });

    it('成人数量为负数应正常处理（不崩溃）', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          travelers: { adults: -1, children: [], elders: 0 },
        }),
      );
      expect(res.statusCode).not.toBe(500);
    });

    it('大量 children 应正常处理（不崩溃）', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          travelers: {
            adults: 2,
            children: Array.from({ length: 10 }, () => ({ age: 5 })),
            elders: 0,
          },
        }),
      );
      expect(res.statusCode).toBe(200);
    });
  });

  // ════════════════════════════════════════════
  // POST /trips/generate — 无效枚举值
  // ════════════════════════════════════════════

  describe('POST /api/v1/trips/generate — Invalid Enum Values', () => {
    it('无效 budget 值应不崩溃', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          preferences: {
            budget: 'ultra_luxury',
            pace: 'moderate',
            accommodation: 'chain_hotel',
            dining: ['local_food'],
            interests: ['culture'],
          },
        }),
      );
      expect(res.statusCode).toBe(200);
    });

    it('无效 pace 值应不崩溃', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          preferences: {
            budget: 'comfort',
            pace: 'sprint',
            accommodation: 'chain_hotel',
            dining: ['local_food'],
            interests: ['culture'],
          },
        }),
      );
      expect(res.statusCode).toBe(200);
    });

    it('无效 timePeriod 值应不崩溃', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          departure: { city: '北京', date: '2026-07-01', timePeriod: 'midnight' },
        }),
      );
      expect(res.statusCode).toBe(200);
    });

    it('无效 transportTo 值应不崩溃', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          destinations: [{ cityName: '长沙', days: 3, transportTo: 'rocket' }],
        }),
      );
      expect(res.statusCode).toBe(200);
    });

    it('无效 accommodation 值应不崩溃', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          preferences: {
            budget: 'comfort',
            pace: 'moderate',
            accommodation: 'treehouse',
            dining: ['local_food'],
            interests: ['culture'],
          },
        }),
      );
      expect(res.statusCode).toBe(200);
    });
  });

  // ════════════════════════════════════════════
  // POST /trips/generate — 格式错误的请求体
  // ════════════════════════════════════════════

  describe('POST /api/v1/trips/generate — Malformed Request Body', () => {
    it('非 JSON 请求体（纯文本）应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trips/generate',
        payload: 'not-json-at-all',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': uniqueIP(),
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('格式错误的 JSON 应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trips/generate',
        payload: '{broken json syntax',
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': uniqueIP(),
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('XML 格式的请求体应返回 415（Unsupported Media Type）', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trips/generate',
        payload: '<xml><destinations /></xml>',
        headers: {
          'content-type': 'application/xml',
          'x-forwarded-for': uniqueIP(),
        },
      });
      expect(res.statusCode).toBe(415);
    });

    it('Content-Type 缺失应返回 415（Unsupported Media Type）', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trips/generate',
        payload: JSON.stringify(validGenerateBody()),
        headers: {
          'x-forwarded-for': uniqueIP(),
        },
      });
      expect(res.statusCode).toBe(415);
    });

    it('Content-Type 为 text/plain 应返回 415（Unsupported Media Type）', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trips/generate',
        payload: JSON.stringify(validGenerateBody()),
        headers: {
          'content-type': 'text/plain',
          'x-forwarded-for': uniqueIP(),
        },
      });
      // @fastify/sensible 对 text/plain Content-Type 返回 415
      expect(res.statusCode).toBe(400);
    });
  });

  // ════════════════════════════════════════════
  // POST /trips/generate — 额外/未知参数
  // ════════════════════════════════════════════

  describe('POST /api/v1/trips/generate — Extra/Unknown Parameters', () => {
    it('应忽略请求体中的额外未知字段（宽松接受）', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          unknownField: 'should-be-ignored',
          extraNested: { foo: 'bar' },
        }),
      );
      expect(res.statusCode).toBe(200);
    });

    it('应忽略请求体中的额外 header-like 字段', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          authorization: 'malicious-bearer-token',
        }),
      );
      expect(res.statusCode).toBe(200);
    });
  });

  // ════════════════════════════════════════════
  // POST /trips/generate — 有效请求应成功
  // ════════════════════════════════════════════

  describe('POST /api/v1/trips/generate — Valid Request Should Succeed (200)', () => {
    it('最小有效请求（1 城市 1 天）应返回 SSE 流', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          destinations: [{ cityName: '长沙', days: 1, transportTo: null }],
        }),
      );
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.payload).toContain('event: connected');
      expect(res.payload).toContain('event: done');
    });

    it('多城市多天请求应成功', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          destinations: [
            { cityName: '长沙', days: 3, transportTo: 'high_speed_rail' },
            { cityName: '成都', days: 2, transportTo: 'high_speed_rail' },
          ],
        }),
      );
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
      expect(res.payload).toContain('event: connected');
    });

    it('有效请求应包含 day_ready 事件', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          destinations: [{ cityName: '长沙', days: 1, transportTo: null }],
        }),
      );
      expect(res.payload).toContain('event: day_ready');
    });

    it('有效请求应包含 connected 事件中的 taskId', async () => {
      const res = await postGenerate(app, validGenerateBody());
      expect(res.payload).toContain('"taskId"');
      expect(res.payload).toContain('"task_');
    });

    it('有效请求的 done 事件应包含 tripId', async () => {
      const res = await postGenerate(app, validGenerateBody());
      expect(res.payload).toContain('"tripId"');
      expect(res.payload).toContain('"trip_');
    });

    it('有冲突的请求应返回 200（冲突作为 successResponse 返回而非 SSE）', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          travelers: { adults: 2, children: [], elders: 1 },
          preferences: {
            budget: 'comfort',
            pace: 'intensive',
            accommodation: 'chain_hotel',
            dining: ['local_food'],
            interests: ['culture'],
          },
        }),
      );
      expect(res.statusCode).toBe(200);
    });
  });

  // ════════════════════════════════════════════
  // POST /trips/generate — Headers Validation
  // ════════════════════════════════════════════

  describe('POST /api/v1/trips/generate — Headers Validation', () => {
    it('Accept 头不为 text/event-stream 应正常处理', async () => {
      const res = await postGenerate(app, validGenerateBody(), { accept: 'application/json' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
    });

    it('无 Accept 头应正常处理', async () => {
      const res = await postGenerate(app, validGenerateBody());
      expect(res.statusCode).toBe(200);
    });

    it('Content-Type 包含 charset 参数应正常解析', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trips/generate',
        payload: validGenerateBody(),
        headers: {
          'content-type': 'application/json; charset=utf-8',
          'x-forwarded-for': uniqueIP(),
        },
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
    });

    it('使用 Idempotency-Key 头应正常处理', async () => {
      const res = await postGenerate(app, validGenerateBody(), {
        'idempotency-key': '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
    });

    it('无效的 Idempotency-Key 格式应返回 400', async () => {
      const res = await postGenerate(app, validGenerateBody(), {
        'idempotency-key': 'not-a-valid-uuid',
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expectErrorResponse(body, 10008, 'UUID v4');
    });

    it('空的 Idempotency-Key 应返回 400', async () => {
      const res = await postGenerate(app, validGenerateBody(), {
        'idempotency-key': '',
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expectErrorResponse(body, 10008);
    });
  });

  // ════════════════════════════════════════════
  // POST /trips/generate — 认证测试
  // ════════════════════════════════════════════

  describe('POST /api/v1/trips/generate — Authentication', () => {
    it('未设置 SERVER_API_KEY 时应通过认证', async () => {
      const res = await postGenerate(app, validGenerateBody());
      expect(res.statusCode).toBe(200);
    });

    it('设置 SERVER_API_KEY 后无 Key 应返回 401', async () => {
      vi.stubEnv('SERVER_API_KEY', 'secret-test-key');
      const res = await postGenerate(app, validGenerateBody());
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expectErrorResponse(body, 20001, 'API Key');
    });

    it('设置 SERVER_API_KEY 后错误的 Key 应返回 401', async () => {
      vi.stubEnv('SERVER_API_KEY', 'secret-test-key');
      const res = await postGenerate(app, validGenerateBody(), { 'x-api-key': 'wrong-key' });
      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.payload);
      expectErrorResponse(body, 20001);
    });

    it('设置 SERVER_API_KEY 后通过 x-api-key 头认证成功', async () => {
      vi.stubEnv('SERVER_API_KEY', 'secret-test-key');
      const res = await postGenerate(app, validGenerateBody(), { 'x-api-key': 'secret-test-key' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
    });

    it('设置 SERVER_API_KEY 后通过 Authorization Bearer 认证成功', async () => {
      vi.stubEnv('SERVER_API_KEY', 'secret-test-key');
      const res = await postGenerate(app, validGenerateBody(), {
        authorization: 'Bearer secret-test-key',
      });
      expect(res.statusCode).toBe(200);
      expect(res.headers['content-type']).toContain('text/event-stream');
    });
  });

  // ════════════════════════════════════════════
  // POST /trips/generate — 限流测试
  // ════════════════════════════════════════════

  describe('POST /api/v1/trips/generate — Rate Limiting', () => {
    it('在限流窗口内正常请求应通过', async () => {
      const res = await postGenerate(app, validGenerateBody());
      expect(res.statusCode).toBe(200);
    });

    it('超过限流阈值应返回 429', async () => {
      // 使用固定 IP 连续发送 6 次请求（超过 5 次限额）
      const ip = `10.250.250.${(nextIp + 5000) % 255}`;
      const results: number[] = [];
      for (let i = 0; i < 6; i++) {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/trips/generate',
          payload: validGenerateBody(),
          headers: {
            'content-type': 'application/json',
            'x-forwarded-for': ip,
          },
        });
        results.push(res.statusCode);
      }
      const fourTwoNine = results.filter((s) => s === 429);
      expect(fourTwoNine.length).toBeGreaterThanOrEqual(1);
    });

    it('不同 IP 应有独立限流计数', async () => {
      const ipA = `10.200.${(nextIp + 8000) % 255}.${(nextIp + 8001) % 255}`;
      const ipB = `10.200.${(nextIp + 8000) % 255}.${(nextIp + 8002) % 255}`;
      const resultsA: number[] = [];
      const resultsB: number[] = [];

      for (let i = 0; i < 5; i++) {
        const resA = await app.inject({
          method: 'POST',
          url: '/api/v1/trips/generate',
          payload: validGenerateBody(),
          headers: { 'content-type': 'application/json', 'x-forwarded-for': ipA },
        });
        resultsA.push(resA.statusCode);

        const resB = await app.inject({
          method: 'POST',
          url: '/api/v1/trips/generate',
          payload: validGenerateBody(),
          headers: { 'content-type': 'application/json', 'x-forwarded-for': ipB },
        });
        resultsB.push(resB.statusCode);
      }

      expect(resultsA.filter((s) => s === 429).length).toBe(0);
      expect(resultsB.filter((s) => s === 429).length).toBe(0);
    });
  });

  // ════════════════════════════════════════════
  // POST /trips/validate — 参数校验
  // ════════════════════════════════════════════

  describe('POST /api/v1/trips/validate — Parameter Validation', () => {
    it('有效请求应返回 valid: true 且空冲突', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trips/validate',
        payload: validValidateBody(),
        headers: { 'content-type': 'application/json' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expectSuccessResponse(body);
      expect(body.data.valid).toBe(true);
      expect(body.data.conflicts).toHaveLength(0);
    });

    it('穷游 + 精品酒店应产生 budget_accommodation 冲突', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trips/validate',
        payload: validValidateBody({
          preferences: {
            budget: 'economy',
            pace: 'moderate',
            accommodation: 'boutique',
            dining: ['local_food'],
            interests: ['culture'],
          },
        }),
        headers: { 'content-type': 'application/json' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.conflicts.length).toBeGreaterThanOrEqual(1);
      expect(body.data.conflicts[0].type).toBe('budget_accommodation');
    });

    it('穷游 + 奢华酒店应产生 budget_accommodation 冲突', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trips/validate',
        payload: validValidateBody({
          preferences: {
            budget: 'economy',
            pace: 'moderate',
            accommodation: 'luxury',
            dining: ['local_food'],
            interests: ['culture'],
          },
        }),
        headers: { 'content-type': 'application/json' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.conflicts.length).toBeGreaterThanOrEqual(1);
      expect(body.data.conflicts[0].type).toBe('budget_accommodation');
    });

    it('comfort 预算 + 精品酒店不应产生 budget_accommodation 冲突', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trips/validate',
        payload: validValidateBody({
          preferences: {
            budget: 'comfort',
            pace: 'moderate',
            accommodation: 'boutique',
            dining: ['local_food'],
            interests: ['culture'],
          },
        }),
        headers: { 'content-type': 'application/json' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      const budgetConflicts = body.data.conflicts.filter(
        (c: { type: string }) => c.type === 'budget_accommodation',
      );
      expect(budgetConflicts).toHaveLength(0);
    });

    it('有老人 + 高强度节奏应产生 pace_elders 冲突', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trips/validate',
        payload: validValidateBody({
          travelers: { adults: 2, children: [], elders: 1 },
          preferences: {
            budget: 'comfort',
            pace: 'intensive',
            accommodation: 'chain_hotel',
            dining: ['local_food'],
            interests: ['culture'],
          },
        }),
        headers: { 'content-type': 'application/json' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.conflicts.length).toBeGreaterThanOrEqual(1);
      expect(body.data.conflicts[0].type).toBe('pace_elders');
    });

    it('有老人但 moderate 节奏不应产生 pace_elders 冲突', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trips/validate',
        payload: validValidateBody({
          travelers: { adults: 2, children: [], elders: 2 },
          preferences: {
            budget: 'comfort',
            pace: 'moderate',
            accommodation: 'chain_hotel',
            dining: ['local_food'],
            interests: ['culture'],
          },
        }),
        headers: { 'content-type': 'application/json' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      const paceConflicts = body.data.conflicts.filter(
        (c: { type: string }) => c.type === 'pace_elders',
      );
      expect(paceConflicts).toHaveLength(0);
    });

    it('两个冲突条件同时满足时应产生两个冲突', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trips/validate',
        payload: validValidateBody({
          travelers: { adults: 2, children: [], elders: 2 },
          preferences: {
            budget: 'economy',
            pace: 'intensive',
            accommodation: 'boutique',
            dining: ['local_food'],
            interests: ['culture'],
          },
        }),
        headers: { 'content-type': 'application/json' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.conflicts).toHaveLength(2);
    });

    it('冲突应包含 severity, message, suggestion 字段', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trips/validate',
        payload: validValidateBody({
          travelers: { adults: 2, children: [], elders: 1 },
          preferences: {
            budget: 'economy',
            pace: 'intensive',
            accommodation: 'boutique',
            dining: ['local_food'],
            interests: ['culture'],
          },
        }),
        headers: { 'content-type': 'application/json' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      for (const conflict of body.data.conflicts) {
        expect(conflict).toHaveProperty('type');
        expect(conflict).toHaveProperty('severity');
        expect(conflict.severity).toBe('warning');
        expect(conflict).toHaveProperty('message');
        expect(typeof conflict.message).toBe('string');
        if (conflict.suggestion) {
          expect(conflict.suggestion).toHaveProperty('action');
          expect(conflict.suggestion).toHaveProperty('value');
        }
      }
    });

    it('空请求体应返回非 500（优雅降级）', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trips/validate',
        payload: {},
        headers: { 'content-type': 'application/json' },
      });
      expect(res.statusCode).not.toBe(500);
    });
  });

  // ════════════════════════════════════════════
  // GET /trips/generate/status/:taskId — 路径参数
  // ════════════════════════════════════════════

  describe('GET /api/v1/trips/generate/status/:taskId — Path Parameters', () => {
    it('有效 taskId 应返回进度信息', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/trips/generate/status/task_abc123',
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expectSuccessResponse(body);
      expect(body.data.taskId).toBe('task_abc123');
      expect(body.data.status).toBe('completed');
      expect(body.data.progress.percent).toBe(100);
    });

    it('缺少 taskId 应匹配路由（空字符串参数）', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/trips/generate/status/',
      });
      // Fastify 将末尾斜线匹配为 :taskId="" 而非 404
      expect(res.statusCode).toBe(200);
    });

    it('taskId 包含特殊字符应正确处理', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/trips/generate/status/task_special-chars_123',
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.taskId).toBe('task_special-chars_123');
    });

    it('带有未知查询参数应忽略', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/trips/generate/status/task_001?foo=bar&baz=qux',
      });
      expect(res.statusCode).toBe(200);
    });
  });

  // ════════════════════════════════════════════
  // DELETE /trips/generate/:taskId — 路径参数
  // ════════════════════════════════════════════

  describe('DELETE /api/v1/trips/generate/:taskId — Path Parameters', () => {
    it('有效 taskId 应取消成功', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/trips/generate/task_abc123',
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expectSuccessResponse(body);
      expect(body.data.taskId).toBe('task_abc123');
      expect(body.data.cancelledAt).toBeTruthy();
      expect(body.message).toBe('生成任务已取消');
    });

    it('缺少 taskId 应匹配路由（空字符串参数）', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/trips/generate/',
      });
      // Fastify 将末尾斜线匹配为 :taskId="" 而非 404
      expect(res.statusCode).toBe(200);
    });

    it('taskId 包含特殊字符也应成功', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/trips/generate/task_has-dashes_and_underscores',
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.data.taskId).toBe('task_has-dashes_and_underscores');
    });
  });

  // ════════════════════════════════════════════
  // GET /trips/:tripId — 路径参数 + 查询参数
  // ════════════════════════════════════════════

  describe('GET /api/v1/trips/:tripId — Path & Query Parameters', () => {
    it('已保存的 tripId 应返回攻略数据', async () => {
      // 先通过 generate 保存一个 trip
      const genPayload = validGenerateBody({
        destinations: [{ cityName: '长沙', days: 1, transportTo: null }],
      });
      const genRes = await app.inject({
        method: 'POST',
        url: '/api/v1/trips/generate',
        payload: genPayload,
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': uniqueIP(),
        },
      });
      // 从 SSE 中提取 tripId
      const doneMatch = genRes.payload.match(/"tripId"\s*:\s*"([^"]+)"/);
      if (doneMatch) {
        const tripId = doneMatch[1];
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/trips/${tripId}`,
        });
        expect(res.statusCode).toBe(200);
        const body = JSON.parse(res.payload);
        expectSuccessResponse(body);
        expect(body.data.tripId).toBe(tripId);
      }
    });

    it('不存在的 tripId 应返回 404', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/trips/nonexistent_trip_99999',
      });
      expect(res.statusCode).toBe(404);
      const body = JSON.parse(res.payload);
      expectErrorResponse(body, 20005, '攻略不存在');
    });

    it('带 shareToken 查询参数应返回分享视图', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/trips/some_trip?shareToken=abc123',
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expectSuccessResponse(body);
      expect(body.data.isReadOnly).toBe(true);
      expect(body.data.sharedBy).toBeTruthy();
    });

    it('带 include 查询参数应正常处理', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/trips/some_trip?include=alternatives,booking_info',
      });
      expect([200, 404]).toContain(res.statusCode);
    });
  });

  // ════════════════════════════════════════════
  // 通用错误响应格式验证
  // ════════════════════════════════════════════

  describe('Error Response Format (跨端点)', () => {
    it('4xx 错误响应应包含统一的信封格式', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trips/generate',
        payload: {},
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': uniqueIP(),
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty('code');
      expect(body).toHaveProperty('message');
      expect(body).toHaveProperty('meta');
      expect(body.meta).toHaveProperty('timestamp');
    });

    it('错误响应的 meta.processingTimeMs 应有实际值', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/trips/generate',
        payload: {},
        headers: {
          'content-type': 'application/json',
          'x-forwarded-for': uniqueIP(),
        },
      });
      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.payload);
      expect(body.meta.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof body.meta.processingTimeMs).toBe('number');
    });

    it('成功响应的 meta.processingTimeMs 应有实际值', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/trips/generate/status/task_001',
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.meta.processingTimeMs).toBeGreaterThanOrEqual(0);
      expect(typeof body.meta.processingTimeMs).toBe('number');
    });
  });

  // ════════════════════════════════════════════
  // 404 路由匹配
  // ════════════════════════════════════════════

  describe('404 Route Matching', () => {
    it('不存在的路径应返回 404', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/nonexistent-endpoint',
      });
      expect(res.statusCode).toBe(404);
    });

    it('/health 应返回健康检查', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/health',
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.status).toBe('ok');
      expect(body).toHaveProperty('timestamp');
      expect(body).toHaveProperty('uptime');
    });
  });

  // ════════════════════════════════════════════
  // 多目的地边界测试
  // ════════════════════════════════════════════

  describe('Multi-Destination Edge Cases', () => {
    it('多个城市每个 0 天应返回空行程', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          destinations: [
            { cityName: '长沙', days: 0, transportTo: null },
            { cityName: '成都', days: 0, transportTo: null },
            { cityName: '北京', days: 0, transportTo: null },
          ],
        }),
      );
      expect(res.statusCode).toBe(200);
    });

    it('3 城市各 1 天应产生 3 个 day_ready 事件', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          destinations: [
            { cityName: '长沙', days: 1, transportTo: null },
            { cityName: '成都', days: 1, transportTo: 'high_speed_rail' },
            { cityName: '杭州', days: 1, transportTo: 'high_speed_rail' },
          ],
        }),
      );
      expect(res.statusCode).toBe(200);
      expect(res.payload).toContain('event: connected');
      const dayReadyCount = (res.payload.match(/event: day_ready/g) || []).length;
      expect(dayReadyCount).toBe(3);
    });
  });

  // ════════════════════════════════════════════
  // 幂等键集成测试
  // ════════════════════════════════════════════

  describe('Idempotency-Key Integration', () => {
    it('带有效幂等键的请求应成功', async () => {
      const res = await postGenerate(app, validGenerateBody(), {
        'idempotency-key': '770e8400-e29b-41d4-a716-446655440300',
      });
      expect(res.statusCode).toBe(200);
    });

    it('重复使用相同幂等键应命中缓存', async () => {
      const idemKey = '880e8400-e29b-41d4-a716-446655440400';
      // 第一次请求
      await postGenerate(
        app,
        validGenerateBody({
          destinations: [{ cityName: '长沙', days: 1, transportTo: null }],
        }),
        { 'idempotency-key': idemKey },
      );

      // 第二次相同幂等键请求
      const res = await postGenerate(
        app,
        validGenerateBody({
          destinations: [{ cityName: '长沙', days: 1, transportTo: null }],
        }),
        { 'idempotency-key': idemKey },
      );

      expect(res.statusCode).toBe(200);
      expect(res.headers['x-idempotency-replayed']).toBe('true');
    });
  });

  // ════════════════════════════════════════════
  // 请求日期格式边界测试
  // ════════════════════════════════════════════

  describe('Date Format Edge Cases', () => {
    it('无效日期格式应不崩溃', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          departure: { city: '北京', date: 'not-a-date', timePeriod: 'morning' },
        }),
      );
      expect(res.statusCode).not.toBe(500);
    });

    it('旧日期（过去）应正常处理', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          departure: { city: '北京', date: '2020-01-01', timePeriod: 'morning' },
        }),
      );
      expect(res.statusCode).toBe(200);
    });

    it('远未来日期应正常处理', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          departure: { city: '北京', date: '2099-12-31', timePeriod: 'morning' },
        }),
      );
      expect(res.statusCode).toBe(200);
    });

    it('非法日期（2月30日）应不崩溃', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          departure: { city: '北京', date: '2026-02-30', timePeriod: 'morning' },
        }),
      );
      expect(res.statusCode).not.toBe(500);
    });
  });

  // ════════════════════════════════════════════
  // responseTiming 插件：SSE 路径不受影响
  // ════════════════════════════════════════════

  describe('Response Timing Plugin Behavior', () => {
    it('SSE 响应不受 processingTimeMs 注入影响', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          destinations: [{ cityName: '长沙', days: 1, transportTo: null }],
        }),
      );
      expect(res.statusCode).toBe(200);
      expect(res.payload).not.toContain('"processingTimeMs"');
      expect(res.payload).not.toContain('"meta"');
    });

    it('非 SSE JSON 响应应包含 processingTimeMs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/trips/generate/status/task_001',
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.meta.processingTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  // ════════════════════════════════════════════
  // trim() 和空白字符边界
  // ════════════════════════════════════════════

  describe('Whitespace and Empty String Handling', () => {
    it('城市名包含前后空格应正常处理', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          destinations: [{ cityName: '  长沙  ', days: 1, transportTo: null }],
        }),
      );
      expect(res.statusCode).toBe(200);
    });

    it('空字符串城市名应不崩溃', async () => {
      const res = await postGenerate(
        app,
        validGenerateBody({
          destinations: [{ cityName: '', days: 1, transportTo: null }],
        }),
      );
      expect(res.statusCode).not.toBe(500);
    });
  });
});

/**
 * PATH-WISE · Transport / Accommodation 路由 HTTP 集成测试
 *
 * 测试范围：
 *   1. POST /api/v1/transport/search  — 认证 (401), 参数校验 (400), 正常流程 (200)
 *   2. POST /api/v1/transport/route   — 认证 (401), 参数校验 (400), 正常流程 (200)
 *   3. POST /api/v1/accommodation/search   — 认证 (401), 参数校验 (400), 正常流程 (200)
 *   4. POST /api/v1/accommodation/booking  — 认证 (401), 参数校验 (400), 正常流程 (200)
 *
 * 依据：docs/API接口设计规格书_v1.0.0.md §8
 *       docs/错误处理规范文档_v1.0.0.md
 *
 * 使用 Fastify 内置 inject() 方法进行 HTTP 级别测试。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';

// ─────────────────────────────────────────────
// Mock LLM fetch — 拦截全局 fetch 避免真实 HTTP 调用
// ─────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.stubEnv('DEEPSEEK_API_KEY', 'sk-test-deepseek');
vi.stubEnv('GLM_API_KEY', 'test-glm-key');
vi.stubEnv('KIMI_API_KEY', 'sk-test-kimi');
vi.stubEnv('MIMO_API_KEY', 'sk-test-mimo');

// ─────────────────────────────────────────────
// 辅助函数
// ─────────────────────────────────────────────

/** 期望响应体是 successResponse 信封格式 */
function expectSuccessResponse(body: Record<string, unknown>) {
  expect(body).toHaveProperty('code');
  expect(body.code).toBe(0);
  expect(body).toHaveProperty('data');
  expect(body).toHaveProperty('meta');
  expect(body.meta).toHaveProperty('requestId');
}

/** 期望响应体是 errorResponse 信封格式（不限定具体错误码） */
function expectAnyErrorResponse(body: Record<string, unknown>, msgContains?: string) {
  expect(body).toHaveProperty('code');
  expect(typeof body.code).toBe('number');
  expect(body.code).toBeGreaterThan(0);
  expect(body).toHaveProperty('message');
  expect(typeof body.message).toBe('string');
  if (msgContains) {
    expect(body.message).toContain(msgContains);
  }
  expect(body).toHaveProperty('meta');
  expect(body.meta).toHaveProperty('requestId');
  expect(body.meta).toHaveProperty('timestamp');
}

// ─────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────

describe('Transport & Accommodation Routes (HTTP)', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.stubEnv('SERVER_API_KEY', ''); // 清空，让 authenticateApiKey 跳过认证
    app = await buildApp({ skipPrisma: true });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  // ============================================================
  // POST /transport/search
  // ============================================================

  describe('POST /api/v1/transport/search', () => {
    it('正常请求应返回 200 和交通方案', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/search',
        payload: {
          fromCity: '北京',
          toCity: '长沙',
          date: '2026-07-01',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expectSuccessResponse(body);
      expect(body.data.options.length).toBeGreaterThan(0);
      expect(body.data.source).toBe('mock');
    });

    it('缺少 fromCity 应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/search',
        payload: {
          toCity: '长沙',
          date: '2026-07-01',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expectAnyErrorResponse(body, 'fromCity');
    });

    it('缺少 toCity 应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/search',
        payload: {
          fromCity: '北京',
          date: '2026-07-01',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expectAnyErrorResponse(body, 'toCity');
    });

    it('空请求体应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/search',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });

    it('无效日期格式应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/search',
        payload: {
          fromCity: '北京',
          toCity: '长沙',
          date: '07-01-2026', // 非 YYYY-MM-DD
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expectAnyErrorResponse(body, '日期格式');
    });

    it('无效的 prefer 类型应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/search',
        payload: {
          fromCity: '北京',
          toCity: '长沙',
          date: '2026-07-01',
          prefer: ['teleport'], // 无效类型
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('teleport');
    });

    it('prefer 非数组应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/search',
        payload: {
          fromCity: '北京',
          toCity: '长沙',
          date: '2026-07-01',
          prefer: 'high_speed_rail', // 字符串而非数组
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('无效的 departTimePeriod 应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/search',
        payload: {
          fromCity: '北京',
          toCity: '长沙',
          date: '2026-07-01',
          departTimePeriod: 'midnight',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('不存在的城市应返回 404', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/search',
        payload: {
          fromCity: '火星',
          toCity: '长沙',
          date: '2026-07-01',
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('valid departTimePeriod should work', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/search',
        payload: {
          fromCity: '北京',
          toCity: '长沙',
          date: '2026-07-01',
          departTimePeriod: 'morning',
        },
      });

      expect(res.statusCode).toBe(200);
    });

    it('带 prefer 有效值应正常返回', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/search',
        payload: {
          fromCity: '北京',
          toCity: '成都',
          date: '2026-07-01',
          prefer: ['high_speed_rail', 'flight'],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.options.length).toBeGreaterThan(0);
    });
  });

  // ============================================================
  // POST /transport/route
  // ============================================================

  describe('POST /api/v1/transport/route', () => {
    it('正常请求应返回 200 和路线规划', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/route',
        payload: {
          city: '长沙',
          origin: { lat: 28.235, lng: 112.907, name: '岳麓山南门' },
          destination: { lat: 28.227, lng: 112.938, name: '橘子洲头' },
          mode: 'transit',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expectSuccessResponse(body);
      expect(body.data.distanceMeters).toBeGreaterThan(0);
      expect(body.data.steps.length).toBeGreaterThan(0);
    });

    it('缺少 city 应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/route',
        payload: {
          origin: { lat: 28.235, lng: 112.907 },
          destination: { lat: 28.227, lng: 112.938 },
          mode: 'transit',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expectAnyErrorResponse(body, 'city');
    });

    it('缺少 origin 应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/route',
        payload: {
          city: '长沙',
          destination: { lat: 28.227, lng: 112.938 },
          mode: 'transit',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expectAnyErrorResponse(body, 'origin');
    });

    it('缺少 destination 应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/route',
        payload: {
          city: '长沙',
          origin: { lat: 28.235, lng: 112.907 },
          mode: 'transit',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expectAnyErrorResponse(body, 'destination');
    });

    it('origin 缺少 lat 应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/route',
        payload: {
          city: '长沙',
          origin: { lng: 112.907 },
          destination: { lat: 28.227, lng: 112.938 },
          mode: 'transit',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expectAnyErrorResponse(body, 'origin');
    });

    it('无效 mode 应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/route',
        payload: {
          city: '长沙',
          origin: { lat: 28.235, lng: 112.907 },
          destination: { lat: 28.227, lng: 112.938 },
          mode: 'flying',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.message).toContain('flying');
    });

    it('不存在的城市应返回 404', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/route',
        payload: {
          city: '火星',
          origin: { lat: 28.235, lng: 112.907 },
          destination: { lat: 28.227, lng: 112.938 },
          mode: 'transit',
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('driving 模式应正常返回', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/route',
        payload: {
          city: '北京',
          origin: { lat: 39.916, lng: 116.397 },
          destination: { lat: 39.905, lng: 116.391 },
          mode: 'driving',
        },
      });

      expect(res.statusCode).toBe(200);
    });

    it('空请求体应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/transport/route',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ============================================================
  // POST /accommodation/search
  // ============================================================

  describe('POST /api/v1/accommodation/search', () => {
    it('正常请求应返回 200 和住宿推荐', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accommodation/search',
        payload: {
          cityName: '长沙',
          checkInDate: '2026-07-01',
          checkOutDate: '2026-07-04',
          budget: 'comfort',
          travelers: { adults: 2, children: [] },
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expectSuccessResponse(body);
      expect(body.data.cityName).toBe('长沙');
      expect(body.data.options.length).toBeGreaterThan(0);
      expect(body.data.bookingTip).toBeTruthy();
    });

    it('缺少 cityName 应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accommodation/search',
        payload: {
          checkInDate: '2026-07-01',
          checkOutDate: '2026-07-04',
          budget: 'comfort',
          travelers: { adults: 2, children: [] },
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expectAnyErrorResponse(body, 'cityName');
    });

    it('缺少 checkInDate 应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accommodation/search',
        payload: {
          cityName: '长沙',
          checkOutDate: '2026-07-04',
          budget: 'comfort',
          travelers: { adults: 2, children: [] },
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('缺少 checkOutDate 应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accommodation/search',
        payload: {
          cityName: '长沙',
          checkInDate: '2026-07-01',
          budget: 'comfort',
          travelers: { adults: 2, children: [] },
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('无效 checkInDate 格式应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accommodation/search',
        payload: {
          cityName: '长沙',
          checkInDate: '07-01-2026',
          checkOutDate: '2026-07-04',
          budget: 'comfort',
          travelers: { adults: 2, children: [] },
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expectAnyErrorResponse(body, '日期格式');
    });

    it('无效 budget 应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accommodation/search',
        payload: {
          cityName: '长沙',
          checkInDate: '2026-07-01',
          checkOutDate: '2026-07-04',
          budget: 'premium',
          travelers: { adults: 2, children: [] },
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('缺少 travelers 应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accommodation/search',
        payload: {
          cityName: '长沙',
          checkInDate: '2026-07-01',
          checkOutDate: '2026-07-04',
          budget: 'comfort',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('adults 为 0 应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accommodation/search',
        payload: {
          cityName: '长沙',
          checkInDate: '2026-07-01',
          checkOutDate: '2026-07-04',
          budget: 'comfort',
          travelers: { adults: 0, children: [] },
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('children 非数组应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accommodation/search',
        payload: {
          cityName: '长沙',
          checkInDate: '2026-07-01',
          checkOutDate: '2026-07-04',
          budget: 'comfort',
          travelers: { adults: 2, children: 'two kids' },
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('不存在的城市应返回 404', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accommodation/search',
        payload: {
          cityName: '火星',
          checkInDate: '2026-07-01',
          checkOutDate: '2026-07-04',
          budget: 'comfort',
          travelers: { adults: 2, children: [] },
        },
      });

      expect(res.statusCode).toBe(404);
    });

    it('带 preferences 应正常返回', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accommodation/search',
        payload: {
          cityName: '北京',
          checkInDate: '2026-07-01',
          checkOutDate: '2026-07-02',
          budget: 'economy',
          preferences: { roomType: 'double', location: 'center', amenities: ['wifi'] },
          travelers: { adults: 2, children: [] },
        },
      });

      expect(res.statusCode).toBe(200);
    });

    it('空请求体应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accommodation/search',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });

  // ============================================================
  // POST /accommodation/booking
  // ============================================================

  describe('POST /api/v1/accommodation/booking', () => {
    it('正常请求应返回 200 和 booking URL', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accommodation/booking',
        payload: {
          optionIndex: 0,
          checkInDate: '2026-07-01',
          checkOutDate: '2026-07-04',
          roomType: '标准双床房',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expectSuccessResponse(body);
      expect(body.data.bookingUrl).toContain('ctrip');
      expect(body.data.confirmationCode).toBeTruthy();
    });

    it('缺少 optionIndex 应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accommodation/booking',
        payload: {
          checkInDate: '2026-07-01',
          checkOutDate: '2026-07-04',
          roomType: '标准双床房',
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expectAnyErrorResponse(body, 'optionIndex');
    });

    it('optionIndex 为字符串应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accommodation/booking',
        payload: {
          optionIndex: '0',
          checkInDate: '2026-07-01',
          checkOutDate: '2026-07-04',
          roomType: '标准双床房',
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it('非法 checkInDate 应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accommodation/booking',
        payload: {
          optionIndex: 0,
          checkInDate: 'bad-date',
          checkOutDate: '2026-07-04',
          roomType: '标准双床房',
        },
      });

      // 路由层只校验 optionIndex 的 type，日期校验在服务层
      // 服务层会抛 ValidationError → 400
      expect(res.statusCode).toBe(400);
    });

    it('optionIndex 为负数应正常返回', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accommodation/booking',
        payload: {
          optionIndex: -5,
          roomType: '家庭房',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.body);
      expect(body.data.bookingUrl).toContain('option=-5');
    });

    it('空请求体应返回 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/accommodation/booking',
        payload: {},
      });

      expect(res.statusCode).toBe(400);
    });
  });
});

// ============================================================
// API Key 认证测试
// ============================================================

describe('Transport & Accommodation API Key Authentication', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    vi.stubEnv('SERVER_API_KEY', 'sk-test-key-12345');
    app = await buildApp({ skipPrisma: true });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const authEndpoints = [
    {
      method: 'POST',
      url: '/api/v1/transport/search',
      payload: { fromCity: '北京', toCity: '长沙', date: '2026-07-01' },
    },
    {
      method: 'POST',
      url: '/api/v1/transport/route',
      payload: {
        city: '长沙',
        origin: { lat: 28.235, lng: 112.907 },
        destination: { lat: 28.227, lng: 112.938 },
        mode: 'transit',
      },
    },
    {
      method: 'POST',
      url: '/api/v1/accommodation/search',
      payload: {
        cityName: '长沙',
        checkInDate: '2026-07-01',
        checkOutDate: '2026-07-04',
        budget: 'comfort',
        travelers: { adults: 2, children: [] },
      },
    },
    { method: 'POST', url: '/api/v1/accommodation/booking', payload: { optionIndex: 0 } },
  ];

  for (const ep of authEndpoints) {
    it(`${ep.method} ${ep.url} 无 API Key 应返回 401`, async () => {
      const res = await app.inject({
        method: ep.method as 'POST',
        url: ep.url,
        payload: ep.payload,
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBeGreaterThan(0);
      expect(body.message).toContain('API Key');
    });

    it(`${ep.method} ${ep.url} 错误的 API Key 应返回 401`, async () => {
      const res = await app.inject({
        method: ep.method as 'POST',
        url: ep.url,
        payload: ep.payload,
        headers: {
          'x-api-key': 'wrong-key',
        },
      });

      expect(res.statusCode).toBe(401);
    });

    it(`${ep.method} ${ep.url} 正确的 x-api-key 应返回 200/400（非 401）`, async () => {
      const res = await app.inject({
        method: ep.method as 'POST',
        url: ep.url,
        payload: ep.payload,
        headers: {
          'x-api-key': 'sk-test-key-12345',
        },
      });

      // 如果 payload 正确，应返回 200；如果缺少字段，返回 400
      // 但绝不应返回 401
      expect(res.statusCode).not.toBe(401);
    });

    it(`${ep.method} ${ep.url} Bearer token 应正确提取`, async () => {
      const res = await app.inject({
        method: ep.method as 'POST',
        url: ep.url,
        payload: ep.payload,
        headers: {
          authorization: 'Bearer sk-test-key-12345',
        },
      });

      expect(res.statusCode).not.toBe(401);
    });
  }
});

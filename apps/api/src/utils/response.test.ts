/**
 * 统一响应工具单元测试
 * 依据：docs/API接口设计规格书_v1.0.0.md §8
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock node:crypto before importing the module under test
const FAKE_UUID = '00000000-0000-0000-0000-000000000000';
const FAKE_TIME = '2026-06-25T12:00:00.000Z';

vi.mock('node:crypto', () => ({
  randomUUID: () => FAKE_UUID,
}));

// Dynamic import so the mock is in place before the module graph resolves crypto
const { successResponse, errorResponse } = await import('../utils/response');

describe('successResponse', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FAKE_TIME));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('应返回 code=0 和 data', () => {
    const data = { id: 1, name: 'test' };
    const result = successResponse(data);
    expect(result.code).toBe(0);
    expect(result.data).toEqual(data);
  });

  it('默认 message 应为 "ok"', () => {
    const result = successResponse(null);
    expect(result.message).toBe('ok');
  });

  it('应支持自定义 message', () => {
    const result = successResponse({ id: 1 }, { message: '创建成功' });
    expect(result.message).toBe('创建成功');
  });

  it('meta 应包含 requestId 和时间戳', () => {
    const result = successResponse(42);
    expect(result.meta.requestId).toBe(FAKE_UUID);
    expect(result.meta.timestamp).toBe(FAKE_TIME);
    expect(result.meta.processingTimeMs).toBe(0);
  });

  it('应支持 meta 覆盖', () => {
    const result = successResponse('data', {
      meta: { processingTimeMs: 123 },
    });
    expect(result.meta.processingTimeMs).toBe(123);
    expect(result.meta.requestId).toBe(FAKE_UUID); // 仍保留默认值
  });

  it('应支持各种 data 类型', () => {
    expect(successResponse('string').data).toBe('string');
    expect(successResponse(0).data).toBe(0);
    expect(successResponse(null).data).toBeNull();
    expect(successResponse([1, 2, 3]).data).toEqual([1, 2, 3]);
    expect(successResponse(undefined).data).toBeUndefined();
  });
});

// ---- errorResponse ----

describe('errorResponse', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FAKE_TIME));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('应返回指定的 code 和 message', () => {
    const result = errorResponse(10002, '缺少必填字段');
    expect(result.code).toBe(10002);
    expect(result.message).toBe('缺少必填字段');
  });

  it('默认不包含 data 字段', () => {
    const result = errorResponse(50002, '内部错误');
    expect(result.data).toBeUndefined();
  });

  it('应支持附带调试 data', () => {
    const result = errorResponse(10004, 'destinations 不能为空', {
      data: { field: 'destinations', reason: '至少需要 1 个目的地' },
    });
    expect(result.data).toEqual({
      field: 'destinations',
      reason: '至少需要 1 个目的地',
    });
  });

  it('应包含 meta', () => {
    const result = errorResponse(403, '禁止访问');
    expect(result.meta.requestId).toBe(FAKE_UUID);
    expect(result.meta.timestamp).toBe(FAKE_TIME);
  });

  it('code 0 也可用作错误响应（边界）', () => {
    const result = errorResponse(0, 'ok-like error');
    expect(result.code).toBe(0);
    expect(result.message).toBe('ok-like error');
  });
});

// ── 额外边界测试 ──

describe('successResponse 边界', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FAKE_TIME));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('空对象 data', () => {
    const result = successResponse({});
    expect(result.data).toEqual({});
  });

  it('很长的 message', () => {
    const long = 'a'.repeat(10000);
    const result = successResponse(null, { message: long });
    expect(result.message).toBe(long);
  });

  it('options 为 {} 时不应报错', () => {
    const result = successResponse('data', {});
    expect(result.message).toBe('ok');
  });

  it('嵌套复杂对象', () => {
    const complex = {
      trips: [{ id: 1, days: [{ title: 'Day 1' }, { title: 'Day 2' }] }],
    };
    const result = successResponse(complex);
    expect(result.data.trips[0].days.length).toBe(2);
  });
});

describe('errorResponse 边界', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(FAKE_TIME));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('空字符串 message', () => {
    const result = errorResponse(500, '');
    expect(result.message).toBe('');
  });

  it('很长的 message', () => {
    const long = 'e'.repeat(5000);
    const result = errorResponse(99999, long);
    expect(result.message).toBe(long);
    expect(result.code).toBe(99999);
  });

  it('负数 code', () => {
    const result = errorResponse(-1, '负错误码');
    expect(result.code).toBe(-1);
  });

  it('data 为 undefined 显式传入时不追加 data', () => {
    const result = errorResponse(400, 'bad', { data: undefined });
    expect(result).not.toHaveProperty('data');
  });

  it('data 为 null 时正确存储', () => {
    const result = errorResponse(400, 'bad', { data: null });
    expect(result.data).toBeNull();
  });
});

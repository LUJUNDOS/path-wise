/**
 * PATH-WISE · 幂等键服务单元测试
 * 依据：docs/LLM集成测试用例_v1.0.0.md UT-LLM-008 / IT-GEN-004
 *      docs/API接口设计规格书_v1.0.0.md §4.2 幂等性说明
 *
 * 测试范围：
 *   - 幂等键格式校验（validateIdempotencyKey）
 *   - 幂等存储基本操作（IdempotencyStore）
 *   - TTL 过期逻辑
 *   - 并发请求保护（pending 状态）
 *   - 失败状态处理
 *   - 全局单例管理
 *   - 边界条件（空 key、超长 key、非 UUID、特殊字符等）
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  validateIdempotencyKey,
  IdempotencyStore,
  getIdempotencyStore,
  resetIdempotencyStore,
  DEFAULT_IDEMPOTENCY_TTL_MS,
} from './idempotency_service.js';
import type { TripResponse } from '@path-wise/shared';

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

/** 构造测试用 TripResponse */
function makeTripResponse(overrides: Partial<TripResponse> = {}): TripResponse {
  return {
    tripId: 'trip_test_idem_001',
    title: '测试攻略',
    generateTime: new Date().toISOString(),
    totalDays: 3,
    totalEstimatedCostCNY: 3000,
    departureCity: '北京',
    status: 'completed',
    days: [
      {
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
        ],
        tips: ['建议下载长沙地铁 APP'],
      },
    ],
    shareUrl: 'https://tripplanner.com/share/trip_test_idem_001',
    ...overrides,
  };
}

/** 有效的 UUID v4 */
const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_2 = '660e8400-e29b-41d4-a716-446655440001';
const VALID_UUID_3 = '770e8400-e29b-41d4-a716-446655440002';

// ─────────────────────────────────────────────
// Section 1: validateIdempotencyKey（格式校验）
// ─────────────────────────────────────────────

describe('validateIdempotencyKey', () => {
  it('有效 UUID v4 应返回 valid: true', () => {
    const result = validateIdempotencyKey(VALID_UUID);
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('大写 UUID v4 应接受', () => {
    // UUID v4 正则使用 /i 标志，大小写不敏感
    const upperUUID = VALID_UUID.toUpperCase();
    const result = validateIdempotencyKey(upperUUID);
    expect(result.valid).toBe(true);
  });

  it('undefined 应返回 invalid', () => {
    const result = validateIdempotencyKey(undefined);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('missing');
  });

  it('null 应返回 invalid', () => {
    const result = validateIdempotencyKey(null);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('missing');
  });

  it('空字符串应返回 invalid', () => {
    const result = validateIdempotencyKey('');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('empty');
  });

  it('非字符串类型（数字）应返回 invalid', () => {
    const result = validateIdempotencyKey(12345);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('string');
  });

  it('非字符串类型（对象）应返回 invalid', () => {
    const result = validateIdempotencyKey({ key: 'value' });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('string');
  });

  it('非字符串类型（数组）应返回 invalid', () => {
    const result = validateIdempotencyKey([VALID_UUID]);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('string');
  });

  it('非 UUID 格式的随机字符串应返回 invalid', () => {
    const result = validateIdempotencyKey('not-a-uuid-at-all');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('UUID v4');
  });

  it('UUID v1 格式（非 v4）应返回 invalid', () => {
    // UUID v1: 包含时间戳，version nibble = 1
    const uuidV1 = '550e8400-e29b-11d4-a716-446655440000';
    const result = validateIdempotencyKey(uuidV1);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('UUID v4');
  });

  it('缺少连字符的 UUID 应返回 invalid', () => {
    // 有效 UUID 去掉连字符
    const noDashes = VALID_UUID.replace(/-/g, '');
    const result = validateIdempotencyKey(noDashes);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('UUID v4');
  });

  it('包含额外前导空格的 UUID 应返回 invalid', () => {
    const result = validateIdempotencyKey(`  ${VALID_UUID}`);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('UUID v4');
  });

  it('包含额外尾部空格的 UUID 应返回 invalid', () => {
    const result = validateIdempotencyKey(`${VALID_UUID}  `);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('UUID v4');
  });

  it('超过最大长度（128 字符）应返回 invalid', () => {
    const longKey = 'a'.repeat(129);
    const result = validateIdempotencyKey(longKey);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('exceeds maximum length');
  });

  it('恰好等于最大长度（128 字符）但非 UUID 应返回 invalid', () => {
    const maxKey = 'a'.repeat(128);
    const result = validateIdempotencyKey(maxKey);
    expect(result.valid).toBe(false);
    // 通过了长度检查，但 UUID 格式检查失败
    expect(result.reason).toContain('UUID v4');
  });

  it('包含特殊字符的字符串应返回 invalid', () => {
    const result = validateIdempotencyKey('<script>alert(1)</script>');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('UUID v4');
  });

  it('包含 SQL 注入 payload 的字符串应返回 invalid', () => {
    const result = validateIdempotencyKey("'; DROP TABLE users; --");
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('UUID v4');
  });

  it('包含换行符的字符串应返回 invalid', () => {
    const result = validateIdempotencyKey(`${VALID_UUID}\n`);
    expect(result.valid).toBe(false);
  });

  it('UUID v5 格式应返回 invalid', () => {
    // UUID v5: version nibble = 5
    const uuidV5 = '550e8400-e29b-51d4-a716-446655440000';
    const result = validateIdempotencyKey(uuidV5);
    expect(result.valid).toBe(false);
  });

  it('UUID v3 格式应返回 invalid', () => {
    // UUID v3: version nibble = 3
    const uuidV3 = '550e8400-e29b-31d4-a716-446655440000';
    const result = validateIdempotencyKey(uuidV3);
    expect(result.valid).toBe(false);
  });

  it('CUID 格式字符串应返回 invalid', () => {
    const result = validateIdempotencyKey('clh3j9n3j0000g8w88cz6a1yi');
    expect(result.valid).toBe(false);
  });

  it('NIL UUID (全零) 应返回 invalid（非 v4）', () => {
    const nilUUID = '00000000-0000-0000-0000-000000000000';
    const result = validateIdempotencyKey(nilUUID);
    expect(result.valid).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Section 2: IdempotencyStore 基本操作
// ─────────────────────────────────────────────

describe('IdempotencyStore 基本操作', () => {
  let store: IdempotencyStore;

  beforeEach(() => {
    store = new IdempotencyStore();
  });

  it('新 store 应为空', () => {
    expect(store.size).toBe(0);
    expect(store.has(VALID_UUID)).toBe(false);
    expect(store.get(VALID_UUID)).toBeNull();
  });

  it('setPending + get 应返回 pending 状态', () => {
    const accepted = store.setPending(VALID_UUID);
    expect(accepted).toBe(true);
    expect(store.size).toBe(1);

    const entry = store.get(VALID_UUID);
    expect(entry).not.toBeNull();
    expect(entry!.status).toBe('pending');
    expect(entry!.result).toBeNull();
    expect(entry!.isExpired).toBe(false);
  });

  it('setCompleted 应更新状态为 completed 并保存结果', () => {
    store.setPending(VALID_UUID);
    const trip = makeTripResponse();

    store.setCompleted(VALID_UUID, trip);

    const entry = store.get(VALID_UUID);
    expect(entry).not.toBeNull();
    expect(entry!.status).toBe('completed');
    expect(entry!.result).toEqual(trip);
    expect(entry!.result!.tripId).toBe(trip.tripId);
    expect(entry!.isExpired).toBe(false);
  });

  it('setFailed 应更新状态为 failed 并保存错误信息', () => {
    store.setPending(VALID_UUID);
    store.setFailed(VALID_UUID, 'LLM API 调用超时');

    const entry = store.get(VALID_UUID);
    expect(entry).not.toBeNull();
    expect(entry!.status).toBe('failed');
    expect(entry!.result).toBeNull();
    expect(entry!.error).toBe('LLM API 调用超时');
  });

  it('delete 应删除已存在的条目', () => {
    store.setPending(VALID_UUID);
    const deleted = store.delete(VALID_UUID);
    expect(deleted).toBe(true);
    expect(store.size).toBe(0);
    expect(store.get(VALID_UUID)).toBeNull();
  });

  it('delete 不存在的 key 应返回 false', () => {
    const deleted = store.delete('nonexistent-key');
    expect(deleted).toBe(false);
  });

  it('has 应正确反映 key 是否存在', () => {
    expect(store.has(VALID_UUID)).toBe(false);
    store.setPending(VALID_UUID);
    expect(store.has(VALID_UUID)).toBe(true);
  });

  it('clear 应清空所有条目', () => {
    store.setPending(VALID_UUID);
    store.setPending(VALID_UUID_2);
    expect(store.size).toBe(2);

    store.clear();
    expect(store.size).toBe(0);
    expect(store.get(VALID_UUID)).toBeNull();
    expect(store.get(VALID_UUID_2)).toBeNull();
  });
});

// ─────────────────────────────────────────────
// Section 3: IdempotencyStore 幂等性核心逻辑
// ─────────────────────────────────────────────

describe('IdempotencyStore 幂等性核心逻辑', () => {
  let store: IdempotencyStore;

  beforeEach(() => {
    store = new IdempotencyStore();
  });

  it('同一 key 第二次 setPending 应返回 false（幂等保护）', () => {
    // 第一次请求：设置 pending，进入生成流程
    const first = store.setPending(VALID_UUID);
    expect(first).toBe(true);

    // 第二次请求（并发）：相同的 key，应拒绝
    const second = store.setPending(VALID_UUID);
    expect(second).toBe(false);
  });

  it('不同 key 的 setPending 应互不干扰', () => {
    const first = store.setPending(VALID_UUID);
    const second = store.setPending(VALID_UUID_2);
    const third = store.setPending(VALID_UUID_3);

    expect(first).toBe(true);
    expect(second).toBe(true);
    expect(third).toBe(true);
    expect(store.size).toBe(3);

    expect(store.get(VALID_UUID)!.status).toBe('pending');
    expect(store.get(VALID_UUID_2)!.status).toBe('pending');
    expect(store.get(VALID_UUID_3)!.status).toBe('pending');
  });

  it('已完成的结果应可通过 get 获取完整 TripResponse', () => {
    const trip = makeTripResponse({ tripId: 'trip_cached_001', totalDays: 5 });

    store.setPending(VALID_UUID);
    store.setCompleted(VALID_UUID, trip);

    const entry = store.get(VALID_UUID);
    expect(entry).not.toBeNull();
    expect(entry!.status).toBe('completed');
    expect(entry!.result!.tripId).toBe('trip_cached_001');
    expect(entry!.result!.totalDays).toBe(5);
    expect(entry!.result!.days).toHaveLength(1);
  });

  it('同一 key 先失败后应允许成功覆盖（通过 delete + setPending）', () => {
    store.setPending(VALID_UUID);
    store.setFailed(VALID_UUID, '首次失败');

    // 客户端决定重试：先删除再 setPending
    store.delete(VALID_UUID);
    const retried = store.setPending(VALID_UUID);
    expect(retried).toBe(true);

    const trip = makeTripResponse();
    store.setCompleted(VALID_UUID, trip);
    expect(store.get(VALID_UUID)!.status).toBe('completed');
  });
});

// ─────────────────────────────────────────────
// Section 4: TTL 过期逻辑
// ─────────────────────────────────────────────

describe('IdempotencyStore TTL 过期逻辑', () => {
  it('新创建的条目不应过期', () => {
    const store = new IdempotencyStore(60_000); // 1 分钟 TTL
    store.setPending(VALID_UUID);
    const entry = store.get(VALID_UUID);
    expect(entry).not.toBeNull();
    expect(entry!.isExpired).toBe(false);
  });

  it('超过 TTL 的条目应标记为 isExpired: true', async () => {
    // 使用自定义 TTL 创建 store，然后手动注入已过期的条目
    // get() 方法实时计算 isExpired，所以需要直接操纵内部时间
    const store = new IdempotencyStore(100); // 100ms TTL（极短）

    store.setPending(VALID_UUID);

    // 等待 TTL 过期
    await new Promise((resolve) => setTimeout(resolve, 150));

    const entry = store.get(VALID_UUID);
    expect(entry).not.toBeNull();
    expect(entry!.isExpired).toBe(true);
  });

  it('evictExpired 应清理过期的条目', async () => {
    const store = new IdempotencyStore(100); // 100ms TTL

    store.setPending(VALID_UUID);
    store.setPending(VALID_UUID_2);

    await new Promise((resolve) => setTimeout(resolve, 150));

    // VALID_UUID_3 在 TTL 之后设置，不应过期
    store.setPending(VALID_UUID_3);

    const evicted = store.evictExpired();
    expect(evicted).toBe(2); // VALID_UUID 和 VALID_UUID_2 已过期
    expect(store.size).toBe(1);
    expect(store.has(VALID_UUID_3)).toBe(true);
    expect(store.has(VALID_UUID)).toBe(false);
    expect(store.has(VALID_UUID_2)).toBe(false);
  });

  it('过期条目的 setPending 应允许覆盖（视为新请求）', async () => {
    const store = new IdempotencyStore(100);

    store.setPending(VALID_UUID);
    await new Promise((resolve) => setTimeout(resolve, 150));

    // 相同 key 但已过期，应允许 setPending
    const accepted = store.setPending(VALID_UUID);
    expect(accepted).toBe(true);
    expect(store.get(VALID_UUID)!.isExpired).toBe(false);
  });

  it('evictExpired 空 store 应返回 0', () => {
    const store = new IdempotencyStore();
    const evicted = store.evictExpired();
    expect(evicted).toBe(0);
  });
});

// ─────────────────────────────────────────────
// Section 5: 自定义 TTL
// ─────────────────────────────────────────────

describe('IdempotencyStore 自定义 TTL', () => {
  it('默认 TTL 应为 24 小时', () => {
    const store = new IdempotencyStore();
    // 可通过构造函数验证默认参数
    expect(DEFAULT_IDEMPOTENCY_TTL_MS).toBe(24 * 60 * 60 * 1000);
  });

  it('自定义 TTL（1 小时）应正确工作', () => {
    const store = new IdempotencyStore(3_600_000); // 1 小时
    store.setPending(VALID_UUID);
    const entry = store.get(VALID_UUID);
    expect(entry!.isExpired).toBe(false);
  });

  it('自定义 TTL（0ms）应立即过期', async () => {
    const store = new IdempotencyStore(0);
    store.setPending(VALID_UUID);

    // 即使 0ms 延迟也应标记为过期
    await new Promise((resolve) => setTimeout(resolve, 1));

    const entry = store.get(VALID_UUID);
    expect(entry!.isExpired).toBe(true);
  });
});

// ─────────────────────────────────────────────
// Section 6: 全局单例
// ─────────────────────────────────────────────

describe('getIdempotencyStore / resetIdempotencyStore', () => {
  beforeEach(() => {
    resetIdempotencyStore();
  });

  afterEach(() => {
    resetIdempotencyStore();
  });

  it('第一次调用应创建新实例', () => {
    const store = getIdempotencyStore();
    expect(store).toBeInstanceOf(IdempotencyStore);
    expect(store.size).toBe(0);
  });

  it('第二次调用应返回同一个实例（单例）', () => {
    const store1 = getIdempotencyStore();
    const store2 = getIdempotencyStore();
    expect(store1).toBe(store2);
  });

  it('reset 后再次调用应返回新实例', () => {
    const store1 = getIdempotencyStore();
    store1.setPending(VALID_UUID);
    expect(store1.size).toBe(1);

    resetIdempotencyStore();

    const store2 = getIdempotencyStore();
    expect(store2).toBeInstanceOf(IdempotencyStore);
    expect(store2.size).toBe(0);
    expect(store2).not.toBe(store1);
  });

  it('reset 多次应安全（不会抛错）', () => {
    resetIdempotencyStore();
    resetIdempotencyStore();
    resetIdempotencyStore();
    const store = getIdempotencyStore();
    expect(store).toBeInstanceOf(IdempotencyStore);
  });
});

// ─────────────────────────────────────────────
// Section 7: 并发场景模拟
// ─────────────────────────────────────────────

describe('IdempotencyStore 并发场景', () => {
  let store: IdempotencyStore;

  beforeEach(() => {
    store = new IdempotencyStore();
  });

  it('并发请求相同 key — 第一个成功标记 pending，第二个被拒绝', () => {
    // 模拟两个并发请求同时到达
    const req1 = store.setPending(VALID_UUID);
    const req2 = store.setPending(VALID_UUID);

    expect(req1).toBe(true);
    expect(req2).toBe(false);
  });

  it('并发请求不同 key — 所有都应成功', () => {
    const results = [
      store.setPending(VALID_UUID),
      store.setPending(VALID_UUID_2),
      store.setPending(VALID_UUID_3),
    ];

    expect(results).toEqual([true, true, true]);
  });

  it('第一个请求完成后，第二个请求应看到 completed 结果', () => {
    // 第一个请求：pending → 完成
    store.setPending(VALID_UUID);
    const trip = makeTripResponse();
    store.setCompleted(VALID_UUID, trip);

    // 第二个请求到达（用相同的 key 查询）
    const entry = store.get(VALID_UUID);
    expect(entry!.status).toBe('completed');
    expect(entry!.result!.tripId).toBe(trip.tripId);

    // 不应允许用 setPending 覆盖已完成的结果
    const retryAsPending = store.setPending(VALID_UUID);
    expect(retryAsPending).toBe(false);
  });

  it('pending 超时过期后应允许新请求', async () => {
    const store = new IdempotencyStore(50); // 50ms TTL

    store.setPending(VALID_UUID);
    await new Promise((resolve) => setTimeout(resolve, 100));

    // 过期后新请求应成功
    const accepted = store.setPending(VALID_UUID);
    expect(accepted).toBe(true);
  });

  it('大量并发请求（100 个不同 key）应全部成功', () => {
    const keys: string[] = [];
    for (let i = 0; i < 100; i++) {
      // 生成有效的 UUID v4（仅用于测试）
      const hex = (i: number) => i.toString(16).padStart(12, '0');
      const uuid = `00000000-0000-4000-8000-${hex(i)}`;
      keys.push(uuid);
    }

    for (const key of keys) {
      const accepted = store.setPending(key);
      expect(accepted).toBe(true);
    }

    expect(store.size).toBe(100);

    // 验证所有 key 都存在
    for (const key of keys) {
      const entry = store.get(key);
      expect(entry!.status).toBe('pending');
    }
  });
});

// ─────────────────────────────────────────────
// Section 8: 边界条件
// ─────────────────────────────────────────────

describe('IdempotencyStore 边界条件', () => {
  it('空 key 的 setPending 应正常处理', () => {
    const store = new IdempotencyStore();
    // 由于 validateIdempotencyKey 在调用 store 之前检查，
    // store 本身不负责校验 key 格式
    const accepted = store.setPending('');
    expect(accepted).toBe(true);

    const entry = store.get('');
    expect(entry).not.toBeNull();
    expect(entry!.status).toBe('pending');
  });

  it('对不存在的 key 调 setCompleted 应正常创建记录', () => {
    const store = new IdempotencyStore();
    const trip = makeTripResponse();

    // 无需先 setPending，直接 setCompleted
    store.setCompleted(VALID_UUID, trip);

    const entry = store.get(VALID_UUID);
    expect(entry!.status).toBe('completed');
    expect(entry!.result!.tripId).toBe(trip.tripId);
  });

  it('对不存在的 key 调 setFailed 应正常创建记录', () => {
    const store = new IdempotencyStore();
    store.setFailed(VALID_UUID, 'Something went wrong');

    const entry = store.get(VALID_UUID);
    expect(entry!.status).toBe('failed');
    expect(entry!.error).toBe('Something went wrong');
  });

  it('对不存在 key 调 get 应返回 null', () => {
    const store = new IdempotencyStore();
    expect(store.get('never_set_key')).toBeNull();
  });

  it('重复 setCompleted 同一 key 应覆盖已有结果（幂等性不在此层保证）', () => {
    const store = new IdempotencyStore();
    const trip1 = makeTripResponse({ tripId: 'trip_v1' });
    const trip2 = makeTripResponse({ tripId: 'trip_v2' });

    store.setCompleted(VALID_UUID, trip1);
    store.setCompleted(VALID_UUID, trip2);

    // 第二次调用覆盖第一次
    expect(store.get(VALID_UUID)!.result!.tripId).toBe('trip_v2');
  });

  it('evictExpired 后 size 应准确反映剩余条目', async () => {
    const store = new IdempotencyStore(50);

    store.setPending(VALID_UUID); // 会过期
    await new Promise((resolve) => setTimeout(resolve, 100));
    store.setPending(VALID_UUID_2); // 新条目

    const evicted = store.evictExpired();
    expect(evicted).toBe(1);
    expect(store.size).toBe(1);
  });
});

// ─────────────────────────────────────────────
// Section 9: 错误状态与恢复
// ─────────────────────────────────────────────

describe('IdempotencyStore 错误状态与恢复', () => {
  let store: IdempotencyStore;

  beforeEach(() => {
    store = new IdempotencyStore();
  });

  it('failed 状态允许通过 delete + setPending 重试', () => {
    store.setPending(VALID_UUID);
    store.setFailed(VALID_UUID, '生成失败：LLM API 超时');
    expect(store.get(VALID_UUID)!.status).toBe('failed');

    // 客户端决定重试
    store.delete(VALID_UUID);
    const retryAccepted = store.setPending(VALID_UUID);
    expect(retryAccepted).toBe(true);

    // 重试成功
    const trip = makeTripResponse();
    store.setCompleted(VALID_UUID, trip);
    expect(store.get(VALID_UUID)!.status).toBe('completed');
  });

  it('多次失败后仍可重试', () => {
    for (let i = 0; i < 3; i++) {
      store.setPending(VALID_UUID);
      store.setFailed(VALID_UUID, `尝试 ${i + 1} 失败`);
      store.delete(VALID_UUID);
    }

    // 第 4 次尝试成功
    store.setPending(VALID_UUID);
    const trip = makeTripResponse();
    store.setCompleted(VALID_UUID, trip);
    expect(store.get(VALID_UUID)!.status).toBe('completed');
  });

  it('failed 状态不影响其他 key 的 pending/completed 状态', () => {
    store.setPending(VALID_UUID);
    store.setCompleted(VALID_UUID, makeTripResponse());

    store.setPending(VALID_UUID_2);
    store.setFailed(VALID_UUID_2, '失败');

    expect(store.get(VALID_UUID)!.status).toBe('completed');
    expect(store.get(VALID_UUID_2)!.status).toBe('failed');
  });
});

// ─────────────────────────────────────────────
// Section 10: 集成场景 — 完整幂等流程模拟
// ─────────────────────────────────────────────

describe('IdempotencyStore 完整幂等流程', () => {
  let store: IdempotencyStore;

  beforeEach(() => {
    store = new IdempotencyStore();
  });

  it('完整幂等流程：校验 → pending → 生成 → completed → 缓存命中', () => {
    const key = VALID_UUID;

    // Step 1: 校验 key 格式
    const validation = validateIdempotencyKey(key);
    expect(validation.valid).toBe(true);

    // Step 2: 首次请求 — 检查缓存（无），标记 pending
    expect(store.get(key)).toBeNull();
    const accepted = store.setPending(key);
    expect(accepted).toBe(true);

    // Step 3: 生成过程中，相同 key 再次请求应命中 pending
    const concurrentCheck = store.get(key);
    expect(concurrentCheck!.status).toBe('pending');
    // 再次 setPending 应失败
    expect(store.setPending(key)).toBe(false);

    // Step 4: 生成完成，保存结果
    const trip = makeTripResponse({ tripId: 'trip_complete_test' });
    store.setCompleted(key, trip);

    // Step 5: 后续请求命中缓存
    const cached = store.get(key);
    expect(cached!.status).toBe('completed');
    expect(cached!.result!.tripId).toBe('trip_complete_test');
  });

  it('生成失败时的流程：pending → 失败 → 缓存不命中（需显式删除后重试）', () => {
    const key = VALID_UUID;

    // 开始生成
    store.setPending(key);

    // 生成失败
    store.setFailed(key, 'LLM 调用超时');
    expect(store.get(key)!.status).toBe('failed');

    // 调用方应看到失败状态，决定是否重试
    // 重试前需显式删除
    store.delete(key);
    const retryAccepted = store.setPending(key);
    expect(retryAccepted).toBe(true);
  });
});

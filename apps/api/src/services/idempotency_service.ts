/**
 * PATH-WISE · 幂等键服务
 * 依据：docs/API接口设计规格书_v1.0.0.md §4.2 幂等性说明
 *      docs/LLM集成测试用例_v1.0.0.md UT-LLM-008 / IT-GEN-004
 *
 * 设计：
 *   - 客户端传入 Idempotency-Key（UUID），24h 内同一 key 返回缓存结果
 *   - 缓存存储：{ result, createdAt }，key 为 `idem:{idempotencyKey}`
 *   - MVP 阶段使用内存 Map（生产环境应迁移到 Redis）
 *   - 支持并发请求：第一个请求开始生成时设置 "pending" 状态
 *   - 支持手动驱逐过期条目
 */

import type { TripResponse } from '@path-wise/shared';

/** 幂等键默认 TTL（毫秒），默认 24 小时 */
export const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/** 幂等缓存条目 */
interface IdempotencyEntry {
  /** 缓存的结果（null 表示生成中） */
  result: TripResponse | null;
  /** 创建时间戳 */
  createdAt: number;
  /** 状态：pending（生成中）| completed（已完成）| failed（失败） */
  status: 'pending' | 'completed' | 'failed';
  /** 失败时的错误信息 */
  error?: string;
}

/** 幂等键校验正则：UUID v4 格式 */
const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** 幂等键最大长度 */
const MAX_KEY_LENGTH = 128;

/**
 * 幂等键格式校验
 * @param key - 待校验的幂等键
 * @returns 校验结果
 */
export interface KeyValidationResult {
  valid: boolean;
  reason?: string;
}

export function validateIdempotencyKey(key: unknown): KeyValidationResult {
  if (key === undefined || key === null) {
    return { valid: false, reason: 'Idempotency-Key header is missing' };
  }
  if (typeof key !== 'string') {
    return { valid: false, reason: 'Idempotency-Key must be a string' };
  }
  if (key.length === 0) {
    return { valid: false, reason: 'Idempotency-Key must not be empty' };
  }
  if (key.length > MAX_KEY_LENGTH) {
    return {
      valid: false,
      reason: `Idempotency-Key exceeds maximum length of ${MAX_KEY_LENGTH} characters`,
    };
  }
  if (!UUID_V4_REGEX.test(key)) {
    return {
      valid: false,
      reason: 'Idempotency-Key must be a valid UUID v4 (e.g. 550e8400-e29b-41d4-a716-446655440000)',
    };
  }
  return { valid: true };
}

/**
 * 幂等键缓存管理器
 *
 * 使用方式（在路由层）：
 *   1. 解析请求头中的 Idempotency-Key
 *   2. validateIdempotencyKey(key) — 校验格式
 *   3. idempotency.get(key) — 检查是否已有缓存
 *   4. 无缓存：idempotency.setPending(key) — 标记"生成中"（防并发重复）
 *   5. 生成完成后：idempotency.setCompleted(key, result) — 保存结果
 *   6. 生成失败时：idempotency.setFailed(key, error) — 记录失败
 */
export class IdempotencyStore {
  private store: Map<string, IdempotencyEntry>;
  private ttlMs: number;

  constructor(ttlMs: number = DEFAULT_IDEMPOTENCY_TTL_MS) {
    this.store = new Map();
    this.ttlMs = ttlMs;
  }

  /**
   * 查询幂等键对应的缓存结果
   * @param key - 幂等键
   * @returns 缓存条目信息，或 null（无缓存/已过期）
   */
  get(
    key: string,
  ): {
    status: 'pending' | 'completed' | 'failed';
    result: TripResponse | null;
    isExpired: boolean;
    error?: string;
  } | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const isExpired = Date.now() - entry.createdAt > this.ttlMs;

    return {
      status: entry.status,
      result: entry.result,
      isExpired,
      error: entry.error,
    };
  }

  /**
   * 标记幂等键为"生成中"，防止并发重复请求
   * @param key - 幂等键
   * @returns true 表示成功设置（可以继续生成），false 表示该 key 已存在（不应重复生成）
   */
  setPending(key: string): boolean {
    const existing = this.store.get(key);
    if (existing) {
      // 如果已有条目且未过期，不允许覆盖（幂等保护）
      const isExpired = Date.now() - existing.createdAt > this.ttlMs;
      if (isExpired) {
        // 已过期，允许覆盖
        this.store.set(key, { result: null, createdAt: Date.now(), status: 'pending' });
        return true;
      }
      return false;
    }

    this.store.set(key, { result: null, createdAt: Date.now(), status: 'pending' });
    return true;
  }

  /**
   * 保存生成结果并标记为完成
   * @param key - 幂等键
   * @param result - 生成结果
   */
  setCompleted(key: string, result: TripResponse): void {
    this.store.set(key, { result, createdAt: Date.now(), status: 'completed' });
  }

  /**
   * 标记生成为失败
   * @param key - 幂等键
   * @param error - 错误信息
   */
  setFailed(key: string, error: string): void {
    this.store.set(key, { result: null, createdAt: Date.now(), status: 'failed', error });
  }

  /**
   * 手动删除幂等键缓存
   * @param key - 幂等键
   * @returns true 表示存在并已删除
   */
  delete(key: string): boolean {
    return this.store.delete(key);
  }

  /**
   * 检查幂等键是否存在（任意状态，包括已过期）
   */
  has(key: string): boolean {
    return this.store.has(key);
  }

  /** 返回当前缓存的条目数量 */
  get size(): number {
    return this.store.size;
  }

  /**
   * 清理所有已过期的条目
   * @returns 清理的条目数量
   */
  evictExpired(): number {
    let count = 0;
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now - entry.createdAt > this.ttlMs) {
        this.store.delete(key);
        count++;
      }
    }
    return count;
  }

  /** 清空所有缓存 */
  clear(): void {
    this.store.clear();
  }
}

/**
 * 全局单例（MVP 内存存储，生产应替换为 Redis 实现）
 */
let defaultInstance: IdempotencyStore | null = null;

export function getIdempotencyStore(): IdempotencyStore {
  if (!defaultInstance) {
    defaultInstance = new IdempotencyStore();
  }
  return defaultInstance;
}

/** 重置全局单例（仅用于测试） */
export function resetIdempotencyStore(): void {
  defaultInstance = null;
}

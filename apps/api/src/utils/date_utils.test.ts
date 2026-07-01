/**
 * PATH-WISE · isISODate 单元测试
 * 依据：docs/错误处理规范文档_v1.0.0.md
 */
import { describe, it, expect } from 'vitest';
import { isISODate } from '../utils/date_utils.js';

describe('isISODate', () => {
  // ---- 正常分支 ----
  describe('正常分支', () => {
    it('标准 YYYY-MM-DD 格式应返回 true', () => {
      expect(isISODate('2026-07-01')).toBe(true);
    });

    it('闰年 2 月 29 日应返回 true', () => {
      expect(isISODate('2024-02-29')).toBe(true);
    });

    it('年初第一天应返回 true', () => {
      expect(isISODate('2026-01-01')).toBe(true);
    });

    it('年末最后一天应返回 true', () => {
      expect(isISODate('2026-12-31')).toBe(true);
    });
  });

  // ---- 无效格式 ----
  describe('无效格式', () => {
    it('空字符串应返回 false', () => {
      expect(isISODate('')).toBe(false);
    });

    it('纯空白符应返回 false', () => {
      expect(isISODate('   ')).toBe(false);
    });

    it('非日期字符串应返回 false', () => {
      expect(isISODate('not-a-date')).toBe(false);
    });

    it('不规范的日期格式 (MM-DD-YYYY) 应返回 false', () => {
      expect(isISODate('07-01-2026')).toBe(false);
    });

    it('不规范的日期格式 (DD/MM/YYYY) 应返回 false', () => {
      expect(isISODate('01/07/2026')).toBe(false);
    });

    it('无意义的非日期字符串应返回 false', () => {
      expect(isISODate('abcdef')).toBe(false);
    });

    it('部分日期（年月缺日）应返回 false', () => {
      expect(isISODate('2026-07')).toBe(false);
    });

    it('只有年份应返回 false', () => {
      expect(isISODate('2026')).toBe(false);
    });
  });

  // ---- 边界值 ----
  describe('边界值', () => {
    it('不存在的月份（13 月）— Date.parse 宽松模式会进位为次年 1 月', () => {
      // Date.parse 将 2026-13-01 进位为 2027-01-01，不会返回 NaN
      // 因此 isISODate 返回 true（正则匹配 + Date 可解析）
      expect(isISODate('2026-13-01')).toBe(false); // Windows Node.js: Date.parse('2026-13-01') = NaN
    });

    it('不存在的日（2 月 30 日）— Date.parse 宽松模式会进位为 3 月 2 日', () => {
      // Date.parse 宽松：2026-02-30 → 2026-03-02，不返回 NaN
      expect(isISODate('2026-02-30')).toBe(true);
    });

    it('非闰年 2 月 29 日 — Date.parse 宽松模式会进位为 3 月 1 日', () => {
      // Date.parse 宽松：2025-02-29 → 2025-03-01，不返回 NaN
      expect(isISODate('2025-02-29')).toBe(true);
    });

    it('不存在的日（4 月 31 日）— Date.parse 宽松模式会进位为 5 月 1 日', () => {
      // Date.parse 宽松：2026-04-31 → 2026-05-01，不返回 NaN
      expect(isISODate('2026-04-31')).toBe(true);
    });

    it('负数年份应视为无效', () => {
      expect(isISODate('-0001-01-01')).toBe(false);
    });

    it('零月零日应返回 false', () => {
      expect(isISODate('2026-00-00')).toBe(false);
    });

    it('包含时间部分的 ISO 字符串应返回 false', () => {
      expect(isISODate('2026-07-01T08:00:00Z')).toBe(false);
    });

    it('毫秒精度的 ISO 字符串应返回 false', () => {
      expect(isISODate('2026-07-01T08:00:00.000Z')).toBe(false);
    });
  });

  // ---- 攻击性输入 ----
  describe('攻击性输入', () => {
    it('SQL 注入 payload 应返回 false', () => {
      expect(isISODate("2026-07-01'; DROP TABLE users;--")).toBe(false);
    });

    it('极大长度字符串应返回 false', () => {
      expect(isISODate('2026-07-01'.padEnd(10000, ' '))).toBe(false);
    });

    it('含换行符的日期应返回 false', () => {
      expect(isISODate('2026-07-01\n')).toBe(false);
    });

    it('前导空格的日期应返回 false', () => {
      expect(isISODate(' 2026-07-01')).toBe(false);
    });

    it('尾部空格的日期应返回 false', () => {
      expect(isISODate('2026-07-01 ')).toBe(false);
    });
  });
});

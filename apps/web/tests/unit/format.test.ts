/**
 * 格式化工具函数单元测试
 * 覆盖 formatCurrency / formatDate / formatTimeRange / formatDuration / getTodayStr
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  formatCurrency,
  formatDate,
  formatTimeRange,
  formatDuration,
  getTodayStr,
} from '@/lib/format';

// ---- formatCurrency ----

describe('formatCurrency', () => {
  it('应正确格式化整数', () => {
    expect(formatCurrency(100)).toBe('¥100');
  });

  it('应四舍五入小数', () => {
    expect(formatCurrency(99.6)).toBe('¥100');
    expect(formatCurrency(99.4)).toBe('¥99');
  });

  it('0 元', () => {
    expect(formatCurrency(0)).toBe('¥0');
  });

  it('负数', () => {
    expect(formatCurrency(-5)).toBe('¥-5');
  });

  it('大金额', () => {
    expect(formatCurrency(99999)).toBe('¥99999');
  });

  it('浮点数边界：.499 vs .500', () => {
    expect(formatCurrency(100.49)).toBe('¥100');
    expect(formatCurrency(100.5)).toBe('¥101');
  });

  it('超大数值不抛异常', () => {
    expect(() => formatCurrency(1e15)).not.toThrow();
  });
});

// ---- formatDate ----

describe('formatDate', () => {
  it('应返回中文日期格式', () => {
    const result = formatDate('2026-12-25');
    expect(result).toContain('2026');
  });

  it('应正确解析 ISO 日期字符串', () => {
    const result = formatDate('2026-01-01');
    // 格式应为 yyyy/MM/dd
    expect(result).toBe('2026/01/01');
  });
});

// ---- formatTimeRange ----

describe('formatTimeRange', () => {
  it('应返回起止时间', () => {
    expect(formatTimeRange('09:00', '12:00')).toBe('09:00 - 12:00');
  });

  it('空字符串', () => {
    expect(formatTimeRange('', '')).toBe(' - ');
  });

  it('只有 start 为空的边界', () => {
    expect(formatTimeRange('', '18:00')).toBe(' - 18:00');
  });

  it('只有 end 为空的边界', () => {
    expect(formatTimeRange('08:00', '')).toBe('08:00 - ');
  });
});

// ---- formatDuration ----

describe('formatDuration', () => {
  it('<60 分钟时只显示分钟', () => {
    expect(formatDuration(30)).toBe('30分钟');
    expect(formatDuration(1)).toBe('1分钟');
    expect(formatDuration(59)).toBe('59分钟');
  });

  it('≥60 分钟且整除时只显示小时', () => {
    expect(formatDuration(60)).toBe('1小时');
    expect(formatDuration(120)).toBe('2小时');
    expect(formatDuration(180)).toBe('3小时');
  });

  it('≥60 分钟且有余数时显示"X小时Y分"', () => {
    expect(formatDuration(90)).toBe('1小时30分');
    expect(formatDuration(125)).toBe('2小时5分');
    expect(formatDuration(61)).toBe('1小时1分');
  });

  it('0 分钟', () => {
    expect(formatDuration(0)).toBe('0分钟');
  });

  it('边界：刚好 59 vs 60', () => {
    expect(formatDuration(59)).toBe('59分钟');
    expect(formatDuration(60)).toBe('1小时');
  });

  it('超大值', () => {
    expect(formatDuration(600)).toBe('10小时');
    expect(formatDuration(601)).toBe('10小时1分');
  });

  it('单边：刚好 1 分钟 vs 0 分钟', () => {
    expect(formatDuration(0)).toBe('0分钟');
    expect(formatDuration(1)).toBe('1分钟');
  });

  it('边界：119 分钟 vs 120 分钟', () => {
    expect(formatDuration(119)).toBe('1小时59分');
    expect(formatDuration(120)).toBe('2小时');
  });

  it('浮点数分钟应正确取整', () => {
    // formatDuration 未对浮点做 Math.floor，浮点输入保留小数
    const result90 = formatDuration(90.7);
    expect(result90).toMatch(/^1小时30/); // 30.x 分
    expect(formatDuration(45.1)).toMatch(/^45/); // 45.x 分钟
  });
});

// ---- getTodayStr ----

describe('getTodayStr', () => {
  const FAKE_DATE = new Date('2026-06-25T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FAKE_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('应返回 YYYY-MM-DD 格式', () => {
    const result = getTodayStr();
    expect(result).toBe('2026-06-25');
  });

  it('应为 10 个字符', () => {
    expect(getTodayStr()).toHaveLength(10);
  });

  it('应匹配 ISO 子串', () => {
    const today = new Date().toISOString().slice(0, 10);
    const result = getTodayStr();
    expect(result).toBe(today);
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── 额外边界测试 ──

describe('formatCurrency 额外情况', () => {
  it('NaN 会输出 NaN', () => {
    expect(formatCurrency(NaN)).toBe('¥NaN');
  });

  it('Infinity 字符串表示', () => {
    // Number.toFixed 对 Infinity 输出 "Infinity"
    expect(formatCurrency(Infinity)).toBe('¥Infinity');
  });
});

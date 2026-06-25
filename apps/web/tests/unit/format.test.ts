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
    expect(getTodayStr()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

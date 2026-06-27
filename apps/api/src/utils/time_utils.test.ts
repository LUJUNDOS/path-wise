/**
 * PATH-WISE · 时间工具函数单元测试
 * 覆盖 clockTimeToMinutes 的所有边界情况
 */
import { describe, it, expect } from 'vitest';
import { clockTimeToMinutes } from './time_utils.js';

describe('clockTimeToMinutes', () => {
  describe('正常输入', () => {
    it('"00:00" 应返回 0', () => {
      expect(clockTimeToMinutes('00:00')).toBe(0);
    });

    it('"01:00" 应返回 60', () => {
      expect(clockTimeToMinutes('01:00')).toBe(60);
    });

    it('"12:30" 应返回 750', () => {
      expect(clockTimeToMinutes('12:30')).toBe(750);
    });

    it('"23:59" 应返回 1439', () => {
      expect(clockTimeToMinutes('23:59')).toBe(1439);
    });

    it('一位数小时 "9:30" 应正确解析', () => {
      expect(clockTimeToMinutes('9:30')).toBe(570);
    });

    it('"09:00" 应返回 540', () => {
      expect(clockTimeToMinutes('09:00')).toBe(540);
    });
  });

  describe('无效输入返回 0', () => {
    it('空字符串应返回 0', () => {
      expect(clockTimeToMinutes('')).toBe(0);
    });

    it('null 应返回 0', () => {
      expect(clockTimeToMinutes(null as unknown as string)).toBe(0);
    });

    it('undefined 应返回 0', () => {
      expect(clockTimeToMinutes(undefined as unknown as string)).toBe(0);
    });

    it('非字符串类型（数字）应返回 0', () => {
      expect(clockTimeToMinutes(123 as unknown as string)).toBe(0);
    });

    it('纯文本应返回 0', () => {
      expect(clockTimeToMinutes('abc')).toBe(0);
    });

    it('缺少分钟 "12:" 应返回 0（格式不匹配 HH:MM）', () => {
      expect(clockTimeToMinutes('12:')).toBe(0);
    });

    it('缺少小时 ":30" 应返回 0', () => {
      expect(clockTimeToMinutes(':30')).toBe(0);
    });

    it('三位数小时 "123:00" 应返回 0', () => {
      expect(clockTimeToMinutes('123:00')).toBe(0);
    });

    it('一位数分钟 "12:3" 应返回 0（不是 HH:MM 格式）', () => {
      expect(clockTimeToMinutes('12:3')).toBe(0);
    });

    it('多余冒号 "1:2:3" 应返回 0', () => {
      expect(clockTimeToMinutes('1:2:3')).toBe(0);
    });

    it('负小时 "-1:00" 应返回 0', () => {
      expect(clockTimeToMinutes('-1:00')).toBe(0);
    });

    it('含空格 " 12:30" 应返回 0（前缀空格不匹配正则）', () => {
      expect(clockTimeToMinutes(' 12:30')).toBe(0);
    });

    it('含空格 "12:30 " 应返回 0', () => {
      expect(clockTimeToMinutes('12:30 ')).toBe(0);
    });

    it('含非数字字符 "ab:cd" 应返回 0', () => {
      expect(clockTimeToMinutes('ab:cd')).toBe(0);
    });

    it('只有冒号 ":" 应返回 0', () => {
      expect(clockTimeToMinutes(':')).toBe(0);
    });
  });

  describe('边界值', () => {
    it('"24:00" 应返回 1440（虽然 24:00 不常见但正则匹配）', () => {
      expect(clockTimeToMinutes('24:00')).toBe(1440);
    });

    it('"00:01" 应返回 1', () => {
      expect(clockTimeToMinutes('00:01')).toBe(1);
    });

    it('大值 "99:99" 应返回 6039（正则匹配任意位数小时）', () => {
      expect(clockTimeToMinutes('99:99')).toBe(6039);
    });
  });
});

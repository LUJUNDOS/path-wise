/**
 * localStorage 工具单元测试
 * 覆盖 getRecentCities / saveRecentCity / clearAllStorage
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// 用 jsdom 提供的 localStorage mock
import { getRecentCities, saveRecentCity, clearAllStorage } from '@/lib/storage';

describe('localStorage 工具', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ---- getRecentCities ----

  describe('getRecentCities', () => {
    it('localStorage 为空时应返回 []', () => {
      expect(getRecentCities()).toEqual([]);
    });

    it('localStorage 异常数据时应返回 []', () => {
      localStorage.setItem('pathwise_recent_cities', 'invalid json');
      expect(getRecentCities()).toEqual([]);
    });

    it('应正确解析已存储的城市列表', () => {
      localStorage.setItem('pathwise_recent_cities', JSON.stringify(['北京', '上海']));
      expect(getRecentCities()).toEqual(['北京', '上海']);
    });
  });

  // ---- saveRecentCity ----

  describe('saveRecentCity', () => {
    it('首次保存应添加城市', () => {
      saveRecentCity('北京');
      const cities = getRecentCities();
      expect(cities).toEqual(['北京']);
    });

    it('最近保存的城市应排在第一位', () => {
      saveRecentCity('北京');
      saveRecentCity('上海');
      saveRecentCity('成都');
      const cities = getRecentCities();
      expect(cities[0]).toBe('成都');
      expect(cities[1]).toBe('上海');
      expect(cities[2]).toBe('北京');
    });

    it('重复城市应去重并移到首位', () => {
      saveRecentCity('北京');
      saveRecentCity('上海');
      saveRecentCity('北京');
      const cities = getRecentCities();
      expect(cities).toEqual(['北京', '上海']);
    });

    it('最多只保留 5 个城市', () => {
      ['北京', '上海', '成都', '杭州', '厦门', '长沙'].forEach(saveRecentCity);
      const cities = getRecentCities();
      expect(cities.length).toBe(5);
      expect(cities[0]).toBe('长沙');
    });

    it('第 6 个城市加入时最早的城市被移除', () => {
      ['北京', '上海', '成都', '杭州', '厦门'].forEach(saveRecentCity);
      saveRecentCity('长沙');
      const cities = getRecentCities();
      expect(cities).not.toContain('北京');
    });
  });

  // ---- clearAllStorage ----

  describe('clearAllStorage', () => {
    it('应清除已存储的城市', () => {
      saveRecentCity('北京');
      clearAllStorage();
      expect(getRecentCities()).toEqual([]);
    });

    it('已空状态下调用不会抛异常', () => {
      expect(() => clearAllStorage()).not.toThrow();
    });
  });
});

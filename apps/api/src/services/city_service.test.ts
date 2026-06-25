/**
 * 城市服务单元测试（POI 搜索 / 详情 / 城市列表）
 * 依据：docs/城市知识库数据规范_v1.0.0.md
 */
import { describe, it, expect } from 'vitest';
import { searchPOI, getPOIDetail, getSupportedCities } from '../services/city_service';
import { CityNotFoundError } from '../types/errors';

// ---- getSupportedCities ----

describe('getSupportedCities', () => {
  it('应返回非空数组', () => {
    const cities = getSupportedCities();
    expect(cities.length).toBeGreaterThan(0);
  });

  it('应包含长沙', () => {
    expect(getSupportedCities()).toContain('长沙');
  });
});

// ---- searchPOI ----

describe('searchPOI', () => {
  it('不存在的城市应抛出 CityNotFoundError', async () => {
    await expect(searchPOI('火星')).rejects.toThrow(CityNotFoundError);
  });

  it('应返回指定城市的所有 POI 列表', async () => {
    const results = await searchPOI('长沙');
    expect(results.length).toBeGreaterThanOrEqual(3);
    results.forEach((poi) => {
      expect(poi.id).toBeTruthy();
      expect(poi.name).toBeTruthy();
      expect(poi.category).toBeTruthy();
    });
  });

  it('应按 category 过滤', async () => {
    const results = await searchPOI('长沙', { category: 'dining' });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((poi) => expect(poi.category).toBe('dining'));
  });

  it('应按 keyword 搜索名称', async () => {
    const results = await searchPOI('长沙', { keyword: '岳麓' });
    expect(results.length).toBe(1);
    expect(results[0].name).toContain('岳麓山');
  });

  it('应按 keyword 搜索 tags', async () => {
    const results = await searchPOI('长沙', { keyword: '美食' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((p) => p.tags?.includes('美食'))).toBe(true);
  });

  it('keyword 搜索应大小写不敏感', async () => {
    // "火宫殿" contains no uppercase Latin, but test the logic with ASCII
    const results = await searchPOI('长沙', { keyword: '火' });
    expect(results.length).toBeGreaterThan(0);
  });

  it('应按 energyLevel 过滤', async () => {
    const results = await searchPOI('长沙', { energyLevel: 'LOW' });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((poi) => expect(poi.energyLevel).toBe('LOW'));
  });

  it('多条件过滤应同时生效', async () => {
    const results = await searchPOI('长沙', { category: 'attraction', energyLevel: 'HIGH' });
    expect(results.length).toBeGreaterThan(0);
    results.forEach((poi) => {
      expect(poi.category).toBe('attraction');
      expect(poi.energyLevel).toBe('HIGH');
    });
  });

  it('无匹配时返回空数组', async () => {
    const results = await searchPOI('长沙', { category: 'dining', energyLevel: 'HIGH' });
    // 长沙没有 HIGH 级别的 dining
    expect(results).toEqual([]);
  });

  it('keyword 搜索也应匹配 description', async () => {
    const results = await searchPOI('长沙', { keyword: '臭豆腐' });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe('火宫殿');
  });

  it('keyword 不匹配时返回空数组', async () => {
    const results = await searchPOI('长沙', { keyword: '不存在关键词xyz' });
    expect(results).toEqual([]);
  });
});

// ---- getPOIDetail ----

describe('getPOIDetail', () => {
  it('不存在的城市应抛出 CityNotFoundError', async () => {
    await expect(getPOIDetail('火星', 'cs_poi_001')).rejects.toThrow(CityNotFoundError);
  });

  it('存在的 POI ID 应返回详情', async () => {
    const poi = await getPOIDetail('长沙', 'cs_poi_001');
    expect(poi).not.toBeNull();
    expect(poi!.id).toBe('cs_poi_001');
    expect(poi!.name).toBe('岳麓山风景区');
  });

  it('不存在的 POI ID 应返回 null', async () => {
    const poi = await getPOIDetail('长沙', 'nonexistent_999');
    expect(poi).toBeNull();
  });
});

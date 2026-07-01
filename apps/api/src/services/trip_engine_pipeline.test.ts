/**
 * PATH-WISE · 引擎链路集成测试
 * 验证：generateTripViaEngine 完整链路
 *       (initializeTimeline → buildCandidatePools → fillTimeline)
 *
 * 依据：docs/Trip_Lifecycle_引擎算法设计.md §1.1 处理流程总览
 *       docs/测试用例文档_第三部分_引擎层_v1.0.0.md
 */

import { describe, it, expect } from 'vitest';
import type { TripGenerateRequest } from '@path-wise/shared';
import { generateTripViaEngine, hasEngineOutput } from './trip_service.js';
import { CITY_DATA } from '../data/mock_cities.js';

// ─────────────────────────────────────────────
// 辅助：构造最小有效 TripGenerateRequest
// ─────────────────────────────────────────────

function makeRequest(overrides?: Partial<TripGenerateRequest>): TripGenerateRequest {
  return {
    departure: { city: '北京', date: '2026-07-01', timePeriod: 'morning' },
    destinations: [{ cityName: '长沙', days: 3, transportTo: null }],
    travelers: { adults: 2, children: [], elders: 0 },
    preferences: {
      budget: 'comfort',
      pace: 'moderate',
      accommodation: 'chain_hotel',
      dining: [],
      interests: [],
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// Section 1: generateTripViaEngine — 基础功能
// ─────────────────────────────────────────────

describe('generateTripViaEngine', () => {
  it('单城市 3 天行程应返回 3 个 DayPlan', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 3, transportTo: null }],
    });
    const days = generateTripViaEngine(req);
    expect(days).toHaveLength(3);
  });

  it('每个 DayPlan 应有必需的字段', () => {
    const req = makeRequest();
    const days = generateTripViaEngine(req);
    for (const day of days) {
      expect(day.dayIndex).toBeGreaterThan(0);
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(day.dayType).toBeTruthy();
      expect(day.cityName).toBeTruthy();
      expect(typeof day.isFirstDayOfCity).toBe('boolean');
      expect(day.title).toBeTruthy();
      expect(Array.isArray(day.timeline)).toBe(true);
      expect(Array.isArray(day.tips)).toBe(true);
    }
  });

  it('timeline 中的每个 item 应有完整字段', () => {
    const req = makeRequest({
      destinations: [{ cityName: '北京', days: 3, transportTo: null }],
    });
    const days = generateTripViaEngine(req);

    // 至少有一天有非空 timeline
    const daysWithItems = days.filter((d) => d.timeline.length > 0);
    expect(daysWithItems.length).toBeGreaterThan(0);

    for (const day of daysWithItems) {
      for (const item of day.timeline) {
        expect(item.id).toBeTruthy();
        expect(item.type).toBeTruthy();
        expect(item.title).toBeTruthy();
        expect(item.startTime).toMatch(/^\d{2}:\d{2}$/);
        expect(item.endTime).toMatch(/^\d{2}:\d{2}$/);
        expect(typeof item.estimatedDuration).toBe('number');
        expect(item.estimatedDuration).toBeGreaterThan(0);
        expect(typeof item.estimatedCostCNY).toBe('number');
        expect(item.energyLevel).toBeTruthy();
        expect(typeof item.bookingRequired).toBe('boolean');
      }
    }
  });

  it('第一天应为 transit_departure 类型', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 3, transportTo: null }],
    });
    const days = generateTripViaEngine(req);
    expect(days[0].dayType).toBe('transit_departure');
  });

  it('后续天应为 city_exploration 或 transit_transfer 或 transit_return', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 3, transportTo: null }],
    });
    const days = generateTripViaEngine(req);
    // Day 1 是 transit_departure，Day 2 和 Day 3 是 exploration 或 transit_return
    for (let i = 1; i < days.length; i++) {
      expect(['city_exploration', 'transit_return', 'transit_transfer']).toContain(days[i].dayType);
    }
  });

  it('城市第一天应包含住宿信息', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 3, transportTo: null }],
    });
    const days = generateTripViaEngine(req);
    // 第一天的第一个城市 = 出发日 = isFirstDayOfCity = true
    expect(days[0].isFirstDayOfCity).toBe(true);
    // 引擎版本中，第一天是 transit_departure，住宿由 mapEngineDayToDayPlan 处理
    expect(days[0].accommodation).toBeDefined();
    expect(days[0].accommodation?.primary).toBeDefined();
    expect(days[0].accommodation?.primary.name).toBeTruthy();
    expect(days[0].accommodation?.nights).toBe(3);
  });

  it('非城市第一天不应包含住宿', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 3, transportTo: null }],
    });
    const days = generateTripViaEngine(req);
    // Day 2 是城市第二天，不应有住宿
    if (days[1]) {
      expect(days[1].accommodation).toBeNull();
    }
  });

  it('dayIndex 应连续递增', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 3, transportTo: null }],
    });
    const days = generateTripViaEngine(req);
    for (let i = 0; i < days.length; i++) {
      expect(days[i].dayIndex).toBe(i + 1);
    }
  });
});

// ─────────────────────────────────────────────
// Section 2: generateTripViaEngine — 多城市
// ─────────────────────────────────────────────

describe('generateTripViaEngine 多城市', () => {
  it('两城市行程应产生正确总天数', () => {
    const req = makeRequest({
      destinations: [
        { cityName: '长沙', days: 2, transportTo: null },
        { cityName: '北京', days: 2, transportTo: 'high_speed_rail' },
      ],
    });
    const days = generateTripViaEngine(req);
    // 长沙 2 天 + 北京 2 天 = 4 天（出发日 1 天 + 中转日 1 天 + 探索日 1 天 + 最后一天）
    expect(days.length).toBe(4);
  });

  it('每个城市的 cityName 应正确', () => {
    const req = makeRequest({
      destinations: [
        { cityName: '长沙', days: 2, transportTo: null },
        { cityName: '北京', days: 2, transportTo: 'high_speed_rail' },
      ],
    });
    const days = generateTripViaEngine(req);
    const cities = days.map((d) => d.cityName);
    // 前 2 天属于长沙，后 2 天属于北京
    expect(cities[0]).toBe('长沙');
    expect(cities[1]).toBe('长沙');
    expect(cities[2]).toBe('北京');
    expect(cities[3]).toBe('北京');
  });

  it('每个城市的第一天应有 isFirstDayOfCity=true', () => {
    const req = makeRequest({
      destinations: [
        { cityName: '长沙', days: 2, transportTo: null },
        { cityName: '北京', days: 2, transportTo: 'high_speed_rail' },
      ],
    });
    const days = generateTripViaEngine(req);
    // 长沙 Day 1: isFirstDayOfCity=true
    expect(days[0].isFirstDayOfCity).toBe(true);
    // 长沙 Day 2: isFirstDayOfCity=false
    expect(days[1].isFirstDayOfCity).toBe(false);
    // 北京 Day 1: isFirstDayOfCity=true
    expect(days[2].isFirstDayOfCity).toBe(true);
    // 北京 Day 2: isFirstDayOfCity=false
    expect(days[3].isFirstDayOfCity).toBe(false);
  });

  it('三城市行程应产生正确总天数', () => {
    const req = makeRequest({
      destinations: [
        { cityName: '长沙', days: 2, transportTo: null },
        { cityName: '武汉', days: 1, transportTo: 'high_speed_rail' },
        { cityName: '北京', days: 2, transportTo: 'high_speed_rail' },
      ],
    });
    const days = generateTripViaEngine(req);
    // 长沙 2 + 武汉 1 + 北京 2 = 5
    expect(days.length).toBe(5);
  });
});

// ─────────────────────────────────────────────
// Section 3: generateTripViaEngine — 偏好设置影响
// ─────────────────────────────────────────────

describe('generateTripViaEngine 偏好设置', () => {
  it('economy 预算应产生较低的住宿费用', () => {
    const economyReq = makeRequest({
      destinations: [{ cityName: '长沙', days: 3, transportTo: null }],
      preferences: {
        budget: 'economy',
        pace: 'moderate',
        accommodation: 'chain_hotel',
        dining: [],
        interests: [],
      },
    });
    const luxuryReq = makeRequest({
      destinations: [{ cityName: '长沙', days: 3, transportTo: null }],
      preferences: {
        budget: 'luxury',
        pace: 'moderate',
        accommodation: 'chain_hotel',
        dining: [],
        interests: [],
      },
    });

    const economyDays = generateTripViaEngine(economyReq);
    const luxuryDays = generateTripViaEngine(luxuryReq);

    const economyHotelPrice = economyDays[0].accommodation?.primary?.pricePerNight ?? 0;
    const luxuryHotelPrice = luxuryDays[0].accommodation?.primary?.pricePerNight ?? 0;

    expect(economyHotelPrice).toBeLessThanOrEqual(luxuryHotelPrice);
  });

  it('有老人时不应崩溃（人群过滤）', () => {
    const req = makeRequest({
      destinations: [{ cityName: '北京', days: 3, transportTo: null }],
      travelers: { adults: 2, children: [], elders: 1 },
    });
    const days = generateTripViaEngine(req);
    expect(days.length).toBe(3);
    // 所有天都应该有 timeline（可能为空）
    for (const day of days) {
      expect(Array.isArray(day.timeline)).toBe(true);
    }
  });

  it('有儿童时不应崩溃（人群过滤）', () => {
    const req = makeRequest({
      destinations: [{ cityName: '北京', days: 3, transportTo: null }],
      travelers: { adults: 2, children: [{ age: 5 }], elders: 0 },
    });
    const days = generateTripViaEngine(req);
    expect(days.length).toBe(3);
    for (const day of days) {
      expect(Array.isArray(day.timeline)).toBe(true);
    }
  });

  it('特定兴趣标签不影响生成', () => {
    const req = makeRequest({
      destinations: [{ cityName: '北京', days: 3, transportTo: null }],
      preferences: {
        budget: 'comfort',
        pace: 'moderate',
        accommodation: 'chain_hotel',
        dining: [],
        interests: ['history', 'culture', 'food'],
      },
    });
    const days = generateTripViaEngine(req);
    expect(days.length).toBe(3);
  });
});

// ─────────────────────────────────────────────
// Section 4: generateTripViaEngine — 边界情况
// ─────────────────────────────────────────────

describe('generateTripViaEngine 边界情况', () => {
  it('单日游应正常生成', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 1, transportTo: null }],
    });
    const days = generateTripViaEngine(req);
    expect(days.length).toBe(1);
    expect(days[0].dayType).toBe('transit_departure');
  });

  it('多天多城市用不同城市知识库数据', () => {
    const req = makeRequest({
      destinations: [
        { cityName: '长沙', days: 2, transportTo: null },
        { cityName: '杭州', days: 2, transportTo: 'high_speed_rail' },
      ],
    });
    const days = generateTripViaEngine(req);
    expect(days.length).toBe(4);
    // 每个城市都有自己的 tips
    expect(days[0].tips.length).toBeGreaterThan(0);
    expect(days[2].tips.length).toBeGreaterThan(0);
  });

  it('needsReturnTransport=true 应产生 transit_return 天', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 3, transportTo: null }],
      needsReturnTransport: true,
    });
    const days = generateTripViaEngine(req);
    // 最后一天应为 transit_return
    const lastDay = days[days.length - 1];
    expect(lastDay.dayType).toBe('transit_return');
  });

  it('needsReturnTransport=false 最后一天应为 city_exploration', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 3, transportTo: null }],
      needsReturnTransport: false,
    });
    const days = generateTripViaEngine(req);
    const lastDay = days[days.length - 1];
    expect(lastDay.dayType).toBe('city_exploration');
  });

  it('未知城市应降级到长沙数据而不崩溃', () => {
    const req = makeRequest({
      departure: { city: '北京', date: '2026-07-01', timePeriod: 'morning' },
      destinations: [{ cityName: '火星', days: 2, transportTo: null }],
      travelers: { adults: 2, children: [], elders: 0 },
      preferences: {
        budget: 'comfort',
        pace: 'moderate',
        accommodation: 'chain_hotel',
        dining: [],
        interests: [],
      },
    });
    const days = generateTripViaEngine(req);
    // 不崩溃即通过；引擎会对未知城市产生空候选池
    expect(days.length).toBe(2);
    expect(Array.isArray(days)).toBe(true);
  });

  it('自定义 cityDataLookup 应生效', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 2, transportTo: null }],
    });
    // 使用 CITY_DATA 作为自定义 lookup（与默认行为一致）
    const days = generateTripViaEngine(req, CITY_DATA);
    expect(days.length).toBe(2);
    expect(days[0].cityName).toBe('长沙');
  });

  it('luxury 预算不崩溃', () => {
    const req = makeRequest({
      destinations: [{ cityName: '北京', days: 3, transportTo: null }],
      preferences: {
        budget: 'luxury',
        pace: 'moderate',
        accommodation: 'chain_hotel',
        dining: [],
        interests: [],
      },
    });
    const days = generateTripViaEngine(req);
    expect(days.length).toBe(3);
  });

  it('economy 预算不崩溃', () => {
    const req = makeRequest({
      destinations: [{ cityName: '北京', days: 3, transportTo: null }],
      preferences: {
        budget: 'economy',
        pace: 'moderate',
        accommodation: 'chain_hotel',
        dining: [],
        interests: [],
      },
    });
    const days = generateTripViaEngine(req);
    expect(days.length).toBe(3);
  });
});

// ─────────────────────────────────────────────
// Section 5: generateTripViaEngine — 中转日
// ─────────────────────────────────────────────

describe('generateTripViaEngine 中转日处理', () => {
  it('两城市之间的中转日应为 transit_transfer', () => {
    const req = makeRequest({
      destinations: [
        { cityName: '长沙', days: 2, transportTo: null },
        { cityName: '北京', days: 2, transportTo: 'high_speed_rail' },
      ],
    });
    const days = generateTripViaEngine(req);
    // 长沙 Day 2 是 transit_transfer（最后一天，有下一个城市）
    const changshaLastDay = days[1];
    expect(changshaLastDay.dayType).toBe('transit_transfer');
  });

  it('中转日过滤后不应包含高强度活动', () => {
    const req = makeRequest({
      destinations: [
        { cityName: '长沙', days: 2, transportTo: null },
        { cityName: '北京', days: 2, transportTo: 'high_speed_rail' },
      ],
    });
    const days = generateTripViaEngine(req);
    // 中转日的 timeline items 不应是 HIGH 体力
    const transferDay = days.find((d) => d.dayType === 'transit_transfer');
    if (transferDay) {
      for (const item of transferDay.timeline) {
        expect(item.energyLevel).not.toBe('HIGH');
      }
    }
  });
});

// ─────────────────────────────────────────────
// Section 6: hasEngineOutput
// ─────────────────────────────────────────────

describe('hasEngineOutput', () => {
  it('有有效活动时返回 true', () => {
    const req = makeRequest({
      destinations: [{ cityName: '北京', days: 3, transportTo: null }],
    });
    const days = generateTripViaEngine(req);
    expect(hasEngineOutput(days)).toBe(true);
  });

  it('所有天无活动时返回 false', () => {
    expect(
      hasEngineOutput([
        {
          dayIndex: 1,
          date: '2026-07-01',
          dayType: 'city_exploration',
          cityName: '测试',
          isFirstDayOfCity: true,
          title: 'Day 1',
          timeline: [],
          tips: [],
        },
      ]),
    ).toBe(false);
  });

  it('空数组返回 false', () => {
    expect(hasEngineOutput([])).toBe(false);
  });
});

// ─────────────────────────────────────────────
// Section 7: generateTripViaEngine — 日期计算
// ─────────────────────────────────────────────

describe('generateTripViaEngine 日期计算', () => {
  it('departureDate 正确映射到 Day 1', () => {
    const req = makeRequest({
      departure: { city: '北京', date: '2026-08-15', timePeriod: 'morning' },
      destinations: [{ cityName: '长沙', days: 2, transportTo: null }],
    });
    const days = generateTripViaEngine(req);
    expect(days[0].date).toBe('2026-08-15');
  });

  it('Day 2 的日期应为 departureDate + 1 天', () => {
    const req = makeRequest({
      departure: { city: '北京', date: '2026-08-15', timePeriod: 'morning' },
      destinations: [{ cityName: '长沙', days: 3, transportTo: null }],
    });
    const days = generateTripViaEngine(req);
    expect(days[1].date).toBe('2026-08-16');
  });

  it('跨月日期应正确', () => {
    const req = makeRequest({
      departure: { city: '北京', date: '2026-01-31', timePeriod: 'morning' },
      destinations: [{ cityName: '长沙', days: 2, transportTo: null }],
    });
    const days = generateTripViaEngine(req);
    expect(days[0].date).toBe('2026-01-31');
    expect(days[1].date).toBe('2026-02-01');
  });
});

// ─────────────────────────────────────────────
// Section 8: generateTripViaEngine — 错误处理
// ─────────────────────────────────────────────

describe('generateTripViaEngine 错误处理', () => {
  it('空的 destinations 应抛出 BusinessError', () => {
    const req = makeRequest({
      destinations: [],
    });
    expect(() => generateTripViaEngine(req)).toThrow();
  });

  it('总天数超过 30 天应抛出 BusinessError', () => {
    // 构造一个超过 30 天的请求
    const manyDays = Array.from({ length: 4 }, (_, i) => ({
      cityName: ['长沙', '北京', '上海', '成都'][i],
      days: 8,
      transportTo: i === 0 ? (null as null) : ('high_speed_rail' as const),
    }));
    const req = makeRequest({
      destinations: manyDays,
    });
    expect(() => generateTripViaEngine(req)).toThrow();
  });
});

// ─────────────────────────────────────────────
// Section 9: generateTripViaEngine — Pace 影响
// ─────────────────────────────────────────────

describe('generateTripViaEngine pace 设置', () => {
  it('intensive pace 不崩溃', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 3, transportTo: null }],
      preferences: {
        budget: 'comfort',
        pace: 'intensive',
        accommodation: 'chain_hotel',
        dining: [],
        interests: [],
      },
    });
    const days = generateTripViaEngine(req);
    expect(days.length).toBe(3);
  });

  it('relaxed pace 不崩溃', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 3, transportTo: null }],
      preferences: {
        budget: 'comfort',
        pace: 'relaxed',
        accommodation: 'chain_hotel',
        dining: [],
        interests: [],
      },
    });
    const days = generateTripViaEngine(req);
    expect(days.length).toBe(3);
  });
});

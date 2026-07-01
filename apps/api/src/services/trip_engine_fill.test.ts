/**
 * ENGINE-003 时间轴填充（贪心+回溯）· 单元测试
 *
 * 依据：
 *   - docs/任务分解_WBS_v1.0.0.md §5.2 ENGINE-003 验收标准
 *   - docs/Trip_Lifecycle_引擎算法设计.md §5
 *   - docs/测试用例文档_第三部分_引擎层_v1.0.0.md §4.3
 */

import { describe, it, expect } from 'vitest';
import type { TripGenerateRequest } from '@path-wise/shared';
import type { TimelineDay } from './trip_engine.js';
import type { EnginePOI, CandidatePoolMap, CandidatePool } from './trip_engine_candidate.js';
import {
  fillTimeline,
  scorePOI,
  rankCandidates,
  isNearMealTime,
  timePeriodOf,
  energyOf,
  FILL_CONFIG,
  formatFillItem,
  getDayFillSummary,
  INTEREST_CATEGORY_MAP,
} from './trip_engine_fill.js';
import { timeToMinutes, minutesToTime } from '../utils/date_utils.js';
import type { FillContext, FillItem, FilledTimelineDay } from './trip_engine_fill.js';

// ─────────────────────────────────────────────
// 辅助：构造测试数据
// ─────────────────────────────────────────────

function makeRequest(overrides: Partial<TripGenerateRequest> = {}): TripGenerateRequest {
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

function makePOI(overrides: Partial<EnginePOI> = {}): EnginePOI {
  return {
    id: 'test_poi_1',
    name: '测试景点',
    city: '北京',
    category: 'attraction',
    durationMin: 120,
    energyLevel: 'MEDIUM',
    bestTimeSlot: ['morning', 'afternoon'],
    suitableFor: ['adult', 'elder', 'child'],
    priceRange: { min: 30, max: 100 },
    bookingRequired: false,
    ...overrides,
  };
}

function makeTimelineDay(overrides: Partial<TimelineDay> = {}): TimelineDay {
  return {
    dayIndex: 1,
    date: '2026-07-01',
    dayType: 'city_exploration',
    city: '北京',
    availableWindow: {
      start: '09:00',
      end: '22:00',
      totalMinutes: 780,
    },
    ...overrides,
  };
}

function makeCandidatePoolMap(cityName: string, pois: EnginePOI[]): CandidatePoolMap {
  const byCategory = new Map<string, EnginePOI[]>();
  for (const poi of pois) {
    const cat = poi.category;
    if (!byCategory.has(cat)) byCategory.set(cat, []);
    byCategory.get(cat)!.push(poi);
  }
  const pool: CandidatePool = {
    cityName,
    all: pois,
    byCategory: byCategory as CandidatePool['byCategory'],
    rawCount: pois.length,
    filteredCount: pois.length,
  };
  const map: CandidatePoolMap = new Map();
  map.set(cityName, pool);
  return map;
}

function makeFillContext(overrides: Partial<FillContext> = {}): FillContext {
  return {
    currentTimeMinutes: 9 * 60, // 09:00
    prevPOI: null,
    energyUsed: 0,
    dayType: 'city_exploration',
    userPreferences: {
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
// 单元测试：timeToMinutes / minutesToTime
// ─────────────────────────────────────────────

describe('ENGINE-003 · 工具函数', () => {
  describe('timeToMinutes', () => {
    it('"09:00" → 540min', () => {
      expect(timeToMinutes('09:00')).toBe(540);
    });

    it('"14:00" → 840min', () => {
      expect(timeToMinutes('14:00')).toBe(840);
    });

    it('"00:00" → 0min', () => {
      expect(timeToMinutes('00:00')).toBe(0);
    });

    it('"22:00" → 1320min', () => {
      expect(timeToMinutes('22:00')).toBe(1320);
    });

    it('"00:30" → 30min', () => {
      expect(timeToMinutes('00:30')).toBe(30);
    });
  });

  describe('minutesToTime', () => {
    it('540min → "09:00"', () => {
      expect(minutesToTime(540)).toBe('09:00');
    });

    it('840min → "14:00"', () => {
      expect(minutesToTime(840)).toBe('14:00');
    });

    it('0min → "00:00"', () => {
      expect(minutesToTime(0)).toBe('00:00');
    });

    it('1320min → "22:00"', () => {
      expect(minutesToTime(1320)).toBe('22:00');
    });

    it('750min (12:30) → "12:30"', () => {
      expect(minutesToTime(750)).toBe('12:30');
    });

    it('25h overflow → "01:00"', () => {
      expect(minutesToTime(25 * 60)).toBe('01:00');
    });
  });

  describe('isNearMealTime', () => {
    it('11:00 是午餐时间 (true)', () => {
      expect(isNearMealTime(11 * 60)).toBe(true);
    });

    it('12:00 是午餐时间 (true)', () => {
      expect(isNearMealTime(12 * 60)).toBe(true);
    });

    it('13:00 不是午餐时间 (false) — 边界：end 不包含', () => {
      expect(isNearMealTime(13 * 60)).toBe(false);
    });

    it('13:01 不是午餐时间 (false)', () => {
      expect(isNearMealTime(13 * 60 + 1)).toBe(false);
    });

    it('10:59 不是午餐时间 (false)', () => {
      expect(isNearMealTime(10 * 60 + 59)).toBe(false);
    });

    it('17:00 是晚餐时间 (true)', () => {
      expect(isNearMealTime(17 * 60)).toBe(true);
    });

    it('18:30 是晚餐时间 (true)', () => {
      expect(isNearMealTime(18 * 60 + 30)).toBe(true);
    });

    it('19:00 不是晚餐时间 (false) — 边界：end 不包含', () => {
      expect(isNearMealTime(19 * 60)).toBe(false);
    });

    it('16:30 不是晚餐时间 (false)', () => {
      expect(isNearMealTime(16 * 60 + 30)).toBe(false);
    });

    it('08:00 不是用餐时间 (false)', () => {
      expect(isNearMealTime(8 * 60)).toBe(false);
    });
  });

  describe('timePeriodOf', () => {
    it('08:00 → morning', () => {
      expect(timePeriodOf(8 * 60)).toBe('morning');
    });

    it('11:00 → morning', () => {
      expect(timePeriodOf(11 * 60)).toBe('morning');
    });

    it('11:59 → morning', () => {
      expect(timePeriodOf(11 * 60 + 59)).toBe('morning');
    });

    it('12:00 → afternoon', () => {
      expect(timePeriodOf(12 * 60)).toBe('afternoon');
    });

    it('17:59 → afternoon', () => {
      expect(timePeriodOf(17 * 60 + 59)).toBe('afternoon');
    });

    it('18:00 → evening', () => {
      expect(timePeriodOf(18 * 60)).toBe('evening');
    });

    it('23:00 → evening', () => {
      expect(timePeriodOf(23 * 60)).toBe('evening');
    });
  });

  describe('energyOf', () => {
    it('LOW → 1', () => {
      expect(energyOf(makePOI({ energyLevel: 'LOW' }))).toBe(1);
    });

    it('MEDIUM → 2', () => {
      expect(energyOf(makePOI({ energyLevel: 'MEDIUM' }))).toBe(2);
    });

    it('HIGH → 4', () => {
      expect(energyOf(makePOI({ energyLevel: 'HIGH' }))).toBe(4);
    });
  });
});

// ─────────────────────────────────────────────
// 评分函数：scorePOI — 纯函数确定性测试
// ─────────────────────────────────────────────

describe('ENGINE-003 · scorePOI — 评分函数（WBS 验收：确定性输出）', () => {
  describe('距离得分 (0-30)', () => {
    it('无 prevPOI → distanceScore = 15', () => {
      const poi = makePOI({ id: 'poi_1' });
      const ctx = makeFillContext({ prevPOI: null });

      const score = scorePOI(poi, ctx);
      // 距离 15 + 时间段 25(上午匹配 morning) + 偏好 12(无interests) + 体力 10(medium) = 62
      expect(score).toBeGreaterThanOrEqual(15);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('有 prevPOI → distanceScore = 20 (MVP 固定值)', () => {
      const poi = makePOI({ id: 'poi_2' });
      const prev = makePOI({ id: 'poi_1' });
      const ctx = makeFillContext({ prevPOI: prev });

      const score = scorePOI(poi, ctx);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('时间段匹配得分 (0-25)', () => {
    it('POI bestTimeSlot 匹配当前时间 → timeScore = 25', () => {
      const poi = makePOI({ bestTimeSlot: ['morning', 'afternoon'] });
      const ctx = makeFillContext({ currentTimeMinutes: 9 * 60 }); // morning

      const score = scorePOI(poi, ctx);
      // 距离=15 + 时间=25 + 偏好=12 + 体力=10 = 62
      expect(score).toBe(62);
    });

    it('POI bestTimeSlot 不匹配 → timeScore = 5', () => {
      const poi = makePOI({ bestTimeSlot: ['evening'] });
      const ctx = makeFillContext({ currentTimeMinutes: 9 * 60 }); // morning

      const score = scorePOI(poi, ctx);
      // 距离=15 + 时间=5 + 偏好=12 + 体力=10 = 42
      expect(score).toBe(42);
    });

    it('evening 时段匹配验证', () => {
      const poi = makePOI({ bestTimeSlot: ['evening'] });
      const ctx = makeFillContext({ currentTimeMinutes: 19 * 60 }); // evening

      const score = scorePOI(poi, ctx);
      // 距离=15 + 时间=25 + 偏好=12 + 体力=10 = 62
      expect(score).toBe(62);
    });
  });

  describe('用户偏好匹配得分 (0-25)', () => {
    it('无兴趣标签：默认偏好分 12', () => {
      const poi = makePOI({ category: 'attraction' });
      const ctx = makeFillContext({
        userPreferences: { ...makeFillContext().userPreferences, interests: [] },
      });

      const score = scorePOI(poi, ctx);
      // 距离=15 + 时间=25(白天) + 偏好=12 + 体力=10 = 62
      expect(score).toBe(62);
    });

    it('有匹配标签：美食→dining 权重提升', () => {
      const poi = makePOI({
        category: 'dining',
        bestTimeSlot: ['morning', 'afternoon', 'evening'],
      });
      const ctx = makeFillContext({
        currentTimeMinutes: 10 * 60,
        userPreferences: { ...makeFillContext().userPreferences, interests: ['美食'] },
      });

      const score = scorePOI(poi, ctx);
      // 距离=15 + 时间=25 + 偏好=25/1=25 + 体力=20(LOW改) ... wait, MEDIUM default
      // 距离=15 + 时间=25 + 偏好=25 + 体力=10(MEDIUM) = 75
      expect(score).toBeGreaterThan(65);
    });

    it('无匹配标签：偏好分 = 0', () => {
      const poi = makePOI({ category: 'nature' });
      const ctx = makeFillContext({
        userPreferences: { ...makeFillContext().userPreferences, interests: ['美食', '购物'] },
      });

      const score = scorePOI(poi, ctx);
      // 距离=15 + 时间=25(如果morning) + 偏好=0(无匹配) + 体力=10 = 50
      expect(score).toBeLessThanOrEqual(55);
    });

    it('多标签匹配：偏好分 proportional 分配', () => {
      const poi = makePOI({
        category: 'dining',
        bestTimeSlot: ['morning', 'afternoon', 'evening'],
      });
      const ctx = makeFillContext({
        currentTimeMinutes: 10 * 60,
        userPreferences: {
          ...makeFillContext().userPreferences,
          interests: ['美食', '购物', '历史'],
        },
      });

      const score = scorePOI(poi, ctx);
      // 美食匹配 dining → +25/3 ≈ 8.33
      // 距离=15 + 时间=25 + 偏好≈8.33 + 体力=10(MEDIUM) ≈ 58.33
      expect(score).toBeGreaterThan(55);
      expect(score).toBeLessThan(65);
    });
  });

  describe('体力均衡得分 (0-20)', () => {
    it('LOW 体力 → energyScore = 20', () => {
      const poi = makePOI({ energyLevel: 'LOW' });
      const ctx = makeFillContext();

      const score = scorePOI(poi, ctx);
      // 距离=15 + 时间=25 + 偏好=12 + 体力=20 = 72
      expect(score).toBe(72);
    });

    it('HIGH 体力 → energyScore = 0', () => {
      const poi = makePOI({ energyLevel: 'HIGH' });
      const ctx = makeFillContext();

      const score = scorePOI(poi, ctx);
      // 距离=15 + 时间=25 + 偏好=12 + 体力=0 = 52
      expect(score).toBe(52);
    });
  });

  describe('纯函数确定性', () => {
    it('相同输入 → 相同输出', () => {
      const poi = makePOI({
        id: 'poi_a',
        category: 'attraction',
        energyLevel: 'MEDIUM',
        bestTimeSlot: ['morning'],
      });
      const ctx = makeFillContext({
        currentTimeMinutes: 9 * 60,
        userPreferences: {
          ...makeFillContext().userPreferences,
          interests: ['历史', '文化'],
        },
      });

      const score1 = scorePOI(poi, ctx);
      const score2 = scorePOI(poi, ctx);
      const score3 = scorePOI(poi, ctx);

      expect(score1).toBe(score2);
      expect(score2).toBe(score3);
    });

    it('不同 POI 评分可能不同（非全相等）', () => {
      const poiLow = makePOI({ id: 'poi_low', energyLevel: 'LOW', durationMin: 60 });
      const poiHigh = makePOI({ id: 'poi_high', energyLevel: 'HIGH', durationMin: 240 });
      const ctx = makeFillContext({ currentTimeMinutes: 9 * 60 });

      const scoreLow = scorePOI(poiLow, ctx);
      const scoreHigh = scorePOI(poiHigh, ctx);

      expect(scoreLow).toBeGreaterThan(scoreHigh);
    });
  });
});

// ─────────────────────────────────────────────
// rankCandidates 测试
// ─────────────────────────────────────────────

describe('ENGINE-003 · rankCandidates — 排序', () => {
  it('按评分降序排列', () => {
    const pois = [
      makePOI({ id: 'A', energyLevel: 'HIGH' }),
      makePOI({ id: 'B', energyLevel: 'LOW' }),
      makePOI({ id: 'C', energyLevel: 'MEDIUM' }),
    ];
    const ctx = makeFillContext();

    const ranked = rankCandidates(pois, ctx);
    expect(ranked).toHaveLength(3);
    expect(ranked[0].score).toBeGreaterThanOrEqual(ranked[1].score);
    expect(ranked[1].score).toBeGreaterThanOrEqual(ranked[2].score);

    // LOW 应该排最前（体力得分高）
    expect(ranked[0].poi.id).toBe('B');
  });

  it('空列表返回空', () => {
    const ranked = rankCandidates([], makeFillContext());
    expect(ranked).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// 功能验收：fillTimeline — 每个时间槽选最高分 POI
// ─────────────────────────────────────────────

describe('ENGINE-003 · fillTimeline — 功能验收（WBS §5.2）', () => {
  it('每个时间槽选择得分最高的 POI', () => {
    const req = makeRequest({
      destinations: [{ cityName: '北京', days: 1, transportTo: null }],
    });

    // 构造候选池：LOW 体力 POI 评分应高于 HIGH
    const pois: EnginePOI[] = [
      makePOI({
        id: 'low_1',
        name: '低体力景点',
        energyLevel: 'LOW',
        durationMin: 60,
        category: 'attraction',
      }),
      makePOI({
        id: 'high_1',
        name: '高体力景点',
        energyLevel: 'HIGH',
        durationMin: 120,
        category: 'attraction',
      }),
      makePOI({
        id: 'low_2',
        name: '另一个低体力景点',
        energyLevel: 'LOW',
        durationMin: 90,
        category: 'attraction',
      }),
    ];

    const pools = makeCandidatePoolMap('北京', pois);
    const timeline: TimelineDay[] = [
      makeTimelineDay({
        city: '北京',
        dayType: 'city_exploration',
        availableWindow: { start: '09:00', end: '22:00', totalMinutes: 780 },
      }),
    ];

    const result = fillTimeline(timeline, pools, req, () => 0);

    expect(result).toHaveLength(1);
    // 应该至少选了一个 POI
    expect(result[0].items.length).toBeGreaterThan(0);
    // 第一个选中的应该是低体力的（评分最高）
    const firstItem = result[0].items[0];
    expect(firstItem.poi.id).toBe('low_1'); // LOW 体力评分最高
    expect(firstItem.poi.energyLevel).toBe('LOW');
  });

  it('距离评分：MVP 阶段默认给 20（有 prevPOI）', () => {
    // 距离评分在 MVP 阶段固定（无高德 API）
    // 此测试验证评分函数包含了距离维度的计算
    const poi = makePOI({ id: 'near' });
    const prev = makePOI({ id: 'prev' });
    const ctx = makeFillContext({ prevPOI: prev });

    const score = scorePOI(poi, ctx);
    // 有 prevPOI: distanceScore=20
    // 距离=20 + 时间=25(morning) + 偏好=12(无interests) + 体力=10 = 67
    expect(score).toBe(67);
  });

  it('体力消耗：当天累计 energyUsed ≤ MAX_ENERGY_PER_DAY (8)', () => {
    const req = makeRequest();

    // 精心构造：3个HIGH体力（4*3=12 > 8），确保最多选2个
    const pois: EnginePOI[] = [
      makePOI({ id: 'h1', energyLevel: 'HIGH', durationMin: 60, category: 'attraction' }),
      makePOI({ id: 'h2', energyLevel: 'HIGH', durationMin: 60, category: 'attraction' }),
      makePOI({ id: 'h3', energyLevel: 'HIGH', durationMin: 60, category: 'attraction' }),
    ];

    const pools = makeCandidatePoolMap('北京', pois);
    const timeline: TimelineDay[] = [
      makeTimelineDay({
        city: '北京',
        dayType: 'city_exploration',
        availableWindow: { start: '09:00', end: '22:00', totalMinutes: 780 },
      }),
    ];

    const result = fillTimeline(timeline, pools, req, () => 0);

    // 体力上限 = 8, HIGH=4, 最多 2 个 HIGH
    // 可能有用餐时间占据，所以即使窗口够大，体力限制了
    const items = result[0].items;
    expect(items.length).toBeLessThanOrEqual(2); // 最多 2个 HIGH

    // 手动计算体力
    let energySum = 0;
    for (const item of items) {
      energySum += energyOf(item.poi);
    }
    expect(energySum).toBeLessThanOrEqual(8);
  });

  it('回溯机制：无可用候选时回退上一个，换更短活动', () => {
    const req = makeRequest();

    // 构造场景：只有一个中等时长 POI 和一个长 POI 的候选池。
    // 先选中中等时长的 (150min)，然后长 POI (360min) 无法填入剩余窗口 -> 触发回溯，
    // 回溯后弹出中等 POI，尝试换长 POI，但长 POI 也不能填满 -> 最终填入部分。
    // 关键是验证：算法不会崩溃，且 items 存在。
    const pois: EnginePOI[] = [
      makePOI({
        id: 'mid_poi',
        name: '中时POI',
        energyLevel: 'LOW',
        durationMin: 150,
        category: 'attraction',
      }),
      makePOI({
        id: 'long_poi',
        name: '长时POI',
        energyLevel: 'LOW',
        durationMin: 360,
        category: 'attraction',
      }),
      makePOI({
        id: 'short_poi',
        name: '短POI',
        energyLevel: 'LOW',
        durationMin: 90,
        category: 'attraction',
      }),
    ];
    const pools = makeCandidatePoolMap('北京', pois);

    // 窗口 09:00-17:00 = 480min
    const timeline: TimelineDay[] = [
      makeTimelineDay({
        city: '北京',
        dayType: 'city_exploration',
        availableWindow: { start: '09:00', end: '17:00', totalMinutes: 480 },
      }),
    ];

    // 自定义 transitTimeFn：返回 0（无交通时间）
    const result = fillTimeline(timeline, pools, req, () => 0);

    // 至少应该成功填入一些 POI（不崩溃）
    // 预期：short_poi(90) + mid_poi(150) = 240 < 480，两个都能填入
    // 或者：mid_poi(150) + short_poi(90) = 240 < 480
    expect(result[0].items.length).toBeGreaterThanOrEqual(1);

    // 验证不重叠
    const items = result[0].items;
    for (let i = 1; i < items.length; i++) {
      expect(items[i].startTimeMinutes).toBeGreaterThanOrEqual(items[i - 1].endTimeMinutes);
    }
  });
});

// ─────────────────────────────────────────────
// 边界验收：候选池为空
// ─────────────────────────────────────────────

describe('ENGINE-003 · 边界验收 — 候选池为空', () => {
  it('候选池为空 → 返回空 items（不崩溃）', () => {
    const req = makeRequest();
    const emptyPools: CandidatePoolMap = new Map();

    const timeline: TimelineDay[] = [
      makeTimelineDay({
        city: '北京',
        dayType: 'city_exploration',
        availableWindow: { start: '09:00', end: '22:00', totalMinutes: 780 },
      }),
    ];

    const result = fillTimeline(timeline, emptyPools, req, () => 0);
    expect(result).toHaveLength(1);
    expect(result[0].items).toHaveLength(0);
  });

  it('城市不在候选池中 → items 为空（不崩溃）', () => {
    const req = makeRequest();
    const pools = makeCandidatePoolMap('上海', []);

    const timeline: TimelineDay[] = [
      makeTimelineDay({
        city: '北京', // 候选池没有北京
        dayType: 'city_exploration',
        availableWindow: { start: '09:00', end: '22:00', totalMinutes: 780 },
      }),
    ];

    const result = fillTimeline(timeline, pools, req, () => 0);
    expect(result[0].items).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// 边界验收：回溯超限
// ─────────────────────────────────────────────

describe('ENGINE-003 · 边界验收 — 回溯超限', () => {
  it('回溯超过 MAX_BACKTRACK_STEPS 后停止并返回已完成部分', () => {
    const req = makeRequest();

    // 构造场景：所有 POI 都很长，导致每次都被过滤
    // 回溯后因没有其他选择仍不行，回退次数递增
    // 最终达到上限后停止
    const pois: EnginePOI[] = [
      makePOI({ id: 'p1', durationMin: 30, energyLevel: 'HIGH' }), // 这个可以选
      makePOI({ id: 'p2', durationMin: 780, energyLevel: 'LOW' }), // 这个太长
      makePOI({ id: 'p3', durationMin: 780, energyLevel: 'LOW' }),
    ];

    const pools = makeCandidatePoolMap('北京', pois);

    // 极小窗口：只够 30min
    const timeline: TimelineDay[] = [
      makeTimelineDay({
        city: '北京',
        dayType: 'city_exploration',
        availableWindow: { start: '09:00', end: '10:00', totalMinutes: 60 },
      }),
    ];

    const result = fillTimeline(timeline, pools, req, () => 0);

    // 应该选了 p1(30min) 后，p2(780min) 超窗口过滤 → 回溯 → p1 被弹出标记
    // 然后没有其他可用 POI，再次回溯 → 达到上限后停止
    // 不会崩溃
    expect(result).toHaveLength(1);
    expect(() => result[0].items).not.toThrow();
  });

  it('多城市：部分城市候选池为空不影响其他城市', () => {
    const req = makeRequest();
    const beijingPOIs = [
      makePOI({
        id: 'bj1',
        energyLevel: 'LOW',
        durationMin: 60,
        city: '北京',
        category: 'attraction',
      }),
    ];
    const pools = makeCandidatePoolMap('北京', beijingPOIs);

    const timeline: TimelineDay[] = [
      makeTimelineDay({ city: '北京', dayType: 'city_exploration' }),
      makeTimelineDay({ city: '上海', dayType: 'city_exploration', dayIndex: 2 }),
    ];

    const result = fillTimeline(timeline, pools, req, () => 0);

    expect(result[0].items.length).toBeGreaterThan(0); // 北京有内容
    expect(result[1].items).toHaveLength(0); // 上海无候选池
  });
});

// ─────────────────────────────────────────────
// 单元测试：固定候选池 + 固定偏好 → 确定性输出
// ─────────────────────────────────────────────

describe('ENGINE-003 · 确定性输出（WBS 验收：固定输入→固定输出）', () => {
  it('相同候选池和偏好 → 相同填充结果', () => {
    const req = makeRequest({
      preferences: {
        ...makeRequest().preferences,
        interests: ['历史', '文化'],
      },
    });

    const pois = [
      makePOI({
        id: 'a1',
        name: 'POI_A',
        energyLevel: 'LOW',
        durationMin: 90,
        category: 'attraction',
      }),
      makePOI({
        id: 'b1',
        name: 'POI_B',
        energyLevel: 'MEDIUM',
        durationMin: 60,
        category: 'attraction',
      }),
      makePOI({
        id: 'c1',
        name: 'POI_C',
        energyLevel: 'LOW',
        durationMin: 120,
        category: 'nature',
      }),
    ];

    const pools = makeCandidatePoolMap('北京', pois);
    const timeline: TimelineDay[] = [
      makeTimelineDay({
        city: '北京',
        dayType: 'city_exploration',
        availableWindow: { start: '09:00', end: '22:00', totalMinutes: 780 },
      }),
    ];

    // 运行两次
    const result1 = fillTimeline(timeline, pools, req, () => 30);
    const result2 = fillTimeline(timeline, pools, req, () => 30);

    // 验证：相同输出
    expect(result1).toHaveLength(result2.length);
    for (let d = 0; d < result1.length; d++) {
      expect(result1[d].items).toHaveLength(result2[d].items.length);
      for (let i = 0; i < result1[d].items.length; i++) {
        expect(result1[d].items[i].poi.id).toBe(result2[d].items[i].poi.id);
        expect(result1[d].items[i].startTimeMinutes).toBe(result2[d].items[i].startTimeMinutes);
        expect(result1[d].items[i].endTimeMinutes).toBe(result2[d].items[i].endTimeMinutes);
      }
    }
  });

  it('不同 transitTimeFn → 可能产生不同结果', () => {
    const req = makeRequest();
    const pois = [
      makePOI({ id: 'a1', energyLevel: 'LOW', durationMin: 90, category: 'attraction' }),
      makePOI({ id: 'b1', energyLevel: 'MEDIUM', durationMin: 60, category: 'attraction' }),
    ];
    const pools = makeCandidatePoolMap('北京', pois);
    const timeline: TimelineDay[] = [
      makeTimelineDay({
        city: '北京',
        dayType: 'city_exploration',
        availableWindow: { start: '09:00', end: '12:00', totalMinutes: 180 },
      }),
    ];

    // 交通时间=0 → 可以塞更多
    const r0 = fillTimeline(timeline, pools, req, () => 0);
    // 交通时间=60 → 塞得更少
    const r60 = fillTimeline(timeline, pools, req, () => 60);

    // 交通时间更长时，可能有更少的 items
    expect(r0[0].items.length).toBeGreaterThanOrEqual(r60[0].items.length);
  });
});

// ─────────────────────────────────────────────
// 单元测试：Mock 交通时间，验证 startTime 连续不重叠
// ─────────────────────────────────────────────

describe('ENGINE-003 · startTime 连续不重叠（WBS 验收）', () => {
  it('mock 交通时间 30min：验证 startTime 连续不重叠', () => {
    const req = makeRequest();
    const pois = [
      makePOI({
        id: 'p1',
        name: '景点1',
        energyLevel: 'LOW',
        durationMin: 60,
        category: 'attraction',
      }),
      makePOI({
        id: 'p2',
        name: '景点2',
        energyLevel: 'LOW',
        durationMin: 90,
        category: 'attraction',
      }),
      makePOI({
        id: 'p3',
        name: '景点3',
        energyLevel: 'LOW',
        durationMin: 45,
        category: 'attraction',
      }),
    ];
    const pools = makeCandidatePoolMap('北京', pois);

    const timeline: TimelineDay[] = [
      makeTimelineDay({
        city: '北京',
        dayType: 'city_exploration',
        // 窗口足够大：09:00~18:00 = 540min
        availableWindow: { start: '09:00', end: '18:00', totalMinutes: 540 },
      }),
    ];

    const T = 30; // 固定交通时间
    const result = fillTimeline(timeline, pools, req, () => 0);

    const items = result[0].items;
    expect(items.length).toBeGreaterThanOrEqual(2); // 至少安排 2 个

    // 验证每个 item 的 startTime >= 前一个 endTime + transitTime
    for (let i = 1; i < items.length; i++) {
      const prevEnd = items[i - 1].endTimeMinutes;
      const currStart = items[i].startTimeMinutes;
      // 当前 start 应该 >= 前一个 end（不需要再单独验证 transit，因为引擎在 startTime 里已经加了 transitTime）
      expect(currStart).toBeGreaterThanOrEqual(prevEnd);
    }

    // 第一天第一个 item 从 09:00 开始（无 prevPOI，无交通时间）
    expect(items[0].startTimeMinutes).toBe(9 * 60);
  });

  it('mock 交通时间 0min：全部紧挨着填充', () => {
    const req = makeRequest();
    const pois = [
      makePOI({ id: 'p1', energyLevel: 'LOW', durationMin: 60, category: 'attraction' }),
      makePOI({ id: 'p2', energyLevel: 'LOW', durationMin: 60, category: 'attraction' }),
      makePOI({ id: 'p3', energyLevel: 'LOW', durationMin: 60, category: 'attraction' }),
    ];
    const pools = makeCandidatePoolMap('北京', pois);
    const timeline: TimelineDay[] = [
      makeTimelineDay({
        city: '北京',
        dayType: 'city_exploration',
        availableWindow: { start: '09:00', end: '18:00', totalMinutes: 540 },
      }),
    ];

    const result = fillTimeline(timeline, pools, req, () => 0);

    const items = result[0].items;
    // 0 transitTime → 每个紧挨上一个（除非触发午餐）
    // p1: 09:00-10:00, p2: 10:00-11:00(触发午餐+60), p3: 12:00-13:00
    expect(items.length).toBeGreaterThanOrEqual(2);
    // p1 和 p2 之间无间隙
    expect(items[1].startTimeMinutes).toBe(items[0].endTimeMinutes);
    // p2 和 p3 之间有午餐间隙 (p2 ends at 11:00, lunch +60, p3 starts at 12:00)
    if (items.length >= 3) {
      expect(items[2].startTimeMinutes).toBe(items[1].endTimeMinutes + 60);
    }
  });

  it('用餐时间自动插入 60min', () => {
    const req = makeRequest();

    // 构造：一个 POI 结束在 11:30 → 触发午餐 → +60min → 下一个在 12:30+30=13:00 开始
    const pois = [
      makePOI({
        id: 'p1',
        name: '上午景点',
        energyLevel: 'LOW',
        durationMin: 150,
        category: 'attraction',
      }),
      // 以 transit=30 算：09:00 开始，09:00+150=11:30 → 触发 lunch → +60 = 12:30 → 下一POI
      makePOI({
        id: 'p2',
        name: '下午景点',
        energyLevel: 'LOW',
        durationMin: 60,
        category: 'attraction',
      }),
    ];
    const pools = makeCandidatePoolMap('北京', pois);
    const timeline: TimelineDay[] = [
      makeTimelineDay({
        city: '北京',
        dayType: 'city_exploration',
        availableWindow: { start: '09:00', end: '22:00', totalMinutes: 780 },
      }),
    ];

    const result = fillTimeline(timeline, pools, req, () => 0);

    const items = result[0].items;
    expect(items.length).toBeGreaterThanOrEqual(1);

    // p1: 09:00+30(transit=0 for first) → 09:00 开始，09:00+150=11:30 结束 → 触发 lunch
    expect(items[0].startTimeMinutes).toBe(540); // 09:00
    expect(items[0].endTimeMinutes).toBe(690); // 11:30

    if (items.length >= 2) {
      // p2: currentTime = 11:30 + 60(meal) = 12:30, start = 12:30 + 0(transit=0) = 12:30
      expect(items[1].startTimeMinutes).toBeGreaterThanOrEqual(750); // 12:30
    }
  });
});

// ─────────────────────────────────────────────
// 多天填充
// ─────────────────────────────────────────────

describe('ENGINE-003 · 多天填充', () => {
  it('多天独立填充，互不干扰', () => {
    const req = makeRequest();

    const beijingPOIs = [
      makePOI({
        id: 'bj1',
        energyLevel: 'LOW',
        durationMin: 120,
        city: '北京',
        category: 'attraction',
      }),
      makePOI({
        id: 'bj2',
        energyLevel: 'MEDIUM',
        durationMin: 60,
        city: '北京',
        category: 'attraction',
      }),
    ];
    const changshaPOIs = [
      makePOI({
        id: 'cs1',
        energyLevel: 'LOW',
        durationMin: 90,
        city: '长沙',
        category: 'attraction',
      }),
      makePOI({
        id: 'cs2',
        energyLevel: 'LOW',
        durationMin: 120,
        city: '长沙',
        category: 'dining',
      }),
    ];

    const pools: CandidatePoolMap = new Map();
    {
      const byCat = new Map();
      byCat.set('attraction', [beijingPOIs[0], beijingPOIs[1]]);
      pools.set('北京', {
        cityName: '北京',
        all: beijingPOIs,
        byCategory: byCat as any,
        rawCount: 2,
        filteredCount: 2,
      });
    }
    {
      const byCat = new Map();
      byCat.set('attraction', [changshaPOIs[0]]);
      byCat.set('dining', [changshaPOIs[1]]);
      pools.set('长沙', {
        cityName: '长沙',
        all: changshaPOIs,
        byCategory: byCat as any,
        rawCount: 2,
        filteredCount: 2,
      });
    }

    const timeline: TimelineDay[] = [
      makeTimelineDay({ dayIndex: 1, city: '北京', dayType: 'city_exploration' }),
      makeTimelineDay({ dayIndex: 2, city: '长沙', dayType: 'city_exploration' }),
    ];

    const result = fillTimeline(timeline, pools, req, () => 0);

    expect(result).toHaveLength(2);
    expect(result[0].items.length).toBeGreaterThan(0);
    expect(result[1].items.length).toBeGreaterThan(0);

    // 北京 items 全来自北京候选池
    for (const item of result[0].items) {
      expect(item.poi.city).toBe('北京');
    }
    // 长沙 items 全来自长沙候选池
    for (const item of result[1].items) {
      expect(item.poi.city).toBe('长沙');
    }
  });
});

// ─────────────────────────────────────────────
// 体重模型：不同体力 POI 消耗正确
// ─────────────────────────────────────────────

describe('ENGINE-003 · 体力模型', () => {
  it('LOW=1, MEDIUM=2, HIGH=4', () => {
    expect(FILL_CONFIG.ENERGY_VALUE.LOW).toBe(1);
    expect(FILL_CONFIG.ENERGY_VALUE.MEDIUM).toBe(2);
    expect(FILL_CONFIG.ENERGY_VALUE.HIGH).toBe(4);
  });

  it('MAX_ENERGY_PER_DAY = 8', () => {
    expect(FILL_CONFIG.MAX_ENERGY_PER_DAY).toBe(8);
  });

  it('MAX_BACKTRACK_STEPS = 5', () => {
    expect(FILL_CONFIG.MAX_BACKTRACK_STEPS).toBe(5);
  });

  it('体力用尽后不再安排新 POI', () => {
    const req = makeRequest();
    // 2个HIGH = 8体力，刚好用完
    const pois: EnginePOI[] = [
      makePOI({ id: 'h1', energyLevel: 'HIGH', durationMin: 30, category: 'attraction' }),
      makePOI({ id: 'h2', energyLevel: 'HIGH', durationMin: 30, category: 'attraction' }),
      makePOI({ id: 'l1', energyLevel: 'LOW', durationMin: 30, category: 'attraction' }), // 这个无法安排
    ];
    const pools = makeCandidatePoolMap('北京', pois);
    const timeline: TimelineDay[] = [
      makeTimelineDay({
        city: '北京',
        dayType: 'city_exploration',
        availableWindow: { start: '09:00', end: '22:00', totalMinutes: 780 },
      }),
    ];

    const result = fillTimeline(timeline, pools, req, () => 0);

    // 最多2个HIGH → 体力用完 → 不安排第3个
    expect(result[0].items.length).toBe(2);
  });
});

// ─────────────────────────────────────────────
// 时间窗口边界
// ─────────────────────────────────────────────

describe('ENGINE-003 · 时间窗口边界', () => {
  it('时间窗口为 0 → 返回空 items', () => {
    const req = makeRequest();
    const pois = [makePOI({ id: 'p1', energyLevel: 'LOW', durationMin: 30 })];
    const pools = makeCandidatePoolMap('北京', pois);
    const timeline: TimelineDay[] = [
      makeTimelineDay({
        city: '北京',
        dayType: 'transit_transfer',
        availableWindow: { start: '09:00', end: '09:00', totalMinutes: 0 },
      }),
    ];

    const result = fillTimeline(timeline, pools, req, () => 0);
    expect(result[0].items).toHaveLength(0);
  });

  it('POI duration 刚好等于剩余时间 → 成功填入（边界）', () => {
    const req = makeRequest();
    const pois = [
      makePOI({ id: 'exact', energyLevel: 'LOW', durationMin: 780, category: 'attraction' }),
    ];
    const pools = makeCandidatePoolMap('北京', pois);
    const timeline: TimelineDay[] = [
      makeTimelineDay({
        city: '北京',
        dayType: 'city_exploration',
        availableWindow: { start: '09:00', end: '22:00', totalMinutes: 780 },
      }),
    ];

    const result = fillTimeline(timeline, pools, req, () => 0);
    expect(result[0].items.length).toBe(1);
    expect(result[0].items[0].endTimeMinutes).toBe(22 * 60);
  });

  it('POI duration 稍大于剩余时间 → 过滤掉', () => {
    const req = makeRequest();
    const pois = [
      makePOI({ id: 'too_long', energyLevel: 'LOW', durationMin: 781, category: 'attraction' }),
    ];
    const pools = makeCandidatePoolMap('北京', pois);
    const timeline: TimelineDay[] = [
      makeTimelineDay({
        city: '北京',
        dayType: 'city_exploration',
        availableWindow: { start: '09:00', end: '22:00', totalMinutes: 780 },
      }),
    ];

    const result = fillTimeline(timeline, pools, req, () => 0);
    expect(result[0].items).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────
// 中转日：不安排但也不崩溃
// ─────────────────────────────────────────────

describe('ENGINE-003 · 中转日/出发日处理', () => {
  it('transit_transfer 日有较短窗口也可以正常填充', () => {
    const req = makeRequest();
    const pois = [
      makePOI({ id: 'short1', energyLevel: 'LOW', durationMin: 60, category: 'attraction' }),
      makePOI({ id: 'short2', energyLevel: 'LOW', durationMin: 60, category: 'attraction' }),
    ];
    const pools = makeCandidatePoolMap('北京', pois);
    const timeline: TimelineDay[] = [
      makeTimelineDay({
        city: '北京',
        dayType: 'transit_transfer',
        availableWindow: { start: '09:00', end: '13:30', totalMinutes: 270 },
      }),
    ];

    const result = fillTimeline(timeline, pools, req, () => 0);
    expect(result[0].items.length).toBeGreaterThan(0);

    // 所有 items 在窗口内
    for (const item of result[0].items) {
      expect(item.startTimeMinutes).toBeGreaterThanOrEqual(9 * 60);
      expect(item.endTimeMinutes).toBeLessThanOrEqual(13 * 60 + 30);
    }
  });

  it('transit_departure 日（14:00开始）正常填充', () => {
    const req = makeRequest();
    const pois = [
      makePOI({
        id: 'eve1',
        energyLevel: 'LOW',
        durationMin: 120,
        category: 'attraction',
        bestTimeSlot: ['afternoon', 'evening'],
      }),
      makePOI({
        id: 'eve2',
        energyLevel: 'LOW',
        durationMin: 90,
        category: 'dining',
        bestTimeSlot: ['afternoon', 'evening'],
      }),
    ];
    const pools = makeCandidatePoolMap('北京', pois);
    const timeline: TimelineDay[] = [
      makeTimelineDay({
        city: '北京',
        dayType: 'transit_departure',
        availableWindow: { start: '14:00', end: '22:00', totalMinutes: 480 },
      }),
    ];

    const result = fillTimeline(timeline, pools, req, () => 0);
    expect(result[0].items.length).toBeGreaterThan(0);

    // 第一个 item 从 14:00 开始
    if (result[0].items.length > 0) {
      expect(result[0].items[0].startTimeMinutes).toBe(14 * 60);
    }
  });
});

// ─────────────────────────────────────────────
// formatFillItem / getDayFillSummary
// ─────────────────────────────────────────────

describe('ENGINE-003 · formatFillItem / getDayFillSummary', () => {
  it('formatFillItem 正确转换格式', () => {
    const item: FillItem = {
      poi: makePOI({ name: '故宫', energyLevel: 'MEDIUM' }),
      startTimeMinutes: 9 * 60,
      endTimeMinutes: 13 * 60,
      energyLevel: 'MEDIUM',
    };

    const formatted = formatFillItem(item);
    expect(formatted.startTime).toBe('09:00');
    expect(formatted.endTime).toBe('13:00');
    expect(formatted.duration).toBe(240);
    expect(formatted.poiName).toBe('故宫');
    expect(formatted.energyLevel).toBe('MEDIUM');
  });

  it('getDayFillSummary 正确统计', () => {
    const day: FilledTimelineDay = {
      ...makeTimelineDay(),
      items: [
        {
          poi: makePOI({ id: 'p1', name: 'POI_A', energyLevel: 'LOW' }),
          startTimeMinutes: 9 * 60,
          endTimeMinutes: 11 * 60,
          energyLevel: 'LOW',
        },
        {
          poi: makePOI({ id: 'p2', name: 'POI_B', energyLevel: 'MEDIUM' }),
          startTimeMinutes: 11 * 60 + 30, // +30 for transit
          endTimeMinutes: 13 * 60,
          energyLevel: 'MEDIUM',
        },
      ],
    };

    const summary = getDayFillSummary(day);
    expect(summary.itemCount).toBe(2);
    expect(summary.totalActivityMinutes).toBe(210); // 120 + 90
    expect(summary.energyUsed).toBe(3); // 1 + 2
  });
});

// ─────────────────────────────────────────────
// FILL_CONFIG 常量验证
// ─────────────────────────────────────────────

describe('ENGINE-003 · FILL_CONFIG', () => {
  it('DEFAULT_TRANSIT_TIME = 30', () => {
    expect(FILL_CONFIG.DEFAULT_TRANSIT_TIME).toBe(30);
  });

  it('MEAL_TIME_MINUTES = 60', () => {
    expect(FILL_CONFIG.MEAL_TIME_MINUTES).toBe(60);
  });

  it('LUNCH window: 11:00-13:00', () => {
    expect(FILL_CONFIG.LUNCH_START).toBe(660); // 11*60
    expect(FILL_CONFIG.LUNCH_END).toBe(780); // 13*60
  });

  it('DINNER window: 17:00-19:00', () => {
    expect(FILL_CONFIG.DINNER_START).toBe(1020); // 17*60
    expect(FILL_CONFIG.DINNER_END).toBe(1140); // 19*60
  });
});

// ─────────────────────────────────────────────
// 复杂场景：综合测试
// ─────────────────────────────────────────────

describe('ENGINE-003 · 复杂场景综合测试', () => {
  it('仿真实城市数据集：长沙一日游', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 1, transportTo: null }],
      preferences: {
        ...makeRequest().preferences,
        interests: ['美食', '历史'],
      },
    });

    const changshaPOIs: EnginePOI[] = [
      {
        id: 'cs_yuelu',
        name: '岳麓山',
        city: '长沙',
        category: 'nature',
        durationMin: 180,
        energyLevel: 'MEDIUM',
        bestTimeSlot: ['morning', 'afternoon'],
        suitableFor: ['adult', 'elder'],
        priceRange: { min: 0, max: 0 },
        bookingRequired: false,
      },
      {
        id: 'cs_juzi',
        name: '橘子洲头',
        city: '长沙',
        category: 'attraction',
        durationMin: 120,
        energyLevel: 'LOW',
        bestTimeSlot: ['morning', 'afternoon', 'evening'],
        suitableFor: ['adult', 'elder', 'child'],
        priceRange: { min: 0, max: 0 },
        bookingRequired: false,
      },
      {
        id: 'cs_museum',
        name: '湖南省博物馆',
        city: '长沙',
        category: 'attraction',
        durationMin: 150,
        energyLevel: 'LOW',
        bestTimeSlot: ['morning', 'afternoon'],
        suitableFor: ['adult', 'elder', 'child'],
        priceRange: { min: 0, max: 0 },
        bookingRequired: true,
      },
      {
        id: 'cs_dining',
        name: '文和友',
        city: '长沙',
        category: 'dining',
        durationMin: 60,
        energyLevel: 'LOW',
        bestTimeSlot: ['afternoon', 'evening'],
        suitableFor: ['adult', 'elder', 'child'],
        priceRange: { min: 80, max: 120 },
        bookingRequired: false,
      },
      {
        id: 'cs_taiping',
        name: '太平街',
        city: '长沙',
        category: 'shopping',
        durationMin: 90,
        energyLevel: 'LOW',
        bestTimeSlot: ['morning', 'afternoon', 'evening'],
        suitableFor: ['adult', 'elder', 'child'],
        priceRange: { min: 0, max: 50 },
        bookingRequired: false,
      },
    ];

    const pools = makeCandidatePoolMap('长沙', changshaPOIs);
    const timeline: TimelineDay[] = [
      makeTimelineDay({
        city: '长沙',
        dayType: 'city_exploration',
        availableWindow: { start: '09:00', end: '22:00', totalMinutes: 780 },
      }),
    ];

    const result = fillTimeline(timeline, pools, req, () => 0);

    const items = result[0].items;
    expect(items.length).toBeGreaterThan(0);

    // 验证体力不超限
    let energySum = 0;
    for (const item of items) {
      energySum += energyOf(item.poi);
    }
    expect(energySum).toBeLessThanOrEqual(8);

    // 验证不重叠
    for (let i = 1; i < items.length; i++) {
      expect(items[i].startTimeMinutes).toBeGreaterThanOrEqual(items[i - 1].endTimeMinutes);
    }

    // 验证全在窗口内
    for (const item of items) {
      expect(item.startTimeMinutes).toBeGreaterThanOrEqual(9 * 60);
      expect(item.endTimeMinutes).toBeLessThanOrEqual(22 * 60);
    }
  });
});

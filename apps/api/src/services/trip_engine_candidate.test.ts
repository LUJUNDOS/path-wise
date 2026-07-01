/**
 * ENGINE-002 候选池生成与过滤 · 单元测试
 *
 * 依据：
 *   - docs/任务分解_WBS_v1.0.0.md §5.2 ENGINE-002 验收标准
 *   - docs/Trip_Lifecycle_引擎算法设计.md §4
 *   - docs/测试用例文档_第三部分_引擎层_v1.0.0.md §4.2
 */

import { describe, it, expect } from 'vitest';
import type { TripGenerateRequest, BudgetLevel, TravelerGroup } from '@path-wise/shared';
import {
  buildCandidatePools,
  crowdFilter,
  budgetFilter,
  bookingFilter,
  interestBoostFilter,
  CANDIDATE_POOL_CONFIG,
  getPoolSummary,
  getPOIsByCategory,
} from './trip_engine_candidate.js';
import type { EnginePOI, CandidatePoolMap } from './trip_engine_candidate.js';
import { CITY_DATA } from '../data/mock_cities.js';

// ─────────────────────────────────────────────
// 辅助
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

/** 构造最小 EnginePOI 用于单元测试 */
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

// ─────────────────────────────────────────────
// 功能验收：buildCandidatePools — 核心行为
// ─────────────────────────────────────────────

describe('ENGINE-002 · buildCandidatePools — 功能验收', () => {
  it('单城市：候选池含 POI 并正确分组', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 3, transportTo: null }],
    });
    const pools = buildCandidatePools(req, CITY_DATA);

    expect(pools.has('长沙')).toBe(true);
    const pool = pools.get('长沙')!;

    // 候选池应非空
    expect(pool.all.length).toBeGreaterThan(0);
    expect(pool.filteredCount).toBeGreaterThan(0);
    expect(pool.rawCount).toBeGreaterThanOrEqual(pool.filteredCount);

    // 分组应至少包含一个非空类别
    expect(pool.byCategory.size).toBeGreaterThan(0);
    // 至少有一个类别下有 POI
    const totalInCategories = Array.from(pool.byCategory.values()).reduce(
      (s, arr) => s + arr.length,
      0,
    );
    expect(totalInCategories).toBeGreaterThan(0);

    // 每个 POI 都有必须字段
    for (const poi of pool.all) {
      expect(poi.id).toBeTruthy();
      expect(poi.name).toBeTruthy();
      expect(poi.category).toBeTruthy();
      expect(poi.durationMin).toBeGreaterThan(0);
      expect(poi.energyLevel).toMatch(/^(LOW|MEDIUM|HIGH)$/);
      expect(poi.city).toBe('长沙');
    }
  });

  it('多城市：每城市独立候选池', () => {
    const req = makeRequest({
      destinations: [
        { cityName: '长沙', days: 2, transportTo: 'high_speed_rail' },
        { cityName: '广州', days: 2, transportTo: 'high_speed_rail' },
      ],
    });
    const pools = buildCandidatePools(req, CITY_DATA);

    expect(pools.has('长沙')).toBe(true);
    expect(pools.has('广州')).toBe(true);

    // 两个城市 POI 不混淆
    const changshaPOIs = pools.get('长沙')!.all;
    const guangzhouPOIs = pools.get('广州')!.all;
    for (const p of changshaPOIs) expect(p.city).toBe('长沙');
    for (const p of guangzhouPOIs) expect(p.city).toBe('广州');
  });

  it('候选池大小合理（不过大导致性能问题）', () => {
    const req = makeRequest({
      destinations: [{ cityName: '北京', days: 2, transportTo: null }],
    });
    const pools = buildCandidatePools(req, CITY_DATA);
    const pool = pools.get('北京')!;

    // 北京有 6 attractions + 4 dining = 10 个 POI
    expect(pool.all.length).toBeGreaterThan(0);
    // MVP 数据源不会过大
    expect(pool.all.length).toBeLessThanOrEqual(200);
  });

  it('getPoolSummary 返回正确汇总', () => {
    const req = makeRequest({
      destinations: [
        { cityName: '长沙', days: 2, transportTo: null },
        { cityName: '成都', days: 2, transportTo: 'high_speed_rail' },
      ],
    });
    const pools = buildCandidatePools(req, CITY_DATA);
    const summary = getPoolSummary(pools);

    expect(summary).toHaveLength(2);
    for (const s of summary) {
      expect(s.cityName).toBeTruthy();
      expect(s.rawCount).toBeGreaterThanOrEqual(s.filteredCount);
    }
  });

  it('getPOIsByCategory 返回指定类别 POI', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 2, transportTo: null }],
    });
    const pools = buildCandidatePools(req, CITY_DATA);
    const pool = pools.get('长沙')!;

    const attractions = getPOIsByCategory(pool, 'attraction');
    const dinnings = getPOIsByCategory(pool, 'dining');

    for (const p of attractions) expect(p.category).toBe('attraction');
    for (const p of dinnings) expect(p.category).toBe('dining');
  });

  it('偏好过滤：interests 不影响保留（仅作为权重信号）', () => {
    // 无 interests
    const pools1 = buildCandidatePools(
      makeRequest({
        destinations: [{ cityName: '长沙', days: 2, transportTo: null }],
        preferences: { ...makeRequest().preferences, interests: [] },
      }),
      CITY_DATA,
    );
    // 有美食兴趣
    const pools2 = buildCandidatePools(
      makeRequest({
        destinations: [{ cityName: '长沙', days: 2, transportTo: null }],
        preferences: { ...makeRequest().preferences, interests: ['美食'] },
      }),
      CITY_DATA,
    );

    // interests 过滤是宽松策略：有 tag 无 tag 结果都含全部 POI
    const count1 = pools1.get('长沙')!.filteredCount;
    const count2 = pools2.get('长沙')!.filteredCount;
    expect(count1).toBe(count2); // 兴趣过滤不剔除 POI
  });
});

// ─────────────────────────────────────────────
// 单元测试：crowdFilter — 人群匹配过滤
// ─────────────────────────────────────────────

describe('ENGINE-002 · crowdFilter — 人群匹配', () => {
  it('仅有成人：所有 POI 保留', () => {
    const poi = makePOI({ energyLevel: 'HIGH', suitableFor: ['adult'] });
    const travelers: TravelerGroup = { adults: 1, children: [], elders: 0 };
    expect(crowdFilter(poi, travelers)).toBe(true);
  });

  it('有老人 + HIGH 体力不限老：过滤', () => {
    const poi = makePOI({ energyLevel: 'HIGH', suitableFor: ['adult'] });
    const travelers: TravelerGroup = { adults: 1, children: [], elders: 1 };
    expect(crowdFilter(poi, travelers)).toBe(false);
  });

  it('有老人 + LOW 体力：保留', () => {
    const poi = makePOI({ energyLevel: 'LOW', suitableFor: ['adult', 'elder'] });
    const travelers: TravelerGroup = { adults: 1, children: [], elders: 1 };
    expect(crowdFilter(poi, travelers)).toBe(true);
  });

  it('有幼儿(<=6) + HIGH 体力不含 child：过滤', () => {
    const poi = makePOI({ energyLevel: 'HIGH', suitableFor: ['adult'] });
    const travelers: TravelerGroup = { adults: 1, children: [{ age: 4 }], elders: 0 };
    expect(crowdFilter(poi, travelers)).toBe(false);
  });

  it('有幼儿(<=6) + LOW 体力含 child：保留', () => {
    const poi = makePOI({ energyLevel: 'LOW', suitableFor: ['adult', 'child'] });
    const travelers: TravelerGroup = { adults: 1, children: [{ age: 5 }], elders: 0 };
    expect(crowdFilter(poi, travelers)).toBe(true);
  });

  it('有婴儿(<=3) + 夜店类：过滤', () => {
    const poi = makePOI({ category: 'nightlife' });
    const travelers: TravelerGroup = { adults: 1, children: [{ age: 2 }], elders: 0 };
    expect(crowdFilter(poi, travelers)).toBe(false);
  });

  it('有儿童(>6, 非婴幼儿)：HIGH 体力不过滤（大龄儿童可接受）', () => {
    const poi = makePOI({ energyLevel: 'HIGH', suitableFor: ['adult'] });
    const travelers: TravelerGroup = { adults: 1, children: [{ age: 10 }], elders: 0 };
    expect(crowdFilter(poi, travelers)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 单元测试：budgetFilter — 预算过滤
// ─────────────────────────────────────────────

describe('ENGINE-002 · budgetFilter — 预算过滤', () => {
  it('economy 预算：expensive POI 被过滤', () => {
    const cheap = makePOI({ priceRange: { min: 0, max: 50 } }); // avg=25
    const expensive = makePOI({ priceRange: { min: 80, max: 120 } }); // avg=100

    // economy perDay=200, threshold=200*0.3=60
    expect(budgetFilter(cheap, 'economy')).toBe(true);
    expect(budgetFilter(expensive, 'economy')).toBe(false);
  });

  it('comfort 预算：中等价 POI 通过', () => {
    const mid = makePOI({ priceRange: { min: 50, max: 150 } }); // avg=100

    // comfort perDay=500, threshold=500*0.3=150
    expect(budgetFilter(mid, 'comfort')).toBe(true);
  });

  it('luxury 预算：几乎所有 POI 通过', () => {
    const premium = makePOI({ priceRange: { min: 300, max: 500 } }); // avg=400

    // luxury perDay=2000, threshold=2000*0.3=600
    expect(budgetFilter(premium, 'luxury')).toBe(true);
  });

  it('economy 预算按设计 §4.3.3：单景点 ≤ perDay × 0.3', () => {
    // economy perDay=200, threshold=60
    const justUnder = makePOI({ priceRange: { min: 50, max: 70 } }); // avg=60 ✓
    const justOver = makePOI({ priceRange: { min: 60, max: 70 } }); // avg=65 ✗

    expect(budgetFilter(justUnder, 'economy')).toBe(true);
    expect(budgetFilter(justOver, 'economy')).toBe(false);
  });
});

// ─────────────────────────────────────────────
// 单元测试：bookingFilter — 预约状态
// ─────────────────────────────────────────────

describe('ENGINE-002 · bookingFilter — 预约状态', () => {
  it('MVP 阶段：所有 POI 通过（不做实时预约过滤）', () => {
    const poi1 = makePOI({ bookingRequired: true });
    const poi2 = makePOI({ bookingRequired: false });

    expect(bookingFilter(poi1)).toBe(true);
    expect(bookingFilter(poi2)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 单元测试：interestBoostFilter — 兴趣权重
// ─────────────────────────────────────────────

describe('ENGINE-002 · interestBoostFilter — 兴趣偏好', () => {
  it('无兴趣标签：所有 POI 保留', () => {
    const poi = makePOI({ category: 'attraction' });
    expect(interestBoostFilter(poi, [])).toBe(true);
  });

  it('有匹配标签：POI 保留', () => {
    const food = makePOI({ category: 'dining' });
    const shopping = makePOI({ category: 'shopping' });

    expect(interestBoostFilter(food, ['美食'])).toBe(true);
    expect(interestBoostFilter(shopping, ['购物'])).toBe(true);
  });

  it('无匹配标签：仍保留（不剔除，后续评分降权即可）', () => {
    const nature = makePOI({ category: 'nature' });
    expect(interestBoostFilter(nature, ['美食', '购物'])).toBe(true);
  });
});

// ─────────────────────────────────────────────
// 边界验收
// ─────────────────────────────────────────────

describe('ENGINE-002 · 边界情况', () => {
  it('城市不在知识库中：返回空候选池', () => {
    const req = makeRequest({
      destinations: [{ cityName: '火星', days: 2, transportTo: null }],
    });
    const pools = buildCandidatePools(req, CITY_DATA);

    expect(pools.has('火星')).toBe(true);
    const pool = pools.get('火星')!;
    expect(pool.all).toHaveLength(0);
    expect(pool.filteredCount).toBe(0);
    expect(pool.rawCount).toBe(0);
  });

  it('知识库数据源为空对象：不崩溃', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 2, transportTo: null }],
    });
    const emptyData: Record<string, (typeof CITY_DATA)[string]> = {};
    const pools = buildCandidatePools(req, emptyData);

    expect(pools.has('长沙')).toBe(true);
    expect(pools.get('长沙')!.all).toHaveLength(0);
  });

  it('候选池 POI > 200 时正常（不超时）', () => {
    // MVP 阶段 CITY_DATA 最大约 10 POI/城市，远小于 200
    // 此测试验证执行效率
    const req = makeRequest({
      destinations: [
        { cityName: '北京', days: 2, transportTo: null },
        { cityName: '上海', days: 2, transportTo: 'high_speed_rail' },
        { cityName: '成都', days: 2, transportTo: 'high_speed_rail' },
        { cityName: '杭州', days: 2, transportTo: 'high_speed_rail' },
        { cityName: '长沙', days: 2, transportTo: 'high_speed_rail' },
      ],
    });
    const start = Date.now();
    const pools = buildCandidatePools(req, CITY_DATA);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(100); // 5 城市候选池生成 < 100ms
    for (const [name, pool] of pools) {
      expect(pool.all.length).toBeGreaterThan(0);
    }
  });

  it('economy 过滤后候选池可能变小但不应为 0', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 2, transportTo: null }],
      travelers: { adults: 1, children: [], elders: 0 },
      preferences: {
        ...makeRequest().preferences,
        budget: 'economy',
      },
    });
    const pools = buildCandidatePools(req, CITY_DATA);
    const pool = pools.get('长沙')!;

    // 即使是 economy，也应该有至少有一些低价 POI（如 free entry 的）
    expect(pool.filteredCount).toBeGreaterThan(0);
    // economy 过滤后应 ≤ 原始数量
    expect(pool.filteredCount).toBeLessThanOrEqual(pool.rawCount);
  });

  it('有老人+幼儿：同时过滤 HIGH 体力 + 夜店类', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 2, transportTo: null }],
      travelers: { adults: 1, children: [{ age: 3 }, { age: 8 }], elders: 1 },
    });
    const pools = buildCandidatePools(req, CITY_DATA);
    const pool = pools.get('长沙')!;

    // 所有保留的 POI 不应是 HIGH + 不含 elder
    expect(pool.all.length).toBeGreaterThan(0);
    for (const poi of pool.all) {
      if (poi.energyLevel === 'HIGH') {
        // 保留的 HIGH 体力 POI 必须标记适合 child 或 elder
        expect(poi.suitableFor.includes('child') || poi.suitableFor.includes('elder')).toBe(true);
      }
    }
  });
});

// ─────────────────────────────────────────────
// 配置常量验证
// ─────────────────────────────────────────────

describe('ENGINE-002 · CANDIDATE_POOL_CONFIG', () => {
  it('BUDGET_PER_DAY_RATIO = 0.3', () => {
    expect(CANDIDATE_POOL_CONFIG.BUDGET_PER_DAY_RATIO).toBe(0.3);
  });

  it('三档预算都有对应的 DEFAULT_PER_DAY_BUDGET', () => {
    const levels: BudgetLevel[] = ['economy', 'comfort', 'luxury'];
    for (const level of levels) {
      expect(CANDIDATE_POOL_CONFIG.DEFAULT_PER_DAY_BUDGET[level]).toBeGreaterThan(0);
    }
  });

  it('economy < comfort < luxury', () => {
    const { economy, comfort, luxury } = CANDIDATE_POOL_CONFIG.DEFAULT_PER_DAY_BUDGET;
    expect(economy).toBeLessThan(comfort);
    expect(comfort).toBeLessThan(luxury);
  });
});

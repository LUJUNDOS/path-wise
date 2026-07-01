/**
 * PATH-WISE · Trip Lifecycle 引擎 — 候选池生成与过滤
 * ENGINE-002：算法二：候选池生成与多维度过滤（buildCandidatePools）
 *
 * 依据：docs/Trip_Lifecycle_引擎算法设计.md §4
 *       docs/任务分解_WBS_v1.0.0.md §5.2 ENGINE-002
 *
 * 职责：
 *   1. 从城市知识库加载 POI（MVP 阶段：CITY_DATA mock）
 *   2. 四维过滤：营业时间 / 人群匹配 / 预算 / 预约状态
 *   3. 按类别分组，便于后续时间轴填充时均衡选择
 *   4. 候选池为空时触发降级策略（返回全量 + 警告日志）
 */

import type { EnergyLevel, TravelerGroup, BudgetLevel } from '@path-wise/shared';
import type { TripGenerateRequest } from '@path-wise/shared';
import type { CityData } from '../data/mock_cities.js';
import { INTEREST_CATEGORY_MAP } from './engine_shared.js';

// ─────────────────────────────────────────────
// 引擎内部 POI 类型（适配 CITY_DATA mock 结构）
// ─────────────────────────────────────────────

/** POI 类别 */
export type POICategory = 'attraction' | 'dining' | 'shopping' | 'nightlife' | 'nature';

/** 营业时间 */
export interface OpeningHours {
  open: string; // HH:MM
  close: string; // HH:MM
  closedOn: string[]; // "Monday" | "Tuesday" ...
}

/** 引擎内部 POI 表示 */
export interface EnginePOI {
  id: string;
  name: string;
  city: string;
  category: POICategory;
  durationMin: number;
  energyLevel: EnergyLevel;
  bestTimeSlot: ('morning' | 'afternoon' | 'evening')[];
  /** 适合人群：成人总是 true，children/elders/infant 按 POI 特性标记 */
  suitableFor: string[];
  /** MVP 阶段简化：closedOn 为可选，从 CITY_DATA 推断 */
  openingHours?: OpeningHours;
  priceRange: { min: number; max: number };
  bookingRequired: boolean;
  bookingUrl?: string;
}

/**
 * 按类别分组的候选池
 * 便于后续填充时均衡选择各类型活动
 */
export interface CandidatePool {
  /** 城市名 */
  cityName: string;
  /** 全部未分组 POI */
  all: EnginePOI[];
  /** 按类别分组 */
  byCategory: Map<POICategory, EnginePOI[]>;
  /** 候选池未过滤时的大小 */
  rawCount: number;
  /** 过滤后的大小 */
  filteredCount: number;
}

/**
 * builder 返回值：城市候选池 Map
 */
export type CandidatePoolMap = Map<string, CandidatePool>;

// ─────────────────────────────────────────────
// 算法配置
// ─────────────────────────────────────────────

export const CANDIDATE_POOL_CONFIG = {
  /** 预算过滤：单景点不超过当日预算的比例（设计 §4.3.3） */
  BUDGET_PER_DAY_RATIO: 0.3,
  /** 默认单人日预算 */
  DEFAULT_PER_DAY_BUDGET: {
    economy: 200,
    comfort: 500,
    luxury: 2000,
  } as Record<BudgetLevel, number>,
  /** 降级时最少保留 POI 数（用于 min(该值, rawCount) 动态阈值） */
  MIN_DEGRADED_POOL_SIZE: 5,
} as const;

// ─────────────────────────────────────────────
// 工具：从 CITY_DATA 转换到 EnginePOI
// ─────────────────────────────────────────────

/**
 * 将 mock_cities.ts 的 attraction 条目转为 EnginePOI
 */
function attractionToPOI(
  cityName: string,
  attr: CityData['attractions'][number],
  index: number,
): EnginePOI {
  // 从描述推断 bestTimeSlot（简化启发式）
  const bestTimeSlots: ('morning' | 'afternoon' | 'evening')[] = [];
  const desc = attr.description;
  if (/夜景|晚上|灯|傍晚|夜市|日落/.test(desc)) {
    bestTimeSlots.push('evening');
  }
  if (/早晨|清晨|早上|日出|上午|早/.test(desc)) {
    bestTimeSlots.push('morning');
  }
  if (!bestTimeSlots.length) {
    // 默认：吃饭适合中午/晚上，景点全天
    bestTimeSlots.push('morning', 'afternoon', 'evening');
  }

  // 推断类别
  let category: POICategory = 'attraction';
  if (/古街|步行街|商圈|市场|IFS|太古|购物|商场/.test(desc + attr.name)) {
    category = 'shopping';
  } else if (/山|湖|公园|森林|植物园|湿地|动物园|植物|自然|海|江|岛/.test(desc + attr.name)) {
    category = 'nature';
  }

  // suitableFor 推断：高强度景点标记不适合老人/婴幼儿
  const suitableFor: string[] = ['adult'];
  if (attr.energy !== 'HIGH') {
    suitableFor.push('elder');
  }
  if (attr.energy === 'LOW' && !/爬山|徒步|长城|登山/.test(desc + attr.name)) {
    suitableFor.push('child');
  }

  // MVP 阶段：closedOn 为可选字段，暂无城市维度录入
  // 后续可以扩增 CITY_DATA 结构

  return {
    id: `${cityName}_attraction_${index}`,
    name: attr.name,
    city: cityName,
    category,
    durationMin: attr.durationMin,
    energyLevel: attr.energy,
    bestTimeSlot: bestTimeSlots,
    suitableFor,
    priceRange: { min: 0, max: attr.costCNY },
    bookingRequired: attr.bookingRequired,
  };
}

/**
 * 将 mock_cities.ts 的 dining 条目转为 EnginePOI
 */
function diningToPOI(
  cityName: string,
  dining: CityData['dining'][number],
  index: number,
): EnginePOI {
  return {
    id: `${cityName}_dining_${index}`,
    name: dining.name,
    city: cityName,
    category: 'dining',
    durationMin: 60, // 用餐默认 1h
    energyLevel: 'LOW',
    bestTimeSlot: ['afternoon', 'evening'],
    suitableFor: ['adult', 'elder', 'child'],
    priceRange: { min: dining.costCNY * 0.5, max: dining.costCNY },
    bookingRequired: false,
  };
}

// ─────────────────────────────────────────────
// 主函数
// ─────────────────────────────────────────────

/**
 * 构建所有城市的候选池
 *
 * @param params - 攻略生成请求参数
 * @param cityDataLookup - 城市知识库查找表（MVP 阶段：CITY_DATA 对象）
 * @returns 城市名 → CandidatePool 的 Map
 */
export function buildCandidatePools(
  params: TripGenerateRequest,
  cityDataLookup: Record<string, CityData>,
): CandidatePoolMap {
  const { destinations, travelers, preferences } = params;
  const pools: CandidatePoolMap = new Map();

  for (const dest of destinations) {
    const cityName = dest.cityName;
    const cityData = cityDataLookup[cityName];

    // 2.1 从城市知识库加载 POI
    if (!cityData) {
      console.warn(
        `[buildCandidatePools] City "${cityName}" not found in knowledge base, skipping`,
      );
      // 返回空候选池（后续逻辑感知后触发降级）
      pools.set(cityName, {
        cityName,
        all: [],
        byCategory: new Map(),
        rawCount: 0,
        filteredCount: 0,
      });
      continue;
    }

    const rawPOIs: EnginePOI[] = [
      ...cityData.attractions.map((a, i) => attractionToPOI(cityName, a, i)),
      ...cityData.dining.map((d, i) => diningToPOI(cityName, d, i)),
    ];

    const rawCount = rawPOIs.length;

    // 2.2 多维度过滤
    const filtered = applyFilters(rawPOIs, travelers, preferences);

    // 降级：过滤后数量过少时，返回原始全量（避免前端空页面）
    const minPoolSize = Math.min(CANDIDATE_POOL_CONFIG.MIN_DEGRADED_POOL_SIZE, rawCount);
    if (filtered.length < minPoolSize) {
      console.warn(
        `[buildCandidatePools] ${cityName}: filtered pool too small (${filtered.length}/${rawCount}), ` +
          `keeping all ${rawCount} POIs`,
      );
      pools.set(cityName, buildPoolResult(cityName, rawPOIs, rawCount));
      continue;
    }

    pools.set(cityName, buildPoolResult(cityName, filtered, rawCount));
  }

  return pools;
}

// ─────────────────────────────────────────────
// 过滤管道
// ─────────────────────────────────────────────

/**
 * 多维度过滤管道（按设计 §4.2 step 2.2 顺序）
 */
function applyFilters(
  pois: EnginePOI[],
  travelers: TravelerGroup,
  preferences: TripGenerateRequest['preferences'],
): EnginePOI[] {
  return (
    pois
      // 4.3.2 人群匹配
      .filter((poi) => crowdFilter(poi, travelers))
      // 4.3.3 预算过滤
      .filter((poi) => budgetFilter(poi, preferences.budget))
  );
  // MVP 阶段不做预约状态过滤（bookingFilter 保留为 no-op）
  // 兴趣偏好用作评分降权信号，不由过滤管道剔除（ENGINE-003 评分时处理）
}

// ─────────────────────────────────────────────
// 过滤子函数
// ─────────────────────────────────────────────

/**
 * 人群匹配过滤（设计 §4.3.2）
 *
 * 规则：
 *   - 有 elders/children 时，过滤 HIGH 体力且无「无障碍」特征的 POI
 *   - MVP 阶段用 suitableFor 字段作为无障碍替代
 */
export function crowdFilter(poi: EnginePOI, travelers: TravelerGroup): boolean {
  // 有老人
  if (travelers.elders > 0) {
    if (poi.energyLevel === 'HIGH' && !poi.suitableFor.includes('elder')) {
      return false;
    }
  }

  // 有 <=6 岁儿童
  const hasYoungChildren = travelers.children.some((c) => c.age <= 6);
  if (hasYoungChildren) {
    if (poi.energyLevel === 'HIGH' && !poi.suitableFor.includes('child')) {
      return false;
    }
  }

  // 有 <=3 岁婴幼儿
  const hasInfants = travelers.children.some((c) => c.age <= 3);
  if (hasInfants) {
    if (poi.category === 'nightlife') {
      return false;
    }
  }

  return true;
}

/**
 * 预算过滤（设计 §4.3.3）
 *
 * 规则：avgPrice = (min + max) / 2 ≤ perDay * 0.3
 */
export function budgetFilter(poi: EnginePOI, budget: BudgetLevel): boolean {
  const perDay = CANDIDATE_POOL_CONFIG.DEFAULT_PER_DAY_BUDGET[budget];
  const avgPrice = (poi.priceRange.min + poi.priceRange.max) / 2;
  return avgPrice <= perDay * CANDIDATE_POOL_CONFIG.BUDGET_PER_DAY_RATIO;
}

/**
 * 预约状态过滤（设计 §4.2 step 2.2）
 *
 * MVP 阶段：不基于预约状态过滤（无实时数据源），
 * 仅返回 true 保留所有 POI。后续对接高德/美团 API 后实现真实过滤。
 */
export function bookingFilter(_poi: EnginePOI): boolean {
  // MVP 阶段：不做预约过滤，保留所有 POI
  // 后续迭代：检查 高德/美团 API 返回的库存状态
  return true;
}

/**
 * 兴趣偏好过滤（宽松策略）
 *
 * 用户的兴趣标签用作升权而非剔除，但当：
 *   - 无兴趣标签 → 不过滤
 *   - 有至少有 1 个匹配 → 保留
 *   - 非餐饮/景点类且有标签但完全不匹配 → 降低权重（MVP 仍保留）
 */
export function interestBoostFilter(poi: EnginePOI, interests: string[]): boolean {
  if (!interests || interests.length === 0) return true;

  // 任一兴趣匹配则保留
  for (const interest of interests) {
    const matchedCategories = INTEREST_CATEGORY_MAP[interest] ?? [];
    if (matchedCategories.includes(poi.category)) {
      return true;
    }
  }

  // 无匹配标签：仍保留（不剔除），后续评分时降权
  return true;
}

// ─────────────────────────────────────────────
// 内部辅助
// ─────────────────────────────────────────────

/**
 * 按类别分组 POI
 */
function groupByCategory(pois: EnginePOI[]): Map<POICategory, EnginePOI[]> {
  const grouped = new Map<POICategory, EnginePOI[]>();
  for (const poi of pois) {
    const cat = poi.category;
    if (!grouped.has(cat)) {
      grouped.set(cat, []);
    }
    grouped.get(cat)!.push(poi);
  }
  return grouped;
}

/**
 * 构建候选池结果对象
 */
function buildPoolResult(cityName: string, pois: EnginePOI[], rawCount: number): CandidatePool {
  return {
    cityName,
    all: pois,
    byCategory: groupByCategory(pois),
    rawCount,
    filteredCount: pois.length,
  };
}

// ─────────────────────────────────────────────
// 便捷方法：从候选池获取某类别的 POI
// ─────────────────────────────────────────────

/**
 * 从候选池获取指定类别的 POI 列表
 */
export function getPOIsByCategory(pool: CandidatePool, category: POICategory): EnginePOI[] {
  return pool.byCategory.get(category) ?? [];
}

/**
 * 从候选池获取 POI 总数（用于统计/log）
 */
export function getPoolSummary(pools: CandidatePoolMap): {
  cityName: string;
  rawCount: number;
  filteredCount: number;
}[] {
  return Array.from(pools.values()).map((p) => ({
    cityName: p.cityName,
    rawCount: p.rawCount,
    filteredCount: p.filteredCount,
  }));
}

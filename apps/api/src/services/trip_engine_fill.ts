/**
 * PATH-WISE · Trip Lifecycle 引擎 — 时间轴填充（贪心 + 回溯）
 * ENGINE-003：算法三：fillTimeline + scorePOI + 体力模型
 *
 * 依据：docs/Trip_Lifecycle_引擎算法设计.md §5
 *       docs/任务分解_WBS_v1.0.0.md §5.2 ENGINE-003
 *
 * 职责：
 *   1. 评分函数 scorePOI：距离 / 时间段匹配 / 用户偏好 / 体力均衡
 *   2. 贪心填充：每天从候选池依次选最高分 POI 填入
 *   3. 回溯机制：无可用候选时回退上一个，最多 MAX_BACKTRACK_STEPS 次
 *   4. 体力模型：MAX_ENERGY_PER_DAY=8, LOW=1, MEDIUM=2, HIGH=4
 */

import type { TripGenerateRequest } from '@path-wise/shared';
import type { TimelineDay } from './trip_engine.js';
import type { CandidatePoolMap, EnginePOI } from './trip_engine_candidate.js';
import { timeToMinutes, minutesToTime } from '../utils/date_utils.js';
import { INTEREST_CATEGORY_MAP } from './engine_shared.js';

// ─────────────────────────────────────────────
// 引擎层类型
// ─────────────────────────────────────────────

/** 填充上下文：传给评分函数的运行时信息 */
export interface FillContext {
  /** 当前时间（分钟，从 00:00 开始） */
  currentTimeMinutes: number;
  /** 前一个已安排的 POI（用于距离计算） */
  prevPOI: EnginePOI | null;
  /** 当天已消耗体力 */
  energyUsed: number;
  /** 当天类型 */
  dayType: TimelineDay['dayType'];
  /** 用户偏好 */
  userPreferences: TripGenerateRequest['preferences'];
}

/** 交通时间计算函数签名（依赖注入，便于测试 mock） */
export type TransitTimeFn = (from: EnginePOI | null, to: EnginePOI) => number;

/** 填充后的单条活动（引擎内部表示） */
export interface FillItem {
  poi: EnginePOI;
  startTimeMinutes: number;
  endTimeMinutes: number;
  energyLevel: EnginePOI['energyLevel'];
}

/** 填充后的 TimelineDay（扩展 items 字段） */
export interface FilledTimelineDay extends TimelineDay {
  items: FillItem[];
}

/** 天级填充结果（内部） */
interface FillDayResult {
  items: FillItem[];
  backtrackCount: number;
}

// ─────────────────────────────────────────────
// 算法配置常量
// ─────────────────────────────────────────────

export const FILL_CONFIG = {
  /** 每天最大体力值 */
  MAX_ENERGY_PER_DAY: 8,

  /** 体力消耗对应值 */
  ENERGY_VALUE: {
    LOW: 1,
    MEDIUM: 2,
    HIGH: 4,
  } as const,

  /** 最大回溯步数 */
  MAX_BACKTRACK_STEPS: 5,

  /** 默认交通时间（分钟），MVP 固定值 */
  DEFAULT_TRANSIT_TIME: 30,

  /** 用餐预留时间（分钟） */
  MEAL_TIME_MINUTES: 60,

  /** 用餐时间窗口：午餐 */
  LUNCH_START: 11 * 60, // 11:00
  LUNCH_END: 13 * 60, // 13:00

  /** 用餐时间窗口：晚餐 */
  DINNER_START: 17 * 60, // 17:00
  DINNER_END: 19 * 60, // 19:00
} as const;

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────
// timeToMinutes 从 utils/date_utils.ts 导入，避免跨文件重复定义。

/**
 * 判断当前时间是否接近用餐时间（午餐 11:00-13:00，晚餐 17:00-19:00）
 * 依据：docs/Trip_Lifecycle_引擎算法设计.md §5.3 step 3.7
 */
export function isNearMealTime(currentTimeMinutes: number): boolean {
  const { LUNCH_START, LUNCH_END, DINNER_START, DINNER_END } = FILL_CONFIG;
  return (
    (currentTimeMinutes >= LUNCH_START && currentTimeMinutes < LUNCH_END) ||
    (currentTimeMinutes >= DINNER_START && currentTimeMinutes < DINNER_END)
  );
}

/**
 * 判断给定分钟属于哪个时段
 */
export function timePeriodOf(minutes: number): 'morning' | 'afternoon' | 'evening' {
  if (minutes < 12 * 60) return 'morning'; // 00:00-11:59
  if (minutes < 18 * 60) return 'afternoon'; // 12:00-17:59
  return 'evening'; // 18:00-23:59
}

/**
 * 体力值查询
 */
export function energyOf(poi: EnginePOI): number {
  return FILL_CONFIG.ENERGY_VALUE[poi.energyLevel];
}

// ─────────────────────────────────────────────
// 评分函数
// ─────────────────────────────────────────────

/**
 * 评分函数：计算候选 POI 对当前时间槽的适合度（满分 100）
 *
 * 依据：docs/Trip_Lifecycle_引擎算法设计.md §5.2
 *
 * 评分项：
 *   1. 距离得分 (0-30)：<1km=30, 1-3km=20, >3km=5, 无prevPOI=15
 *   2. 时间段匹配 (0-25)：currentTime 在 bestTimeSlot -> 25，否则 5
 *   3. 用户偏好匹配 (0-25)：按 interests 匹配 category，proportional
 *   4. 体力均衡 (0-20)：LOW=20, MEDIUM=10, HIGH=0
 *
 * @param poi - 待评分的 POI
 * @param context - 填充上下文（当前时间、上一个 POI、体力、偏好等）
 * @returns 总分 (0-100)
 */
export function scorePOI(poi: EnginePOI, context: FillContext): number {
  // 1. 距离得分 (0-30)
  // MVP 阶段无高德 API：prevPOI 存在时统一使用固定值 20（1-3km 档）
  const distanceScore = !context.prevPOI ? 15 : 20;

  // 2. 时间段匹配 (0-25)
  const currentPeriod = timePeriodOf(context.currentTimeMinutes);
  const timeScore = poi.bestTimeSlot.includes(currentPeriod) ? 25 : 5;

  // 3. 用户偏好匹配 (0-25)
  const interests = context.userPreferences?.interests ?? [];
  let preferenceScore = 0;
  if (interests.length > 0) {
    for (const interest of interests) {
      const matchedCategories = INTEREST_CATEGORY_MAP[interest] ?? [];
      if (matchedCategories.includes(poi.category)) {
        preferenceScore += 25 / interests.length;
      }
    }
  } else {
    preferenceScore = 12;
  }

  // 4. 体力均衡得分 (0-20)
  const energyScore = poi.energyLevel === 'LOW' ? 20 : poi.energyLevel === 'HIGH' ? 0 : 10; // MEDIUM or default

  return distanceScore + timeScore + preferenceScore + energyScore;
}

// ─────────────────────────────────────────────
// 候选评分与排序
// ─────────────────────────────────────────────

interface ScoredCandidate {
  poi: EnginePOI;
  score: number;
}

/**
 * 对候选池按评分降序排列
 *
 * @param candidates - 可用的候选 POI 列表
 * @param context - 填充上下文
 * @returns 按 score 降序排列的 (POI, score) 列表
 */
export function rankCandidates(candidates: EnginePOI[], context: FillContext): ScoredCandidate[] {
  return candidates
    .map((poi) => ({ poi, score: scorePOI(poi, context) }))
    .sort((a, b) => b.score - a.score);
}

// ─────────────────────────────────────────────
// 单天填充（内部函数）
// ─────────────────────────────────────────────

interface FillDayResult {
  items: FillItem[];
  backtrackCount: number;
}

function fillSingleDay(
  day: TimelineDay,
  candidates: EnginePOI[],
  preferences: TripGenerateRequest['preferences'],
  transitTimeFn: TransitTimeFn,
): FillDayResult {
  const { MAX_ENERGY_PER_DAY, MAX_BACKTRACK_STEPS, MEAL_TIME_MINUTES } = FILL_CONFIG;
  const dayItems: FillItem[] = [];
  const totalMinutes = day.availableWindow.totalMinutes;

  // 跳过不可用的天（时间窗口为 0 或候选为空）
  if (totalMinutes <= 0 || candidates.length === 0) {
    return { items: [], backtrackCount: 0 };
  }

  const windowStartMinutes = timeToMinutes(day.availableWindow.start);
  const windowEndMinutes = timeToMinutes(day.availableWindow.end);

  // 维护剩余可用 POI（每次选中的从池中移除）
  const remainingPool = [...candidates];

  let currentTime = windowStartMinutes;
  let energyUsed = 0;
  let backtrackCount = 0;
  const excludedThisRound = new Set<string>();

  while (currentTime < windowEndMinutes) {
    const remainingTime = windowEndMinutes - currentTime;
    const prevPOI = dayItems.length > 0 ? dayItems[dayItems.length - 1].poi : null;

    const context: FillContext = {
      currentTimeMinutes: currentTime,
      prevPOI,
      energyUsed,
      dayType: day.dayType,
      userPreferences: preferences,
    };

    // 过滤可用候选（从剩余池中）
    const available = remainingPool
      .filter((poi) => !excludedThisRound.has(poi.id))
      .filter((poi) => {
        const transit = prevPOI ? transitTimeFn(prevPOI, poi) : 0;
        return poi.durationMin + transit <= remainingTime;
      })
      .filter((poi) => energyUsed + energyOf(poi) <= MAX_ENERGY_PER_DAY);

    /**
     * 检查剩余池中是否存在"未被排除且可能适合"的 POI
     * （用于判断是否值得触发回溯，仅检查时间和体力约束，不做偏好评分）
     */
    function hasViableInPool(): boolean {
      const prev = dayItems.length > 0 ? dayItems[dayItems.length - 1].poi : null;
      return remainingPool.some(
        (p) =>
          !excludedThisRound.has(p.id) &&
          p.durationMin + (prev ? transitTimeFn(prev, p) : 0) <= windowEndMinutes - currentTime &&
          energyUsed + energyOf(p) <= MAX_ENERGY_PER_DAY,
      );
    }

    if (available.length === 0) {
      // 如果剩余池中还有未被排除的 POI 可能合适，触发回溯
      if (dayItems.length > 0 && backtrackCount < MAX_BACKTRACK_STEPS && hasViableInPool()) {
        const lastItem = dayItems.pop()!;
        remainingPool.push(lastItem.poi);
        currentTime = lastItem.startTimeMinutes;
        energyUsed -= energyOf(lastItem.poi);
        // 清除本轮所有过期排除标记，仅保留刚回溯的 POI
        excludedThisRound.clear();
        excludedThisRound.add(lastItem.poi.id);
        backtrackCount++;
        continue;
      }
      break;
    }

    // 贪心选择
    const ranked = rankCandidates(available, context);
    const selected = ranked[0];

    const transitTime = prevPOI ? transitTimeFn(prevPOI, selected.poi) : 0;
    const startTime = currentTime + transitTime;

    if (startTime + selected.poi.durationMin > windowEndMinutes) {
      // 当前最佳候选超出了窗口，排除它并尝试下一个（而非立即回溯）
      excludedThisRound.add(selected.poi.id);
      continue;
    }

    const endTime = startTime + selected.poi.durationMin;

    dayItems.push({
      poi: selected.poi,
      startTimeMinutes: startTime,
      endTimeMinutes: endTime,
      energyLevel: selected.poi.energyLevel,
    });

    // 从剩余池中移除已选 POI
    const idx = remainingPool.findIndex((p) => p.id === selected.poi.id);
    if (idx !== -1) remainingPool.splice(idx, 1);

    currentTime = endTime;
    energyUsed += energyOf(selected.poi);

    // 用餐时间
    if (isNearMealTime(currentTime)) {
      currentTime += MEAL_TIME_MINUTES;
    }
  }

  return { items: dayItems, backtrackCount };
}

// ─────────────────────────────────────────────
// 主填充算法：fillTimeline
// ─────────────────────────────────────────────

/**
 * 时间轴填充主函数（ENGINE-003 主函数）
 *
 * 按天循环，从候选池选最优活动填入时间轴。
 * 贪心选择 + 回溯换项，体力消耗累积检查。
 *
 * 依据：docs/Trip_Lifecycle_引擎算法设计.md §5.3
 *
 * @param timeline - 时间轴（已初始化的天数数组）
 * @param candidatePools - 城市候选池 Map
 * @param params - 攻略生成请求参数
 * @param transitTimeFn - 交通时间计算函数（依赖注入），默认 30min
 * @returns 填充后的时间轴数组（FilledTimelineDay[]，含 items 字段）
 */
export function fillTimeline(
  timeline: TimelineDay[],
  candidatePools: CandidatePoolMap,
  params: TripGenerateRequest,
  transitTimeFn: TransitTimeFn = () => FILL_CONFIG.DEFAULT_TRANSIT_TIME,
): FilledTimelineDay[] {
  const result: FilledTimelineDay[] = [];

  for (const day of timeline) {
    const pool = candidatePools.get(day.city);
    if (!pool) {
      console.warn(
        `[fillTimeline] City "${day.city}" not found in candidate pools, day ${day.dayIndex} will be empty`,
      );
    }
    const candidates = pool ? [...pool.all] : [];

    const { items } = fillSingleDay(day, candidates, params.preferences, transitTimeFn);

    result.push({
      ...day,
      items,
    });
  }

  return result;
}

// ─────────────────────────────────────────────
// 便捷方法
// ─────────────────────────────────────────────

/**
 * 将引擎内部 FillItem 转为对外输出的 time + duration 格式
 */
export function formatFillItem(item: FillItem): {
  startTime: string;
  endTime: string;
  duration: number;
  poiName: string;
  energyLevel: string;
} {
  return {
    startTime: minutesToTime(item.startTimeMinutes),
    endTime: minutesToTime(item.endTimeMinutes),
    duration: item.endTimeMinutes - item.startTimeMinutes,
    poiName: item.poi.name,
    energyLevel: item.poi.energyLevel,
  };
}

/**
 * 获取某天填充结果摘要
 */
export function getDayFillSummary(day: FilledTimelineDay): {
  itemCount: number;
  totalActivityMinutes: number;
  energyUsed: number;
} {
  let totalActivityMinutes = 0;
  let energyUsed = 0;

  for (const item of day.items) {
    totalActivityMinutes += item.endTimeMinutes - item.startTimeMinutes;
    energyUsed += energyOf(item.poi);
  }

  return {
    itemCount: day.items.length,
    totalActivityMinutes,
    energyUsed,
  };
}

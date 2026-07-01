/**
 * PATH-WISE · Trip Lifecycle 引擎 — 中转日特殊逻辑
 * ENGINE-004：算法四：handleTransferDay()
 *
 * 依据：docs/Trip_Lifecycle_引擎算法设计.md §6
 *       docs/任务分解_WBS_v1.0.0.md §5.2 ENGINE-004
 *
 * 职责：
 *   1. 过滤高强度活动（energyLevel === 'HIGH'）— 徒步、登山、大型主题公园等
 *   2. 注入「前往枢纽」时间块（transit_to_hub，固定 1.5h）
 *   3. 传递 transferInfo 中转提示信息
 */

import type { TransportType, DayType } from '@path-wise/shared';
import type { TimelineDay, TransferInfo } from './trip_engine.js';
import type { EnginePOI } from './trip_engine_candidate.js';
import { timeToMinutes, minutesToTime } from '../utils/date_utils.js';

// ─────────────────────────────────────────────
// 引擎层类型
// ─────────────────────────────────────────────

/** 中转日处理上下文 */
export interface TransferDayContext {
  /** 当前城市名 */
  currentCity: string;
  /** 下一站城市名 */
  nextCity: string;
  /** 大交通类型 */
  transportType: TransportType | null;
  /** 大交通出发时间 HH:MM（从 transferInfo 获取，默认 16:00） */
  departTime: string;
  /** 市区到枢纽的交通时间（分钟），MVP 默认 60 */
  transitToHubMinutes: number;
}

/** 中转日处理结果：过滤后的 POI + 枢纽时间块 */
export interface TransferDayResult {
  /** 过滤后的活动列表（已排除 HIGH 体力活动） */
  filteredPOIs: EnginePOI[];
  /** 枢纽时间块信息 */
  hubBlock: HubTimeBlock;
  /** 当天时间窗口结束（最晚从市区出发时间）的分钟数 */
  latestDepartureMinutes: number;
}

/** 前往枢纽时间块 */
export interface HubTimeBlock {
  type: 'transit_to_hub';
  startTimeMinutes: number;
  endTimeMinutes: number;
  description: string;
  transitMode: string;
  transitDurationMinutes: number;
}

/** 填充后的 TransferDay（扩展了 items 和 transferInfo） */
export interface ProcessedTransferDay extends TimelineDay {
  transferInfo: TransferInfo;
  hubBlock: HubTimeBlock;
}

// ─────────────────────────────────────────────
// 算法配置常量
// ─────────────────────────────────────────────

export const TRANSFER_CONFIG = {
  /**
   * 高强度活动关键词列表
   * 精确匹配 POI 名称和描述中的关键词，用于辅助过滤。
   *
   * 依据：docs/Trip_Lifecycle_引擎算法设计.md §6.1 step 2
   *       §6.2 中转日 AI 提示词 — 禁止爬山、长距离徒步
   */
  HIGH_INTENSITY_KEYWORDS: [
    '徒步',
    '登山',
    '爬山',
    '攀岩',
    '滑雪',
    '长城',
    '大型主题公园',
    '马拉松',
    '越野',
    '骑行全程',
    '冲浪',
    '漂流',
    '潜水',
    '滑翔',
  ],

  /**
   * 高强度活动类别列表：这些 genre/category 在中转日一律排除
   */
  HIGH_INTENSITY_CATEGORIES: ['nature'] as string[],

  /**
   * 前往枢纽固定时间（分钟）
   * 依据：设计 §6.1 step 4 — 固定 1.5h = 90min
   */
  HUB_TRANSIT_DURATION_MINUTES: 90,

  /**
   * 前往枢纽的交通方式（展示用）
   */
  HUB_TRANSIT_MODE: '地铁/出租车',

  /**
   * 枢纽到达缓冲时间（分钟）：最晚出发前预留
   * 依据：设计 §11 TRANSIT_TO_HUB_SAFETY_MARGIN: 60
   */
  HUB_SAFETY_MARGIN_MINUTES: 60,

  /**
   * 默认大交通出发时间（无 transferInfo 时使用）
   */
  DEFAULT_DEPART_TIME: '16:00',
} as const;

// ─────────────────────────────────────────────
// 高强度活动判断
// ─────────────────────────────────────────────

/**
 * 判断 POI 是否为高强度活动，满足任一条件即视为高强度：
 *   1. energyLevel === 'HIGH'
 *   2. 名称匹配高强度关键词
 *
 * 依据：docs/Trip_Lifecycle_引擎算法设计.md §6.1 step 2
 *
 * @param poi - 待判断的 POI
 * @returns true 表示该 POI 为高强度活动，应在中转日排除
 */
export function isHighIntensityActivity(poi: EnginePOI): boolean {
  // 1. 体力等级为 HIGH
  if (poi.energyLevel === 'HIGH') {
    return true;
  }

  // 2. 名称匹配高强度关键词
  for (const keyword of TRANSFER_CONFIG.HIGH_INTENSITY_KEYWORDS) {
    if (poi.name.includes(keyword)) {
      return true;
    }
  }

  return false;
}

/**
 * 判断 POI 是否适合中转日（低体力 + 非高强度类别）
 *
 * @param poi - 待判断的 POI
 * @returns true 表示该 POI 适合中转日
 */
export function isTransferDaySuitable(poi: EnginePOI): boolean {
  if (isHighIntensityActivity(poi)) {
    return false;
  }

  // 排除高强度类别（如 nature，除非能量等级明确为 LOW）
  if (
    TRANSFER_CONFIG.HIGH_INTENSITY_CATEGORIES.includes(poi.category) &&
    poi.energyLevel !== 'LOW'
  ) {
    return false;
  }

  return true;
}

// ─────────────────────────────────────────────
// 枢纽时间块生成
// ─────────────────────────────────────────────

/**
 * 生成「前往枢纽」时间块
 *
 * 依据：docs/Trip_Lifecycle_引擎算法设计.md §6.1 step 4
 *
 * 在当日可用窗口末尾注入 transit_to_hub 时间块。
 * 时间窗口结束时间由引擎初始化时的中转日窗口计算决定（已扣除 buffer + transitToHub）。
 *
 * @param windowEndMinutes - 当天可用时间窗口结束分钟数（即最晚从市区出发时间）
 * @param transitToHubMinutes - 市区到枢纽的交通时间（分钟），默认 90
 * @param hubName - 枢纽名称（机场/火车站），MVP 默认 "交通枢纽"
 * @param currentCity - 当前城市名
 * @returns HubTimeBlock
 */
export function buildHubTimeBlock(
  windowEndMinutes: number,
  transitToHubMinutes: number = TRANSFER_CONFIG.HUB_TRANSIT_DURATION_MINUTES,
  hubName: string = '交通枢纽',
  currentCity: string = '',
): HubTimeBlock {
  const startTimeMinutes = windowEndMinutes - transitToHubMinutes;

  return {
    type: 'transit_to_hub',
    startTimeMinutes: Math.max(0, startTimeMinutes),
    endTimeMinutes: windowEndMinutes,
    description: currentCity
      ? `建议从${currentCity}市中心出发前往${hubName}（${TRANSFER_CONFIG.HUB_TRANSIT_MODE}约 ${transitToHubMinutes} 分钟）`
      : `建议出发前往${hubName}（${TRANSFER_CONFIG.HUB_TRANSIT_MODE}约 ${transitToHubMinutes} 分钟）`,
    transitMode: TRANSFER_CONFIG.HUB_TRANSIT_MODE,
    transitDurationMinutes: transitToHubMinutes,
  };
}

// ─────────────────────────────────────────────
// 主算法：handleTransferDay
// ─────────────────────────────────────────────

/**
 * 中转日特殊处理（ENGINE-004 主函数）
 *
 * 中转日是最复杂的一天，需要在「游玩」和「赶路」之间找到平衡。
 *
 * 处理流程：
 *   1. 解析中转日时间窗口
 *   2. 过滤高强度活动（energyLevel === 'HIGH' 的 POI）
 *   3. 生成「前往枢纽」时间块
 *   4. 返回过滤后的候选 POI + 枢纽时间块
 *
 * 依据：docs/Trip_Lifecycle_引擎算法设计.md §6.1
 *
 * @param day - 中转日 TimelineDay（dayType 为 transit_transfer 或 transit_return）
 * @param candidates - 当天可用的候选 POI 列表
 * @param context - 中转日处理上下文
 * @returns TransferDayResult
 */
export function handleTransferDay(
  day: TimelineDay,
  candidates: EnginePOI[],
  context: TransferDayContext,
): TransferDayResult {
  const { transitToHubMinutes } = context;

  // 1. 解析中转日时间窗口：窗口结束时间 = 最晚从市区出发时间
  const windowEndMinutes =
    day.availableWindow.totalMinutes > 0
      ? timeToMinutes(day.availableWindow.end)
      : timeToMinutes(day.availableWindow.start);

  // 2. 过滤高强度活动
  const filteredPOIs = candidates.filter((poi) => isTransferDaySuitable(poi));

  // 3. 生成「前往枢纽」时间块
  const hubBlock = buildHubTimeBlock(windowEndMinutes, transitToHubMinutes, '交通枢纽', day.city);

  return {
    filteredPOIs,
    hubBlock,
    latestDepartureMinutes: windowEndMinutes,
  };
}

/**
 * 便捷方法：检查某天是否为中转日
 */
export function isTransferDay(dayType: DayType): boolean {
  return dayType === 'transit_transfer' || dayType === 'transit_return';
}

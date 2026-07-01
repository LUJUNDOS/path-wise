/**
 * PATH-WISE · Trip Lifecycle 引擎 — 时间轴初始化
 * ENGINE-001：算法一：时间轴初始化（initializeTimeline）
 *
 * 依据：docs/Trip_Lifecycle_引擎算法设计.md §3
 *       docs/任务分解_WBS_v1.0.0.md §5.2 ENGINE-001
 *
 * 职责：
 *   1. 解析 destinations 数组
 *   2. 确定每个 Day 的类型（transit_departure / city_exploration / transit_transfer / transit_return）
 *   3. 计算每日可用时间窗口
 *
 * 日类型规则（§3.2）：
 *   - 第一个城市 Day 1 → transit_departure（出发/到达日）
 *   - 非最后城市的最后一天 → transit_transfer（中转日）
 *   - 最后城市最后一天 + needsReturnTransport → transit_return（返程日）
 *   - 其他天 → city_exploration（深度游）
 *
 * 天数计算：totalDays = sum(destinations.days)
 * - 第一个城市的 transit_departure 计入该城市的 days 中
 * - 中转日（transit_transfer）计入当前城市的 days 中
 * - 最后一个城市纯 city_exploration（除非 needsReturnTransport）
 *
 * 实现策略：
 *   initializeTimeline 作为编排函数，委托给三个子函数处理每个城市段。
 *   BuildContext.offset 作为统一计数器在所有子函数间传递，保证 dayIndex 连续。
 */

import type { DayType, TransportType } from '@path-wise/shared';
import type { TripGenerateRequest, Destination } from '@path-wise/shared';
import { BusinessError } from '../types/errors.js';
import { timeToMinutes, minutesToTime } from '../utils/date_utils.js';

// ─────────────────────────────────────────────
// 引擎层类型
// ─────────────────────────────────────────────

/** 时间窗口 */
export interface TimeWindow {
  start: string; // "09:00"
  end: string; // "22:00"
  totalMinutes: number;
}

/** 中转日信息 */
export interface TransferInfo {
  departCity: string;
  arriveCity: string;
  departTime: string;
  arriveTime: string;
  transportType: TransportType;
  suggestion: string;
}

/**
 * 算法配置常量
 * 依据：docs/Trip_Lifecycle_引擎算法设计.md §11
 */
export const TIMELINE_CONFIG = {
  /** 默认游玩开始时间 */
  DEFAULT_START_TIME: '09:00',
  /** 默认游玩结束时间 */
  DEFAULT_END_TIME: '22:00',
  /** 默认全天可用分钟数（09:00~22:00 = 780min） */
  DEFAULT_AVAILABLE_MINUTES: 13 * 60,
  /** 最大总天数（防止恶意请求） */
  MAX_TOTAL_DAYS: 30,
  /** 不同交通方式的枢纽缓冲时间（分钟） */
  BUFFER_MINUTES: {
    flight: 120,
    bus: 60,
    high_speed_rail: 90,
    normal_train: 90,
    auto: 90,
  } as Record<TransportType, number>,
  /** 默认大交通出发时间（未提供时使用） */
  DEFAULT_DEPART_TIME: '16:00',
  /** 默认大交通到达时间 */
  DEFAULT_ARRIVE_TIME: '14:00',
  /** 出发日下午到达时间 */
  ARRIVAL_AFTERNOON_TIME: '14:00',
} as const;

// ─────────────────────────────────────────────
// 引擎核心类型
// ─────────────────────────────────────────────

/** 时间轴中的一天（引擎内部表示） */
export interface TimelineDay {
  dayIndex: number; // 1-based
  date: string; // YYYY-MM-DD
  dayType: DayType;
  city: string;
  availableWindow: TimeWindow;
  transferInfo?: TransferInfo;
}

/** 时间轴初始化结果 */
export interface TimelineInitResult {
  timeline: TimelineDay[];
  totalDays: number;
}

// ─────────────────────────────────────────────
// 工具函数
// ─────────────────────────────────────────────
// timeToMinutes 和 minutesToTime 从 utils/date_utils.ts 导入，避免跨文件重复定义。

/**
 * 根据日期偏移计算日期字符串（显式使用 UTC Date.UTC 构造，避免本地时区偏移）
 * @param startDate - 起始日期 YYYY-MM-DD
 * @param offsetDays - 偏移天数（0-based）
 */
function offsetDate(startDate: string, offsetDays: number): string {
  const [y, m, d] = startDate.split('-').map(Number);
  const dObj = new Date(Date.UTC(y, m - 1, 1));
  dObj.setUTCDate(d + offsetDays);
  const year = dObj.getUTCFullYear();
  const month = String(dObj.getUTCMonth() + 1).padStart(2, '0');
  const day = String(dObj.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 获取交通类型的缓冲时间（分钟）
 */
function getBufferMinutes(transportType: TransportType | null): number {
  if (!transportType) return TIMELINE_CONFIG.BUFFER_MINUTES.high_speed_rail;
  return (
    TIMELINE_CONFIG.BUFFER_MINUTES[transportType] ?? TIMELINE_CONFIG.BUFFER_MINUTES.high_speed_rail
  );
}

/**
 * 计算中转日可用时间窗口
 *
 * 依据：docs/Trip_Lifecycle_引擎算法设计.md §3.3
 *
 * @param transportType - 大交通类型
 * @param departTime - 大交通出发时间 HH:MM
 * @param transitToHubMinutes - 市区到枢纽交通时间（分钟），MVP 默认 60
 * @returns 中转日时间窗口（最晚出发时间 = departTime - buffer - transitToHub）
 */
export function computeTransferDayWindow(
  transportType: TransportType | null,
  departTime: string,
  transitToHubMinutes: number = 60,
): TimeWindow {
  const departMinutes = timeToMinutes(departTime);
  const buffer = getBufferMinutes(transportType);
  const latestDepartureFromCity = departMinutes - buffer - transitToHubMinutes;

  if (latestDepartureFromCity <= timeToMinutes(TIMELINE_CONFIG.DEFAULT_START_TIME)) {
    return {
      start: TIMELINE_CONFIG.DEFAULT_START_TIME,
      end: TIMELINE_CONFIG.DEFAULT_START_TIME,
      totalMinutes: 0,
    };
  }

  return {
    start: TIMELINE_CONFIG.DEFAULT_START_TIME,
    end: minutesToTime(latestDepartureFromCity),
    totalMinutes: latestDepartureFromCity - timeToMinutes(TIMELINE_CONFIG.DEFAULT_START_TIME),
  };
}

// ─────────────────────────────────────────────
// 内部辅助：创建 TimelineDay
// ─────────────────────────────────────────────

interface CreateDayParams {
  dayIndex: number;
  date: string;
  dayType: DayType;
  city: string;
  transportType?: TransportType | null;
  transferInfo?: TransferInfo;
}

/**
 * 创建时间轴中的一天，自动计算 timeWindow
 */
function createTimelineDay(params: CreateDayParams): TimelineDay {
  const { dayIndex, date, dayType, city, transportType, transferInfo } = params;

  let availableWindow: TimeWindow;

  switch (dayType) {
    case 'transit_transfer':
    case 'transit_return':
      availableWindow = computeTransferDayWindow(
        transportType ?? null,
        transferInfo?.departTime ?? TIMELINE_CONFIG.DEFAULT_DEPART_TIME,
      );
      break;
    case 'transit_departure':
      availableWindow = {
        start: TIMELINE_CONFIG.ARRIVAL_AFTERNOON_TIME,
        end: TIMELINE_CONFIG.DEFAULT_END_TIME,
        totalMinutes: 8 * 60,
      };
      break;
    case 'city_exploration':
    default:
      availableWindow = {
        start: TIMELINE_CONFIG.DEFAULT_START_TIME,
        end: TIMELINE_CONFIG.DEFAULT_END_TIME,
        totalMinutes: TIMELINE_CONFIG.DEFAULT_AVAILABLE_MINUTES,
      };
      break;
  }

  return { dayIndex, date, dayType, city, availableWindow, transferInfo };
}

/**
 * 构建中转日信息
 */
function buildTransferInfo(
  fromCity: string,
  toCity: string,
  transportType: TransportType | null,
  context: 'transfer' | 'return',
): TransferInfo {
  const resolvedType = transportType ?? 'high_speed_rail';
  const suggestion =
    context === 'return'
      ? `返程日：从${fromCity}返回${toCity}`
      : `今天下午从${fromCity}出发前往${toCity}，上午可轻松游玩市中心`;

  return {
    departCity: fromCity,
    arriveCity: toCity,
    departTime: TIMELINE_CONFIG.DEFAULT_DEPART_TIME,
    arriveTime: TIMELINE_CONFIG.DEFAULT_ARRIVE_TIME,
    transportType: resolvedType,
    suggestion,
  };
}

/**
 * 解析返程交通偏好：'auto' 时返回 null（表示"与去程相同"或"智能推荐"），
 * 否则直接返回指定的交通类型
 */
function resolveReturnTransportPref(
  pref: TransportType | 'auto' | undefined | null,
): TransportType | null {
  if (!pref || pref === 'auto') return null;
  return pref;
}

// ─────────────────────────────────────────────
// 天数生成上下文（在子函数间共享的可变状态）
// ─────────────────────────────────────────────

/**
 * globalDayOffset 作为计数器在所有城市段间传递，保证 dayIndex 连续。
 * 每个 createTimelineDay 调用后 +1。
 */
interface BuildContext {
  timeline: TimelineDay[];
  offset: number;
  departureDate: string;
  departureCity: string;
  needsReturnTransport: boolean | undefined;
  returnTransportPrefRaw: TransportType | 'auto' | undefined;
}

/** 递增 offset 并返回新 TimelineDay */
function pushDay(ctx: BuildContext, day: TimelineDay): void {
  ctx.timeline.push(day);
  ctx.offset++;
}

// ─────────────────────────────────────────────
// 城市段生成器（每个函数处理一个城市段）
// ─────────────────────────────────────────────

/**
 * 生成第一个城市的 timeline days
 *
 * 规则：
 *   - Day 1 = transit_departure
 *   - 单城市 + needsReturnTransport → 最后一天 transit_return
 *   - 多城市 → 最后一天 transit_transfer
 */
function buildFirstCityDays(
  ctx: BuildContext,
  city: Destination,
  isLastCity: boolean,
  nextCity: Destination | undefined,
): void {
  // Day 1: transit_departure
  pushDay(
    ctx,
    createTimelineDay({
      dayIndex: ctx.offset + 1,
      date: offsetDate(ctx.departureDate, ctx.offset),
      dayType: 'transit_departure',
      city: city.cityName,
    }),
  );

  const cityDays = city.days;
  if (cityDays === 1) return; // 仅有出发日

  const remaining = cityDays - 1;

  if (!isLastCity && nextCity) {
    // 多城市：前 remaining-1 天 city_exploration，最后一天 transit_transfer
    for (let d = 0; d < remaining - 1; d++) {
      pushDay(
        ctx,
        createTimelineDay({
          dayIndex: ctx.offset + 1,
          date: offsetDate(ctx.departureDate, ctx.offset),
          dayType: 'city_exploration',
          city: city.cityName,
        }),
      );
    }
    pushDay(
      ctx,
      createTimelineDay({
        dayIndex: ctx.offset + 1,
        date: offsetDate(ctx.departureDate, ctx.offset),
        dayType: 'transit_transfer',
        city: city.cityName,
        transportType: nextCity.transportTo,
        transferInfo: buildTransferInfo(
          city.cityName,
          nextCity.cityName,
          nextCity.transportTo,
          'transfer',
        ),
      }),
    );
  } else {
    // 单城市：剩余天数 city_exploration，最后一天可能为 transit_return
    buildLastCityDays(ctx, city, remaining);
  }
}

/**
 * 生成中间城市（非首非尾）的 timeline days
 *
 * 规则：
 *   - days=1 → 直接 transit_transfer（§10.1）
 *   - days≥2 → 前 days-1 天 city_exploration，最后一天 transit_transfer
 */
function buildMiddleCityDays(ctx: BuildContext, city: Destination, nextCity: Destination): void {
  const cityDays = city.days;

  if (cityDays === 1) {
    pushDay(
      ctx,
      createTimelineDay({
        dayIndex: ctx.offset + 1,
        date: offsetDate(ctx.departureDate, ctx.offset),
        dayType: 'transit_transfer',
        city: city.cityName,
        transportType: nextCity.transportTo,
        transferInfo: buildTransferInfo(
          city.cityName,
          nextCity.cityName,
          nextCity.transportTo,
          'transfer',
        ),
      }),
    );
    return;
  }

  // cityDays ≥ 2
  for (let d = 0; d < cityDays - 1; d++) {
    pushDay(
      ctx,
      createTimelineDay({
        dayIndex: ctx.offset + 1,
        date: offsetDate(ctx.departureDate, ctx.offset),
        dayType: 'city_exploration',
        city: city.cityName,
      }),
    );
  }
  pushDay(
    ctx,
    createTimelineDay({
      dayIndex: ctx.offset + 1,
      date: offsetDate(ctx.departureDate, ctx.offset),
      dayType: 'transit_transfer',
      city: city.cityName,
      transportType: nextCity.transportTo,
      transferInfo: buildTransferInfo(
        city.cityName,
        nextCity.cityName,
        nextCity.transportTo,
        'transfer',
      ),
    }),
  );
}

/**
 * 生成最后一个城市的末尾 days
 *
 * 规则：
 *   - 前 days-1 天 city_exploration
 *   - needsReturnTransport → 最后一天 transit_return，否则 city_exploration
 */
function buildLastCityDays(ctx: BuildContext, city: Destination, dayCount: number): void {
  const transportType = resolveReturnTransportPref(ctx.returnTransportPrefRaw);

  for (let d = 0; d < dayCount; d++) {
    const isLastLocalDay = d === dayCount - 1;
    const dayType =
      ctx.needsReturnTransport && isLastLocalDay ? 'transit_return' : 'city_exploration';

    pushDay(
      ctx,
      createTimelineDay({
        dayIndex: ctx.offset + 1,
        date: offsetDate(ctx.departureDate, ctx.offset),
        dayType,
        city: city.cityName,
        transportType: dayType === 'transit_return' ? transportType : undefined,
        transferInfo:
          dayType === 'transit_return'
            ? buildTransferInfo(city.cityName, ctx.departureCity, transportType, 'return')
            : undefined,
      }),
    );
  }
}

// ─────────────────────────────────────────────
// 主算法：initializeTimeline
// ─────────────────────────────────────────────

/**
 * 时间轴初始化（ENGINE-001 主函数）
 *
 * 根据 destinations 数组生成完整的时间轴框架。
 * 委托给 buildFirstCityDays / buildMiddleCityDays / buildLastCityDays 处理各个城市段。
 *
 * @param params - 攻略生成请求参数
 * @returns 时间轴数组 + 总天数
 *
 * @throws {BusinessError} 总天数超过 MAX_TOTAL_DAYS (30) 时抛出 DAYS_OUT_OF_RANGE
 * @throws {BusinessError} destinations 为空时抛出 DESTINATIONS_EMPTY
 */
export function initializeTimeline(params: TripGenerateRequest): TimelineInitResult {
  const { departure, destinations, needsReturnTransport } = params;

  if (!destinations?.length) {
    throw new BusinessError(
      10004, // ErrorCode.DESTINATIONS_EMPTY — 避免循环依赖，直接引用码值
      'destinations 不能为空',
      undefined,
      400,
    );
  }

  const totalDays = destinations.reduce((sum, d) => sum + d.days, 0);
  if (totalDays > TIMELINE_CONFIG.MAX_TOTAL_DAYS) {
    throw new BusinessError(
      10006, // ErrorCode.DAYS_OUT_OF_RANGE
      `总天数(${totalDays})超过上限(${TIMELINE_CONFIG.MAX_TOTAL_DAYS})，请减少目的地或缩短停留天数`,
      undefined,
      400,
    );
  }

  const ctx: BuildContext = {
    timeline: [],
    offset: 0,
    departureDate: departure.date,
    departureCity: departure.city,
    needsReturnTransport,
    returnTransportPrefRaw: params.returnTransportPref,
  };

  const N = destinations.length;

  for (let i = 0; i < N; i++) {
    const city = destinations[i];
    const isFirstCity = i === 0;
    const isLastCity = i === N - 1;

    if (isFirstCity) {
      buildFirstCityDays(ctx, city, isLastCity, isLastCity ? undefined : destinations[i + 1]);
    } else if (!isLastCity) {
      buildMiddleCityDays(ctx, city, destinations[i + 1]);
    } else {
      buildLastCityDays(ctx, city, city.days);
    }
  }

  return { timeline: ctx.timeline, totalDays };
}

/**
 * PATH-WISE · 攻略服务
 * 职责：攻略生成编排、校验冲突
 *
 * @mock MVP 阶段：generateMockDay() 使用 CITY_DATA 静态硬编码数据，
 *       city_service / llm_router / amap_adapter 均未被调用。
 *       后续需要将 mock 替换为真实服务调用链：
 *         city_service.searchPOI() → llm_router.generateWithLLM() → 动态生成 DayPlan
 *       城市知识库迁移到数据库后，删除 CITY_DATA 对象。
 */

import type {
  TripGenerateRequest,
  TripValidationResponse,
  TripRegenerateRequest,
  DayPlan,
  TimelineItem,
  AccommodationOption,
  HotelOption,
} from '@path-wise/shared';

import { CITY_DATA, type CityData, type CityTransport } from '../data/mock_cities.js';
import { clockTimeToMinutes } from '../utils/time_utils.js';

// ─────────────────────────────────────────────
// 重新导出（向后兼容）
// ─────────────────────────────────────────────

export {
  saveTrip,
  getTrip,
  listTrips,
  getDayPlan,
  updateDayPlan,
  deleteTrip,
} from './trip_crud_service.js';
export { exportTrip, buildExportHtml } from './trip_export_service.js';

// ─────────────────────────────────────────────
// 城市知识库数据 — 从 mock_cities.ts 导入
// MVP 阶段使用静态 mock，城市知识库迁移到数据库后直接替换 import 源
// ─────────────────────────────────────────────

/** 重新导出，供上层模块 import */
export { getMockTransport, type CityData, type CityTransport } from '../data/mock_cities.js';

/**
 * 攻略请求校验 + 冲突检测
 */
export function validateTripRequest(req: TripGenerateRequest): TripValidationResponse {
  const conflicts: TripValidationResponse['conflicts'] = [];

  // budget + accommodation 冲突
  if (
    req.preferences.budget === 'economy' &&
    (req.preferences.accommodation === 'boutique' || req.preferences.accommodation === 'luxury')
  ) {
    conflicts.push({
      type: 'budget_accommodation',
      severity: 'warning',
      message: '穷游预算下选择精品酒店可能超预算，建议调整为经济型或连锁酒店',
      suggestion: { action: 'set_accommodation', value: 'chain_hotel' },
    });
  }

  // pace + elders 冲突
  if (req.travelers.elders > 0 && req.preferences.pace === 'intensive') {
    conflicts.push({
      type: 'pace_elders',
      severity: 'warning',
      message: '同行有老人，高强度节奏可能较辛苦，建议调整为适中节奏',
      suggestion: { action: 'set_pace', value: 'moderate' },
    });
  }

  return { valid: true, conflicts };
}

/**
 * 重新生成某天（SSE）
 */
export async function regenerateDay(
  _tripId: string,
  _req: TripRegenerateRequest,
): Promise<{ taskId: string }> {
  return { taskId: `regenerate_${Date.now()}` };
}

/**
 * 为目的地生成 mock 天计划，使用城市真实数据
 * @param dayIndex - 全局天的索引（1-based）
 * @param cityName - 城市名
 * @param isFirstDayOfCity - 是否为该城市的第 0 天（抵达日）
 * @param daysInCity - 该城市总天数
 * @param prefs - 偏好设置
 * @param transport - 前往该城市的交通信息（第一个城市和后续城市不同）
 * @param departureDate - 出发日期 (YYYY-MM-DD)，默认 2026-07-01
 */
export function generateMockDay(
  dayIndex: number,
  cityName: string,
  isFirstDayOfCity: boolean,
  daysInCity: number,
  prefs?: TripGenerateRequest['preferences'],
  transport?: CityTransport | null,
  departureDate?: string,
): DayPlan {
  const dayType = isFirstDayOfCity ? 'transit_departure' : 'city_exploration';
  // 基于用户出发日期计算每日日期（与 generateDay 保持一致）
  const baseDate = departureDate ? new Date(departureDate) : new Date(2026, 6, 1);
  const date = new Date(baseDate);
  date.setDate(baseDate.getDate() + dayIndex - 1);
  const dateStr = date.toISOString().slice(0, 10);
  const data = CITY_DATA[cityName] ?? CITY_DATA.长沙;

  // H5: 城市不在知识库时记录警告
  if (!CITY_DATA[cityName]) {
    console.warn(
      `[generateMockDay] City "${cityName}" not found in CITY_DATA, falling back to 长沙`,
    );
  }

  // 每天选不同的景点（根据 dayIndex 轮转）
  const attrIndex = (dayIndex - 1) % data.attractions.length;
  const dineIndex = (dayIndex - 1) % data.dining.length;

  const morningAttr = data.attractions[attrIndex];
  const afternoonAttr = data.attractions[(attrIndex + 1) % data.attractions.length];

  const budgetMultiplier = prefs?.budget === 'economy' ? 0.5 : prefs?.budget === 'luxury' ? 2.5 : 1;

  const timeline: TimelineItem[] = isFirstDayOfCity
    ? [
        {
          id: `item_${dayIndex}_001`,
          type: 'dining',
          title: `午餐：${data.dining[dineIndex].name}`,
          description: data.dining[dineIndex].description,
          startTime: '12:00',
          endTime: '13:30',
          estimatedDuration: 90,
          estimatedCostCNY: Math.round(data.dining[dineIndex].costCNY * budgetMultiplier),
          energyLevel: 'LOW',
          bookingRequired: false,
        },
        {
          id: `item_${dayIndex}_002`,
          type: 'attraction',
          title: morningAttr.name,
          description: morningAttr.description,
          startTime: '14:00',
          endTime: `${String(14 + Math.floor(morningAttr.durationMin / 60)).padStart(2, '0')}:${String(morningAttr.durationMin % 60).padStart(2, '0')}`,
          estimatedDuration: morningAttr.durationMin,
          estimatedCostCNY: Math.round(morningAttr.costCNY * budgetMultiplier),
          energyLevel: morningAttr.energy,
          bookingRequired: morningAttr.bookingRequired,
        },
        {
          id: `item_${dayIndex}_003`,
          type: 'dining',
          title: `晚餐：${data.dining[(dineIndex + 1) % data.dining.length].name}`,
          description: data.dining[(dineIndex + 1) % data.dining.length].description,
          startTime: '18:00',
          endTime: '19:30',
          estimatedDuration: 90,
          estimatedCostCNY: Math.round(
            data.dining[(dineIndex + 1) % data.dining.length].costCNY * budgetMultiplier,
          ),
          energyLevel: 'LOW',
          bookingRequired: false,
        },
      ]
    : [
        {
          id: `item_${dayIndex}_001`,
          type: 'attraction',
          title: morningAttr.name,
          description: morningAttr.description,
          startTime: '09:00',
          endTime: `${String(9 + Math.floor(morningAttr.durationMin / 60)).padStart(2, '0')}:${String(morningAttr.durationMin % 60).padStart(2, '0')}`,
          estimatedDuration: morningAttr.durationMin,
          estimatedCostCNY: Math.round(morningAttr.costCNY * budgetMultiplier),
          energyLevel: morningAttr.energy,
          bookingRequired: morningAttr.bookingRequired,
        },
        {
          id: `item_${dayIndex}_002`,
          type: 'dining',
          title: `午餐：${data.dining[dineIndex].name}`,
          description: data.dining[dineIndex].description,
          startTime: '12:30',
          endTime: '14:00',
          estimatedDuration: 90,
          estimatedCostCNY: Math.round(data.dining[dineIndex].costCNY * budgetMultiplier),
          energyLevel: 'LOW',
          bookingRequired: false,
        },
        {
          id: `item_${dayIndex}_003`,
          type: 'attraction',
          title: afternoonAttr.name,
          description: afternoonAttr.description,
          startTime: '14:30',
          endTime: `${String(14 + Math.floor(afternoonAttr.durationMin / 60) + 1).padStart(2, '0')}:${String(afternoonAttr.durationMin % 60).padStart(2, '0')}`,
          estimatedDuration: afternoonAttr.durationMin,
          estimatedCostCNY: Math.round(afternoonAttr.costCNY * budgetMultiplier),
          energyLevel: afternoonAttr.energy,
          bookingRequired: afternoonAttr.bookingRequired,
        },
      ];

  // 住宿（只在该城市第一天提供）
  const hotelBudget = prefs?.budget ?? 'comfort';
  const hotelIndices =
    hotelBudget === 'economy'
      ? [1, 1]
      : hotelBudget === 'luxury'
        ? [0, 1]
        : [data.hotels.length > 1 ? 1 : 0, data.hotels.length > 2 ? 2 : 0];
  const primaryHotel = data.hotels[Math.min(hotelIndices[0], data.hotels.length - 1)];
  const backupHotel = data.hotels[Math.min(hotelIndices[1], data.hotels.length - 1)];

  const primary: HotelOption = {
    name: primaryHotel.name,
    address: primaryHotel.address,
    pricePerNight: Math.round(primaryHotel.pricePerNight * budgetMultiplier),
    totalPrice: Math.round(primaryHotel.pricePerNight * daysInCity * budgetMultiplier),
    reason: primaryHotel.reason,
    amenities: primaryHotel.amenities,
  };

  const backup: HotelOption = {
    name: backupHotel.name,
    address: backupHotel.address,
    pricePerNight: Math.round(backupHotel.pricePerNight * budgetMultiplier),
    totalPrice: Math.round(backupHotel.pricePerNight * daysInCity * budgetMultiplier),
    reason: backupHotel.reason,
    amenities: backupHotel.amenities,
  };

  const accommodation: AccommodationOption | null = isFirstDayOfCity
    ? {
        checkInDate: dateStr,
        checkOutDate: new Date(
          baseDate.getFullYear(),
          baseDate.getMonth(),
          baseDate.getDate() + dayIndex - 1 + daysInCity,
        )
          .toISOString()
          .slice(0, 10),
        nights: daysInCity,
        primary,
        backup,
      }
    : null;

  return {
    dayIndex,
    date: dateStr,
    dayType,
    cityName,
    isFirstDayOfCity,
    title: `Day ${dayIndex} · ${isFirstDayOfCity ? `抵达${cityName}` : `${cityName}深度游`}`,
    timeline,
    accommodation,
    transport: (isFirstDayOfCity ? transport : null) as Record<string, unknown> | null,
    tips: data.tips.slice(0, Math.min(2, data.tips.length)),
  };
}

// ─────────────────────────────────────────────
// 真实 LLM 生成（带 mock 降级）
// ─────────────────────────────────────────────

/**
 * 单日行程生成参数
 */
export interface GenerateDayParams {
  dayIndex: number;
  cityName: string;
  isFirstDayOfCity: boolean;
  daysInCity: number;
  isLastDay: boolean;
  preferences: TripGenerateRequest['preferences'];
  travelers: TripGenerateRequest['travelers'];
  transport: CityTransport | null;
  previousDays: DayPlan[];
  /** 出发日期 (YYYY-MM-DD)，用于计算每天的日期 */
  departureDate: string;
  /** 强制指定 LLM 提供商（用于测试），默认自动路由 */
  forceProvider?: import('../adapters/llm_router.js').LLMProvider;
}

/**
 * 通过 LLM 生成单天行程，LLM 失败时降级到 mock
 *
 * 流程：
 *   1. 获取城市知识库数据（从 CITY_DATA）
 *   2. 构建 Prompt（prompt.service.ts）
 *   3. 路由选择 LLM 提供商（llm_router.ts）
 *   4. 调用 LLM 生成（带降级链）
 *   5. 解析 JSON 返回 DayPlan
 *   6. LLM 失败时降级到 generateMockDay()
 *
 * @param params - 生成参数
 * @returns DayPlan
 */
export async function generateDay(params: GenerateDayParams): Promise<DayPlan> {
  const {
    dayIndex,
    cityName,
    isFirstDayOfCity,
    daysInCity,
    preferences,
    travelers,
    transport,
    previousDays,
    forceProvider,
    departureDate,
  } = params;

  // 基于用户请求的实际出发日期计算每天日期
  const baseDate = new Date(departureDate);
  const date = new Date(baseDate);
  date.setDate(baseDate.getDate() + dayIndex - 1);
  const dateStr = date.toISOString().slice(0, 10);

  // 获取城市知识库数据
  const cityData = CITY_DATA[cityName] ?? null;

  // H5: 城市知识库数据缺失时记录警告
  if (!cityData) {
    console.warn(
      `[generateDay] City "${cityName}" not found in CITY_DATA, LLM will have no local knowledge data`,
    );
  }

  // 动态导入 Prompt 服务（避免循环依赖）
  const { SYSTEM_PROMPT } = await import('./prompt.service.js');
  const { buildDayGenerationPrompt } = await import('./prompt.service.js');
  const { routeLLM, callWithFallback } = await import('../adapters/llm_router.js');

  // 构建 Prompt
  const systemPrompt = SYSTEM_PROMPT;
  const userPrompt = buildDayGenerationPrompt({
    cityName,
    dayIndex,
    date: dateStr,
    isFirstDayOfCity,
    daysInCity,
    preferences,
    travelers,
    transport,
    cityData: cityData as unknown as Record<string, unknown> | null,
    previousDays,
  });

  try {
    // 路由选择 LLM
    const estimatedTokens = userPrompt.length + systemPrompt.length; // 粗略估算
    const routeDecision = routeLLM({
      taskType: 'trip_generation',
      inputTokens: estimatedTokens > 100000 ? estimatedTokens : undefined,
      costPriority: preferences.budget === 'economy' ? 'low' : 'normal',
      speedPriority: 'normal',
    });

    const provider = forceProvider ?? routeDecision.provider;

    // 调用 LLM（带降级链），传递 routeLLM 决策的 model
    const result = await callWithFallback(userPrompt, systemPrompt, provider, routeDecision.model);

    // 解析 JSON
    const dayPlan = JSON.parse(result.text) as DayPlan;

    // H9: 检查 LLM 输出的字段是否与预期一致（帮助调试 Prompt 质量）
    if (dayPlan.cityName && dayPlan.cityName !== cityName) {
      console.warn(
        `[generateDay] LLM returned cityName "${dayPlan.cityName}" but expected "${cityName}"`,
      );
    }
    if (dayPlan.dayIndex !== undefined && dayPlan.dayIndex !== dayIndex) {
      console.warn(
        `[generateDay] LLM returned dayIndex ${dayPlan.dayIndex} but expected ${dayIndex}`,
      );
    }

    // 确保必填字段和索引正确
    dayPlan.dayIndex = dayIndex;
    dayPlan.date = dateStr;
    dayPlan.cityName = cityName;
    dayPlan.isFirstDayOfCity = isFirstDayOfCity;

    // 如果不是城市第一天，不保留住宿信息
    if (!isFirstDayOfCity) {
      dayPlan.accommodation = null;
    }

    // timeline 中每个 item 确保有 estimatedDuration
    for (const item of dayPlan.timeline) {
      item.id = item.id ?? `item_${dayIndex}_${Date.now().toString(36)}`;
      item.estimatedDuration =
        item.estimatedDuration ??
        Math.max(30, clockTimeToMinutes(item.endTime) - clockTimeToMinutes(item.startTime));
    }

    return dayPlan;
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.warn(
      `[generateDay] LLM failed for day ${dayIndex} (${cityName}), falling back to mock:`,
      errMsg,
    );
    return generateMockDay(
      dayIndex,
      cityName,
      isFirstDayOfCity,
      daysInCity,
      preferences,
      transport,
      departureDate,
    );
  }
}

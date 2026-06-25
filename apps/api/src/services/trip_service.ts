/**
 * PATH-WISE · 攻略服务（MVP stub）
 * 职责：攻略生成编排、CRUD、校验冲突
 *
 * MVP 阶段：大部分接口返回 mock 数据，后续接入 LLM 适配器 + 高德 API
 */

import type {
  TripGenerateRequest,
  TripResponse,
  TripSummary,
  TripValidationResponse,
  DayUpdateRequest,
  ExportOptions,
  ExportResponse,
  TripRegenerateRequest,
  DayPlan,
} from '@path-wise/shared';

/** Mock 天计划生成参数 */
export interface MockDayParams {
  dayIndex: number;
  cityName: string;
  isFirstDayOfCity: boolean;
  daysInCity: number;
}

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
 * 查询攻略列表
 */
export async function listTrips(_userId: string): Promise<TripSummary[]> {
  // MVP stub
  return [];
}

/**
 * 查询完整攻略
 */
export async function getTrip(tripId: string): Promise<TripResponse | null> {
  // MVP stub
  return null;
}

/**
 * 查询单天行程
 */
export async function getDayPlan(_tripId: string, _dayIndex: number): Promise<unknown | null> {
  // MVP stub
  return null;
}

/**
 * 修改单天行程
 */
export async function updateDayPlan(
  _tripId: string,
  _dayIndex: number,
  _req: DayUpdateRequest,
): Promise<unknown> {
  return {
    dayIndex: _dayIndex,
    validation: { valid: true, warnings: [] },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * 删除攻略
 */
export async function deleteTrip(_tripId: string): Promise<{ deletedAt: string }> {
  return { deletedAt: new Date().toISOString() };
}

/**
 * 导出攻略
 */
export async function exportTrip(
  _tripId: string,
  _options: ExportOptions,
): Promise<ExportResponse> {
  return {
    exportId: 'export_mock',
    status: 'ready',
    downloadUrl: 'https://cdn.example.com/exports/trip_mock.pdf',
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
    format: _options.format,
    sizeBytes: 2048000,
  };
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
 * 为目的地生成 mock 天计划
 * @param dayIndex - 全局天的索引（1-based）
 * @param cityName - 城市名
 * @param isFirstDayOfCity - 是否为该城市的第 0 天（抵达日）
 * @param daysInCity - 该城市总天数
 * @param _prefs - 偏好设置（预留，后续接入 LLM 后使用）
 */
export function generateMockDay(
  dayIndex: number,
  cityName: string,
  isFirstDayOfCity: boolean,
  daysInCity: number,
  _prefs?: TripGenerateRequest['preferences'],
): DayPlan {
  const dayType = isFirstDayOfCity ? 'transit_departure' : 'city_exploration';
  const dateStr = `2026-07-${String(dayIndex).padStart(2, '0')}`;

  return {
    dayIndex,
    date: dateStr,
    dayType,
    cityName,
    isFirstDayOfCity,
    title: `Day ${dayIndex} · ${isFirstDayOfCity ? `抵达${cityName}` : `${cityName}深度游`}`,
    timeline: [
      {
        id: `item_${dayIndex}_001`,
        type: 'attraction',
        title: `${cityName}热门景点`,
        startTime: '09:00',
        endTime: '12:00',
        estimatedDuration: 180,
        estimatedCostCNY: 0,
        energyLevel: 'MEDIUM',
        bookingRequired: false,
      },
      {
        id: `item_${dayIndex}_002`,
        type: 'dining',
        title: '当地特色餐厅',
        startTime: '12:30',
        endTime: '13:30',
        estimatedDuration: 60,
        estimatedCostCNY: 50,
        energyLevel: 'LOW',
        bookingRequired: false,
      },
    ],
    accommodation: isFirstDayOfCity
      ? {
          checkInDate: dateStr,
          checkOutDate: `2026-07-${String(dayIndex + daysInCity).padStart(2, '0')}`,
          nights: daysInCity,
          primary: {
            name: `${cityName}市中心舒适酒店`,
            address: `${cityName}市中心`,
            pricePerNight: 450,
            totalPrice: 450 * daysInCity,
            reason: '交通便利，评分高',
          },
          backup: {
            name: `${cityName}经济连锁酒店`,
            address: `${cityName}火车站附近`,
            pricePerNight: 280,
            totalPrice: 280 * daysInCity,
            reason: '性价比高',
          },
        }
      : null,
    tips: ['建议提前查看天气预报', '高峰期景点需排队'],
  };
}

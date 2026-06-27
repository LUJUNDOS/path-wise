/**
 * PATH-WISE · 攻略 CRUD 服务
 * 职责：攻略的保存、查询、列表、删除操作
 */

import type { TripResponse, TripSummary, DayUpdateRequest } from '@path-wise/shared';

/** MVP 内存存储：已生成的攻略（重启丢失，后续迁移到 Prisma） */
const tripStore = new Map<string, TripResponse>();

/** 内存存储上限（MVP 防护：防止内存泄漏） */
const MAX_TRIPS = 100;

/**
 * 保存已生成的攻略到内存
 * 超出容量上限时移除最早的条目
 */
export function saveTrip(trip: TripResponse): void {
  if (tripStore.size >= MAX_TRIPS) {
    const firstKey = tripStore.keys().next().value;
    if (firstKey) tripStore.delete(firstKey);
  }
  tripStore.set(trip.tripId, trip);
}

/**
 * 查询完整攻略
 */
export async function getTrip(tripId: string): Promise<TripResponse | null> {
  return tripStore.get(tripId) ?? null;
}

/**
 * 查询攻略列表
 */
export async function listTrips(_userId: string): Promise<TripSummary[]> {
  // MVP stub
  return [];
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

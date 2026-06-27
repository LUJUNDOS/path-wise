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
 * 先 set 再检查容量，超出上限时移除最早的条目
 * 保证即使在并发访问下也不会超出 MAX_TRIPS + 1
 */
export function saveTrip(trip: TripResponse): void {
  tripStore.set(trip.tripId, trip);
  // 先 set 后 evict，保证容量检查在插入之后
  if (tripStore.size > MAX_TRIPS) {
    const firstKey = tripStore.keys().next().value;
    if (firstKey) tripStore.delete(firstKey);
  }
}

/**
 * 查询完整攻略
 */
export async function getTrip(tripId: string): Promise<TripResponse | null> {
  return tripStore.get(tripId) ?? null;
}

/**
 * 查询攻略列表
 * @todo 将内存存储迁移到 Prisma 时实现，用户维度的分页查询
 */
export async function listTrips(_userId: string): Promise<TripSummary[]> {
  // MVP stub
  return [];
}

/**
 * 查询单天行程
 * @todo 从 Prisma 查询单日行程详情，含 timeline 和 accommodation
 */
export async function getDayPlan(_tripId: string, _dayIndex: number): Promise<unknown | null> {
  // MVP stub
  return null;
}

/**
 * 修改单天行程
 * @todo 写入 Prisma 并返回 dayIndex 索引的更新后行程数据
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
 * @todo 从 Prisma 软删除攻略及其关联数据
 */
export async function deleteTrip(_tripId: string): Promise<{ deletedAt: string }> {
  return { deletedAt: new Date().toISOString() };
}

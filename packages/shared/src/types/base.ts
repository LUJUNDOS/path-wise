/**
 * PATH-WISE · 基础类型定义
 * 依据：docs/前后端接口契约文档_v1.0.0.md §2.1
 */

/** 城际交通方式 */
export type TransportType = 'high_speed_rail' | 'normal_train' | 'flight' | 'bus' | 'auto';

/** 市内交通方式 */
export type LocalTransportType = 'public' | 'rental' | 'walking' | 'taxi';

/** 出发时段 */
export type TimePeriod = 'morning' | 'afternoon' | 'evening';

/** 预算等级 */
export type BudgetLevel = 'economy' | 'comfort' | 'luxury';

/** 行程节奏 */
export type PaceLevel = 'intensive' | 'moderate' | 'relaxed';

/** 住宿偏好类型 */
export type AccommodationType = 'hostel' | 'chain_hotel' | 'boutique' | 'any';

/** 任务状态 */
export type TaskStatus = 'generating' | 'completed' | 'partial' | 'failed';

/** 体力消耗等级 */
export type EnergyLevel = 'LOW' | 'MEDIUM' | 'HIGH';

/** 时间轴条目类型 */
export type TimelineItemType =
  | 'transport'
  | 'attraction'
  | 'dining'
  | 'hotel'
  | 'shopping'
  | 'rest'
  | 'transit_to_hub';

/** 日计划类型 */
export type DayType =
  | 'transit_departure'
  | 'city_exploration'
  | 'transit_transfer'
  | 'transit_return';

/** 出行人员 */
export interface TravelerGroup {
  adults: number;
  children: { age: number }[];
  elders: number;
}

/** 坐标点 */
export interface GeoPoint {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
}

/** 价格区间 */
export interface PriceRange {
  min: number;
  max: number;
}

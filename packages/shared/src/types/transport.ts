/**
 * PATH-WISE · 交通类型
 * 依据：docs/API接口设计规格书_v1.0.0.md §8（原 §7）
 */

import type { GeoPoint, TransportType } from './base.js';

/** 大交通搜索请求 */
export interface TransportSearchRequest {
  fromCity: string;
  toCity: string;
  date: string; // YYYY-MM-DD
  prefer?: TransportType[];
  departTimePeriod?: 'morning' | 'afternoon' | 'evening';
  passengers?: {
    adults: number;
    children: number;
  };
}

/** 交通方案 */
export interface TransportRouteOption {
  type: TransportType;
  trainNumber?: string;
  departTime: string; // HH:mm
  arriveTime: string; // HH:mm 或 "次日 08:15"
  durationMinutes: number;
  pricePerPerson: Record<string, number>;
  availableSeats?: number | Record<string, number>;
  departureStation: string;
  arrivalStation: string;
  isOvernight?: boolean;
  bookingUrl?: string;
  deepLink?: {
    platform: string;
    url: string;
  };
  note: string;
}

/** 大交通搜索响应 */
export interface TransportSearchResponse {
  options: TransportRouteOption[];
  source: 'mock' | 'amap_api' | '12306_api';
  expiresAt: string;
}

/** 市内路线规划请求 */
export interface RoutePlanRequest {
  city: string;
  origin: GeoPoint;
  destination: GeoPoint;
  mode: 'driving' | 'transit' | 'walking' | 'cycling';
  departureTime?: string; // HH:mm
}

/** 路线步骤 */
export interface RouteStep {
  instruction: string;
  mode: string;
  durationMinutes: number;
  distanceMeters: number;
  lineName?: string;
  stations?: number;
}

/** 市内路线响应 */
export interface RoutePlanResponse {
  distanceMeters: number;
  durationMinutes: number;
  steps: RouteStep[];
  polyline?: string;
  source: string;
}

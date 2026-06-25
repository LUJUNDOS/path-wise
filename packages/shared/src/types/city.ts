/**
 * PATH-WISE · 城市与 POI 类型
 * 依据：docs/前后端接口契约文档_v1.0.0.md §2.2
 *      docs/API接口设计规格书_v1.0.0.md §6
 */

import type { TransportType, PriceRange, GeoPoint } from "./base.js";

/** 城际交通方案 */
export interface TransportOption {
  fromCity: string;
  toCity: string;
  duration: number; // 分钟
  priceRange: Record<string, number | PriceRange>;
  departureStations: string[];
  arrivalStations: string[];
  note: string;
}

/** 市内交通信息 */
export interface LocalTransport {
  type: string;
  description: string;
  pricePerDay?: number;
}

/** 城市知识库概要 */
export interface CityBasic {
  cityName: string;
  province: string;
  level: string;
  tags: string[];
}

/** POI 类型 */
export type POICategory = "attraction" | "dining" | "shopping" | "hotel";

/** POI 条目 */
export interface POI {
  id: string;
  amapPoiId?: string;
  name: string;
  category: POICategory;
  subCategory?: string;
  tags?: string[];
  description?: string;
  location: GeoPoint;
  rating?: number;
  priceRange?: PriceRange;
  openingHours?: {
    weekday?: { open: string; close: string };
    weekend?: { open: string; close: string };
    closed_days?: string[];
  };
  bookingRequired?: boolean;
  estimatedDuration?: number; // 分钟
  energyLevel?: string;
  bestTimeSlots?: string[];
  crowdLevel?: string;
  suitableFor?: string[];
  tips?: string[];
  quality?: {
    score: number;
    lastVerified: string;
  };
}

/** POI 搜索请求 */
export interface POISearchParams {
  category?: POICategory;
  keyword?: string;
  energyLevel?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}

/** 城市天气 */
export interface CityWeather {
  date: string;
  forecast: string;
  temperature: {
    low: number;
    high: number;
  };
  humidity?: number;
  wind?: string;
}

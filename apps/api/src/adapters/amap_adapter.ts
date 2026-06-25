/**
 * PATH-WISE · 高德地图 API 适配器（MVP Stub）
 * 依据：docs/API接口设计规格书_v1.0.0.md §13
 *
 * 职责：封装高德 API 调用（POI 搜索、路线规划、地理编码、天气）
 * MVP 阶段返回静态 mock 数据，避免消耗 API 额度。
 */

import type { POI } from "@path-wise/shared";

/**
 * 高德 POI 搜索（mock）
 */
export async function searchAmapPOI(
  _city: string,
  _keywords: string,
): Promise<POI[]> {
  return [];
}

/**
 * 高德 POI 详情（mock）
 */
export async function getAmapPOIDetail(
  _poiId: string,
): Promise<POI | null> {
  return null;
}

/**
 * 高德路线规划（mock）
 */
export async function planAmapRoute(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
  mode: "driving" | "transit" | "walking" | "cycling",
): Promise<{
  distanceMeters: number;
  durationMinutes: number;
  steps: Array<{
    instruction: string;
    mode: string;
    durationMinutes: number;
    distanceMeters: number;
  }>;
}> {
  return {
    distanceMeters:
      Math.round(
        Math.sqrt(
          Math.pow((destination.lat - origin.lat) * 111000, 2) +
            Math.pow((destination.lng - origin.lng) * 111000 * 0.8, 2),
        ),
      ),
    durationMinutes: mode === "walking" ? 30 : 15,
    steps: [],
  };
}

/**
 * 高德地理编码（mock）
 */
export async function geocodeAmap(
  _address: string,
): Promise<{ lat: number; lng: number } | null> {
  return null;
}

/**
 * 高德天气查询（mock）
 */
export async function getAmapWeather(
  _cityCode: string,
): Promise<Record<string, unknown>> {
  return {
    forecast: "晴",
    temperature: { low: 24, high: 33 },
    humidity: 65,
    wind: "东南风 3级",
  };
}

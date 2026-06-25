/**
 * PATH-WISE · 城市服务
 * 职责：城市知识库查询、POI 搜索
 *
 * MVP 阶段：从静态 mock 数据返回，后续接入 cities 表 + JSON 知识库
 */

import type { POI, POICategory } from "@path-wise/shared";
import { CityNotFoundError } from "../types/errors.js";

/** Mock POI 数据 */
const MOCK_POIS: Record<string, POI[]> = {
  "长沙": [
    {
      id: "cs_poi_001",
      name: "岳麓山风景区",
      category: "attraction",
      subCategory: "scenic_spot",
      tags: ["自然", "爬山", "摄影"],
      description: "岳麓山是南岳衡山七十二峰之一，可俯瞰湘江",
      location: { lat: 28.235, lng: 112.907, name: "岳麓山南门", address: "长沙市岳麓区" },
      estimatedDuration: 180,
      energyLevel: "HIGH",
      bestTimeSlots: ["morning"],
      crowdLevel: "high",
      suitableFor: ["couples", "friends", "family"],
      quality: { score: 0.95, lastVerified: "2026-06-01" },
    },
    {
      id: "cs_poi_002",
      name: "橘子洲头",
      category: "attraction",
      subCategory: "scenic_spot",
      tags: ["自然", "历史", "摄影"],
      description: "湘江中的狭长沙洲，毛泽东青年雕像所在地",
      location: { lat: 28.227, lng: 112.938, name: "橘子洲头", address: "长沙市岳麓区橘子洲" },
      estimatedDuration: 120,
      energyLevel: "MEDIUM",
      bestTimeSlots: ["afternoon"],
      crowdLevel: "high",
      suitableFor: ["couples", "family", "elders"],
      tips: ["周末 20:00~20:30 有烟花表演"],
      quality: { score: 0.92, lastVerified: "2026-06-01" },
    },
    {
      id: "cs_poi_003",
      name: "火宫殿",
      category: "dining",
      subCategory: "local_cuisine",
      tags: ["美食", "小吃", "老字号"],
      description: "长沙百年老字号，臭豆腐、糖油粑粑等传统小吃",
      location: { lat: 28.2, lng: 112.97, name: "火宫殿", address: "长沙市天心区坡子街" },
      estimatedDuration: 60,
      energyLevel: "LOW",
      bestTimeSlots: ["evening"],
      priceRange: { min: 30, max: 100 },
      quality: { score: 0.88, lastVerified: "2026-06-01" },
    },
  ],
  "北京": [
    {
      id: "bj_poi_001",
      name: "故宫博物院",
      category: "attraction",
      subCategory: "museum",
      tags: ["历史", "文化", "必去"],
      description: "明清两代皇宫，世界文化遗产",
      location: { lat: 39.916, lng: 116.397, name: "故宫", address: "北京市东城区景山前街4号" },
      estimatedDuration: 240,
      energyLevel: "HIGH",
      bestTimeSlots: ["morning"],
      bookingRequired: true,
      suitableFor: ["couples", "family", "elders", "friends"],
      priceRange: { min: 60, max: 60 },
      quality: { score: 0.98, lastVerified: "2026-06-01" },
    },
  ],
};

/**
 * 按城市名和可选分类搜索 POI
 */
export async function searchPOI(
  cityName: string,
  options?: { category?: POICategory; keyword?: string; energyLevel?: string },
): Promise<POI[]> {
  const pois = MOCK_POIS[cityName];
  if (!pois) {
    throw new CityNotFoundError(cityName);
  }

  let results = pois;

  if (options?.category) {
    results = results.filter((p) => p.category === options.category);
  }
  if (options?.keyword) {
    const kw = options.keyword.toLowerCase();
    results = results.filter(
      (p) =>
        p.name.includes(kw) ||
        p.tags?.some((t) => t.toLowerCase().includes(kw)) ||
        p.description?.includes(kw),
    );
  }
  if (options?.energyLevel) {
    results = results.filter((p) => p.energyLevel === options.energyLevel);
  }

  return results;
}

/**
 * 按 ID 获取 POI 详情
 */
export async function getPOIDetail(
  cityName: string,
  poiId: string,
): Promise<POI | null> {
  const pois = MOCK_POIS[cityName];
  if (!pois) {
    throw new CityNotFoundError(cityName);
  }
  return pois.find((p) => p.id === poiId) ?? null;
}

/**
 * 获取所有支持的城市名称
 */
export function getSupportedCities(): string[] {
  return Object.keys(MOCK_POIS);
}

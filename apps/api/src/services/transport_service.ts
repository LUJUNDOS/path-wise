/**
 * PATH-WISE · 交通服务
 * 职责：大交通方案查询、市内路线规划
 *
 * MVP 阶段：从静态 mock 数据返回，后续接入高德 API + 12306
 */

import type {
  TransportSearchRequest,
  TransportSearchResponse,
  TransportRouteOption,
  RoutePlanRequest,
  RoutePlanResponse,
} from "@path-wise/shared";

/** Mock 大交通方案 */
const MOCK_ROUTES: Record<string, TransportRouteOption[]> = {
  "北京-长沙": [
    {
      type: "high_speed_rail",
      trainNumber: "G79",
      departTime: "10:00",
      arriveTime: "15:42",
      durationMinutes: 342,
      pricePerPerson: { secondClass: 649, firstClass: 998 },
      availableSeats: 45,
      departureStation: "北京西站",
      arrivalStation: "长沙南站",
      bookingUrl: "https://www.12306.cn/",
      deepLink: { platform: "12306", url: "ctrip://train/G79" },
      note: "⚠️ 车次信息仅供参考，余票动态变化，请尽快到 12306 / 携程 / 飞猪查询预订",
    },
    {
      type: "normal_train",
      trainNumber: "Z1",
      departTime: "18:20",
      arriveTime: "次日 08:15",
      durationMinutes: 835,
      pricePerPerson: { 硬座: 156, 硬卧: 280, 软卧: 450 },
      availableSeats: { 硬座: 120, 硬卧: 30, 软卧: 10 },
      departureStation: "北京西站",
      arrivalStation: "长沙站",
      isOvernight: true,
      note: "⚠️ 隔夜车次，含卧铺。信息仅供参考，请及时订票",
    },
    {
      type: "flight",
      departTime: "08:30",
      arriveTime: "11:00",
      durationMinutes: 150,
      pricePerPerson: { 经济舱: 800, 商务舱: 2500 },
      departureStation: "北京首都机场",
      arrivalStation: "长沙黄花机场",
      bookingUrl: "https://www.ctrip.com/",
      deepLink: { platform: "ctrip", url: "ctrip://flight/CZ3123" },
      note: "每日 20+ 航班",
    },
  ],
};

/** Mock 市内路线 */
const MOCK_CITY_ROUTES: Record<string, RoutePlanResponse> = {
  default: {
    distanceMeters: 8500,
    durationMinutes: 35,
    steps: [
      {
        instruction: "从起点步行至最近公交站",
        mode: "walking",
        durationMinutes: 8,
        distanceMeters: 600,
      },
      {
        instruction: "乘坐地铁4号线（溁湾镇方向），2 站后下车",
        mode: "transit",
        lineName: "地铁4号线",
        durationMinutes: 12,
        stations: 2,
        distanceMeters: 4000,
      },
      {
        instruction: "步行至目的地",
        mode: "walking",
        durationMinutes: 10,
        distanceMeters: 700,
      },
    ],
    source: "amap_api",
  },
};

/**
 * 大交通方案查询
 */
export async function searchTransport(
  req: TransportSearchRequest,
): Promise<TransportSearchResponse> {
  const key = `${req.fromCity}-${req.toCity}`;
  const reverseKey = `${req.toCity}-${req.fromCity}`;
  const options =
    MOCK_ROUTES[key] ?? MOCK_ROUTES[reverseKey] ?? [];

  const filtered = req.prefer?.length
    ? options.filter((o) => req.prefer!.includes(o.type))
    : options;

  return {
    options: filtered.length > 0 ? filtered : options,
    source: "mock",
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
}

/**
 * 市内路线规划
 */
export async function planRoute(
  _req: RoutePlanRequest,
): Promise<RoutePlanResponse> {
  // MVP: 返回默认路线
  return MOCK_CITY_ROUTES.default;
}

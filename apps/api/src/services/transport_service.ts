/**
 * PATH-WISE · 交通服务
 * 职责：大交通方案查询、市内路线规划
 *
 * MVP 阶段：从静态 mock_cities.ts 数据返回，后续接入高德 API + 12306
 * 依据：docs/API接口设计规格书_v1.0.0.md §8（原 §7）
 */

import type {
  TransportSearchRequest,
  TransportSearchResponse,
  TransportRouteOption,
  RoutePlanRequest,
  RoutePlanResponse,
  RouteStep,
} from '@path-wise/shared';
import { ValidationError, NotFoundError } from '../types/errors.js';
import { CITY_DATA, getMockTransport, type TimePeriod } from '../data/mock_cities.js';

/** 时间时段小时范围映射（单位：小时） */
const TIME_PERIOD_HOUR_RANGE: Record<string, { start: number; end: number }> = {
  morning: { start: 5, end: 12 },
  afternoon: { start: 12, end: 18 },
  evening: { start: 18, end: 24 },
};

/** 普通列车速度比率（相对高铁） */
const NORMAL_TRAIN_SPEED_RATIO = 1.8;

/** 隔夜列车出发小时 */
const OVERNIGHT_DEPART_HOUR = 22;

/** 长途距离阈值（分钟），超过该时长的路线视为长途 */
const LONG_DISTANCE_THRESHOLD_MINUTES = 240;

/**
 * 简单的字符串哈希，将路线名映射为 0~899 的稳定整数
 * 用于 K 车次编号生成，确保同一条路线的 K 车次在多次调用中保持一致
 */
function simpleHash(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) % 900;
}

/** 出发时段映射到 mock_cities 的 TimePeriod */
function mapTimePeriod(period?: string): TimePeriod | undefined {
  if (!period) return undefined;
  if (period === 'morning' || period === 'afternoon' || period === 'evening') {
    return period as TimePeriod;
  }
  console.warn(`[transport_service] 未知的出发时段: "${period}"，已降级为全天`);
  return undefined;
}

/** 检查城市是否在 mock 知识库中 */
function isKnownCity(cityName: string): boolean {
  return CITY_DATA[cityName] !== undefined;
}

/**
 * 大交通方案查询
 *
 * 校验规则：
 * - 出发/到达城市不能为空
 * - 城市必须在知识库中存在（MVP 阶段）
 * - 支持 transport type 偏好过滤
 * - 支持出发时段过滤
 * - 支持多种交通方式（高铁/普通列车/飞机/大巴）
 *
 * @param params.date - 出发日期（MVP mock 模式暂未使用，TODO: 接入真实 API 后按日期过滤车次）
 */
export async function searchTransport(
  params: TransportSearchRequest,
): Promise<TransportSearchResponse> {
  // 1. 参数校验
  if (!params.fromCity || !params.fromCity.trim()) {
    throw new ValidationError('fromCity', '出发城市不能为空');
  }
  if (!params.toCity || !params.toCity.trim()) {
    throw new ValidationError('toCity', '目的城市不能为空');
  }

  const fromCity = params.fromCity.trim();
  const toCity = params.toCity.trim();

  if (fromCity === toCity) {
    throw new ValidationError('toCity', '出发城市与目的城市不能相同');
  }

  // 2. 城市存在于知识库（MVP 阶段必需）
  if (!isKnownCity(fromCity)) {
    throw new NotFoundError(`城市 "${fromCity}"`);
  }
  if (!isKnownCity(toCity)) {
    throw new NotFoundError(`城市 "${toCity}"`);
  }

  // 3. 获取基本交通方案（正反两个方向都查）
  const timePeriod = mapTimePeriod(params.departTimePeriod);
  const primaryTransport = getMockTransport(fromCity, toCity, timePeriod);

  // 4. 构建交通方案列表
  const allOptions: TransportRouteOption[] = [];

  // 主要高铁方案（第一条）
  allOptions.push({
    type: primaryTransport.type as TransportRouteOption['type'],
    trainNumber: primaryTransport.trainNumber,
    departTime: primaryTransport.departTime,
    arriveTime: primaryTransport.arriveTime,
    durationMinutes: primaryTransport.durationMinutes,
    pricePerPerson: { ...primaryTransport.pricePerPerson },
    departureStation: primaryTransport.departureStation,
    arrivalStation: primaryTransport.arrivalStation,
    bookingUrl: primaryTransport.bookingUrl,
    deepLink: primaryTransport.deepLink,
    isOvernight: primaryTransport.isOvernight,
    note: primaryTransport.note,
  });

  // 补充普通列车 + 飞机方案（仅长途路线，且不限定时段时追加）
  const isLongDistance = primaryTransport.durationMinutes > LONG_DISTANCE_THRESHOLD_MINUTES;
  if (isLongDistance && !timePeriod) {
    // 同一路线的普通列车（慢车）
    const normalTrainDuration = Math.round(
      primaryTransport.durationMinutes * NORMAL_TRAIN_SPEED_RATIO,
    );
    const overnightArriveMinutes = normalTrainDuration + OVERNIGHT_DEPART_HOUR * 60;
    allOptions.push({
      type: 'normal_train',
      trainNumber: `K${100 + simpleHash(`${fromCity}→${toCity}`)}`,
      departTime: `${OVERNIGHT_DEPART_HOUR}:00`,
      arriveTime: `次日 ${String(Math.floor(overnightArriveMinutes / 60) % 24).padStart(2, '0')}:${String(overnightArriveMinutes % 60).padStart(2, '0')}`,
      durationMinutes: normalTrainDuration,
      pricePerPerson: {
        硬座: Math.round(primaryTransport.pricePerPerson.secondClass! * 0.35),
        硬卧: Math.round(primaryTransport.pricePerPerson.secondClass! * 0.6),
        软卧: Math.round(primaryTransport.pricePerPerson.secondClass! * 0.95),
      },
      departureStation: primaryTransport.departureStation,
      arrivalStation: primaryTransport.arrivalStation,
      isOvernight: true,
      note: '⚠️ 隔夜车次，含卧铺。信息仅供参考，请及时订票',
    });
  }

  // 补充飞机方案（长途路线，且不限定时段时追加）
  if (isLongDistance && !timePeriod) {
    const flightDuration = Math.round(primaryTransport.durationMinutes * 0.45);
    allOptions.push({
      type: 'flight',
      departTime: '08:30',
      arriveTime: `${String(Math.floor((flightDuration + 8 * 60 + 30) / 60) % 24).padStart(2, '0')}:${String((flightDuration + 8 * 60 + 30) % 60).padStart(2, '0')}`,
      durationMinutes: flightDuration,
      pricePerPerson: {
        经济舱: Math.round(primaryTransport.pricePerPerson.secondClass! * 1.3),
        商务舱: Math.round(primaryTransport.pricePerPerson.secondClass! * 4),
      },
      departureStation: `${fromCity}机场`,
      arrivalStation: `${toCity}机场`,
      bookingUrl: 'https://www.ctrip.com/',
      deepLink: { platform: 'ctrip', url: `ctrip://flight/${fromCity}-${toCity}` },
      note: `每日多班航班，建议提前订票`,
    });
  }

  // 5. 按偏好过滤
  let filtered = allOptions;
  if (params.prefer && params.prefer.length > 0) {
    filtered = allOptions.filter((o) => params.prefer!.includes(o.type));
    if (filtered.length === 0) {
      // 没有匹配的偏好交通方式时，返回全部（并追加提示）
      filtered = allOptions;
    }
  }

  // 6. 按出发时段过滤
  if (timePeriod) {
    const { start, end } = TIME_PERIOD_HOUR_RANGE[timePeriod];
    filtered = filtered.filter((o) => {
      const [h] = o.departTime.split(':').map(Number);
      return h >= start && h < end;
    });
    if (filtered.length === 0) {
      // 时段过滤后无结果，放宽到全天
      filtered = allOptions;
    }
  }

  return {
    options: filtered,
    source: 'mock',
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
}

/** 各出行模式平均速度（米/分钟） */
const AVERAGE_SPEED_M_PER_MIN: Record<string, number> = {
  driving: 500, // 市区约 30 km/h
  transit: 400, // 含步行 + 等车
  cycling: 250, // 约 15 km/h
  walking: 83, // 约 5 km/h
};

/**
 * 根据经纬度近似计算两点间距离（米）
 *
 * 使用简化的球面距离公式：
 *   latDiff * 111_000 = 纬度差转米（1° ≈ 111km）
 *   lngDiff * 111_000 * cos(avgLat) = 经度差转米
 *   使用中点纬度的余弦值，比固定值更准确
 *
 * @param origin - 起点坐标 { lat, lng }
 * @param destination - 终点坐标 { lat, lng }
 * @returns 近似距离（米）
 */
function approximateDistanceMeters(
  origin: { lat: number; lng: number },
  destination: { lat: number; lng: number },
): number {
  const latDiff = (destination.lat - origin.lat) * 111_000;
  const avgLat = (((origin.lat + destination.lat) / 2) * Math.PI) / 180;
  const factor = Math.cos(avgLat);
  const lngDiff = (destination.lng - origin.lng) * 111_000 * factor;
  return Math.round(Math.sqrt(latDiff * latDiff + lngDiff * lngDiff));
}

/**
 * 市内路线规划
 *
 * 基于高德 API 适配器（MVP 阶段使用 mock，后续接入 amap_adapter）
 */
export async function planRoute(params: RoutePlanRequest): Promise<RoutePlanResponse> {
  // 1. 参数校验
  if (!params.city || !params.city.trim()) {
    throw new ValidationError('city', '城市名称不能为空');
  }

  const city = params.city.trim();

  if (!isKnownCity(city)) {
    throw new NotFoundError(`城市 "${city}"`);
  }

  if (
    !params.origin ||
    typeof params.origin.lat !== 'number' ||
    typeof params.origin.lng !== 'number'
  ) {
    throw new ValidationError('origin', '起点坐标不能为空');
  }
  if (
    !params.destination ||
    typeof params.destination.lat !== 'number' ||
    typeof params.destination.lng !== 'number'
  ) {
    throw new ValidationError('destination', '终点坐标不能为空');
  }

  const validModes = ['driving', 'transit', 'walking', 'cycling'];
  if (params.mode && !validModes.includes(params.mode)) {
    throw new ValidationError('mode', `无效的出行模式，支持: ${validModes.join(', ')}`);
  }

  const mode = params.mode || 'transit';

  // 2. 计算距离和时长
  const distanceMeters = approximateDistanceMeters(params.origin, params.destination);

  if (distanceMeters < 10) {
    return {
      distanceMeters,
      durationMinutes: 1,
      steps: [
        {
          instruction: '起点和终点距离很近，步行即可到达',
          mode: 'walking',
          durationMinutes: 1,
          distanceMeters,
        },
      ],
      source: 'mock',
    };
  }

  // 3. 根据模式生成路线步骤
  const steps = generateRouteSteps(
    params.origin.name || '起点',
    params.destination.name || '终点',
    distanceMeters,
    mode,
  );

  const speed = AVERAGE_SPEED_M_PER_MIN[mode] || 400;
  const durationMinutes = Math.max(1, Math.round(distanceMeters / speed));

  return {
    distanceMeters,
    durationMinutes,
    steps,
    source: 'mock',
  };
}

/**
 * 根据出发/到达点与距离生成路线步骤
 *
 * 每种出行模式生成 3 步路线指示。各步按比例分配总距离，
 * 最后一步的 distanceMeters 和 durationMinutes 会修正为
 * 使所有步骤之和等于总距离，确保数值一致性。
 */
function generateRouteSteps(
  originName: string,
  destName: string,
  _distanceMeters: number,
  mode: string,
): RouteStep[] {
  const totalDistance = _distanceMeters;

  // 以 transit 模式为基准权重计算各步占比（total = 5000）
  const stepBaseWeights: Record<string, number[]> = {
    walking: [600, 400, 50],
    cycling: [1500, 1000, 50],
    driving: [2500, 1500, 200],
    transit: [600, 4000, 400],
  };
  const stepWeightSum: Record<string, number> = {
    walking: 1050,
    cycling: 2550,
    driving: 4200,
    transit: 5000,
  };

  const weights = stepBaseWeights[mode] || stepBaseWeights.transit;
  const weightSum = stepWeightSum[mode] || stepWeightSum.transit;

  // 按权重分配距离，前两步按比例，第三步用剩余量补齐
  const rawSteps = [];
  let allocatedDistance = 0;
  for (let i = 0; i < weights.length; i++) {
    const isLast = i === weights.length - 1;
    const portion = isLast
      ? totalDistance - allocatedDistance
      : Math.round((totalDistance * weights[i]) / weightSum);
    rawSteps.push(portion);
    allocatedDistance += portion;
  }

  // 确保最后一步至少为 1（距离极小场景）
  if (rawSteps[rawSteps.length - 1] <= 0) {
    const deficit = 1 - rawSteps[rawSteps.length - 1];
    rawSteps[rawSteps.length - 1] = 1;
    rawSteps[rawSteps.length - 2] -= deficit;
  }

  switch (mode) {
    case 'walking':
      return [
        {
          instruction: `从${originName}出发，沿主路步行`,
          mode: 'walking',
          durationMinutes: Math.max(1, Math.round(rawSteps[0] / 83)),
          distanceMeters: rawSteps[0],
        },
        {
          instruction: `继续步行前往${destName}`,
          mode: 'walking',
          durationMinutes: Math.max(1, Math.round(rawSteps[1] / 83)),
          distanceMeters: rawSteps[1],
        },
        {
          instruction: `到达${destName}`,
          mode: 'walking',
          durationMinutes: Math.max(1, Math.round(rawSteps[2] / 83)),
          distanceMeters: rawSteps[2],
        },
      ];

    case 'cycling':
      return [
        {
          instruction: `从${originName}出发，沿自行车道骑行`,
          mode: 'cycling',
          durationMinutes: Math.max(1, Math.round(rawSteps[0] / 250)),
          distanceMeters: rawSteps[0],
        },
        {
          instruction: `继续骑行前往${destName}`,
          mode: 'cycling',
          durationMinutes: Math.max(1, Math.round(rawSteps[1] / 250)),
          distanceMeters: rawSteps[1],
        },
        {
          instruction: `到达${destName}`,
          mode: 'cycling',
          durationMinutes: Math.max(1, Math.round(rawSteps[2] / 250)),
          distanceMeters: rawSteps[2],
        },
      ];

    case 'driving':
      return [
        {
          instruction: `从${originName}出发，沿主干道行驶`,
          mode: 'driving',
          durationMinutes: Math.max(1, Math.round(rawSteps[0] / 500)),
          distanceMeters: rawSteps[0],
        },
        {
          instruction: `继续行驶前往${destName}`,
          mode: 'driving',
          durationMinutes: Math.max(1, Math.round(rawSteps[1] / 500)),
          distanceMeters: rawSteps[1],
        },
        {
          instruction: `到达${destName}附近，寻找停车位`,
          mode: 'driving',
          durationMinutes: Math.max(1, Math.round(rawSteps[2] / 500)),
          distanceMeters: rawSteps[2],
        },
      ];

    case 'transit':
    default:
      return [
        {
          instruction: `从${originName}步行至最近公交站/地铁站`,
          mode: 'walking',
          durationMinutes: Math.max(1, Math.round(rawSteps[0] / 83)),
          distanceMeters: rawSteps[0],
        },
        {
          instruction: '乘坐地铁前往目的地',
          mode: 'transit',
          lineName: '地铁线路',
          durationMinutes: Math.max(1, Math.round(rawSteps[1] / 400)),
          stations: Math.max(1, Math.round((3 * rawSteps[1]) / 4000)),
          distanceMeters: rawSteps[1],
        },
        {
          instruction: `步行至${destName}`,
          mode: 'walking',
          durationMinutes: Math.max(1, Math.round(rawSteps[2] / 83)),
          distanceMeters: rawSteps[2],
        },
      ];
  }
}

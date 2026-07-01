/**
 * PATH-WISE · 住宿服务
 * 职责：住宿推荐查询、预约链接生成
 *
 * MVP 阶段：从静态 CITY_DATA 返回，后续接入 OTA API
 * 依据：docs/API接口设计规格书_v1.0.0.md §8.3
 *      docs/旅游攻略生成平台_SRS.md
 */

import type {
  AccommodationSearchRequest,
  AccommodationSearchResponse,
  AccommodationSearchOption,
  AccommodationBookingRequest,
  AccommodationBookingResponse,
} from '@path-wise/shared';
import { ValidationError, NotFoundError } from '../types/errors.js';
import { CITY_DATA } from '../data/mock_cities.js';
import { isISODate } from '../utils/date_utils.js';

/** 预算等级映射到价格上限（每晚 CNY） */
const BUDGET_MAX_PRICE: Record<string, number> = {
  economy: 500,
  comfort: 1500,
  luxury: 99999,
};

/** 位置偏好匹配（通过酒店描述和地址判断） */
const LOCATION_KEYWORDS: Record<string, string[]> = {
  center: ['市中心', '商圈', '广场', '步行街', '核心', '繁华'],
  near_station: ['站', '地铁', '高铁', '火车站', '交通'],
  near_attraction: ['景区', '景点', '公园', '博物院', '外滩', '西湖', '岳麓', '故宫', '迪士尼'],
};

/** 暑期月份范围（含首尾） */
const SUMMER_MONTHS = { start: 6, end: 8 };

/** 暑期热门城市 */
const PEAK_SEASON_CITIES = ['北京', '上海', '杭州', '厦门'];

/** 房型英文 key → 中文显示名映射 */
const ROOM_TYPE_DISPLAY: Record<string, string> = {
  twin: '标准双床房',
  double: '大床房',
  family: '家庭房',
};

/** 房间类型推断：根据出行人群特征，返回英文房型 key */
function inferRoomType(
  travelers: AccommodationSearchRequest['travelers'],
  requestedType?: string,
): string {
  if (requestedType) {
    // 请求的是英文 key 直接返回，中文值则尝试反向匹配
    if (requestedType in ROOM_TYPE_DISPLAY) return requestedType;
    const reverse = Object.entries(ROOM_TYPE_DISPLAY).find(([, v]) => v === requestedType);
    if (reverse) return reverse[0];
    return requestedType;
  }

  const totalAdults = travelers.adults;
  const childCount = travelers.children.length;

  if (childCount > 0) return 'family';
  if (totalAdults >= 3) return 'family';
  if (totalAdults === 2) return 'twin';
  return 'double';
}

/**
 * 按关键词匹配度排序的通用工具函数
 * @param items - 待排序的数据项
 * @param extractText - 从数据项提取待匹配文本的函数
 * @param keywords - 匹配关键词数组
 * @returns 按匹配度降序排列的新数组
 */
function sortByKeywordMatch<T>(
  items: T[],
  extractText: (item: T) => string,
  keywords: string[],
): T[] {
  if (keywords.length === 0) return [...items];
  const scored = items.map((item) => {
    const text = extractText(item);
    const score = keywords.filter((k) => text.includes(k)).length;
    return { item, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.item);
}

/**
 * 住宿推荐查询
 *
 * 功能：
 * - 按城市、日期、预算、偏好筛选酒店
 * - 支持位置偏好（市中心/近车站/近景区）
 * - 支持设施偏好（wifi/elevator/breakfast/...）
 * - 根据出行人特征推断房型
 * - 返回主选 + 备选方案
 */
export async function searchAccommodation(
  params: AccommodationSearchRequest,
): Promise<AccommodationSearchResponse> {
  // 1. 参数校验
  if (!params.cityName || !params.cityName.trim()) {
    throw new ValidationError('cityName', '城市名称不能为空');
  }

  const cityName = params.cityName.trim();
  const cityData = CITY_DATA[cityName];

  if (!cityData) {
    throw new NotFoundError(`城市 "${cityName}"`);
  }

  if (!params.checkInDate || !isISODate(params.checkInDate)) {
    throw new ValidationError('checkInDate', '入住日期格式错误，应为 YYYY-MM-DD');
  }

  if (!params.checkOutDate || !isISODate(params.checkOutDate)) {
    throw new ValidationError('checkOutDate', '退房日期格式错误，应为 YYYY-MM-DD');
  }

  if (new Date(params.checkOutDate) <= new Date(params.checkInDate)) {
    throw new ValidationError('checkOutDate', '退房日期必须晚于入住日期');
  }

  if (params.travelers.adults <= 0) {
    throw new ValidationError('travelers.adults', '成人数量至少为 1');
  }

  const maxPrice = BUDGET_MAX_PRICE[params.budget] ?? BUDGET_MAX_PRICE.comfort;
  const roomTypeKey = inferRoomType(params.travelers, params.preferences?.roomType);
  const roomTypeDisplay = ROOM_TYPE_DISPLAY[roomTypeKey] || roomTypeKey;
  const locationPref = params.preferences?.location;
  const amenityPrefs = params.preferences?.amenities || [];

  // 2. 筛选酒店
  let hotels = cityData.hotels || [];

  // 按预算过滤
  hotels = hotels.filter((h) => h.pricePerNight <= maxPrice);

  // 按位置偏好打分排序
  if (locationPref) {
    const keywords = LOCATION_KEYWORDS[locationPref] || [];
    hotels = sortByKeywordMatch(hotels, (h) => (h.address || '') + (h.reason || ''), keywords);
  }

  // 按设施偏好过滤（仅在有明确要求时过滤）
  if (amenityPrefs.length > 0) {
    const filtered = hotels.filter((h) => {
      const hotelAmenities = (h.amenities || []).map((a) => a.toLowerCase());
      return amenityPrefs.every((pref) =>
        hotelAmenities.some((a) => a.includes(pref.toLowerCase())),
      );
    });
    if (filtered.length > 0) {
      hotels = filtered;
    }
    // 设施过滤无结果时不过滤（降级返回全部）
  }

  // 3. 构建响应方案
  const checkInDate = new Date(params.checkInDate);
  const checkOutDate = new Date(params.checkOutDate);
  const nights = Math.ceil(
    (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  const options: AccommodationSearchOption[] = hotels.map((h) => ({
    name: h.name,
    address: h.address,
    location: { lat: 0, lng: 0 }, // MVP 阶段不提供精确坐标
    roomType: roomTypeDisplay,
    pricePerNight: h.pricePerNight,
    totalPrice: h.pricePerNight * nights,
    amenities: h.amenities || [],
    distanceToCenter: 0,
    distanceToAttractions: {},
    bookingUrl: 'https://m.ctrip.com/',
    deepLink: {
      platform: 'ctrip',
      url: `ctrip://hotel/search?city=${encodeURIComponent(cityName)}`,
    },
    availability: 'available',
    reason: h.reason,
  }));

  // 4. 生成预订提示（根据城市热门程度和入住月份动态调整）
  const checkInMonth = checkInDate.getMonth() + 1; // 0-based → 1-based
  const isSummer = checkInMonth >= SUMMER_MONTHS.start && checkInMonth <= SUMMER_MONTHS.end;
  const isPeakCity = PEAK_SEASON_CITIES.includes(cityName);
  let bookingTip: string;
  if (isPeakCity && isSummer) {
    bookingTip = '暑期热门城市，建议提前 1~2 周预订以确保有房';
  } else if (isSummer) {
    bookingTip = '暑期出行旺季，建议提前 1 周预订';
  } else {
    bookingTip = '预订相对容易，但仍建议提前安排';
  }

  return {
    cityName,
    checkInDate: params.checkInDate,
    options,
    bookingTip,
  };
}

/**
 * 生成预约链接
 *
 * MVP 阶段：返回 mock 的 OTA 跳转链接
 */
export async function createBooking(
  params: AccommodationBookingRequest,
): Promise<AccommodationBookingResponse> {
  if (!params.checkInDate || !isISODate(params.checkInDate)) {
    throw new ValidationError('checkInDate', '入住日期格式错误');
  }
  if (!params.checkOutDate || !isISODate(params.checkOutDate)) {
    throw new ValidationError('checkOutDate', '退房日期格式错误');
  }

  return {
    bookingUrl: `https://m.ctrip.com/hotel/booking?option=${params.optionIndex}`,
    deepLink: { platform: 'ctrip', url: `ctrip://hotel/booking?option=${params.optionIndex}` },
    confirmationCode: `BK${Date.now().toString(36).toUpperCase()}`,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
}

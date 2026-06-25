/**
 * PATH-WISE · 住宿服务
 * 职责：住宿推荐查询、预约链接生成
 *
 * MVP 阶段：从静态 mock 数据返回
 */

import type {
  AccommodationSearchRequest,
  AccommodationSearchResponse,
  AccommodationSearchOption,
  AccommodationBookingRequest,
  AccommodationBookingResponse,
} from '@path-wise/shared';

/** Mock 住宿方案 */
const MOCK_HOTELS: Record<string, AccommodationSearchOption[]> = {
  长沙: [
    {
      name: '长沙IFS国金中心亚朵酒店',
      address: '长沙市芙蓉区解放西路188号',
      location: { lat: 28.195, lng: 112.977 },
      roomType: '标准双床房',
      pricePerNight: 480,
      totalPrice: 1440,
      amenities: ['wifi', 'elevator', 'breakfast', 'laundry'],
      distanceToCenter: 0,
      distanceToAttractions: {
        岳麓山: '15 分钟车程',
        橘子洲头: '10 分钟车程',
      },
      bookingUrl: 'https://m.ctrip.com/hotel/changsha/12345',
      deepLink: { platform: 'ctrip', url: 'ctrip://hotel/12345' },
      availability: 'available',
      reason: '位于市中心，前往各景点交通便利，含早餐',
    },
    {
      name: '岳麓山精品民宿',
      address: '长沙市岳麓区爱民路88号',
      location: { lat: 28.18, lng: 112.93 },
      roomType: '大床房',
      pricePerNight: 320,
      totalPrice: 960,
      amenities: ['wifi', 'garden', 'breakfast'],
      distanceToCenter: 5,
      distanceToAttractions: {
        岳麓山: '步行 5 分钟',
        橘子洲头: '20 分钟车程',
      },
      availability: 'few_left',
      reason: '紧邻岳麓山，环境清幽，适合喜欢自然的旅客',
    },
  ],
};

/**
 * 住宿推荐查询
 */
export async function searchAccommodation(
  req: AccommodationSearchRequest,
): Promise<AccommodationSearchResponse> {
  const options = MOCK_HOTELS[req.cityName] ?? [];

  // 按预算过滤（模拟）
  const budgetMap: Record<string, number> = {
    economy: 200,
    comfort: 500,
    luxury: 1000,
  };
  const maxPrice = budgetMap[req.budget] ?? 500;
  const filtered = options.filter((o) => o.pricePerNight <= maxPrice);

  return {
    cityName: req.cityName,
    checkInDate: req.checkInDate,
    options: filtered.length > 0 ? filtered : options,
    bookingTip: '建议提前 3~5 天预订，暑期房源紧张',
  };
}

/**
 * 生成预约链接
 */
export async function createBooking(
  req: AccommodationBookingRequest,
): Promise<AccommodationBookingResponse> {
  return {
    bookingUrl: 'https://m.ctrip.com/hotel/booking/12345',
    deepLink: { platform: 'ctrip', url: 'ctrip://hotel/booking/12345' },
    confirmationCode: `BK${Date.now().toString(36).toUpperCase()}`,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
  };
}

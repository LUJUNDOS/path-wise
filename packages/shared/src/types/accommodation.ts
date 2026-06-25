/**
 * PATH-WISE · 住宿类型
 * 依据：docs/API接口设计规格书_v1.0.0.md §8.3（原 §7.3）
 */

import type { BudgetLevel } from "./base.js";

/** 住宿搜索请求 */
export interface AccommodationSearchRequest {
  cityName: string;
  checkInDate: string; // YYYY-MM-DD
  checkOutDate: string; // YYYY-MM-DD
  budget: BudgetLevel;
  preferences?: {
    location?: "center" | "near_station" | "near_attraction";
    amenities?: string[];
    roomType?: "twin" | "double" | "family";
  };
  travelers: {
    adults: number;
    children: { age: number }[];
  };
}

/** 住宿方案 */
export interface AccommodationSearchOption {
  name: string;
  address: string;
  location: { lat: number; lng: number };
  roomType: string;
  pricePerNight: number;
  totalPrice: number;
  amenities: string[];
  distanceToCenter: number;
  distanceToAttractions?: Record<string, string>;
  bookingUrl?: string;
  deepLink?: {
    platform: string;
    url: string;
  };
  availability: "available" | "few_left" | "sold_out";
  reason: string;
}

/** 住宿搜索响应 */
export interface AccommodationSearchResponse {
  cityName: string;
  checkInDate: string;
  options: AccommodationSearchOption[];
  bookingTip?: string;
}

/** 预约链接请求 */
export interface AccommodationBookingRequest {
  optionIndex: number;
  checkInDate: string;
  checkOutDate: string;
  roomType: string;
}

/** 预约链接响应 */
export interface AccommodationBookingResponse {
  bookingUrl: string;
  deepLink?: {
    platform: string;
    url: string;
  };
  confirmationCode?: string;
  expiresAt: string;
}

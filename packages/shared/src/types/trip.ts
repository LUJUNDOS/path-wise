/**
 * PATH-WISE · 攻略核心类型
 * 依据：docs/API接口设计规格书_v1.0.0.md §4（v1.0.6）
 */

import type {
  BudgetLevel,
  DayType,
  EnergyLevel,
  GeoPoint,
  PaceLevel,
  TimePeriod,
  TimelineItemType,
  TravelerGroup,
  TransportType,
} from './base.js';

// ===== 请求类型 =====

/** 出发信息 */
export interface Departure {
  city: string;
  date: string; // YYYY-MM-DD
  timePeriod: TimePeriod;
}

/** 单个目的地 */
export interface Destination {
  cityName: string;
  days: number;
  transportTo: TransportType | null; // 第一个城市无上一站交通
}

/** 用户偏好 */
export interface TripPreferences {
  budget: BudgetLevel;
  pace: PaceLevel;
  accommodation: string;
  dining: string[];
  interests: string[];
}

/** 生成选项 */
export interface TripOptions {
  streamProgress?: boolean; // 默认 true
  includeAlternatives?: boolean; // 默认 true
  language?: string; // "zh-CN"
  maxProcessingSeconds?: number; // 最大生成时间
}

/** 攻略生成请求体 */
export interface TripGenerateRequest {
  departure: Departure;
  destinations: Destination[];
  travelers: TravelerGroup;
  preferences: TripPreferences;
  needsReturnTransport?: boolean; // 默认 true，是否预定返程票
  returnTransportPref?: TransportType | 'auto'; // 返程偏好，默认 auto
  options?: TripOptions;
}

/** 重新生成某天请求 */
export interface TripRegenerateRequest {
  dayIndex: number;
  reason?: 'user_dislike' | 'weather_change' | 'preference_update' | 'suggestion_accepted';
  constraints?: {
    avoidPoiIds?: string[];
    mustIncludePoiIds?: string[];
    maxEnergyLevel?: EnergyLevel;
  };
  keepUnchanged?: boolean;
  acceptedSuggestions?: string[];
}

/** 修改单天行程请求 */
export interface DayUpdateRequest {
  timeline: TimelineItemUpdate[];
  userModified: boolean; // 标记为用户手动修改
  modificationNote?: string;
}

/** 时间轴条目更新 */
export interface TimelineItemUpdate {
  id: string;
  type?: TimelineItemType;
  poiId?: string;
  startTime?: string; // HH:mm
  endTime?: string; // HH:mm
  notes?: string;
}

// ===== 响应类型 =====

/** 时间轴条目 */
export interface TimelineItem {
  id: string;
  type: TimelineItemType;
  title: string;
  description?: string;
  location?: GeoPoint;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  estimatedDuration: number; // 分钟
  estimatedCostCNY: number;
  energyLevel: EnergyLevel;
  bookingRequired: boolean;
  bookingUrl?: string | null;
  deepLink?: {
    platform: string;
    url: string;
  } | null;
  alternatives?: TimelineItem[];
}

/** 住宿推荐 */
export interface AccommodationOption {
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  primary: HotelOption;
  backup: HotelOption;
}

export interface HotelOption {
  name: string;
  address: string;
  pricePerNight: number;
  totalPrice: number;
  reason: string;
  amenities?: string[];
  location?: GeoPoint;
  bookingUrl?: string;
  deepLink?: { platform: string; url: string };
}

/** 日计划 */
export interface DayPlan {
  dayIndex: number;
  date: string; // YYYY-MM-DD
  dayType: DayType;
  cityName: string;
  isFirstDayOfCity: boolean;
  title: string;
  timeline: TimelineItem[];
  accommodation?: AccommodationOption | null;
  transport?: Record<string, unknown> | null;
  weather?: Record<string, unknown> | null;
  tips: string[];
}

/** 攻略响应 */
export interface TripResponse {
  tripId: string;
  title: string;
  generateTime?: string; // ISO 8601
  totalDays: number;
  totalEstimatedCostCNY?: number;
  departureCity: string;
  status: string;
  days: DayPlan[];
  accommodations?: AccommodationOption[];
  budgetBreakdown?: Record<string, number>;
  shareUrl?: string;
}

/** 攻略摘要（列表用） */
export interface TripSummary {
  tripId: string;
  title: string;
  totalDays: number;
  departureCity: string;
  status: string;
  isPublic: boolean;
  createdAt: string;
}

/** 校验冲突 */
export interface TripConflict {
  type: string;
  severity: 'warning' | 'error';
  message: string;
  suggestion?: {
    action: string;
    value: string;
  };
}

/** 校验响应 */
export interface TripValidationResponse {
  valid: boolean;
  conflicts: TripConflict[];
}

/** 生成进度 */
export interface GenerationProgress {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: {
    percent: number;
    currentStep: string;
    stepsCompleted: number;
    totalSteps: number;
    estimatedRemainingSeconds: number;
  };
  partialResult?: TripResponse | null;
  tripId?: string | null;
}

/** 攻略导出请求参数 */
export interface ExportOptions {
  format: 'pdf' | 'image' | 'text' | 'html';
  size?: string; // 图片尺寸，如 "1080x1920"
}

/** 攻略导出响应 */
export interface ExportResponse {
  exportId: string;
  status: 'ready' | 'processing';
  downloadUrl?: string;
  expiresAt?: string;
  format: string;
  sizeBytes?: number;
  estimatedSeconds?: number;
  pollUrl?: string;
}

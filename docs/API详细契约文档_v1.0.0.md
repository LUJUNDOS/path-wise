# API 详细契约文档

**版本**：v1.0.0  
**日期**：2026-06-22  
**状态**：待评审  
**作者**：软件架构师  
**关联文档**：API接口设计规格书\_v1.0.0.md、前后端接口契约文档\_v1.0.0.md

---

## 说明

本文档提供所有 API 接口的完整 TypeScript 类型定义，可直接复制到项目 `packages/shared/src/types/api.ts` 中使用，实现前后端端到端类型安全。

**使用方式**：

- 前端：`import { GeneratePlanRequest, GeneratePlanResponse } from '@pathwise/shared'`
- 后端：`import { GeneratePlanRequest, GeneratePlanResponse } from '@pathwise/shared'`

---

## 目录

1. [公共类型](#1-公共类型)
2. [城市与景点](#2-城市与景点)
3. [行程规划](#3-行程规划)
4. [大交通](#4-大交通)
5. [天气](#5-天气)
6. [用户认证](#6-用户认证)
7. [错误类型](#7-错误类型)
8. [SSE 事件类型](#8-sse-事件类型)

---

## 1. 公共类型

```typescript
// ============================================================
// 文件：packages/shared/src/types/common.ts
// ============================================================

/**
 * 统一 API 响应包装
 */
export interface ApiResponse<T = unknown> {
  code: 0 | number; // 0 表示成功，非 0 表示错误
  message?: string; // 错误信息（成功时可省略）
  data: T; // 响应数据
  traceId?: string; // 链路追踪 ID（用于排查问题）
  timestamp: string; // 响应时间（ISO 8601）
}

/**
 * 分页参数
 */
export interface PaginationParams {
  page?: number; // 页码（从 1 开始，默认 1）
  pageSize?: number; // 每页条数（默认 20，最大 100）
}

/**
 * 基于游标的分页参数（推荐使用，性能更好）
 */
export interface CursorPaginationParams {
  first?: number; // 获取条数（默认 20，最大 100）
  after?: string; // 游标（上一页最后一条记录的 ID）
}

/**
 * 分页响应
 */
export interface PaginatedResponse<T> {
  items: T[];
  pageInfo: {
    hasNextPage: boolean;
    endCursor?: string; // 最后一条记录的游标
    totalCount?: number; // 总条数（可选，性能消耗较大）
  };
}

/**
 * 旅行者信息
 */
export interface Travelers {
  adults: number; // 成人（18岁以上），最少 1 人
  children: number; // 儿童（2-17岁）
  infants?: number; // 婴儿（0-2岁，部分交通需要额外计费）
  elders?: number; // 老人（65岁以上，享受优惠票）
}

/**
 * 日期范围
 */
export interface DateRange {
  startDate: string; // 开始日期（ISO 8601 date，如 "2026-07-01"）
  endDate: string; // 结束日期（ISO 8601 date，如 "2026-07-05"）
}

/**
 * 坐标
 */
export interface LatLng {
  lat: number; // 纬度（-90 ~ 90）
  lng: number; // 经度（-180 ~ 180）
}

/**
 * 金额（人民币，单位：分，避免浮点精度问题）
 */
export type Money = number;

/**
 * 时长（分钟）
 */
export type Minutes = number;
```

---

## 2. 城市与景点

```typescript
// ============================================================
// 文件：packages/shared/src/types/city.ts
// ============================================================

/**
 * 城市信息
 */
export interface City {
  id: string; // 城市 ID（如 "beijing"，英文小写）
  name: string; // 城市名称（中文，如 "北京"）
  nameEn: string; // 城市英文名（如 "Beijing"）
  province: string; // 所属省份（如 "北京市"）
  coverImage?: string; // 封面图片 URL
  description?: string; // 城市简介
  tags?: string[]; // 标签（如 ["历史文化", "美食"]）
  avgDays: number; // 推荐游玩天数（整数，如 3）
  bestSeasons: Season[]; // 最佳游玩季节
  location: LatLng; // 城市坐标（用于地图展示）
  timezone: string; // 时区（如 "Asia/Shanghai"）
}

/**
 * 季节枚举
 */
export type Season = "spring" | "summer" | "autumn" | "winter";

// ------------------- 接口类型 -------------------

/** GET /api/v1/cities - 请求参数 */
export interface ListCitiesParams extends CursorPaginationParams {
  keyword?: string; // 搜索关键词（城市名称）
  province?: string; // 按省份筛选
}

/** GET /api/v1/cities - 响应 */
export type ListCitiesResponse = ApiResponse<PaginatedResponse<City>>;

/** GET /api/v1/cities/:cityId - 响应 */
export type GetCityResponse = ApiResponse<City>;

// ============================================================
// 景点类型
// ============================================================

/**
 * 景点分类
 */
export type AttractionCategory =
  | "nature" // 自然景观（山、湖、海、森林）
  | "history" // 历史文化（古迹、博物馆）
  | "food" // 美食（特色餐厅、夜市、市集）
  | "entertainment" // 娱乐休闲（主题公园、购物中心）
  | "religion" // 宗教场所（寺庙、教堂）
  | "art" // 艺术创意（画廊、创意园区）
  | "sport" // 运动户外（徒步、攀岩）
  | "shopping"; // 购物（商业街、特产市场）

/**
 * 景点信息
 */
export interface Attraction {
  id: string;
  cityId: string;
  name: string; // 景点名称
  nameEn?: string; // 英文名
  category: AttractionCategory;
  subcategory?: string; // 二级分类（如 "古迹" 属于 "history"）
  description: string; // 景点描述
  address: string; // 详细地址
  location: LatLng;
  images: string[]; // 图片 URL 列表
  coverImage: string; // 封面图片 URL
  rating?: number; // 评分（1.0 - 5.0）
  ratingCount?: number; // 评分人数
  priceType: "free" | "paid" | "optional"; // 收费类型
  ticketPrice?: {
    adult: Money; // 成人票价（分）
    child?: Money; // 儿童票价
    elder?: Money; // 老人票价
    currency: "CNY";
  };
  openingHours: OpeningHours;
  visitDurationMinutes: Minutes; // 建议游玩时长
  tags?: string[];
  tips?: string[]; // 旅游小贴士
  nearbyAttractions?: string[]; // 周边景点 ID（用于推荐）
  trafficInfo?: string; // 交通信息（文本描述）
  priority: "must_visit" | "recommended" | "optional"; // 推荐优先级
}

/**
 * 营业时间
 */
export interface OpeningHours {
  isOpen24h: boolean;
  schedule?: {
    [key in
      | "monday"
      | "tuesday"
      | "wednesday"
      | "thursday"
      | "friday"
      | "saturday"
      | "sunday"]?: {
      open: string; // 开放时间（HH:MM 格式）
      close: string; // 关闭时间（HH:MM 格式）
      closed?: boolean; // 是否当天不开放
    };
  };
  notes?: string; // 特殊说明（如 "法定节假日延长开放"）
}

// ------------------- 接口类型 -------------------

/** GET /api/v1/cities/:cityId/attractions - 请求参数 */
export interface ListAttractionsParams extends CursorPaginationParams {
  category?: AttractionCategory;
  priority?: "must_visit" | "recommended" | "optional";
  keyword?: string;
  sort?: "rating" | "visitDuration" | "price";
  sortOrder?: "asc" | "desc";
}

/** GET /api/v1/cities/:cityId/attractions - 响应 */
export type ListAttractionsResponse = ApiResponse<
  PaginatedResponse<Attraction>
>;

/** GET /api/v1/attractions/:attractionId - 响应 */
export type GetAttractionResponse = ApiResponse<Attraction>;
```

---

## 3. 行程规划

```typescript
// ============================================================
// 文件：packages/shared/src/types/plan.ts
// ============================================================

/**
 * 大交通类型
 */
export type TransportType =
  | "high_speed_rail" // 高铁（P0）
  | "normal_train" // 普速火车（P0）
  | "flight" // 航班（P0）
  | "bus" // 长途大巴（P1）
  | "auto"; // 自动选择（系统根据距离推荐）

/**
 * 日类型
 */
export type DayType =
  | "move_day" // 出发日（从出发地前往目的地，主要时间在交通上）
  | "explore_day" // 游览日（在目的地游览景点，无长途交通）
  | "transit_day"; // 中转日（城市间移动，当天到达下一城市）

/**
 * 生成行程的请求
 */
export interface GeneratePlanRequest {
  title?: string; // 行程标题（可选，系统可自动生成）
  dateRange: DateRange; // 出发和结束日期
  fromCity: string; // 出发城市 ID（如 "beijing"）
  toCity: string; // 目的地城市 ID（如 "changsha"）
  travelers: Travelers; // 旅行者信息
  transportTo?: TransportType; // 去程交通方式
  transportBack?: TransportType; // 回程交通方式
  budget?: {
    total?: Money; // 总预算（分）
    perPerson?: Money; // 人均预算（分）
    currency: "CNY";
  };
  preferences?: {
    pace?: "relaxed" | "moderate" | "intensive"; // 节奏（轻松/适中/紧凑）
    style?: ("nature" | "history" | "food" | "entertainment")[]; // 偏好风格
    avoidCrowds?: boolean; // 避开热门景点
    accommodationType?: "budget" | "mid_range" | "luxury"; // 住宿档次
  };
  llmModel?: string; // 指定 LLM 模型（可选，默认自动路由）
}

/**
 * 生成行程的响应（非 SSE 版本，完整返回）
 */
export interface GeneratedPlan {
  id: string;
  userId: string;
  title: string;
  status: "generating" | "completed" | "failed";
  dateRange: DateRange;
  fromCity: City;
  toCity: City;
  travelers: Travelers;
  transportTo?: TransportInfo;
  transportBack?: TransportInfo;
  days: DayPlan[];
  summary: PlanSummary;
  generatedAt: string; // ISO 8601 datetime
  llmModel: string; // 实际使用的 LLM 模型
}

/**
 * 单日计划
 */
export interface DayPlan {
  id: string;
  planId: string;
  dayIndex: number; // 第几天（从 1 开始）
  date: string; // 该天日期（ISO 8601 date）
  dayType: DayType;
  theme?: string; // 今日主题（如 "历史文化探索"）
  transportInfo?: TransportInfo; // 长途交通信息（move_day 和 transit_day 时有值）
  activities: Activity[]; // 当天活动列表
  meals: Meal[]; // 餐饮推荐
  accommodation?: Accommodation; // 住宿推荐
  budget?: DayBudget; // 当日预算估算
  tips?: string[]; // 当日提示
  weather?: WeatherForecast; // 天气预报（异步加载）
}

/**
 * 活动
 */
export interface Activity {
  id: string;
  attractionId?: string; // 景点 ID（可能是自由活动，没有景点 ID）
  name: string; // 活动名称
  description: string; // 活动描述
  location?: string; // 地点（文字描述）
  locationCoord?: LatLng; // 坐标
  startTime: string; // 开始时间（HH:MM 格式）
  endTime: string; // 结束时间（HH:MM 格式）
  durationMinutes: Minutes; // 时长
  type: "attraction" | "meal" | "transport" | "rest" | "free"; // 活动类型
  ticketRequired?: boolean; // 是否需要购票
  estimatedCost?: Money; // 预估费用（分）
  tips?: string[]; // 小贴士
  imageUrl?: string;
}

/**
 * 大交通信息
 */
export interface TransportInfo {
  type: TransportType;
  // 火车（高铁 / 普速火车）
  trainNumber?: string; // 车次号（如 "G6113", "Z1"）
  seatClass?: string; // 座位等级（如 "二等座", "硬卧"）
  seatPrice?: Money; // 座位票价（分）
  availableSeatClasses?: {
    // 可用座位类型
    [seatClass: string]: {
      price: Money;
      available: number; // 余票数量
    };
  };
  // 航班
  flightNumber?: string; // 航班号（如 "CZ3142"）
  airline?: string; // 航空公司（如 "南方航空"）
  cabinClass?: string; // 舱位（如 "经济舱"）
  // 公共字段
  departureTime: string; // 出发时间（HH:MM 格式）
  arrivalTime: string; // 到达时间（HH:MM 格式，隔夜显示"次日 HH:MM"）
  durationMinutes: Minutes; // 全程时长
  departureStation: string; // 出发站/港
  arrivalStation: string; // 到达站/港
  isOvernight?: boolean; // 是否隔夜车次/班次
  bookingUrl?: string; // 购票链接
  disclaimer: string; // 免责声明文本（必须展示）
}

/**
 * 餐饮推荐
 */
export interface Meal {
  id: string;
  mealType: "breakfast" | "lunch" | "dinner" | "snack";
  name: string;
  description?: string;
  location?: string;
  locationCoord?: LatLng;
  estimatedCost?: Money; // 人均费用（分）
  imageUrl?: string;
  tags?: string[]; // 如 ["特色小吃", "本地推荐"]
}

/**
 * 住宿推荐
 */
export interface Accommodation {
  id: string;
  name: string;
  type: "hotel" | "hostel" | "guesthouse" | "resort" | "apartment";
  stars?: number; // 星级（1-5）
  location: string;
  locationCoord?: LatLng;
  pricePerNight?: Money; // 每晚价格（分）
  description?: string;
  amenities?: string[]; // 设施（如 ["WiFi", "停车场"]）
  bookingUrl?: string; // 预订链接
  imageUrl?: string;
}

/**
 * 当日预算
 */
export interface DayBudget {
  transport?: Money; // 交通费用
  attraction?: Money; // 景点门票
  meal?: Money; // 餐饮费用
  accommodation?: Money; // 住宿费用
  misc?: Money; // 其他费用
  total: Money; // 当日总计
  currency: "CNY";
}

/**
 * 行程总结
 */
export interface PlanSummary {
  totalDays: number;
  moveDays: number;
  exploreDays: number;
  transitDays: number;
  totalAttractions: number;
  highlightAttractions: string[]; // 亮点景点名称列表（前 3 个）
  estimatedTotalBudget?: Money;
  budgetBreakdown?: {
    transport?: Money;
    attraction?: Money;
    meal?: Money;
    accommodation?: Money;
    misc?: Money;
  };
}

// ------------------- 接口类型 -------------------

/** POST /api/v1/plans/generate - 请求体 */
export type GeneratePlanRequestBody = GeneratePlanRequest;

/** POST /api/v1/plans/generate - 响应（非 SSE） */
export type GeneratePlanResponse = ApiResponse<GeneratedPlan>;

/** GET /api/v1/plans - 请求参数 */
export interface ListPlansParams extends CursorPaginationParams {
  status?: "generating" | "completed" | "failed";
  sort?: "createdAt" | "startDate";
  sortOrder?: "asc" | "desc";
}

/** GET /api/v1/plans - 响应 */
export type ListPlansResponse = ApiResponse<PaginatedResponse<GeneratedPlan>>;

/** GET /api/v1/plans/:planId - 响应 */
export type GetPlanResponse = ApiResponse<GeneratedPlan>;

/** DELETE /api/v1/plans/:planId - 响应 */
export type DeletePlanResponse = ApiResponse<{ success: true }>;

/** PUT /api/v1/plans/:planId - 请求体（更新行程）*/
export interface UpdatePlanRequest {
  title?: string;
  days?: Partial<DayPlan>[];
}

/** PUT /api/v1/plans/:planId - 响应 */
export type UpdatePlanResponse = ApiResponse<GeneratedPlan>;
```

---

## 4. 大交通

```typescript
// ============================================================
// 文件：packages/shared/src/types/transport.ts
// ============================================================

/**
 * POST /api/v1/transport/search - 请求体
 */
export interface SearchTransportRequest {
  fromCity: string; // 出发城市 ID
  toCity: string; // 目的地城市 ID
  date: string; // 出行日期（ISO 8601 date）
  prefer?: TransportType[]; // 偏好交通方式（不传则返回所有）
  departTimePeriod?:
    | "morning" // 早班（06:00-12:00）
    | "afternoon" // 下午班（12:00-18:00）
    | "evening" // 晚班（18:00-24:00）
    | "overnight"; // 夜班（00:00-06:00）
  passengers: Travelers;
}

/**
 * 大交通搜索选项（单条结果）
 */
export interface TransportOption {
  id: string; // 唯一标识（用于前端 key）
  type: TransportType;
  // 火车通用
  trainNumber?: string;
  // 航班通用
  flightNumber?: string;
  airline?: string;
  airlineLogoUrl?: string;
  // 公共字段
  departTime: string; // HH:MM 格式
  arriveTime: string; // HH:MM 格式（隔夜：加"次日"前缀）
  durationMinutes: Minutes;
  departureStation: string;
  arrivalStation: string;
  isOvernight: boolean;
  // 价格（各座位类型）
  pricePerPerson: {
    [seatClass: string]: Money; // 分为单位，如 { "二等座": 31400, "一等座": 49800 }
  };
  // 可用性
  availableSeats: {
    [seatClass: string]: number | "enough" | "tight" | "none";
    // number: 具体余票数
    // "enough": 余票充足（不显示具体数字）
    // "tight": 余票紧张（< 5 张）
    // "none": 无票
  };
  // 附加信息
  stops?: string[]; // 途经站（普速火车常用）
  notes?: string; // 备注（如 "隔夜车，含卧铺"）
  bookingUrls?: {
    "12306"?: string;
    ctrip?: string;
    fliggy?: string;
  };
  disclaimer: string; // 免责声明文本（必须展示）
  expiresAt: string; // 数据有效期（ISO 8601 datetime）
}

/**
 * POST /api/v1/transport/search - 响应
 */
export interface SearchTransportData {
  options: TransportOption[];
  source: "mock" | "amap_api" | "ctrip_api" | "cache"; // 数据来源
  expiresAt: string;
  cacheHit: boolean;
}

export type SearchTransportResponse = ApiResponse<SearchTransportData>;
```

---

## 5. 天气

```typescript
// ============================================================
// 文件：packages/shared/src/types/weather.ts
// ============================================================

/**
 * 天气预报（单日）
 */
export interface WeatherForecast {
  date: string; // ISO 8601 date
  cityId: string;
  condition: WeatherCondition;
  conditionText: string; // 天气描述（如 "晴" "多云" "阵雨"）
  conditionIcon: string; // 天气图标 URL 或图标代码
  tempHigh: number; // 最高温度（℃）
  tempLow: number; // 最低温度（℃）
  humidity?: number; // 湿度（0-100%）
  windSpeed?: number; // 风速（km/h）
  windDirection?: string; // 风向（如 "东北风"）
  precipitationMm?: number; // 降水量（mm）
  uvIndex?: number; // 紫外线指数（0-11+）
  clothingIndex?: string; // 穿衣建议（如 "厚外套"）
  travelTips?: string[]; // 出行建议
}

export type WeatherCondition =
  | "sunny" // 晴
  | "partly_cloudy" // 多云
  | "cloudy" // 阴
  | "light_rain" // 小雨
  | "moderate_rain" // 中雨
  | "heavy_rain" // 大雨
  | "thunderstorm" // 雷暴
  | "light_snow" // 小雪
  | "moderate_snow" // 中雪
  | "heavy_snow" // 大雪
  | "foggy" // 雾
  | "haze" // 霾
  | "windy"; // 大风

/**
 * GET /api/v1/weather - 请求参数
 */
export interface GetWeatherParams {
  cityId: string;
  startDate: string; // ISO 8601 date
  endDate: string; // ISO 8601 date（最多 7 天预报）
}

/**
 * GET /api/v1/weather - 响应
 */
export type GetWeatherResponse = ApiResponse<{
  cityId: string;
  forecasts: WeatherForecast[];
  source: "hefeng" | "mock"; // 数据来源
  updatedAt: string;
}>;
```

---

## 6. 用户认证

```typescript
// ============================================================
// 文件：packages/shared/src/types/auth.ts
// ============================================================

/**
 * POST /api/v1/auth/register - 请求体
 */
export interface RegisterRequest {
  email: string; // 邮箱（唯一）
  password: string; // 密码（8-64 位，含大小写字母+数字+特殊字符）
  nickname?: string; // 昵称（可选，不填则从邮箱自动生成）
  agreeToTerms: boolean; // 同意用户协议（必须为 true）
}

/**
 * POST /api/v1/auth/register - 响应
 */
export interface RegisterData {
  user: UserProfile;
  accessToken: string; // JWT Access Token
  refreshToken: string; // Refresh Token（存 HttpOnly Cookie）
  expiresIn: number; // Access Token 有效期（秒）
}

export type RegisterResponse = ApiResponse<RegisterData>;

/**
 * POST /api/v1/auth/login - 请求体
 */
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean; // 记住我（影响 Refresh Token 有效期）
}

/**
 * POST /api/v1/auth/login - 响应
 */
export type LoginResponse = ApiResponse<RegisterData>; // 同 Register 响应

/**
 * POST /api/v1/auth/refresh - 请求体
 */
export interface RefreshTokenRequest {
  refreshToken: string; // 从 Cookie 中获取
}

/**
 * POST /api/v1/auth/refresh - 响应
 */
export type RefreshTokenResponse = ApiResponse<{
  accessToken: string;
  expiresIn: number;
}>;

/**
 * POST /api/v1/auth/logout - 响应
 */
export type LogoutResponse = ApiResponse<{ success: true }>;

/**
 * 用户资料
 */
export interface UserProfile {
  id: string;
  email: string;
  nickname: string;
  avatarUrl?: string;
  role: "user" | "premium" | "admin";
  planCount: number; // 已创建的行程数量
  createdAt: string; // ISO 8601 datetime
}

/**
 * GET /api/v1/users/me - 响应
 */
export type GetMeResponse = ApiResponse<UserProfile>;

/**
 * PUT /api/v1/users/me - 请求体
 */
export interface UpdateProfileRequest {
  nickname?: string;
  avatarUrl?: string;
}

/**
 * PUT /api/v1/users/me - 响应
 */
export type UpdateProfileResponse = ApiResponse<UserProfile>;
```

---

## 7. 错误类型

```typescript
// ============================================================
// 文件：packages/shared/src/types/errors.ts
// ============================================================

/**
 * API 错误响应
 */
export interface ApiError {
  code: number; // 错误码（见下方错误码表）
  message: string; // 错误描述（中文，面向用户）
  debugMessage?: string; // 调试信息（仅开发环境返回）
  traceId?: string; // 链路追踪 ID
  timestamp: string;
  details?: Record<string, unknown>; // 额外信息（如字段验证错误）
}

/**
 * 字段验证错误（HTTP 422）
 */
export interface ValidationError extends ApiError {
  details: {
    fields: {
      field: string; // 字段名（如 "dateRange.startDate"）
      message: string; // 错误原因（如 "日期格式不正确"）
      value?: unknown; // 实际值
    }[];
  };
}

// ============================================================
// 错误码表
// ============================================================

/**
 * 错误码枚举
 *
 * 命名规则：
 *   1xxx - 认证相关
 *   2xxx - 授权相关
 *   3xxx - 输入验证
 *   4xxx - 资源不存在
 *   5xxx - 业务逻辑错误
 *   9xxx - 系统内部错误
 */
export const ErrorCode = {
  // ========== 认证 ==========
  UNAUTHORIZED: 1001, // 未登录 / Token 无效
  TOKEN_EXPIRED: 1002, // Access Token 已过期
  REFRESH_TOKEN_EXPIRED: 1003, // Refresh Token 已过期，需重新登录
  INVALID_CREDENTIALS: 1004, // 邮箱或密码错误
  EMAIL_ALREADY_EXISTS: 1005, // 邮箱已被注册

  // ========== 授权 ==========
  FORBIDDEN: 2001, // 无权限
  PLAN_NOT_OWNED: 2002, // 该行程不属于当前用户

  // ========== 输入验证 ==========
  VALIDATION_ERROR: 3001, // 字段验证失败
  INVALID_DATE_RANGE: 3002, // 日期范围不合法
  INVALID_TRANSPORT_TYPE: 3003, // 不支持的交通类型

  // ========== 资源不存在 ==========
  CITY_NOT_FOUND: 4001, // 城市不存在
  ATTRACTION_NOT_FOUND: 4002, // 景点不存在
  PLAN_NOT_FOUND: 4003, // 行程不存在

  // ========== 业务逻辑 ==========
  PLAN_GENERATION_FAILED: 5001, // 行程生成失败（LLM 返回无效内容）
  TRANSPORT_NO_RESULTS: 5002, // 无可用交通选项
  MAX_PLANS_REACHED: 5003, // 超过免费用户行程数量上限（如 5 条）

  // ========== 系统 ==========
  INTERNAL_SERVER_ERROR: 9001, // 服务器内部错误
  EXTERNAL_API_ERROR: 9002, // 第三方 API 调用失败（如高德地图）
  LLM_API_ERROR: 9003, // LLM API 调用失败
  RATE_LIMIT_EXCEEDED: 9004, // 请求过于频繁
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// ============================================================
// HTTP 状态码对照表（供后端实现参考）
// ============================================================
//
// 200 OK           - 成功（GET/PUT/PATCH）
// 201 Created      - 资源创建成功（POST）
// 204 No Content   - 删除成功（DELETE）
// 400 Bad Request  - 请求格式错误（ErrorCode: 3xxx）
// 401 Unauthorized - 未认证（ErrorCode: 1001-1004）
// 403 Forbidden    - 无权限（ErrorCode: 2xxx）
// 404 Not Found    - 资源不存在（ErrorCode: 4xxx）
// 422 Unprocessable - 字段验证失败（ErrorCode: 3001）
// 429 Too Many Requests - 请求过频（ErrorCode: 9004）
// 500 Internal Server Error - 服务器错误（ErrorCode: 9001-9003）
```

---

## 8. SSE 事件类型

```typescript
// ============================================================
// 文件：packages/shared/src/types/sse.ts
// ============================================================
// 注：SSE（Server-Sent Events）用于攻略生成进度的实时推送
// 详细设计见《SSE 流式响应设计文档_v1.0.0.md》
// ============================================================

/**
 * SSE 事件类型枚举
 */
export type SSEEventType =
  | "connected" // 连接建立
  | "progress" // 进度更新
  | "day_generated" // 单日行程生成完成
  | "completed" // 全部生成完成
  | "error"; // 生成失败

/**
 * SSE 基础事件
 */
export interface SSEBaseEvent {
  event: SSEEventType;
  id: string; // 事件 ID（用于断线重连）
  timestamp: string;
}

/**
 * 连接建立事件
 */
export interface SSEConnectedEvent extends SSEBaseEvent {
  event: "connected";
  data: {
    planId: string;
    message: string; // 如 "开始生成行程..."
  };
}

/**
 * 进度更新事件
 */
export interface SSEProgressEvent extends SSEBaseEvent {
  event: "progress";
  data: {
    stage: SSEProgressStage;
    percent: number; // 0-100
    message: string; // 如 "正在分析最佳游览路线..."
    currentDay?: number; // 当前正在生成第几天
    totalDays?: number; // 总天数
  };
}

export type SSEProgressStage =
  | "initializing" // 初始化（解析用户输入）
  | "fetching_data" // 获取数据（景点、交通、天气）
  | "generating" // LLM 生成中
  | "optimizing" // 优化路线
  | "finalizing"; // 收尾（保存结果）

/**
 * 单日行程生成完成事件
 */
export interface SSEDayGeneratedEvent extends SSEBaseEvent {
  event: "day_generated";
  data: {
    dayIndex: number; // 第几天（从 1 开始）
    day: DayPlan; // 该天完整数据
  };
}

/**
 * 全部生成完成事件
 */
export interface SSECompletedEvent extends SSEBaseEvent {
  event: "completed";
  data: {
    planId: string;
    plan: GeneratedPlan; // 完整行程数据
    duration: number; // 生成耗时（毫秒）
  };
}

/**
 * 生成失败事件
 */
export interface SSEErrorEvent extends SSEBaseEvent {
  event: "error";
  data: {
    code: ErrorCodeType;
    message: string; // 错误描述（面向用户）
    retryable: boolean; // 是否可以重试
  };
}

/**
 * SSE 事件联合类型
 */
export type SSEEvent =
  | SSEConnectedEvent
  | SSEProgressEvent
  | SSEDayGeneratedEvent
  | SSECompletedEvent
  | SSEErrorEvent;

// ============================================================
// 前端使用示例
// ============================================================
//
// const eventSource = new EventSource(`/api/v1/plans/${planId}/stream`);
//
// eventSource.addEventListener('progress', (e) => {
//   const event = JSON.parse(e.data) as SSEProgressEvent['data'];
//   setProgress(event.percent);
//   setMessage(event.message);
// });
//
// eventSource.addEventListener('day_generated', (e) => {
//   const event = JSON.parse(e.data) as SSEDayGeneratedEvent['data'];
//   appendDay(event.day);
// });
//
// eventSource.addEventListener('completed', (e) => {
//   const event = JSON.parse(e.data) as SSECompletedEvent['data'];
//   setPlan(event.data.plan);
//   eventSource.close();
// });
//
// eventSource.addEventListener('error', (e) => {
//   const event = JSON.parse(e.data) as SSEErrorEvent['data'];
//   setError(event.message);
//   eventSource.close();
// });
```

---

## 9. 完整导出

```typescript
// ============================================================
// 文件：packages/shared/src/types/index.ts
// 统一导出所有类型
// ============================================================

// 公共类型
export * from "./common";

// 业务类型
export * from "./city";
export * from "./plan";
export * from "./transport";
export * from "./weather";
export * from "./auth";

// 错误类型
export * from "./errors";

// SSE 类型
export * from "./sse";
```

---

## 10. 使用指南

### 10.1 项目中引用

```bash
# 在 Monorepo 中，shared 包被 web 和 api 共享
# packages/shared/package.json
{
  "name": "@pathwise/shared",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts"
}

# 前端引入（apps/web）
import { GeneratePlanRequest, DayPlan, ErrorCode } from '@pathwise/shared';

# 后端引入（apps/api）
import { GeneratePlanRequest, DayPlan, ErrorCode } from '@pathwise/shared';
```

### 10.2 版本变更规则

| 变更类型             | 版本号规则 | 示例            |
| -------------------- | ---------- | --------------- |
| **新增字段（可选）** | Patch 版本 | v1.0.0 → v1.0.1 |
| **修改字段类型**     | Minor 版本 | v1.0.0 → v1.1.0 |
| **删除字段**         | Major 版本 | v1.0.0 → v2.0.0 |
| **新增接口**         | Minor 版本 | v1.0.0 → v1.1.0 |
| **删除接口**         | Major 版本 | v1.0.0 → v2.0.0 |

**原则**：向后兼容的变更用 Minor/Patch 版本，破坏性变更用 Major 版本。

---

**文档状态**：✅ 已完成  
**关联文件**：`packages/shared/src/types/` 目录

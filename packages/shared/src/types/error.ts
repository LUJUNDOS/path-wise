/**
 * PATH-WISE · 错误码与错误类型定义
 * 依据：docs/API接口设计规格书_v1.0.0.md §8（v1.0.6）
 *      docs/错误处理规范文档_v1.0.0.md §2.2
 */

/** 统一错误码枚举 */
export enum ErrorCode {
  // 成功
  SUCCESS = 0,

  // 客户端错误 — 参数校验（1xxxx）
  BAD_REQUEST = 10001,
  MISSING_REQUIRED_FIELD = 10002,
  FIELD_FORMAT_ERROR = 10003,
  DESTINATIONS_EMPTY = 10004,
  DATE_FORMAT_ERROR = 10005,
  DAYS_OUT_OF_RANGE = 10006,
  TRAVELERS_EMPTY = 10007,

  // 客户端错误 — 认证 / 权限（2xxxx）
  TOKEN_MISSING = 20001,
  TOKEN_EXPIRED = 20002,
  TOKEN_INVALID = 20003,
  FORBIDDEN = 20004,
  RESOURCE_NOT_FOUND = 20005,

  // 服务端警告（3xxxx）
  WARNING_POI_HOURS_UNVERIFIED = 30001,
  WARNING_TIGHT_SCHEDULE = 30002,
  WARNING_BUDGET_OVERFLOW = 30003,
  WARNING_MOCK_MODE = 30004, // 展示版 mock 模式提示

  // 外部 API 错误（4xxxx）
  AMAP_API_FAILED = 40001,
  TRAIN_API_UNAVAILABLE = 40002,
  EXTERNAL_API_TIMEOUT = 40003,
  CITY_KB_BUILDING = 40004,

  // 服务端内部错误（5xxxx）
  TRIP_GENERATION_FAILED = 50001,
  INTERNAL_ERROR = 50002,
  SERVICE_BUSY = 50003,

  // 业务错误别名（兼容旧版命名，使用独立值，落在合法分段内）
  // TRANSPORT_SEARCH_FAILED: 5xxxx 段 → 50004
  // CITY_NOT_FOUND: 4xxxx 段 → 40005
  // LLM_API_ERROR: 5xxxx 段 → 50005
  TRANSPORT_SEARCH_FAILED = 50004,
  CITY_NOT_FOUND = 40005,
  LLM_API_ERROR = 50005,

  // 限流
  RATE_LIMIT_TRIP_GENERATE = 42901,
  RATE_LIMIT_GLOBAL = 42902,
}

/** 错误消息映射（用户友好） */
export const ErrorMessageMap: Record<number, string> = {
  [ErrorCode.SUCCESS]: '成功',

  [ErrorCode.BAD_REQUEST]: '请求参数有误，请检查后重试',
  [ErrorCode.MISSING_REQUIRED_FIELD]: '缺少必填字段',
  [ErrorCode.FIELD_FORMAT_ERROR]: '字段格式错误',
  [ErrorCode.DESTINATIONS_EMPTY]: '目的地不能为空',
  [ErrorCode.DATE_FORMAT_ERROR]: '日期格式错误，应为 YYYY-MM-DD',
  [ErrorCode.DAYS_OUT_OF_RANGE]: '行程天数必须在 1~30 之间',
  [ErrorCode.TRAVELERS_EMPTY]: '出行人员数量不能为 0',

  [ErrorCode.TOKEN_MISSING]: '未提供认证 Token',
  [ErrorCode.TOKEN_EXPIRED]: 'Token 已过期',
  [ErrorCode.TOKEN_INVALID]: 'Token 无效',
  [ErrorCode.FORBIDDEN]: '无权访问该资源',
  [ErrorCode.RESOURCE_NOT_FOUND]: '请求的资源不存在',

  [ErrorCode.WARNING_POI_HOURS_UNVERIFIED]: '部分景点营业时间未确认',
  [ErrorCode.WARNING_TIGHT_SCHEDULE]: '行程安排较紧',
  [ErrorCode.WARNING_BUDGET_OVERFLOW]: '预算可能超支',
  [ErrorCode.WARNING_MOCK_MODE]: '当前为展示版，数据为预设模板',

  [ErrorCode.AMAP_API_FAILED]: '高德地图服务异常',
  [ErrorCode.TRAIN_API_UNAVAILABLE]: '12306 接口暂不可用',
  [ErrorCode.EXTERNAL_API_TIMEOUT]: '外部服务超时',
  [ErrorCode.CITY_KB_BUILDING]: '该城市知识库建设中，暂不支持',

  [ErrorCode.TRIP_GENERATION_FAILED]: '攻略生成失败，请重试',
  [ErrorCode.INTERNAL_ERROR]: '服务器内部错误，请稍后重试',
  [ErrorCode.SERVICE_BUSY]: '服务繁忙，请稍后重试',

  [ErrorCode.RATE_LIMIT_TRIP_GENERATE]: '攻略生成次数超限，请 1 小时后再试',
  [ErrorCode.RATE_LIMIT_GLOBAL]: '请求频率超限，请稍后再试',
};

/** 统一错误响应体 */
export interface ErrorResponse {
  code: number;
  message: string;
  details?: string;
  timestamp: string;
  path: string;
}

/** SSE 事件类型 */
export type SSEEventType = 'connected' | 'progress' | 'day_ready' | 'done' | 'error' | 'warning';

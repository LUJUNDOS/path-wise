/**
 * PATH-WISE · 通用 API 信封类型
 * 依据：docs/API接口设计规格书_v1.0.0.md §1.3
 */

/** 统一 API 响应信封 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
  meta: ResponseMeta;
}

/** 响应元信息 */
export interface ResponseMeta {
  requestId: string;
  processingTimeMs: number;
  timestamp: string;
}

/** 分页参数 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/** 分页元信息 */
export interface PaginationMeta {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** 分页响应 */
export interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}

/** SSE 进度事件 */
export interface SSEProgressEvent {
  step: number;
  totalSteps: number;
  percent: number;
  message: string;
  subMessage?: string;
  estimatedRemainingSeconds: number;
}

/** SSE 连接建立事件 */
export interface SSEConnectedEvent {
  taskId: string;
  estimatedTotalSeconds: number;
  totalSteps: number;
  message: string;
}

/** SSE 完成事件 */
export interface SSEDoneEvent {
  tripId: string;
  totalProcessingTimeSeconds: number;
  totalEstimatedCostCNY: number;
  summary: string;
  shareUrl?: string;
}

/** SSE 错误事件 */
export interface SSEErrorEvent {
  code: number;
  message: string;
  recoverable: boolean;
  partialTripId?: string;
  failedStep?: string;
  suggestion?: string;
}

/** SSE 警告事件 */
export interface SSEWarningEvent {
  code: number;
  message: string;
  dayIndex?: number;
}

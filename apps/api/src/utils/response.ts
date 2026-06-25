/**
 * PATH-WISE · 统一响应工具
 * 消除路由层中重复的响应信封构造。
 *
 * 使用方式：
 *   // 成功
 *   return reply.send(successResponse(data));
 *   return reply.send(successResponse(data, { message: "ok" }));
 *   return reply.status(201).send(successResponse(data, { message: "已创建" }));
 *
 *   // 错误
 *   return reply.status(400).send(errorResponse(10002, "缺少必填字段"));
 *   return reply.status(400).send(errorResponse(10004, "destinations 不能为空", {
 *     data: { field: "destinations", reason: "至少需要 1 个目的地" },
 *   }));
 *   return reply.status(404).send(errorResponse(error.code, error.message));
 */

import { randomUUID } from "node:crypto";
import type { ResponseMeta } from "@path-wise/shared";

// ---- 成功响应 ----

/** 成功响应选项 */
export interface SuccessResponseOptions {
  /** 额外消息（默认 "ok"） */
  message?: string;
  /** 覆盖默认 meta 字段 */
  meta?: Partial<ResponseMeta>;
}

/** 默认响应元信息 */
const defaultMeta = (): ResponseMeta => ({
  requestId: randomUUID(),
  processingTimeMs: 0,
  timestamp: new Date().toISOString(),
});

/** 成功响应载荷 */
export interface SuccessResponsePayload<T = unknown> {
  code: 0;
  message: string;
  data: T;
  meta: ResponseMeta;
}

/**
 * 构建统一成功响应信封
 * @param data - 响应数据
 * @param options - 可选的消息和 meta 覆盖
 */
export function successResponse<T>(
  data: T,
  options: SuccessResponseOptions = {},
): SuccessResponsePayload<T> {
  return {
    code: 0,
    message: options.message ?? "ok",
    data,
    meta: { ...defaultMeta(), ...options.meta },
  };
}

// ---- 错误响应 ----

/** 错误响应选项 */
export interface ErrorResponseOptions {
  /** 额外调试数据（如字段名、原因） */
  data?: unknown;
}

/** 错误响应载荷 */
export interface ErrorResponsePayload {
  code: number;
  message: string;
  data?: unknown;
  meta: ResponseMeta;
}

/**
 * 构建统一错误响应信封
 * 所有路由中的非成功响应均应通过此函数构造，保证格式一致。
 *
 * @param code - 业务错误码（来自 ErrorCode 枚举）
 * @param message - 用户友好的错误消息
 * @param options - 可选的数据和 meta 覆盖
 */
export function errorResponse(
  code: number,
  message: string,
  options: ErrorResponseOptions = {},
): ErrorResponsePayload {
  const payload: ErrorResponsePayload = {
    code,
    message,
    meta: defaultMeta(),
  };
  if (options.data !== undefined) {
    payload.data = options.data;
  }
  return payload;
}

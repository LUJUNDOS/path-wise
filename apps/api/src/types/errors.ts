/**
 * PATH-WISE · 业务错误类层级
 * 依据：docs/错误处理规范文档_v1.0.0.md §4.2
 */

import { ErrorCode } from '@path-wise/shared';

/** 业务错误基类 */
export class BusinessError extends Error {
  public readonly code: number;
  public readonly details?: string;
  public readonly statusCode: number;

  constructor(code: number, message: string, details?: string, statusCode = 400) {
    super(message);
    this.name = 'BusinessError';
    this.code = code;
    this.details = details;
    this.statusCode = statusCode;
  }
}

/** 攻略生成失败 */
export class TripGenerationFailedError extends BusinessError {
  constructor(message = '攻略生成失败', details?: string) {
    super(ErrorCode.TRIP_GENERATION_FAILED, message, details, 500);
    this.name = 'TripGenerationFailedError';
  }
}

/** 交通查询失败 */
export class TransportSearchFailedError extends BusinessError {
  constructor(message = '交通信息查询失败', details?: string) {
    super(ErrorCode.TRANSPORT_SEARCH_FAILED, message, details, 500);
    this.name = 'TransportSearchFailedError';
  }
}

/** 城市不存在 */
export class CityNotFoundError extends BusinessError {
  constructor(cityName: string) {
    super(
      ErrorCode.CITY_NOT_FOUND,
      `城市 "${cityName}" 暂不支持`,
      `City "${cityName}" not found in cities table`,
      404,
    );
    this.name = 'CityNotFoundError';
  }
}

/** LLM API 错误 */
export class LLMAPIError extends BusinessError {
  constructor(message = 'AI 服务暂不可用', details?: string) {
    super(ErrorCode.LLM_API_ERROR, message, details, 502);
    this.name = 'LLMAPIError';
  }
}

/** 外部 API 错误 */
export class ExternalAPIError extends BusinessError {
  constructor(apiName: string, reason: string, details?: string) {
    super(ErrorCode.EXTERNAL_API_TIMEOUT, `${apiName} 服务调用失败: ${reason}`, details, 502);
    this.name = 'ExternalAPIError';
  }
}

/** 未授权错误 */
export class UnauthorizedError extends BusinessError {
  constructor(message = '未提供认证 Token') {
    super(ErrorCode.TOKEN_MISSING, message, undefined, 401);
    this.name = 'UnauthorizedError';
  }
}

/** 禁止访问错误 */
export class ForbiddenError extends BusinessError {
  constructor(message = '无权访问该资源') {
    super(ErrorCode.FORBIDDEN, message, undefined, 403);
    this.name = 'ForbiddenError';
  }
}

/** 资源不存在 */
export class NotFoundError extends BusinessError {
  constructor(resource: string) {
    super(ErrorCode.RESOURCE_NOT_FOUND, `${resource} 不存在`, undefined, 404);
    this.name = 'NotFoundError';
  }
}

/** 参数校验错误 */
export class ValidationError extends BusinessError {
  constructor(field: string, reason: string) {
    super(ErrorCode.MISSING_REQUIRED_FIELD, `参数校验失败: ${field}`, reason, 400);
    this.name = 'ValidationError';
  }
}

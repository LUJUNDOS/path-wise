/**
 * 业务错误类层级单元测试
 * 依据：docs/错误处理规范文档_v1.0.0.md §4.2
 */
import { describe, it, expect } from 'vitest';
import {
  BusinessError,
  TripGenerationFailedError,
  TransportSearchFailedError,
  CityNotFoundError,
  LLMAPIError,
  ExternalAPIError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../types/errors.js';
import { ErrorCode } from '@path-wise/shared';

// ---- BusinessError 基类 ----

describe('BusinessError', () => {
  it('应正确设置 name、code、statusCode', () => {
    const err = new BusinessError(10099, '测试错误', undefined, 418);
    expect(err.name).toBe('BusinessError');
    expect(err.code).toBe(10099);
    expect(err.message).toBe('测试错误');
    expect(err.statusCode).toBe(418);
    expect(err.details).toBeUndefined();
  });

  it('默认 statusCode 应为 400', () => {
    const err = new BusinessError(10099, '默认状态码');
    expect(err.statusCode).toBe(400);
  });

  it('应继承自 Error', () => {
    const err = new BusinessError(1, 'msg');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(BusinessError);
  });
});

// ---- TripGenerationFailedError ----

describe('TripGenerationFailedError', () => {
  it('默认消息应为 "攻略生成失败"', () => {
    const err = new TripGenerationFailedError();
    expect(err.message).toBe('攻略生成失败');
    expect(err.code).toBe(ErrorCode.TRIP_GENERATION_FAILED);
    expect(err.statusCode).toBe(500);
  });

  it('应支持自定义 details', () => {
    const err = new TripGenerationFailedError(undefined, 'LLM 返回异常');
    expect(err.details).toBe('LLM 返回异常');
  });

  it('应为 BusinessError 实例', () => {
    expect(new TripGenerationFailedError()).toBeInstanceOf(BusinessError);
  });
});

// ---- TransportSearchFailedError ----

describe('TransportSearchFailedError', () => {
  it('默认消息应为 "交通信息查询失败"', () => {
    const err = new TransportSearchFailedError();
    expect(err.message).toBe('交通信息查询失败');
    expect(err.code).toBe(ErrorCode.TRANSPORT_SEARCH_FAILED);
    expect(err.statusCode).toBe(500);
  });
});

// ---- CityNotFoundError ----

describe('CityNotFoundError', () => {
  it('消息应包含城市名', () => {
    const err = new CityNotFoundError('火星');
    expect(err.message).toBe('城市 "火星" 暂不支持');
    expect(err.code).toBe(ErrorCode.CITY_NOT_FOUND);
    expect(err.statusCode).toBe(404);
  });

  it('details 应为英文描述', () => {
    const err = new CityNotFoundError('Tokyo');
    expect(err.details).toBe('City "Tokyo" not found in cities table');
  });
});

// ---- LLMAPIError ----

describe('LLMAPIError', () => {
  it('默认消息应为 "AI 服务暂不可用"', () => {
    const err = new LLMAPIError();
    expect(err.message).toBe('AI 服务暂不可用');
    expect(err.code).toBe(ErrorCode.LLM_API_ERROR);
    expect(err.statusCode).toBe(502);
  });

  it('应支持自定义消息和 details', () => {
    const err = new LLMAPIError('DeepSeek 超时', 'timeout after 30s');
    expect(err.message).toBe('DeepSeek 超时');
    expect(err.details).toBe('timeout after 30s');
  });
});

// ---- ExternalAPIError ----

describe('ExternalAPIError', () => {
  it('消息应包含 API 名称和原因', () => {
    const err = new ExternalAPIError('高德地图', '连接超时');
    expect(err.message).toBe('高德地图 服务调用失败: 连接超时');
    expect(err.code).toBe(ErrorCode.EXTERNAL_API_TIMEOUT);
  });

  it('应支持 details 补充', () => {
    const err = new ExternalAPIError('和风天气', '401', 'API Key 已过期');
    expect(err.details).toBe('API Key 已过期');
  });
});

// ---- UnauthorizedError ----

describe('UnauthorizedError', () => {
  it('默认消息应为 "未提供认证 Token"', () => {
    const err = new UnauthorizedError();
    expect(err.message).toBe('未提供认证 Token');
    expect(err.code).toBe(ErrorCode.TOKEN_MISSING);
    expect(err.statusCode).toBe(401);
  });

  it('应支持自定义消息', () => {
    const err = new UnauthorizedError('Token 已过期');
    expect(err.message).toBe('Token 已过期');
  });
});

// ---- ForbiddenError ----

describe('ForbiddenError', () => {
  it('默认消息应为 "无权访问该资源"', () => {
    const err = new ForbiddenError();
    expect(err.message).toBe('无权访问该资源');
    expect(err.code).toBe(ErrorCode.FORBIDDEN);
    expect(err.statusCode).toBe(403);
  });
});

// ---- NotFoundError ----

describe('NotFoundError', () => {
  it('消息应包含资源名', () => {
    const err = new NotFoundError('Trip#abc123');
    expect(err.message).toBe('Trip#abc123 不存在');
    expect(err.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
    expect(err.statusCode).toBe(404);
  });
});

// ---- ValidationError ----

describe('ValidationError', () => {
  it('消息应包含字段名和原因', () => {
    const err = new ValidationError('departureDate', '日期不能为过去');
    expect(err.message).toBe('参数校验失败: departureDate');
    expect(err.details).toBe('日期不能为过去');
    expect(err.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
    expect(err.statusCode).toBe(400);
  });
});

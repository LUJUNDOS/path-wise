/**
 * PATH-WISE · route_error_handler 单元测试
 * 依据：docs/错误处理规范文档_v1.0.0.md §4.2
 */
import { describe, it, expect, vi } from 'vitest';
import { handleServiceError } from '../utils/route_error_handler.js';
import {
  ValidationError,
  BusinessError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  LLMAPIError,
  ExternalAPIError,
  TripGenerationFailedError,
} from '../types/errors.js';
import { ErrorCode } from '@path-wise/shared';

// 创建模拟的 FastifyReply
function createMockReply() {
  return {
    status: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
  } as unknown as ReturnType<(typeof import('fastify').FastifyReply)['prototype']> & {
    status: ReturnType<typeof vi.fn>;
    send: ReturnType<typeof vi.fn>;
  };
}

describe('handleServiceError', () => {
  // ---- ValidationError ----
  describe('ValidationError', () => {
    it('应返回 400 并使用 fieldName 作为 data.field', () => {
      const reply = createMockReply();
      const err = new ValidationError('fromCity', '出发城市不能为空');

      handleServiceError(err, reply as any);

      expect(reply.status).toHaveBeenCalledWith(400);
      const sendArg = reply.send.mock.calls[0][0] as Record<string, unknown>;
      expect(sendArg.code).toBe(ErrorCode.MISSING_REQUIRED_FIELD);
      expect(sendArg.message).toContain('参数校验失败');
      // ValiationError 构造函数 message 是 `参数校验失败: ${field}`
      expect((sendArg.data as Record<string, unknown>)?.field).toBe('fromCity');
      expect((sendArg.data as Record<string, unknown>)?.reason).toBe('出发城市不能为空');
    });

    it('ValidationError 的 message 应包含字段名', () => {
      const reply = createMockReply();
      const err = new ValidationError('cityName', '城市名称不能为空');

      handleServiceError(err, reply as any);

      const sendArg = reply.send.mock.calls[0][0] as Record<string, unknown>;
      expect(sendArg.message).toContain('cityName');
    });

    it('ValidationError 修复字段（空字符串）应正常工作', () => {
      const reply = createMockReply();
      const err = new ValidationError('', '未知字段错误');

      handleServiceError(err, reply as any);

      const sendArg = reply.send.mock.calls[0][0] as Record<string, unknown>;
      expect((sendArg.data as Record<string, unknown>)?.field).toBe('');
    });
  });

  // ---- BusinessError 子类 ----
  describe('NotFoundError', () => {
    it('应返回 404 和资源名', () => {
      const reply = createMockReply();
      const err = new NotFoundError('城市 "火星"');

      handleServiceError(err, reply as any);

      expect(reply.status).toHaveBeenCalledWith(404);
      const sendArg = reply.send.mock.calls[0][0] as Record<string, unknown>;
      expect(sendArg.code).toBe(ErrorCode.RESOURCE_NOT_FOUND);
      expect(sendArg.message).toContain('火星');
    });

    it('details 为空时不应追加到响应', () => {
      const reply = createMockReply();
      const err = new NotFoundError('城市 "月球"');

      handleServiceError(err, reply as any);

      const sendArg = reply.send.mock.calls[0][0] as Record<string, unknown>;
      // NotFoundError 不传 details，不应有 data.details
      const data = sendArg.data as Record<string, unknown> | undefined;
      expect(data?.details).toBeUndefined();
    });
  });

  describe('UnauthorizedError', () => {
    it('应返回 401 和 TOKEN_MISSING', () => {
      const reply = createMockReply();
      const err = new UnauthorizedError();

      handleServiceError(err, reply as any);

      expect(reply.status).toHaveBeenCalledWith(401);
      const sendArg = reply.send.mock.calls[0][0] as Record<string, unknown>;
      expect(sendArg.code).toBe(ErrorCode.TOKEN_MISSING);
    });
  });

  describe('ForbiddenError', () => {
    it('应返回 403 和 FORBIDDEN', () => {
      const reply = createMockReply();
      const err = new ForbiddenError();

      handleServiceError(err, reply as any);

      expect(reply.status).toHaveBeenCalledWith(403);
      const sendArg = reply.send.mock.calls[0][0] as Record<string, unknown>;
      expect(sendArg.code).toBe(ErrorCode.FORBIDDEN);
    });
  });

  describe('LLMAPIError', () => {
    it('应返回 502 和 LLM_API_ERROR', () => {
      const reply = createMockReply();
      const err = new LLMAPIError();

      handleServiceError(err, reply as any);

      expect(reply.status).toHaveBeenCalledWith(502);
      const sendArg = reply.send.mock.calls[0][0] as Record<string, unknown>;
      expect(sendArg.code).toBe(ErrorCode.LLM_API_ERROR);
    });

    it('带 details 时应追加到 data.details', () => {
      const reply = createMockReply();
      const err = new LLMAPIError('AI 服务暂不可用', 'Rate limit exceeded', 429);

      handleServiceError(err, reply as any);

      const sendArg = reply.send.mock.calls[0][0] as Record<string, unknown>;
      expect((sendArg.data as Record<string, unknown>)?.details).toBe('Rate limit exceeded');
    });

    it('带 providerStatusCode 时应正确设置（code 层面在错误对象上）', () => {
      const err = new LLMAPIError('AI 服务异常', 'Rate limit', 429);
      expect(err.providerStatusCode).toBe(429);
    });
  });

  describe('ExternalAPIError', () => {
    it('应返回 502', () => {
      const reply = createMockReply();
      const err = new ExternalAPIError('高德地图', '连接超时');

      handleServiceError(err, reply as any);

      expect(reply.status).toHaveBeenCalledWith(502);
      const sendArg = reply.send.mock.calls[0][0] as Record<string, unknown>;
      expect(sendArg.code).toBe(ErrorCode.EXTERNAL_API_TIMEOUT);
      expect(sendArg.message).toContain('高德地图');
    });
  });

  describe('TripGenerationFailedError', () => {
    it('应返回 500', () => {
      const reply = createMockReply();
      const err = new TripGenerationFailedError('攻略生成失败', 'LLM returned empty response');

      handleServiceError(err, reply as any);

      expect(reply.status).toHaveBeenCalledWith(500);
      const sendArg = reply.send.mock.calls[0][0] as Record<string, unknown>;
      expect(sendArg.code).toBe(ErrorCode.TRIP_GENERATION_FAILED);
    });
  });

  // ---- 通用 BusinessError ----
  describe('通用 BusinessError', () => {
    it('自定义 code 和 statusCode 应正确传播', () => {
      const reply = createMockReply();
      const err = new BusinessError(99999, '自定义业务错误', '额外信息', 418);

      handleServiceError(err, reply as any);

      expect(reply.status).toHaveBeenCalledWith(418);
      const sendArg = reply.send.mock.calls[0][0] as Record<string, unknown>;
      expect(sendArg.code).toBe(99999);
    });

    it('BusinessError 带 details 时应追加到 data.details', () => {
      const reply = createMockReply();
      const err = new BusinessError(ErrorCode.BAD_REQUEST, '请求错误', '详细说明');

      handleServiceError(err, reply as any);

      const sendArg = reply.send.mock.calls[0][0] as Record<string, unknown>;
      expect((sendArg.data as Record<string, unknown>)?.details).toBe('详细说明');
    });

    it('BusinessError 无 details 时 data 不应有 details', () => {
      const reply = createMockReply();
      const err = new BusinessError(ErrorCode.BAD_REQUEST, '请求错误');

      handleServiceError(err, reply as any);

      const sendArg = reply.send.mock.calls[0][0] as Record<string, unknown>;
      const data = sendArg.data as Record<string, unknown> | undefined;
      if (data) {
        expect(data.details).toBeUndefined();
      }
    });
  });

  // ---- 非预期的错误类型 ----
  describe('非预期错误', () => {
    it('普通 Error 应重新抛出（交由 error_handler 插件处理）', () => {
      const reply = createMockReply();
      const err = new Error('系统内部错误');

      expect(() => handleServiceError(err, reply as any)).toThrow('系统内部错误');
    });

    it('字符串类型的错误应重新抛出', () => {
      const reply = createMockReply();
      expect(() => handleServiceError('string error', reply as any)).toThrow();
    });

    it('null 错误应重新抛出', () => {
      const reply = createMockReply();
      expect(() => handleServiceError(null, reply as any)).toThrow();
    });

    it('undefined 错误应重新抛出', () => {
      const reply = createMockReply();
      expect(() => handleServiceError(undefined, reply as any)).toThrow();
    });

    it('数字类型错误应重新抛出', () => {
      const reply = createMockReply();
      expect(() => handleServiceError(42, reply as any)).toThrow();
    });
  });

  // ---- 边界 ----
  describe('边界情况', () => {
    it('ValidationError 消息包含特殊字符应不崩溃', () => {
      const reply = createMockReply();
      const err = new ValidationError('field<123>', 'reason: "test" & more');

      expect(() => handleServiceError(err, reply as any)).not.toThrow();
      expect(reply.status).toHaveBeenCalledWith(400);
    });

    it('BusinessError 极长 details 应不崩溃', () => {
      const reply = createMockReply();
      const err = new BusinessError(ErrorCode.BAD_REQUEST, '错误', 'x'.repeat(10000));

      expect(() => handleServiceError(err, reply as any)).not.toThrow();
    });
  });
});

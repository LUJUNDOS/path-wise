/**
 * PATH-WISE · 路由层通用错误处理
 *
 * 消除路由层 4 处重复的 ValidationError / BusinessError catch 代码块。
 * 所有路由的 catch 块统一调用此函数，错误处理逻辑集中维护。
 */

import type { FastifyReply } from 'fastify';
import { ValidationError, BusinessError } from '../types/errors.js';
import { errorResponse } from './response.js';

/**
 * 处理服务层抛出的 ValidationError 和 BusinessError，返回统一错误响应。
 * 对于未识别的错误，重新抛出交由 error_handler 插件处理。
 *
 * @param err - 捕获的异常
 * @param reply - Fastify Reply 对象
 * @throws 未识别的错误（非 ValidationError / BusinessError）
 */
export function handleServiceError(err: unknown, reply: FastifyReply): void {
  if (err instanceof ValidationError) {
    reply.status(400).send(
      errorResponse(err.code, err.message, {
        data: { field: err.fieldName, reason: err.details },
      }),
    );
    return;
  }
  if (err instanceof BusinessError) {
    const responseBody = errorResponse(err.code, err.message);
    // 转发 details（如果子类设置了 details），帮助前端展示更多信息
    if (err.details) {
      (responseBody as Record<string, unknown>).data = {
        ...(responseBody as Record<string, unknown>).data,
        details: err.details,
      };
    }
    reply.status(err.statusCode).send(responseBody);
    return;
  }
  // 让 error_handler 插件处理
  throw err;
}

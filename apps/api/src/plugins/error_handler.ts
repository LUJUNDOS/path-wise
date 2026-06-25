/**
 * PATH-WISE · 全局错误处理器
 * 依据：docs/错误处理规范文档_v1.0.0.md §4.1
 *
 * 注册为 Fastify 插件，拦截所有未捕获的错误，返回统一信封格式。
 */

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import type { ErrorResponse } from '@path-wise/shared';
import { ErrorCode } from '@path-wise/shared';

export async function errorHandlerPlugin(
  fastify: import('fastify').FastifyInstance,
): Promise<void> {
  fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    let code: number;
    let message: string;
    let details: string | undefined;

    // 1. Fastify 内置错误（有 statusCode）
    if (error.statusCode && error.statusCode >= 400) {
      code = error.statusCode;
      message = error.message;
      details = error.validation ? JSON.stringify(error.validation) : undefined;
    }
    // 2. 参数验证错误
    else if (error.code === 'FST_ERR_VALIDATION') {
      code = ErrorCode.BAD_REQUEST;
      message = '请求参数验证失败';
      details = error.validation ? JSON.stringify(error.validation) : error.message;
    }
    // 3. 未找到路由
    else if (error.statusCode === 404 || error.code === 'FST_ERR_NOT_FOUND') {
      code = ErrorCode.RESOURCE_NOT_FOUND;
      message = '请求的资源不存在';
    }
    // 4. 未知错误
    else {
      code = ErrorCode.INTERNAL_ERROR;
      message = '服务器内部错误';
      details = error.stack;
    }

    // 记录错误日志
    request.log.error({
      code,
      message: error.message,
      stack: error.stack,
      url: request.url,
      method: request.method,
    });

    // 构建错误响应
    const errorResponse: ErrorResponse = {
      code,
      message,
      details: process.env.NODE_ENV === 'production' ? undefined : details,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // 发送错误响应
    reply.status(code >= 100 && code < 600 ? code : 500).send(errorResponse);
  });
}

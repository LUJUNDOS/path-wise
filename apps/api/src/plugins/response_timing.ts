/**
 * PATH-WISE · 响应耗时插件
 * 依据：docs/API接口设计规格书_v1.0.0.md §1.1「透明性」原则 —
 *       meta.processingTimeMs 必须返回真实耗时，禁止硬编码为 0。
 *
 * 通过 Fastify 生命周期钩子自动计算：
 *   onRequest  → 记录 requestStart 时间戳
 *   onSend     → 计算 elapsed = Date.now() - requestStart，注入到响应体的 meta 中
 *
 * 仅针对 successResponse / errorResponse 统一信封路由（含 meta.processingTimeMs 字段）。
 * SSE 流式接口、health check、重定向等非信封路径不影响。
 */

import type { FastifyInstance } from 'fastify';

/** 扩展 FastifyRequest 存储请求开始时间 */
declare module 'fastify' {
  interface FastifyRequest {
    __requestStart?: number;
  }
}

// onSend 收到的 payload 可能是 string 或 Buffer，也可能是流（SSE 场景）
// 只处理 JSON 字符串中 meta.processingTimeMs === 0 的情况
function patchProcessingTime(payload: unknown, elapsed: number): string | null {
  if (typeof payload !== 'string') return null;
  if (payload.length === 0) return null;

  try {
    const body = JSON.parse(payload);
    // 仅处理含 meta.processingTimeMs 的统一信封
    if (body && typeof body === 'object' && body.meta && typeof body.meta === 'object') {
      body.meta.processingTimeMs = elapsed;
      return JSON.stringify(body);
    }
  } catch {
    // 非 JSON 或解析失败，原样返回
  }
  return null;
}

export async function responseTimingPlugin(fastify: FastifyInstance): Promise<void> {
  // 记录请求到达时间
  fastify.addHook('onRequest', async (request) => {
    request.__requestStart = Date.now();
  });

  // 响应发送前注入真实耗时
  fastify.addHook('onSend', async (request, _reply, payload) => {
    const start = request.__requestStart;
    if (start === undefined) return payload;

    const elapsed = Date.now() - start;
    const patched = patchProcessingTime(payload, elapsed);
    return patched ?? payload;
  });
}

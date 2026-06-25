/**
 * SSE 流式响应工具
 * 封装 Fastify reply 上的 SSE 事件发送逻辑，消除路由层重复代码。
 *
 * 使用方式：
 *   const stream = createSSEStream(reply);
 *   stream.send("connected", { taskId });
 *   stream.end();
 */

import type { FastifyReply } from "fastify";
import type { SSEEventType } from "@path-wise/shared";

/** SSE 流控制器 */
export interface SSEStream {
  /** 发送一个 SSE 事件 */
  send: (event: SSEEventType, data: unknown) => void;
  /** 关闭 SSE 连接 */
  end: () => void;
}

/** SSE 响应头集合 */
const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

/**
 * 在 Fastify reply 上创建 SSE 流
 * 自动写入响应头，返回 send/end 控制器。
 */
export function createSSEStream(reply: FastifyReply): SSEStream {
  reply.raw.writeHead(200, SSE_HEADERS);

  const send = (event: string, data: unknown): void => {
    reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const end = (): void => {
    reply.raw.end();
  };

  return { send, end };
}

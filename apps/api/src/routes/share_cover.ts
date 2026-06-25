/**
 * PATH-WISE · 分享封面路由
 * 接口：GET /share/cover/{tripId}
 * 依据：docs/API接口设计规格书_v1.0.0.md §7.8
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { getCoverImageUrl } from "../services/share_service.js";

export async function shareCoverRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /share/cover/:tripId — 获取分享封面图
   * MVP: 返回 302 重定向到 placeholder 图片
   */
  fastify.get(
    "/share/cover/:tripId",
    async (
      request: FastifyRequest<{ Params: { tripId: string } }>,
      reply: FastifyReply,
    ) => {
      const { tripId } = request.params;
      const imageUrl = getCoverImageUrl(tripId);
      // MVP: 重定向到 placeholder
      return reply.redirect(imageUrl, 302);
    },
  );
}

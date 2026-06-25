/**
 * PATH-WISE · 用户偏好路由
 * 接口：GET /users/{userId}/preferences, PUT /users/{userId}/preferences
 * 依据：docs/API接口设计规格书_v1.0.0.md §2.2
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import type { UserPreferences } from "@path-wise/shared";
import { getUserPreferences, saveUserPreferences } from "../services/user_service.js";
import { successResponse } from "../utils/response.js";

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /users/:userId/preferences — 读取用户偏好
   */
  fastify.get(
    "/users/:userId/preferences",
    async (
      request: FastifyRequest<{ Params: { userId: string } }>,
      reply: FastifyReply,
    ) => {
      const { userId } = request.params;
      const prefs = await getUserPreferences(userId);
      return reply.send(successResponse(prefs));
    },
  );

  /**
   * PUT /users/:userId/preferences — 保存用户偏好
   */
  fastify.put(
    "/users/:userId/preferences",
    async (
      request: FastifyRequest<{
        Params: { userId: string };
        Body: UserPreferences;
      }>,
      reply: FastifyReply,
    ) => {
      const { userId } = request.params;
      const prefs = await saveUserPreferences(userId, request.body);
      return reply.send(successResponse(prefs, { message: "偏好已保存" }));
    },
  );
}

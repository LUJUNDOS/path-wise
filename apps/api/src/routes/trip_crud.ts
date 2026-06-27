/**
 * PATH-WISE · 攻略 CRUD 路由
 * 接口：
 *   POST /trips/validate
 *   GET /trips/{tripId}
 *   GET /trips/{tripId}/day/{dayIndex}
 *   PUT /trips/{tripId}/day/{dayIndex}
 *   DELETE /trips/{tripId}
 *   GET /trips/{tripId}/export
 *
 * 依据：docs/API接口设计规格书_v1.0.0.md §4.1, §6
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { TripGenerateRequest, DayUpdateRequest, ExportOptions } from '@path-wise/shared';
import {
  validateTripRequest,
  getTrip,
  getDayPlan,
  updateDayPlan,
  deleteTrip,
  exportTrip,
} from '../services/trip_service.js';
import { ErrorCode } from '@path-wise/shared';
import { successResponse, errorResponse } from '../utils/response.js';

export async function tripCrudRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /trips/validate — 用户输入校验与冲突检测
   */
  fastify.post('/trips/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as TripGenerateRequest;
    reply.header('Access-Control-Allow-Origin', '*');
    const result = validateTripRequest(body);
    return reply.send(successResponse(result));
  });

  /**
   * GET /trips/:tripId — 查询完整攻略
   */
  fastify.get(
    '/trips/:tripId',
    async (
      request: FastifyRequest<{
        Params: { tripId: string };
        Querystring: { include?: string; format?: string; shareToken?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { tripId } = request.params;
      const { shareToken } = request.query;

      // 分享链接查看
      if (shareToken) {
        return reply.send(
          successResponse({
            tripId,
            title: '示例攻略 · 北京 → 长沙 5 天游',
            days: [],
            isReadOnly: true,
            sharedBy: '旅行者',
            expireAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          }),
        );
      }

      const trip = await getTrip(tripId);
      if (!trip) {
        return reply.status(404).send(errorResponse(ErrorCode.RESOURCE_NOT_FOUND, '攻略不存在'));
      }

      return reply.send(successResponse(trip));
    },
  );

  /**
   * GET /trips/:tripId/day/:dayIndex — 查询单天行程
   */
  fastify.get(
    '/trips/:tripId/day/:dayIndex',
    async (
      request: FastifyRequest<{ Params: { tripId: string; dayIndex: string } }>,
      reply: FastifyReply,
    ) => {
      const { tripId, dayIndex } = request.params;
      const day = await getDayPlan(tripId, parseInt(dayIndex, 10));

      if (!day) {
        return reply
          .status(404)
          .send(errorResponse(ErrorCode.RESOURCE_NOT_FOUND, '该天行程不存在'));
      }

      return reply.send(successResponse(day));
    },
  );

  /**
   * PUT /trips/:tripId/day/:dayIndex — 修改单天行程
   */
  fastify.put(
    '/trips/:tripId/day/:dayIndex',
    async (
      request: FastifyRequest<{
        Params: { tripId: string; dayIndex: string };
        Body: DayUpdateRequest;
      }>,
      reply: FastifyReply,
    ) => {
      const { tripId, dayIndex } = request.params;
      const result = await updateDayPlan(tripId, parseInt(dayIndex, 10), request.body);
      return reply.send(successResponse(result, { message: '行程已更新' }));
    },
  );

  /**
   * DELETE /trips/:tripId — 删除攻略
   */
  fastify.delete(
    '/trips/:tripId',
    async (request: FastifyRequest<{ Params: { tripId: string } }>, reply: FastifyReply) => {
      const { tripId } = request.params;
      const result = await deleteTrip(tripId);
      return reply.send(successResponse(result, { message: '攻略已删除' }));
    },
  );

  /**
   * GET /trips/:tripId/export — 导出攻略
   */
  fastify.get(
    '/trips/:tripId/export',
    async (
      request: FastifyRequest<{
        Params: { tripId: string };
        Querystring: { format?: string; size?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { tripId } = request.params;
      const trip = await getTrip(tripId);
      if (!trip) {
        return reply.status(404).send(errorResponse(ErrorCode.RESOURCE_NOT_FOUND, '攻略不存在'));
      }
      const options: ExportOptions = {
        format: (request.query.format as ExportOptions['format']) ?? 'pdf',
        size: request.query.size,
      };
      const result = await exportTrip(trip, options);
      return reply.send(successResponse(result));
    },
  );
}

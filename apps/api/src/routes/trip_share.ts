/**
 * PATH-WISE · 分享与协作路由
 * 接口：
 *   POST /trips/{tripId}/share
 *   POST /trips/{tripId}/suggestions
 *   GET /trips/{tripId}/suggestions
 *   PATCH /trips/{tripId}/suggestions/{suggestionId}
 *   GET /share/{shareId}
 *   POST /trips/{tripId}/regenerate
 *
 * 依据：docs/API接口设计规格书_v1.0.0.md §7
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type {
  SuggestionSubmitRequest,
  SuggestionActionRequest,
  TripRegenerateRequest,
} from '@path-wise/shared';
import {
  generateShareToken,
  getSuggestions,
  submitSuggestion,
  handleSuggestion,
  getShareCard,
} from '../services/share_service.js';
import { regenerateDay } from '../services/trip_service.js';
import { createSSEStream } from '../utils/sseStream.js';
import { successResponse } from '../utils/response.js';

export async function tripShareRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /trips/:tripId/share — 生成分享 Token
   */
  fastify.post(
    '/trips/:tripId/share',
    async (
      request: FastifyRequest<{
        Params: { tripId: string };
        Body: { expireDays?: number; maxUsers?: number };
      }>,
      reply: FastifyReply,
    ) => {
      const { tripId } = request.params;
      const { expireDays, maxUsers } = request.body ?? {};
      const result = await generateShareToken(tripId, expireDays, maxUsers);
      return reply.send(successResponse(result));
    },
  );

  /**
   * POST /trips/:tripId/suggestions — 提交修改建议
   */
  fastify.post(
    '/trips/:tripId/suggestions',
    async (
      request: FastifyRequest<{
        Params: { tripId: string };
        Body: SuggestionSubmitRequest;
        Headers: { 'x-share-token'?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { tripId } = request.params;
      const shareToken = request.headers['x-share-token'] ?? 'anonymous';
      const result = await submitSuggestion(tripId, request.body, shareToken);
      return reply.status(201).send(successResponse(result));
    },
  );

  /**
   * GET /trips/:tripId/suggestions — 查看修改建议列表
   */
  fastify.get(
    '/trips/:tripId/suggestions',
    async (
      request: FastifyRequest<{
        Params: { tripId: string };
        Querystring: { status?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { tripId } = request.params;
      const result = await getSuggestions(tripId, request.query.status);
      return reply.send(successResponse(result));
    },
  );

  /**
   * PATCH /trips/:tripId/suggestions/:suggestionId — 处理修改建议
   */
  fastify.patch(
    '/trips/:tripId/suggestions/:suggestionId',
    async (
      request: FastifyRequest<{
        Params: { tripId: string; suggestionId: string };
        Body: SuggestionActionRequest;
      }>,
      reply: FastifyReply,
    ) => {
      const { tripId, suggestionId } = request.params;
      const result = await handleSuggestion(tripId, suggestionId, request.body);
      return reply.send(successResponse(result));
    },
  );

  /**
   * GET /share/:shareId — 获取分享卡片数据
   */
  fastify.get(
    '/share/:shareId',
    async (request: FastifyRequest<{ Params: { shareId: string } }>, reply: FastifyReply) => {
      const result = await getShareCard(request.params.shareId);
      return reply.send(successResponse(result));
    },
  );

  /**
   * POST /trips/:tripId/regenerate — 重新生成某天行程（SSE）
   */
  fastify.post(
    '/trips/:tripId/regenerate',
    async (
      request: FastifyRequest<{
        Params: { tripId: string };
        Body: TripRegenerateRequest;
      }>,
      reply: FastifyReply,
    ) => {
      const { tripId } = request.params;
      const taskInfo = await regenerateDay(tripId, request.body);

      // SSE 流式返回（简化版）
      const sse = createSSEStream(reply);

      sse.send('connected', {
        taskId: taskInfo.taskId,
        estimatedTotalSeconds: 20,
        totalSteps: 3,
        message: '正在重新生成...',
      });

      await new Promise((r) => setTimeout(r, 800));

      sse.send('day_ready', {
        dayIndex: request.body.dayIndex,
        day: {
          dayIndex: request.body.dayIndex,
          date: '2026-07-02',
          dayType: 'city_exploration',
          cityName: '长沙',
          isFirstDayOfCity: false,
          title: `Day ${request.body.dayIndex + 1} · 重新生成`,
          timeline: [
            {
              id: 'item_regenerated_001',
              type: 'attraction',
              title: '新推荐景点',
              startTime: '09:00',
              endTime: '12:00',
              estimatedCostCNY: 0,
              energyLevel: 'MEDIUM',
              bookingRequired: false,
            },
          ],
          accommodation: null,
          tips: ['已根据新约束重新生成'],
        },
      });

      sse.send('done', {
        tripId,
        totalProcessingTimeSeconds: 5,
        summary: 'Day 已重新生成',
      });

      sse.end();
    },
  );
}

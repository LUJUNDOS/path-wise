/**
 * PATH-WISE · 攻略生成路由
 * 接口：POST /trips/generate（SSE）, GET /trips/generate/status/{taskId}, DELETE /trips/generate/{taskId}
 * 依据：docs/API接口设计规格书_v1.0.0.md §4.2~4.4
 *
 * SSE 事件流协议：
 *   connected → progress* → day_ready* → done
 *   异常时插入 error_event / warning
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { TripGenerateRequest } from '@path-wise/shared';
import { validateTripRequest, generateMockDay } from '../services/trip_service.js';
import { createSSEStream } from '../utils/sseStream.js';
import { successResponse, errorResponse } from '../utils/response.js';

/** 生成模拟耗时（ms），替代 LLM 调用 */
const MOCK_DAY_DELAY_MS = 500;

export async function tripGenerateRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /trips/generate — 发起攻略生成（SSE 流式）
   */
  fastify.post('/trips/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as TripGenerateRequest;

    // 参数校验
    if (!body.destinations?.length) {
      return reply.status(400).send(
        errorResponse(10004, 'destinations 不能为空', {
          data: { field: 'destinations', reason: '至少需要 1 个目的地' },
        }),
      );
    }

    // 冲突检测
    const validation = validateTripRequest(body);
    if (validation.conflicts.length > 0) {
      return reply.send(successResponse(validation));
    }

    // SSE 流式返回
    const sse = createSSEStream(reply);
    const taskId = `task_${Date.now().toString(36)}`;
    const totalDays = body.destinations.reduce((sum, d) => sum + d.days, 0);

    sse.send('connected', {
      taskId,
      estimatedTotalSeconds: Math.max(30, 5 + totalDays * 5),
      totalSteps: 5 + totalDays,
      message: '已开始生成，预计需要 30~60 秒',
    });

    // 逐城市、逐天生成（MVP: mock 数据，后续接入 LLM）
    let dayIndex = 1;
    for (const dest of body.destinations) {
      for (let d = 0; d < dest.days; d++) {
        await new Promise((r) => setTimeout(r, MOCK_DAY_DELAY_MS));

        sse.send('progress', {
          step: dayIndex,
          totalSteps: totalDays,
          percent: Math.round((dayIndex / totalDays) * 100),
          message: `正在为 ${dest.cityName} 第 ${d + 1} 天安排行程...`,
          subMessage: `已选择 ${dest.cityName} 热门景点`,
          estimatedRemainingSeconds: Math.max(5, 45 - dayIndex * 5),
        });

        const mockDay = generateMockDay(
          dayIndex,
          dest.cityName,
          d === 0,
          dest.days,
          body.preferences,
        );

        sse.send('day_ready', {
          dayIndex,
          day: mockDay,
        });

        dayIndex++;
      }
    }

    // 完成
    const totalCost = 5000 + Math.round(Math.random() * 3000);
    const tripId = `trip_${Date.now().toString(36)}`;
    sse.send('done', {
      tripId,
      totalProcessingTimeSeconds: 45,
      totalEstimatedCostCNY: totalCost,
      summary: `已为你生成 ${totalDays} 天行程，预计总花费约 ¥${totalCost}`,
      shareUrl: `https://tripplanner.com/share/${tripId}`,
    });

    sse.end();
  });

  /**
   * GET /trips/generate/status/{taskId} — 轮询生成进度
   */
  fastify.get(
    '/trips/generate/status/:taskId',
    async (request: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
      return reply.send(
        successResponse({
          taskId: request.params.taskId,
          status: 'completed',
          progress: {
            percent: 100,
            currentStep: '已完成',
            stepsCompleted: 10,
            totalSteps: 10,
            estimatedRemainingSeconds: 0,
          },
          tripId: `trip_${request.params.taskId.replace('task_', '')}`,
        }),
      );
    },
  );

  /**
   * DELETE /trips/generate/{taskId} — 取消生成任务
   */
  fastify.delete(
    '/trips/generate/:taskId',
    async (request: FastifyRequest<{ Params: { taskId: string } }>, reply: FastifyReply) => {
      return reply.send(
        successResponse(
          {
            taskId: request.params.taskId,
            cancelledAt: new Date().toISOString(),
            partialTripId: null,
          },
          { message: '生成任务已取消' },
        ),
      );
    },
  );
}

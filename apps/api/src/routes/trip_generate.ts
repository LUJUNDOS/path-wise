/**
 * PATH-WISE · 攻略生成路由
 * 接口：POST /trips/generate（SSE）, GET /trips/generate/status/{taskId}, DELETE /trips/generate/{taskId}
 * 依据：docs/API接口设计规格书_v1.0.0.md §4.2~4.4
 *
 * SSE 事件流协议：
 *   connected → progress* → day_ready* → done
 *   异常时插入 error 事件
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { TripGenerateRequest, TripResponse, DayPlan } from '@path-wise/shared';
import { ErrorCode } from '@path-wise/shared';
import {
  validateTripRequest,
  generateDay,
  saveTrip,
  getMockTransport,
} from '../services/trip_service.js';
import { createSSEStream } from '../utils/sseStream.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function tripGenerateRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /trips/generate — 发起攻略生成（SSE 流式）
   */
  fastify.post('/trips/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as TripGenerateRequest;
    reply.header('Access-Control-Allow-Origin', '*');

    // 参数校验
    if (!body.destinations?.length) {
      return reply.status(400).send(
        errorResponse(ErrorCode.DESTINATIONS_EMPTY, 'destinations 不能为空', {
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
      estimatedTotalSeconds: Math.max(30, totalDays * 20),
      totalSteps: totalDays,
      message: '已开始生成，正在通过 AI 为你规划行程...',
    });

    // 逐城市、逐天生成（通过 LLM，失败了降级到 mock）
    try {
      let dayIndex = 1;
      const days: DayPlan[] = [];
      const departureCity = body.departure.city;

      for (let ci = 0; ci < body.destinations.length; ci++) {
        const dest = body.destinations[ci];
        const prevCity = ci === 0 ? departureCity : body.destinations[ci - 1].cityName;
        const transport =
          ci === 0
            ? getMockTransport(departureCity, dest.cityName)
            : getMockTransport(prevCity, dest.cityName);

        for (let d = 0; d < dest.days; d++) {
          sse.send('progress', {
            step: dayIndex,
            totalSteps: totalDays,
            percent: Math.round((dayIndex / totalDays) * 100),
            message: `正在为 ${dest.cityName} 第 ${d + 1} 天安排行程...`,
            subMessage: `AI 正在规划 ${dest.cityName} 的最佳路线`,
            estimatedRemainingSeconds: Math.max(5, (totalDays - dayIndex) * 20),
          });

          try {
            const day = await generateDay({
              dayIndex,
              cityName: dest.cityName,
              isFirstDayOfCity: d === 0,
              daysInCity: dest.days,
              isLastDay: ci === body.destinations.length - 1 && d === dest.days - 1,
              preferences: body.preferences,
              travelers: body.travelers,
              transport: d === 0 ? transport : null,
              previousDays: days,
            });

            days.push(day);

            sse.send('day_ready', {
              dayIndex,
              day,
            });
          } catch (dayError: unknown) {
            // 单天生成失败，发送 warning 并结束流
            const errMsg = dayError instanceof Error ? dayError.message : '未知错误';
            sse.send('error', {
              code: ErrorCode.TRIP_GENERATION_FAILED,
              message: `第 ${dayIndex} 天行程生成失败: ${errMsg}`,
              details: errMsg,
              retryable: true,
              retryAfterSeconds: 10,
            });
            sse.end();
            return;
          }

          dayIndex++;
        }
      }

      // 完成：计算实际总花费
      const totalCost =
        days.reduce((sum: number, day: DayPlan) => {
          let dayCost = 0;
          for (const item of day.timeline) {
            dayCost += item.estimatedCostCNY || 0;
          }
          if (day.accommodation?.primary?.pricePerNight) {
            dayCost += day.accommodation.primary.pricePerNight;
          }
          return sum + dayCost;
        }, 0) + Math.round(days.length * 200); // + 日均杂费（市内交通、小吃等）

      const tripId = `trip_${Date.now().toString(36)}`;
      sse.send('done', {
        tripId,
        totalProcessingTimeSeconds: Math.round(totalDays * 20),
        totalEstimatedCostCNY: totalCost,
        summary: `已为你生成 ${totalDays} 天行程，预计总花费约 ¥${totalCost}`,
        shareUrl: `https://tripplanner.com/share/${tripId}`,
      });

      // 保存到内存存储，供 TripResultPage 查询
      const tripResponse: TripResponse = {
        tripId,
        title: `${body.destinations.map((d) => d.cityName).join(' → ')} ${totalDays} 日游`,
        generateTime: new Date().toISOString(),
        totalDays,
        totalEstimatedCostCNY: totalCost,
        departureCity: body.departure.city,
        status: 'completed',
        days,
        shareUrl: `https://tripplanner.com/share/${tripId}`,
      };
      saveTrip(tripResponse);

      sse.end();
    } catch (error: unknown) {
      // 整体异常处理
      const errMsg = error instanceof Error ? error.message : '未知错误';
      sse.send('error', {
        code: ErrorCode.TRIP_GENERATION_FAILED,
        message: `攻略生成失败: ${errMsg}`,
        details: errMsg,
        retryable: false,
      });
      sse.end();
    }
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

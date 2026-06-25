/**
 * PATH-WISE · 攻略生成路由
 * 接口：POST /trips/generate（SSE）, GET /trips/generate/status/{taskId}, DELETE /trips/generate/{taskId}
 * 依据：docs/API接口设计规格书_v1.0.0.md §4.2~4.4
 *
 * @mock MVP 阶段：生成过程为 setTimeout + trip_service mock 数据，未接入 LLM 适配器。
 *       后续需要将 L60-134 的逐城市逐天 mock 循环替换为 LLM 调用链路：
 *         trip_service.generateDay() → llm_router.routeLLM() → llm_router.generateWithLLM()
 *       接入后移除此 @mock 标记和 sse.send('warning', ...) 运行时提示。
 *
 * SSE 事件流协议：
 *   connected → warning(mock) → progress* → day_ready* → done
 *   异常时插入 error_event / warning
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { TripGenerateRequest, TripResponse, DayPlan } from '@path-wise/shared';
import { ErrorCode } from '@path-wise/shared';
import {
  validateTripRequest,
  generateMockDay,
  saveTrip,
  getMockTransport,
} from '../services/trip_service.js';
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
      estimatedTotalSeconds: Math.max(30, 5 + totalDays * 5),
      totalSteps: 5 + totalDays,
      message: '已开始生成，预计需要 30~60 秒',
    });

    // ══════════════════════════════════════════
    // ⚠️  MVP Mock 运行时提示
    // 接入 LLM 后移除本 warning
    // ══════════════════════════════════════════
    sse.send('warning', {
      code: ErrorCode.WARNING_MOCK_MODE,
      message:
        '当前为展示版，行程数据为预设模板（非 AI 实时生成）。正式版将接入 DeepSeek / GLM-4 等 LLM 引擎。',
    });

    // 逐城市、逐天生成
    // TODO(mvp): 替换为 trip_service.generateDay() → llm_router.routeLLM() → generateWithLLM()
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
          d === 0 ? transport : null,
        );

        days.push(mockDay);

        sse.send('day_ready', {
          dayIndex,
          day: mockDay,
        });

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
        if (day.accommodation) {
          dayCost += day.accommodation.primary.pricePerNight;
        }
        return sum + dayCost;
      }, 0) + Math.round(days.length * 200); // + 日均杂费（市内交通、小吃等）
    const tripId = `trip_${Date.now().toString(36)}`;
    sse.send('done', {
      tripId,
      totalProcessingTimeSeconds: 45,
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

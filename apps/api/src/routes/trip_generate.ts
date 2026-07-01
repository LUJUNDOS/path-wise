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
  generateTripViaEngine,
  saveTrip,
  getMockTransport,
} from '../services/trip_service.js';
import { validateIdempotencyKey, getIdempotencyStore } from '../services/idempotency_service.js';
import { createSSEStream } from '../utils/sseStream.js';
import type { SSEStream } from '../utils/sseStream.js';
import { successResponse, errorResponse } from '../utils/response.js';

/** 日均杂费（当地交通、零食、纪念品等零散开销，单位 CNY） */
const DAILY_MISC_COST_CNY = 200;

// ─────────────────────────────────────────────
// S2: 简单内存限流（MVP，生产可升级为 Redis 限流）
// ─────────────────────────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * 检查请求 IP 是否在限流窗口内
 * @returns true 表示未超限，false 表示已超限
 */
function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ─────────────────────────────────────────────
// S1: API Key 认证（MVP，可升级为 JWT/OAuth）
// ─────────────────────────────────────────────

/**
 * 校验请求中的 API Key
 * @returns true 表示认证通过，false 表示需要 401
 */
function authenticateApiKey(request: FastifyRequest): boolean {
  const serverApiKey = process.env.SERVER_API_KEY;
  // 未配置 SERVER_API_KEY 时跳过认证（本地开发便利）
  if (!serverApiKey) return true;

  const authHeader =
    (request.headers['x-api-key'] as string) || (request.headers['authorization'] as string);
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  return !!token && token === serverApiKey;
}

/** 计算多天行程总花费（timeline 花费 + 住宿 + 日均杂费） */
function computeTotalCost(days: DayPlan[]): number {
  return (
    days.reduce((sum, day) => {
      let dayCost = 0;
      for (const item of day.timeline) {
        dayCost += item.estimatedCostCNY || 0;
      }
      if (day.accommodation?.primary?.pricePerNight) {
        dayCost += day.accommodation.primary.pricePerNight;
      }
      return sum + dayCost;
    }, 0) + Math.round(days.length * DAILY_MISC_COST_CNY)
  );
}

/** 构建 TripResponse 对象 */
function buildTripResponse(
  days: DayPlan[],
  body: TripGenerateRequest,
  totalDays: number,
  status: 'partial' | 'completed',
): TripResponse {
  const suffix =
    status === 'partial' ? ` ${days.length}/${totalDays} 日游（部分）` : ` ${totalDays} 日游`;
  const tripId = `trip_${Date.now().toString(36)}${status === 'partial' ? '_partial' : ''}`;

  return {
    tripId,
    title: `${body.destinations.map((d) => d.cityName).join(' → ')}${suffix}`,
    generateTime: new Date().toISOString(),
    totalDays: days.length,
    totalEstimatedCostCNY: computeTotalCost(days),
    departureCity: body.departure.city,
    status,
    days,
    shareUrl: `https://tripplanner.com/share/${tripId}`,
  };
}

/**
 * 通过引擎链路生成全部天行程（initializeTimeline → buildCandidatePools → fillTimeline）
 *
 * 首选路径：引擎一次性生成所有天，然后逐天 SSE 推送。
 * 引擎失败时降级到逐天 LLM 生成（generateDay）。
 *
 * 引擎链路是纯同步计算（无 I/O），适合作为 MVP 默认生成策略。
 */
async function generateAllDaysViaEngine(
  body: TripGenerateRequest,
  sse: SSEStream,
  reply: FastifyReply,
  totalDays: number,
): Promise<DayPlan[]> {
  const engineDays = generateTripViaEngine(body);
  const days: DayPlan[] = [];

  // 逐天推送 SSE 事件
  for (let i = 0; i < engineDays.length; i++) {
    const day = engineDays[i];
    const dayIndex = day.dayIndex;

    safeSSESend(sse, reply, 'progress', {
      step: dayIndex,
      totalSteps: totalDays,
      percent: Math.round((dayIndex / totalDays) * 100),
      message: `正在为 ${day.cityName} 第 ${dayIndex} 天安排行程...`,
      subMessage: `引擎正在规划 ${day.cityName} 的最佳路线`,
      estimatedRemainingSeconds: Math.max(5, (totalDays - dayIndex) * 10),
    });

    days.push(day);
    safeSSESend(sse, reply, 'day_ready', { dayIndex, day });
  }

  return days;
}

/** 逐城市、逐天生成行程（通过 LLM，失败了降级到 mock） */
async function generateAllDays(
  body: TripGenerateRequest,
  sse: SSEStream,
  reply: FastifyReply,
  totalDays: number,
): Promise<DayPlan[]> {
  let dayIndex = 1;
  const days: DayPlan[] = [];
  const departureCity = body.departure.city;

  // 首选：引擎链路
  try {
    return await generateAllDaysViaEngine(body, sse, reply, totalDays);
  } catch (engineError: unknown) {
    // 客户端断开 — 静默退出
    if (engineError instanceof ClientDisconnectError) {
      return days;
    }
    const errMsg = engineError instanceof Error ? engineError.message : String(engineError);
    console.warn(
      `[generateAllDays] Engine pipeline failed: ${errMsg}, falling back to per-day LLM + mock`,
    );
  }

  // 降级：逐天 LLM 生成
  for (let ci = 0; ci < body.destinations.length; ci++) {
    const dest = body.destinations[ci];
    const prevCity = ci === 0 ? departureCity : body.destinations[ci - 1].cityName;
    const transport =
      ci === 0
        ? getMockTransport(departureCity, dest.cityName, body.departure.timePeriod)
        : getMockTransport(prevCity, dest.cityName, body.departure.timePeriod);

    for (let d = 0; d < dest.days; d++) {
      safeSSESend(sse, reply, 'progress', {
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
          departureDate: body.departure.date,
          departureCity: body.departure.city,
          needsReturnTransport: body.needsReturnTransport,
          returnTransportPref: body.returnTransportPref,
        });

        days.push(day);
        safeSSESend(sse, reply, 'day_ready', { dayIndex, day });
      } catch (dayError: unknown) {
        // 客户端断开连接 — 不是 LLM 失败，清理并静默退出
        if (dayError instanceof ClientDisconnectError) {
          return days;
        }
        const errMsg = dayError instanceof Error ? dayError.message : '未知错误';
        handleDayGenerationError(days, body, sse, reply, totalDays, dayIndex, errMsg);
      }

      dayIndex++;
    }
  }

  return days;
}

/** 当某天生成失败但已有部分天完成时，发送 partial 结果并抛出此标记终止生成 */
class DayGenerationPartialCompletion extends Error {
  constructor() {
    super('DAY_GENERATION_PARTIAL_COMPLETION');
    this.name = 'DayGenerationPartialCompletion';
  }
}

/** 客户端断开连接错误 — 与 LLM 失败区分开来 */
class ClientDisconnectError extends Error {
  constructor() {
    super('Client disconnected');
    this.name = 'ClientDisconnectError';
  }
}

/**
 * 安全发送 SSE 事件，客户端已断开时抛出 ClientDisconnectError
 * 避免将连接断开误判为 LLM 生成失败
 */
function safeSSESend(sse: SSEStream, reply: FastifyReply, event: string, data: unknown): void {
  // 检查底层 writable 是否仍然可用
  if (reply.raw.writableEnded || reply.raw.destroyed) {
    throw new ClientDisconnectError();
  }
  try {
    sse.send(event as Parameters<SSEStream['send']>[0], data);
  } catch (err: unknown) {
    if (
      err instanceof Error &&
      (err.message.includes('write after end') || err.message.includes('destroyed'))
    ) {
      throw new ClientDisconnectError();
    }
    throw err;
  }
}

/**
 * 处理单天生成失败：保存已有进度、发送 partial done 和 error 事件
 * @param reply - Fastify reply，用于 safeSSESend 检测连接状态
 * @returns 永远不返回（抛出 DayGenerationPartialCompletion）
 */
function handleDayGenerationError(
  daysSoFar: DayPlan[],
  body: TripGenerateRequest,
  sse: SSEStream,
  reply: FastifyReply,
  totalDays: number,
  failedDayIndex: number,
  errMsg: string,
): never {
  try {
    if (daysSoFar.length > 0) {
      const tripResponse = buildTripResponse(daysSoFar, body, totalDays, 'partial');
      saveTrip(tripResponse);
      safeSSESend(sse, reply, 'done', {
        tripId: tripResponse.tripId,
        partial: true,
        totalProcessingTimeSeconds: 0,
        totalEstimatedCostCNY: tripResponse.totalEstimatedCostCNY,
        summary: `仅生成 ${daysSoFar.length}/${totalDays} 天行程（第 ${failedDayIndex} 天失败），预计花费约 ¥${tripResponse.totalEstimatedCostCNY}`,
      });
    }
    safeSSESend(sse, reply, 'error', {
      code: ErrorCode.TRIP_GENERATION_FAILED,
      message: `第 ${failedDayIndex} 天行程生成失败: ${errMsg}`,
      details: errMsg,
      retryable: true,
      retryAfterSeconds: 10,
    });
  } catch (sendError: unknown) {
    if (sendError instanceof ClientDisconnectError) {
      // 客户端已断开，静默退出
      throw new DayGenerationPartialCompletion();
    }
    throw sendError;
  }
  sse.end();
  throw new DayGenerationPartialCompletion();
}

export async function tripGenerateRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /trips/generate — 发起攻略生成（SSE 流式）
   */
  fastify.post('/trips/generate', async (request: FastifyRequest, reply: FastifyReply) => {
    // S1: API Key 认证（在进入 SSE 生成流之前检查）
    if (!authenticateApiKey(request)) {
      return reply.status(401).send(errorResponse(ErrorCode.TOKEN_MISSING, '未提供有效的 API Key'));
    }

    // S2: 请求频率限制（在认证通过之后、SSE 建立之前检查）
    const clientIp = request.ip || (request.headers['x-forwarded-for'] as string) || 'unknown';
    if (!checkRateLimit(clientIp)) {
      return reply
        .status(429)
        .send(
          errorResponse(ErrorCode.RATE_LIMIT_TRIP_GENERATE, '攻略生成次数超限，请 1 分钟后再试'),
        );
    }

    // S3: 幂等键处理（在认证和限流之后、参数校验之前检查）
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
    const idempotencyStore = getIdempotencyStore();

    if (idempotencyKey !== undefined) {
      // 校验幂等键格式
      const keyValidation = validateIdempotencyKey(idempotencyKey);
      if (!keyValidation.valid) {
        reply.header('Access-Control-Allow-Origin', '*');
        return reply
          .status(400)
          .send(errorResponse(ErrorCode.IDEMPOTENCY_KEY_INVALID, keyValidation.reason!));
      }

      // 检查是否已有缓存
      const cached = idempotencyStore.get(idempotencyKey);

      if (cached && !cached.isExpired) {
        if (cached.status === 'completed' && cached.result) {
          // 命中缓存，直接返回已有结果
          reply.header('Access-Control-Allow-Origin', '*');
          reply.header('X-Idempotency-Replayed', 'true');
          return reply.send(successResponse(cached.result, { message: '命中幂等缓存' }));
        }
        if (cached.status === 'pending') {
          // 相同 key 的请求正在处理中
          reply.header('Access-Control-Allow-Origin', '*');
          return reply
            .status(409)
            .send(
              errorResponse(
                ErrorCode.IDEMPOTENCY_KEY_CONFLICT,
                '相同幂等键的请求正在处理中，请等待完成后重试',
              ),
            );
        }
        // cached.status === 'failed': 允许重试（继续执行后续流程）
      }

      // 标记为 pending（防并发）
      // 对于过期或失败的 key，先删除再重新标记为 pending
      if (!cached || cached.isExpired || cached.status === 'failed') {
        if (cached) {
          idempotencyStore.delete(idempotencyKey);
        }
        const accepted = idempotencyStore.setPending(idempotencyKey);
        if (!accepted) {
          reply.header('Access-Control-Allow-Origin', '*');
          return reply
            .status(409)
            .send(
              errorResponse(
                ErrorCode.IDEMPOTENCY_KEY_CONFLICT,
                '相同幂等键的请求正在处理中，请等待完成后重试',
              ),
            );
        }
      }
    }

    const body = request.body as TripGenerateRequest;
    reply.header('Access-Control-Allow-Origin', '*');

    // 参数校验
    if (!body.destinations?.length || !Array.isArray(body.destinations)) {
      // 幂等键清理：参数校验失败时释放 pending 状态
      if (idempotencyKey) {
        idempotencyStore.delete(idempotencyKey);
      }
      return reply.status(400).send(
        errorResponse(ErrorCode.DESTINATIONS_EMPTY, 'destinations 不能为空', {
          data: { field: 'destinations', reason: 'destinations 必须是数组且至少包含 1 个目的地' },
        }),
      );
    }

    // 冲突检测
    const validation = validateTripRequest(body);
    if (validation.conflicts.length > 0) {
      // 幂等键清理：冲突检测返回时释放 pending 状态
      if (idempotencyKey) {
        idempotencyStore.delete(idempotencyKey);
      }
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

    try {
      const days = await generateAllDays(body, sse, reply, totalDays);

      // 完成
      const tripResponse = buildTripResponse(days, body, totalDays, 'completed');
      sse.send('done', {
        tripId: tripResponse.tripId,
        totalProcessingTimeSeconds: Math.round(totalDays * 20),
        totalEstimatedCostCNY: tripResponse.totalEstimatedCostCNY,
        summary: `已为你生成 ${totalDays} 天行程，预计总花费约 ¥${tripResponse.totalEstimatedCostCNY}`,
        shareUrl: `https://tripplanner.com/share/${tripResponse.tripId}`,
      });
      saveTrip(tripResponse);

      // 幂等键：成功完成后缓存结果
      if (idempotencyKey) {
        idempotencyStore.setCompleted(idempotencyKey, tripResponse);
      }

      sse.end();
    } catch (error: unknown) {
      // 幂等键：生成失败时标记失败
      if (idempotencyKey) {
        const errMsg = error instanceof Error ? error.message : '未知错误';
        idempotencyStore.setFailed(idempotencyKey, errMsg);
      }

      if (error instanceof DayGenerationPartialCompletion) {
        // 错误已在 generateAllDays 内部发送，不需要额外处理
        return;
      }
      if (error instanceof ClientDisconnectError) {
        // 客户端已断开，不尝试发送任何 SSE 事件
        return;
      }
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

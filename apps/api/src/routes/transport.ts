/**
 * PATH-WISE · 交通路由
 * 接口：POST /transport/search, POST /transport/route
 * 依据：docs/API接口设计规格书_v1.0.0.md §8
 *
 * 文件名采用动词优先命名约定（如 city.ts / trip_generate.ts）。
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { TransportSearchRequest, RoutePlanRequest } from '@path-wise/shared';
import { searchTransport, planRoute } from '../services/transport_service.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { ErrorCode } from '@path-wise/shared';
import { handleServiceError } from '../utils/route_error_handler.js';

/** API Key 认证（MVP，可升级为 JWT/OAuth） */
function authenticateApiKey(request: FastifyRequest): boolean {
  const serverApiKey = process.env.SERVER_API_KEY;
  // 未配置 SERVER_API_KEY 时跳过认证（本地开发便利）
  if (!serverApiKey) return true;

  const authHeader =
    (request.headers['x-api-key'] as string) || (request.headers['authorization'] as string);
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  return !!token && token === serverApiKey;
}

export async function transportRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /transport/search — 查询大交通方案
   *
   * 请求体校验：
   *  - fromCity 必填
   *  - toCity 必填
   *  - date 格式 YYYY-MM-DD
   *  - prefer 可选，交通方式列表
   *  - departTimePeriod 可选，morning/afternoon/evening
   */
  fastify.post('/transport/search', async (request: FastifyRequest, reply: FastifyReply) => {
    // API Key 认证
    if (!authenticateApiKey(request)) {
      return reply.status(401).send(errorResponse(ErrorCode.TOKEN_MISSING, 'API Key 无效或缺失'));
    }

    try {
      const body = request.body as Record<string, unknown>;

      // 基本类型校验
      if (!body || typeof body !== 'object') {
        return reply.status(400).send(errorResponse(ErrorCode.BAD_REQUEST, '请求体格式错误'));
      }

      // fromCity 必填
      if (!body.fromCity || typeof body.fromCity !== 'string') {
        return reply.status(400).send(
          errorResponse(ErrorCode.MISSING_REQUIRED_FIELD, '缺少必填字段: fromCity', {
            data: { field: 'fromCity', reason: '出发城市不能为空' },
          }),
        );
      }

      // toCity 必填
      if (!body.toCity || typeof body.toCity !== 'string') {
        return reply.status(400).send(
          errorResponse(ErrorCode.MISSING_REQUIRED_FIELD, '缺少必填字段: toCity', {
            data: { field: 'toCity', reason: '目的城市不能为空' },
          }),
        );
      }

      // date 格式校验
      if (body.date && typeof body.date === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(body.date)) {
        return reply.status(400).send(
          errorResponse(ErrorCode.DATE_FORMAT_ERROR, '日期格式错误，应为 YYYY-MM-DD', {
            data: { field: 'date', value: body.date },
          }),
        );
      }

      // prefer 类型校验
      if (body.prefer !== undefined) {
        if (!Array.isArray(body.prefer)) {
          return reply
            .status(400)
            .send(errorResponse(ErrorCode.FIELD_FORMAT_ERROR, '字段格式错误: prefer 应为数组'));
        }
        const validTypes = ['high_speed_rail', 'normal_train', 'flight', 'bus', 'auto'];
        for (const p of body.prefer) {
          if (typeof p !== 'string' || !validTypes.includes(p)) {
            return reply
              .status(400)
              .send(
                errorResponse(
                  ErrorCode.FIELD_FORMAT_ERROR,
                  `无效的交通方式: ${p}，支持: ${validTypes.join(', ')}`,
                ),
              );
          }
        }
      }

      // departTimePeriod 校验
      if (body.departTimePeriod !== undefined) {
        if (
          typeof body.departTimePeriod !== 'string' ||
          !['morning', 'afternoon', 'evening'].includes(body.departTimePeriod)
        ) {
          return reply
            .status(400)
            .send(
              errorResponse(
                ErrorCode.FIELD_FORMAT_ERROR,
                '字段格式错误: departTimePeriod 仅支持 morning/afternoon/evening',
              ),
            );
        }
      }

      // 构造请求对象
      const searchReq: TransportSearchRequest = {
        fromCity: body.fromCity as string,
        toCity: body.toCity as string,
        date: (body.date as string) || new Date().toISOString().slice(0, 10),
        prefer: body.prefer as TransportSearchRequest['prefer'],
        departTimePeriod: body.departTimePeriod as TransportSearchRequest['departTimePeriod'],
        passengers: (body.passengers as TransportSearchRequest['passengers']) || {
          adults: 1,
          children: 0,
        },
      };

      const result = await searchTransport(searchReq);
      return reply.send(successResponse(result));
    } catch (err) {
      handleServiceError(err, reply);
    }
  });

  /**
   * POST /transport/route — 市内路线规划
   */
  fastify.post('/transport/route', async (request: FastifyRequest, reply: FastifyReply) => {
    // API Key 认证
    if (!authenticateApiKey(request)) {
      return reply.status(401).send(errorResponse(ErrorCode.TOKEN_MISSING, 'API Key 无效或缺失'));
    }

    try {
      const body = request.body as Record<string, unknown>;

      if (!body || typeof body !== 'object') {
        return reply.status(400).send(errorResponse(ErrorCode.BAD_REQUEST, '请求体格式错误'));
      }

      // city 必填
      if (!body.city || typeof body.city !== 'string') {
        return reply.status(400).send(
          errorResponse(ErrorCode.MISSING_REQUIRED_FIELD, '缺少必填字段: city', {
            data: { field: 'city' },
          }),
        );
      }

      // origin 必填
      if (
        !body.origin ||
        typeof (body.origin as Record<string, unknown>)?.lat !== 'number' ||
        typeof (body.origin as Record<string, unknown>)?.lng !== 'number'
      ) {
        return reply.status(400).send(
          errorResponse(ErrorCode.MISSING_REQUIRED_FIELD, '缺少必填字段: origin (需含 lat/lng)', {
            data: { field: 'origin' },
          }),
        );
      }

      // destination 必填
      if (
        !body.destination ||
        typeof (body.destination as Record<string, unknown>)?.lat !== 'number' ||
        typeof (body.destination as Record<string, unknown>)?.lng !== 'number'
      ) {
        return reply.status(400).send(
          errorResponse(
            ErrorCode.MISSING_REQUIRED_FIELD,
            '缺少必填字段: destination (需含 lat/lng)',
            {
              data: { field: 'destination' },
            },
          ),
        );
      }

      // mode 校验
      const validModes = ['driving', 'transit', 'walking', 'cycling'];
      if (body.mode !== undefined && (!body.mode || !validModes.includes(body.mode as string))) {
        return reply
          .status(400)
          .send(
            errorResponse(
              ErrorCode.FIELD_FORMAT_ERROR,
              `无效的出行模式: ${body.mode}，支持: ${validModes.join(', ')}`,
            ),
          );
      }

      const routeReq: RoutePlanRequest = {
        city: body.city as string,
        origin: body.origin as RoutePlanRequest['origin'],
        destination: body.destination as RoutePlanRequest['destination'],
        mode: (body.mode as RoutePlanRequest['mode']) || 'transit',
        departureTime: body.departureTime as string | undefined,
      };

      const result = await planRoute(routeReq);
      return reply.send(successResponse(result));
    } catch (err) {
      handleServiceError(err, reply);
    }
  });
}

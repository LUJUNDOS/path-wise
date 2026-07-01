/**
 * PATH-WISE · 住宿路由
 * 接口：POST /accommodation/search, POST /accommodation/booking
 * 依据：docs/API接口设计规格书_v1.0.0.md §8.3
 *
 * 文件名采用动词优先命名约定（如 city.ts / trip_generate.ts）。
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AccommodationSearchRequest, AccommodationBookingRequest } from '@path-wise/shared';
import { searchAccommodation, createBooking } from '../services/accommodation_service.js';
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

export async function accommodationRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /accommodation/search — 查询住宿推荐
   */
  fastify.post('/accommodation/search', async (request: FastifyRequest, reply: FastifyReply) => {
    // API Key 认证
    if (!authenticateApiKey(request)) {
      return reply.status(401).send(errorResponse(ErrorCode.TOKEN_MISSING, 'API Key 无效或缺失'));
    }

    try {
      const body = request.body as Record<string, unknown>;

      if (!body || typeof body !== 'object') {
        return reply.status(400).send(errorResponse(ErrorCode.BAD_REQUEST, '请求体格式错误'));
      }

      // cityName 必填
      if (!body.cityName || typeof body.cityName !== 'string') {
        return reply.status(400).send(
          errorResponse(ErrorCode.MISSING_REQUIRED_FIELD, '缺少必填字段: cityName', {
            data: { field: 'cityName', reason: '城市名称不能为空' },
          }),
        );
      }

      // checkInDate 格式校验
      if (!body.checkInDate || typeof body.checkInDate !== 'string') {
        return reply
          .status(400)
          .send(errorResponse(ErrorCode.MISSING_REQUIRED_FIELD, '缺少必填字段: checkInDate'));
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.checkInDate as string)) {
        return reply.status(400).send(
          errorResponse(ErrorCode.DATE_FORMAT_ERROR, '入住日期格式错误，应为 YYYY-MM-DD', {
            data: { field: 'checkInDate', value: body.checkInDate },
          }),
        );
      }

      // checkOutDate 格式校验
      if (!body.checkOutDate || typeof body.checkOutDate !== 'string') {
        return reply
          .status(400)
          .send(errorResponse(ErrorCode.MISSING_REQUIRED_FIELD, '缺少必填字段: checkOutDate'));
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(body.checkOutDate as string)) {
        return reply.status(400).send(
          errorResponse(ErrorCode.DATE_FORMAT_ERROR, '退房日期格式错误，应为 YYYY-MM-DD', {
            data: { field: 'checkOutDate', value: body.checkOutDate },
          }),
        );
      }

      // budget 校验
      const validBudgets = ['economy', 'comfort', 'luxury'];
      if (!body.budget || !validBudgets.includes(body.budget as string)) {
        return reply
          .status(400)
          .send(
            errorResponse(
              ErrorCode.FIELD_FORMAT_ERROR,
              `无效的预算等级，支持: ${validBudgets.join(', ')}`,
            ),
          );
      }

      // travelers 校验
      if (!body.travelers || typeof body.travelers !== 'object') {
        return reply
          .status(400)
          .send(errorResponse(ErrorCode.MISSING_REQUIRED_FIELD, '缺少必填字段: travelers'));
      }

      const tr = body.travelers as Record<string, unknown>;
      if (typeof tr.adults !== 'number' || tr.adults <= 0) {
        return reply.status(400).send(errorResponse(ErrorCode.TRAVELERS_EMPTY, '成人数量至少为 1'));
      }

      if (tr.children && !Array.isArray(tr.children)) {
        return reply
          .status(400)
          .send(errorResponse(ErrorCode.FIELD_FORMAT_ERROR, 'children 字段格式错误，应为数组'));
      }

      // 构造请求对象
      const searchReq: AccommodationSearchRequest = {
        cityName: body.cityName as string,
        checkInDate: body.checkInDate as string,
        checkOutDate: body.checkOutDate as string,
        budget: body.budget as AccommodationSearchRequest['budget'],
        preferences: body.preferences as AccommodationSearchRequest['preferences'],
        travelers: {
          adults: tr.adults as number,
          children: (tr.children || []) as { age: number }[],
        },
      };

      const result = await searchAccommodation(searchReq);
      return reply.send(successResponse(result));
    } catch (err) {
      handleServiceError(err, reply);
    }
  });

  /**
   * POST /accommodation/booking — 获取预约链接
   */
  fastify.post('/accommodation/booking', async (request: FastifyRequest, reply: FastifyReply) => {
    // API Key 认证
    if (!authenticateApiKey(request)) {
      return reply.status(401).send(errorResponse(ErrorCode.TOKEN_MISSING, 'API Key 无效或缺失'));
    }

    try {
      const body = request.body as Record<string, unknown>;

      if (!body || typeof body !== 'object') {
        return reply.status(400).send(errorResponse(ErrorCode.BAD_REQUEST, '请求体格式错误'));
      }

      // optionIndex 必填
      if (typeof body.optionIndex !== 'number') {
        return reply
          .status(400)
          .send(errorResponse(ErrorCode.MISSING_REQUIRED_FIELD, '缺少必填字段: optionIndex'));
      }

      const bookingReq: AccommodationBookingRequest = {
        optionIndex: body.optionIndex as number,
        checkInDate: (body.checkInDate as string) || new Date().toISOString().slice(0, 10),
        checkOutDate: (body.checkOutDate as string) || new Date().toISOString().slice(0, 10),
        roomType: (body.roomType as string) || '标准双床房',
      };

      const result = await createBooking(bookingReq);
      return reply.send(successResponse(result));
    } catch (err) {
      handleServiceError(err, reply);
    }
  });
}

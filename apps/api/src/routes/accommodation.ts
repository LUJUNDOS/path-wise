/**
 * PATH-WISE · 住宿路由
 * 接口：POST /accommodation/search, POST /accommodation/booking
 * 依据：docs/API接口设计规格书_v1.0.0.md §8.3
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { AccommodationSearchRequest, AccommodationBookingRequest } from '@path-wise/shared';
import { searchAccommodation, createBooking } from '../services/accommodation_service.js';
import { successResponse } from '../utils/response.js';

export async function accommodationRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /accommodation/search — 查询住宿推荐
   */
  fastify.post('/accommodation/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as AccommodationSearchRequest;
    const result = await searchAccommodation(body);
    return reply.send(successResponse(result));
  });

  /**
   * POST /accommodation/booking — 获取预约链接
   */
  fastify.post('/accommodation/booking', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as AccommodationBookingRequest;
    const result = await createBooking(body);
    return reply.send(successResponse(result));
  });
}

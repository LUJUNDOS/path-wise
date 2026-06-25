/**
 * PATH-WISE · 交通路由
 * 接口：POST /transport/search, POST /transport/route
 * 依据：docs/API接口设计规格书_v1.0.0.md §8
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { TransportSearchRequest, RoutePlanRequest } from '@path-wise/shared';
import { searchTransport, planRoute } from '../services/transport_service.js';
import { successResponse } from '../utils/response.js';

export async function transportRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /transport/search — 查询大交通方案
   */
  fastify.post('/transport/search', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as TransportSearchRequest;
    const result = await searchTransport(body);
    return reply.send(successResponse(result));
  });

  /**
   * POST /transport/route — 市内路线规划
   */
  fastify.post('/transport/route', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as RoutePlanRequest;
    const result = await planRoute(body);
    return reply.send(successResponse(result));
  });
}

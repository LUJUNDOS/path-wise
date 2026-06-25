/**
 * PATH-WISE · 城市与 POI 路由
 * 接口：GET /cities/{cityName}/pois, GET /cities/{cityName}/pois/{poiId}
 * 依据：docs/API接口设计规格书_v1.0.0.md §2.2
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { searchPOI, getPOIDetail, getSupportedCities } from '../services/city_service.js';
import { CityNotFoundError } from '../types/errors.js';
import { successResponse, errorResponse } from '../utils/response.js';

export async function cityRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /cities — 获取支持的城市列表
   */
  fastify.get('/cities', async (_request: FastifyRequest, reply: FastifyReply) => {
    const cities = getSupportedCities();
    return reply.send(successResponse(cities));
  });

  /**
   * GET /cities/:cityName/pois — 搜索城市 POI
   */
  fastify.get(
    '/cities/:cityName/pois',
    async (
      request: FastifyRequest<{
        Params: { cityName: string };
        Querystring: { category?: string; keyword?: string; energyLevel?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { cityName } = request.params;
      try {
        const pois = await searchPOI(cityName, {
          category: request.query.category as
            | 'attraction'
            | 'dining'
            | 'shopping'
            | 'hotel'
            | undefined,
          keyword: request.query.keyword,
          energyLevel: request.query.energyLevel,
        });
        return reply.send(successResponse({ cityName, pois, total: pois.length }));
      } catch (error) {
        if (error instanceof CityNotFoundError) {
          return reply.status(404).send(errorResponse(error.code, error.message));
        }
        throw error;
      }
    },
  );

  /**
   * GET /cities/:cityName/pois/:poiId — POI 详情
   */
  fastify.get(
    '/cities/:cityName/pois/:poiId',
    async (
      request: FastifyRequest<{
        Params: { cityName: string; poiId: string };
      }>,
      reply: FastifyReply,
    ) => {
      const { cityName, poiId } = request.params;
      const poi = await getPOIDetail(cityName, poiId);
      if (!poi) {
        return reply.status(404).send(errorResponse(20005, 'POI 不存在'));
      }
      return reply.send(successResponse(poi));
    },
  );
}

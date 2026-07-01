/**
 * PATH-WISE · Fastify 应用工厂（可测试）
 *
 * 与 server.ts 不同，此文件导出 buildApp() 异步工厂函数，
 * 在测试中可构建 Fastify 实例而无需监听端口。
 * 生产启动使用 server.ts，测试使用 app.ts。
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import fastifyEnv from '@fastify/env';

import { errorHandlerPlugin } from './plugins/error_handler.js';
import { responseTimingPlugin } from './plugins/response_timing.js';

// 路由
import { tripGenerateRoutes } from './routes/trip_generate.js';
import { tripCrudRoutes } from './routes/trip_crud.js';
import { tripShareRoutes } from './routes/trip_share.js';
import { transportRoutes } from './routes/transport.js';
import { accommodationRoutes } from './routes/accommodation.js';
import { cityRoutes } from './routes/city.js';
import { userRoutes } from './routes/user.js';
import { shareCoverRoutes } from './routes/share_cover.js';

const envSchema = {
  type: 'object' as const,
  required: ['DATABASE_URL'],
  properties: {
    PORT: { type: 'number' as const, default: 3000 },
    HOST: { type: 'string' as const, default: '0.0.0.0' },
    DATABASE_URL: {
      type: 'string' as const,
      default: 'postgresql://postgres:postgres@localhost:5432/pathwise',
    },
    REDIS_URL: { type: 'string' as const, default: 'redis://localhost:6379' },
    NODE_ENV: { type: 'string' as const, default: 'development' },
  },
};

/**
 * 构建可测试的 Fastify 应用实例
 * 不连接数据库、不启动服务监听
 * @param opts - 选项：skipPrisma 跳过数据库连接, trustProxy 信任代理头
 */
export async function buildApp(
  opts: { skipPrisma?: boolean; trustProxy?: boolean } = {},
): Promise<ReturnType<typeof Fastify>> {
  const app = Fastify({
    logger: false,
    trustProxy: opts.trustProxy ?? true,
  });

  // 基础设施插件
  await app.register(cors);
  await app.register(sensible);
  await app.register(fastifyEnv, { schema: envSchema, dotenv: true });
  // 跳过 Prisma 连接（测试中不需要真实数据库）
  if (!opts.skipPrisma) {
    try {
      const prismaPlugin = (await import('./plugins/prisma.js')).default;
      await app.register(prismaPlugin);
    } catch {
      // Prisma 不可用时静默跳过
    }
  }

  // 全局错误处理器
  await app.register(errorHandlerPlugin);
  // 响应耗时注入
  await app.register(responseTimingPlugin);

  // API 路由（prefix: /api/v1）
  await app.register(
    async (api) => {
      await api.register(tripGenerateRoutes);
      await api.register(tripCrudRoutes);
      await api.register(tripShareRoutes);
      await api.register(transportRoutes);
      await api.register(accommodationRoutes);
      await api.register(cityRoutes);
      await api.register(userRoutes);
      await api.register(shareCoverRoutes);
    },
    { prefix: '/api/v1' },
  );

  // Health check
  app.get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() };
  });

  return app;
}

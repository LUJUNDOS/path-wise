/**
 * PATH-WISE · 环境变量校验插件
 * 依据：docs/项目初始化指南_v1.0.0.md L419-437
 *
 * 注册 @fastify/env，启动时校验必需环境变量。
 */

import fastifyEnv from '@fastify/env';

declare module 'fastify' {
  interface FastifyInstance {
    config: {
      PORT: number;
      HOST: string;
      DATABASE_URL: string;
      REDIS_URL: string;
      NODE_ENV: string;
    };
  }
}

const envSchema = {
  type: 'object',
  required: ['DATABASE_URL'],
  properties: {
    PORT: {
      type: 'number',
      default: 3000,
    },
    HOST: {
      type: 'string',
      default: '0.0.0.0',
    },
    DATABASE_URL: {
      type: 'string',
      default: 'postgresql://postgres:postgres@localhost:5432/pathwise',
    },
    REDIS_URL: {
      type: 'string',
      default: 'redis://localhost:6379',
    },
    NODE_ENV: {
      type: 'string',
      default: 'development',
    },
  },
};

const envOptions = {
  schema: envSchema,
  dotenv: true,
};

export async function envPlugin(fastify: import('fastify').FastifyInstance): Promise<void> {
  await fastify.register(fastifyEnv, envOptions);
}

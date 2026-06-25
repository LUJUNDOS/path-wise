/**
 * PATH-WISE · Prisma Client 插件
 * 连接 PostgreSQL 并在 Fastify 实例上暴露 prisma 实例。
 */

import { PrismaClient } from "@prisma/client";
import fp from "fastify-plugin";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

const prismaPlugin = fp(async (fastify) => {
  const prisma = new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "info", "warn", "error"]
        : ["error"],
  });

  await prisma.$connect();
  fastify.log.info("Prisma Client connected to PostgreSQL");

  // 装饰实例
  fastify.decorate("prisma", prisma);

  // 关闭时断连
  fastify.addHook("onClose", async (instance) => {
    await instance.prisma.$disconnect();
    instance.log.info("Prisma Client disconnected");
  });
});

export default prismaPlugin;

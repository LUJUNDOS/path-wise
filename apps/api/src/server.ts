/**
 * PATH-WISE · API Server 入口
 * 框架：Fastify 4.28+
 * 依据：docs/项目初始化指南_v1.0.0.md + docs/API接口设计规格书_v1.0.0.md §2.2
 *
 * 注册链：cors → sensible → error_handler → 路由组
 */

import Fastify from "fastify";
import cors from "@fastify/cors";
import sensible from "@fastify/sensible";

import { errorHandlerPlugin } from "./plugins/error_handler.js";
import { envPlugin } from "./plugins/env.js";
import prismaPlugin from "./plugins/prisma.js";

// 路由
import { tripGenerateRoutes } from "./routes/trip_generate.js";
import { tripCrudRoutes } from "./routes/trip_crud.js";
import { tripShareRoutes } from "./routes/trip_share.js";
import { transportRoutes } from "./routes/transport.js";
import { accommodationRoutes } from "./routes/accommodation.js";
import { cityRoutes } from "./routes/city.js";
import { userRoutes } from "./routes/user.js";
import { shareCoverRoutes } from "./routes/share_cover.js";

const server = Fastify({
  logger: {
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
  },
});

async function start(): Promise<void> {
  // ── 1. 基础设施插件 ──
  await server.register(cors);
  await server.register(sensible);
  await server.register(envPlugin);
  await server.register(prismaPlugin);

  // ── 2. 全局错误处理器 ──
  await server.register(errorHandlerPlugin);

  // ── 3. API 路由（prefix: /api/v1）──
  await server.register(
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
    { prefix: "/api/v1" },
  );

  // ── 4. Health Check ──
  server.get("/health", async () => {
    return {
      status: "ok",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });

  // ── 5. 已注册路由列表（开发调试用）──
  server.get("/api/v1/routes", async () => {
    const routes: string[] = [];
    server.printRoutes({ commonPrefix: false });
    return { routes };
  });

  // ── 6. 启动 ──
  const port = parseInt(process.env.PORT || "3000", 10);
  const host = process.env.HOST || "0.0.0.0";

  try {
    await server.listen({ port, host });
    server.log.info(`PATH-WISE API Server running at http://${host}:${port}`);
    server.log.info(`Health check: http://${host}:${port}/health`);
    server.log.info(`API base: http://${host}:${port}/api/v1`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();

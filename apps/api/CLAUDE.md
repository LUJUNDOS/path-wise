# apps/api · CLAUDE.md

> 操作 `apps/api/` 目录下文件时自动加载。与根 [CLAUDE.md](../CLAUDE.md) 组合生效。

---

## 文件命名

| 位置                  | 命名方式                      | 示例                                  |
| --------------------- | ----------------------------- | ------------------------------------- |
| 路由（`routes/`）     | `snake_case`                  | `city_service.ts`、`trip_generate.ts` |
| 插件（`plugins/`）    | `snake_case`                  | `error_handler.ts`、`env.ts`          |
| 服务（`services/`）   | `snake_case`                  | `city_service.ts`、`trip_service.ts`  |
| 适配器（`adapters/`） | `snake_case`                  | `amap_adapter.ts`、`llm_router.ts`    |
| 类型（`types/`）      | `PascalCase`                  | `errors.ts`                           |
| 工具（`utils/`）      | `camelCase`                   | `formatDate.ts`、`debounce.ts`        |
| 测试文件              | 源文件名 + `.test` 或 `.spec` | `city_service.test.ts`                |

## 架构分层

```
路由层（routes）  → 只做参数校验 + 响应组装
服务层（services）→ 业务逻辑编排
适配器层（adapters）→ 第三方 API 封装（高德/LLM/天气）
```

**绝对禁止**：路由直接调用适配器、服务直接响应 HTTP。

## 导入规范

```typescript
// 1. 标准库
import { randomUUID } from 'node:crypto';

// 2. 第三方包
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';

// 3. 共享类型
import type { TripRequest } from '@path-wise/shared';

// 4. 本地模块
import { CityNotFoundError } from '../types/errors.js';
import { searchPOI } from '../services/city_service.js';
```

## 常用命令

```bash
npx pnpm --filter api dev            # tsx watch src/server.ts
npx pnpm --filter api exec npx tsc --noEmit  # 类型检查
npx pnpm --filter api db:push        # Schema 直接推送
npx pnpm --filter api db:generate    # 生成 Prisma Client
npx pnpm --filter api db:studio      # Prisma Studio
npx pnpm --filter api exec npx tsx prisma/seed.ts  # 运行 seed
```

## 关键依赖

| 包                                   | 用途                       |
| ------------------------------------ | -------------------------- |
| `fastify` 4.28+                      | HTTP 框架                  |
| `@fastify/cors` / `sensible` / `env` | CORS / 错误增强 / 环境校验 |
| `fastify-plugin`                     | 封装 Prisma 插件           |
| `@prisma/client`                     | ORM                        |
| `@path-wise/shared`                  | 共享类型（workspace:\*）   |

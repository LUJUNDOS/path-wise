---
name: init-project
description: Bootstrap the PATH-WISE monorepo from scratch — package.json, workspaces, frontend, backend, Docker, Prisma, and environment config.
disable-model-invocation: true
---

# PATH-WISE 项目初始化

按《项目初始化指南\_v1.0.0.md》自动化搭建整个 monorepo。

## 执行步骤

### Step 1: 检查环境

```bash
node --version   # ≥ 22
pnpm --version   # ≥ 9
docker --version # 需要 Docker Desktop
```

### Step 2: 初始化 Git

```bash
git init
```

### Step 3: 创建目录结构

```
apps/web/src/{components,pages,hooks,lib,types}
apps/api/src/{routes,plugins,services,adapters,types,utils}
apps/api/prisma
packages/shared/src/{types,utils}
docker/postgres
docker/redis
scripts
```

### Step 4: 创建根配置文件

- `pnpm-workspace.yaml` — packages: ['apps/*', 'packages/*']
- `package.json` — 根配置含 `dev`/`build`/`test`/`lint`/`format` 脚本
- `tsconfig.json` — 根 TypeScript 配置
- `.gitignore` — node_modules, dist, .env, etc.
- `.env.example` — 所有必需环境变量模板

### Step 5: 安装根依赖

```bash
pnpm install
```

### Step 6: 初始化前端 (apps/web)

```bash
pnpm create vite web --template react-ts
cd apps/web
pnpm add react-router-dom zustand @tanstack/react-query axios lucide-react
pnpm add -D tailwindcss postcss autoprefixer
pnpm dlx shadcn-ui@latest init
```

shadcn/ui 初始化选项: Style=Default, Base=Slate, CSS variables=Yes, 别名=@/components 和 @/lib/utils

### Step 7: 初始化后端 (apps/api)

```bash
pnpm add fastify @fastify/cors @fastify/sensible @fastify/env @vercel/ai openai axios
pnpm add -D typescript @types/node tsx prisma jest @types/jest supertest
pnpm prisma init
```

写入 Prisma schema（参考 @docs/项目初始化指南\_v1.0.0.md 第五章）

### Step 8: 配置 Docker

写入 `docker/docker-compose.yml`（PostgreSQL 16 + Redis 7）
写入 `docker/postgres/init.sql`（cities 表 + 示例数据）

### Step 9: 生成 .env

复制 `.env.example` → `.env`，提示用户填写 API Key。

## 验证

```bash
docker-compose -f docker/docker-compose.yml up -d
pnpm prisma migrate dev
pnpm --filter web dev     # → localhost:5173
pnpm --filter api dev     # → localhost:3000
```

## 参考

- @docs/项目初始化指南\_v1.0.0.md — 完整初始化步骤
- @docs/技术栈选型文档\_v1.0.0.md — 技术栈详细说明
- @docs/数据库设计规格书\_v1.0.0.md — 完整 Prisma Schema

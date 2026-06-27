---
allowed-tools: Bash(docker compose:*), Bash(docker:*), Bash(netstat:*), Bash(npx pnpm:*), Bash(cd * pnpm *), Bash(cd * npx *), Bash(cd * node *)
description: 一键启动/停止 PATH-WISE 开发环境（PostgreSQL + Redis + API Server + Vite）
argument-hint: '[up|down|status]'
---

# DEV / 开发环境管理

一键启动或停止 PATH-WISE 全部本地服务。

## 用法

```bash
/dev          # 默认 up：启动所有服务
/dev up       # 启动全部服务
/dev down     # 停止全部服务
/dev status   # 查看各服务运行状态
```

## 参数解析

若 `$ARGUMENTS` 包含 `down` → 执行停止流程；`status` → 执行状态检查；其他/空 → 执行启动流程。

## 启动流程（up）

按依赖顺序启动：

### 1. 基础设施（Docker）

检查 Docker 容器状态，若未运行则启动：

```bash
docker compose -f f:/CCProjects/path-wise/docker/docker-compose.yml up -d
```

### 2. 数据库迁移

```bash
cd f:/CCProjects/path-wise/apps/api && npx prisma migrate deploy
```

### 3. API Server（端口 3000）

先检查端口 3000 是否占用：

```bash
netstat -ano | findstr :3000
```

若已占用则跳过；否则后台启动并等待 "Server listening" 日志：

```bash
cd f:/CCProjects/path-wise/apps/api && npx pnpm dev
```

等待日志中出现 `Server listening at http://0.0.0.0:3000` 即启动成功。

### 4. 前端 Vite（端口 5173）

先检查端口 5173 是否占用：

```bash
netstat -ano | findstr :5173
```

若已占用则跳过；否则后台启动并等待 "ready" 日志：

```bash
cd f:/CCProjects/path-wise/apps/web && npx pnpm dev
```

等待日志中出现 `VITE` + `ready in` 即启动成功。

### 5. 最终输出

以表格汇总各服务状态和访问地址。

## 停止流程（down）

依次停止所有服务：

1. 停止 Docker Compose 容器（保留数据卷）：

```bash
docker compose -f f:/CCProjects/path-wise/docker/docker-compose.yml down
```

2. 不自动 kill 端口 3000 / 5173 的 Node 进程（可能由其他终端管理）。如需强制停止，让用户手动操作。

输出停止确认。

## 状态检查（status）

检查并输出以下各层状态：

| 服务       | 检查方式                                                           |
| ---------- | ------------------------------------------------------------------ | ----------------------- |
| PostgreSQL | `docker ps --filter name=pathwise-postgres --format "{{.Status}}"` |
| Redis      | `docker ps --filter name=pathwise-redis --format "{{.Status}}"`    |
| API        | `netstat -ano                                                      | findstr :3000` 是否占用 |
| Vite       | `netstat -ano                                                      | findstr :5173` 是否占用 |

状态表格 + 建议："如果服务未运行，执行 `/dev up` 一键启动。"

## 端口速查

| 服务         | 端口 | 地址                  |
| ------------ | ---- | --------------------- |
| Vite（前端） | 5173 | http://localhost:5173 |
| API Server   | 3000 | http://localhost:3000 |
| PostgreSQL   | 5432 | localhost:5432        |
| Redis        | 6379 | localhost:6379        |

## 前置条件

- Docker Desktop 已安装并运行
- 项目根目录 `f:/CCProjects/path-wise`
- `apps/api/.env` 已配置数据库连接

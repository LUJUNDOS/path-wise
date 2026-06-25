# apps/web · CLAUDE.md

> 操作 `apps/web/` 目录下文件时自动加载。与根 [CLAUDE.md](../CLAUDE.md) 组合生效。

---

## 文件命名

| 位置                  | 命名方式     | 示例                                 |
| --------------------- | ------------ | ------------------------------------ |
| 组件（`components/`） | `PascalCase` | `TripPlanner.tsx`、`CityCard.tsx`    |
| 页面（`pages/`）      | `PascalCase` | `HomePage.tsx`、`TripDetailPage.tsx` |
| Hooks（`hooks/`）     | `camelCase`  | `useTripGeneration.ts`、`useSSE.ts`  |
| 工具（`lib/`）        | `camelCase`  | `formatDate.ts`、`apiClient.ts`      |
| 类型（`types/`）      | `PascalCase` | `TripPlan.ts`                        |

## 架构分层

```
pages/          → 页面组件，组合 UI + 业务
components/     → 共享 UI 组件（shadcn/ui 代码复制模式）
hooks/          → 自定义逻辑（数据请求、SSE 连接、状态管理）
lib/            → 纯工具函数
```

**组件归属**：仅一个页面使用的组件放该页面目录；≥2 个页面使用则提取到 `components/`。

## 状态管理

- **Zustand** — 全局 UI 状态（如生成进度抽屉开关）
- **TanStack Query** — 服务端数据缓存（API 请求自动缓存/重验证）

## 导入规范

```typescript
// 1. 标准库
// 2. 第三方包
import { create } from 'zustand';
import { useQuery } from '@tanstack/react-query';
// 3. 共享类型
import type { TripRequest, DayPlan } from '@path-wise/shared';
// 4. 本地模块
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/apiClient';
```

## 常用命令

```bash
npx pnpm --filter web dev                          # Vite dev server（:5173）
npx pnpm dlx shadcn@latest add <component-name>    # 添加 shadcn/ui 组件
```

## 关键依赖

| 包                               | 用途      |
| -------------------------------- | --------- |
| `react` 18.3+ / `react-dom`      | UI 框架   |
| `react-router-dom` 6.28+         | 路由      |
| `@tanstack/react-query` 5+       | 数据缓存  |
| `zustand` 4.5+                   | 全局状态  |
| `shadcn/ui` + `tailwindcss` 3.4+ | UI 组件库 |
| `lucide-react`                   | 图标      |

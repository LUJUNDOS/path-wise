# PATH-WISE · CLAUDE.md（根）

> 始终加载。操作 `apps/api/` 或 `apps/web/` 时，对应目录的 CLAUDE.md 会自动合并。

---

## 1. 项目概览

PATH-WISE — 旅游攻略生成平台（全栈 TypeScript，pnpm monorepo）。

**所有设计以 `docs/` 为单一事实来源，编码前必须查阅对应规格书。**

### 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + Vite + shadcn/ui + Tailwind CSS + Zustand + TanStack Query + React Router 6.28 |
| 后端 | Fastify 4.28+ + Prisma 5.15+ |
| 数据库 | PostgreSQL 16 + Redis 7 |
| LLM | DeepSeek / GLM-4 / Kimi / MiMo（via `ai` SDK） |
| 外部 API | 高德地图 / 和风天气 / 12306 |

### 端口

| 服务 | 端口 |
|------|------|
| 前端 (Vite) | 5173 |
| API Server | 3000 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| Prisma Studio | 5555 |

### 环境变量

以 `apps/api/.env.example` 为模板创建 `apps/api/.env`。禁止将真实 Key 提交到 Git。

---

## 2. 目录约束

| 约束 | 说明 |
|------|------|
| 禁止跨层引用 | `apps/web/` 不得直接引用 `apps/api/src/`，必须通过 `packages/shared/` 或 API |
| 适配器隔离 | 第三方 API 封装放 `adapters/`，路由/服务层不直接调外部 API |
| 类型优先 shared | 前后端共用类型放 `packages/shared/src/types/` |

新增文件前先读 [CODE_MAP.md](CODE_MAP.md)，新增目录/模块后同步更新。

---

## 3. 行为约束

### 设计文档优先

- **动手前先读 docs** — 在 `docs/` 中搜索相关规格书
- **以 docs 为真理** — 代码与设计矛盾时，改代码
- **不确定时不猜** — 无规格时标记待确认

### 代码修改边界

- **最小改动** — 只改任务相关文件
- **先读后改** — 修改前先 Read
- **不改配置文件** — tsconfig/package.json/Docker/ESLint/Prettier 不擅自改
- **不自动合并** — 不自动 git merge/rebase/push

### 安全与质量

- **不写密钥**、**异常必捕获**、**禁止 any**、**SQL 参数化**

### 沟通

- **先结论后原因**、**≥3 步先计划**、**含糊先提问**、**不确定说不知道**

---

## 4. 按需加载

| 场景 | 读取文件 |
|------|---------|
| 生成代码/提交/测试报告 | [.claude/rules/output-formats.md](.claude/rules/output-formats.md) |
| 查找设计文档 | [.claude/rules/doc-index.md](.claude/rules/doc-index.md) |
| 查找文件位置 | [CODE_MAP.md](CODE_MAP.md) |

---

## 5. CODE_MAP.md 自动同步

每次对话开始时，`SessionStart` hook 自动运行 `scripts/sync-code-map.ps1`，对比 `docs/` 和 `apps/` 与上次快照的差异。如有变更，写入 `.claude/.code-map-changes.md`。

### 你必须执行

1. 对话开始时，**先检查** `.claude/.code-map-changes.md` 是否存在
2. 如存在，**立即阅读**并按变更清单更新 [CODE_MAP.md](CODE_MAP.md)，然后**删除该报告文件**
3. 如不存在，跳过

> `.code-map-snapshot.json` 由脚本自动维护，不要手动编辑。新增目录/模块后仍应主动更新 [CODE_MAP.md](CODE_MAP.md)。

---

## 6. Gotcha

- Git **零提交**，尽快首次 commit
- **shadcn/ui 是代码复制模式**（非 npm 包），组件在 `apps/web/src/components/ui/`
- ⚠️ `docker/docker-compose.yml` L28：redis.conf 路径 `./docker/redis/redis.conf` 应为 `./redis/redis.conf`
- pnpm 需通过 `npx pnpm` 调用
- Windows 下需分离终端运行 dev（`&` 并行可能异常）
- 测试/ESLint/Husky 暂不可运行（缺配置文件）

---

> **最后更新**：2026-06-23

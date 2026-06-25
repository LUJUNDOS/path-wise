# P2-2 · 接入 LLM 调用链路，移除 SSE Mock 数据

## 背景

当前 `POST /trips/generate` SSE 接口返回的是 `CITY_DATA` 静态硬编码数据，标注为 `@mock MVP 阶段` / `TODO(mvp)`。MVP 阶段可接受，正式版需接入真实 LLM。

## 涉及文件

- [ ] [apps/api/src/routes/trip_generate.ts](apps/api/src/routes/trip_generate.ts) — L67-73 移除 SSE warning mock 提示，L76-117 替换 setTimeout mock 循环
- [ ] [apps/api/src/adapters/llm_router.ts](apps/api/src/adapters/llm_router.ts) — L62-108 `generateWithLLM()` 接入 ai SDK
- [ ] [apps/api/src/services/trip_service.ts](apps/api/src/services/trip_service.ts) — 后续 `CITY_DATA` 迁移到数据库 + 高德 API

## 替换链路

```
trip_generate.ts L76（目前: setTimeout + generateMockDay）
        ↓ 替换为
trip_service.generateDay() → llm_router.routeLLM() → llm_router.generateWithLLM()
        ↓ 接入
ai SDK（@ai-sdk/deepseek / @ai-sdk/glm 等）
```

## 任务清单

1. 安装 ai SDK：`@ai-sdk/deepseek`、`@ai-sdk/glm` 等
2. 实现 `generateWithLLM()` — 按 `routeLLM()` 的决策结果调用对应 SDK
3. 替换 `trip_generate.ts` L76-117 — 移除 `setTimeout` mock 循环
4. 移除 SSE `warning` 事件 — L67-73
5. 清理 `@mock` / `TODO(mvp)` 标记 — 3 个文件共 6 处
6. 后续：`CITY_DATA` → 数据库 + 高德 API

## 标记位置（共 6 处）

| 文件               | 行      | 类型                  |
| ------------------ | ------- | --------------------- |
| `trip_generate.ts` | L6-9    | `@mock` + `TODO(mvp)` |
| `trip_generate.ts` | L67-73  | SSE warning           |
| `trip_generate.ts` | L76     | `TODO(mvp)`           |
| `llm_router.ts`    | L7-13   | `@mock`               |
| `llm_router.ts`    | L62, 70 | `@mock` + `TODO(mvp)` |
| `trip_service.ts`  | L5-9    | `@mock`               |

## 优先级

P2 — 非阻塞，但正式版前必须完成。

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)

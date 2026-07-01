# PATH-WISE · 代码地图

> **生成日期**：2026-06-23
> **总代码行数**：~3,900 行（不含 docs、config）
> **文件数量**：~90 个源文件（含 37 份设计文档）

---

## 一、全局目录总览

```
path-wise/
├── apps/api/          ← 后端 API Server（Fastify 4.28+）
├── apps/web/          ← 前端 SPA（React 18 + Vite + Tailwind）
├── packages/shared/   ← 前后端共享类型
├── docker/            ← 基础设施（PostgreSQL 16 + Redis 7）
├── docs/              ← 设计文档（37 份，项目单一事实来源）
├── scripts/           ← 工具脚本
└── .claude/           ← Claude Code 配置
```

```
path-wise/
├── apps/
│   ├── web/                          # 前端（React + Vite + shadcn/ui）
│   │   ├── src/
│   │   │   ├── components/           # 共享 UI 组件（PascalCase）
│   │   │   ├── pages/                # 页面组件（PascalCase）
│   │   │   ├── hooks/                # 自定义 Hooks（camelCase）
│   │   │   ├── lib/                  # 工具函数（camelCase）
│   │   │   ├── types/                # 前端专用类型（PascalCase）
│   │   │   ├── App.tsx               # 根组件
│   │   │   └── main.tsx              # 入口
│   │   ├── public/                   # 静态资源
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tailwind.config.ts
│   │   └── tsconfig.json
│   │
│   └── api/                          # 后端（Fastify + TypeScript）
│       ├── src/
│       │   ├── routes/               # API 路由（snake_case）
│       │   ├── plugins/              # Fastify 插件（snake_case）
│       │   ├── services/             # 业务逻辑（snake_case）
│       │   ├── adapters/             # 第三方 API 适配器（snake_case）
│       │   ├── types/                # 后端专用类型（PascalCase）
│       │   ├── utils/                # 工具函数（camelCase）
│       │   └── server.ts             # 入口文件
│       ├── prisma/
│       │   ├── schema.prisma         # 数据库 Schema
│       │   └── migrations/           # 迁移文件（snake_case 命名）
│       ├── package.json
│       └── tsconfig.json
│
├── packages/
│   └── shared/                       # 前后端共享（⚠️ 尚未创建）
│       ├── src/
│       │   ├── types/                # 共享类型定义（PascalCase）
│       │   └── utils/                # 共享工具函数（camelCase）
│       └── package.json
│
├── docker/                           # 基础设施（Docker Compose）
├── docs/                             # 设计文档（37 份）
├── scripts/                          # 工具脚本
├── package.json                      # Monorepo 根配置
├── pnpm-workspace.yaml

```

| 约束            | 说明                                                                                    |
| --------------- | --------------------------------------------------------------------------------------- |
| 禁止跨层引用    | `apps/web/` 不得直接引用 `apps/api/src/`，必须通过 `packages/shared/` 或 API 调用       |
| 组件归属        | 仅一个页面使用的组件放该页面目录；≥2 个页面使用则提取到 `components/`                   |
| 适配器隔离      | 第三方 API 适配器全部放 `adapters/`，禁止在 `services/` 或 `routes/` 中直接调用外部 API |
| 类型优先 shared | 前后端共用的类型必须放在 `packages/shared/src/types/`，禁止各自定义重复类型             |
| 迁移文件命名    | `snake_case`，简洁描述变更内容（`docs/数据库迁移策略文档_v1.0.0.md` §三 L122-130）      |

---

## 二、后端 · `apps/api/`（~2,600 行）

### 2.0 目录级指南

| 文件                            | 行  | 职责                                                                  |
| ------------------------------- | --- | --------------------------------------------------------------------- |
| [CLAUDE.md](apps/api/CLAUDE.md) | 66  | 后端专用指南：命名规范/分层架构/导入/命令——操作此目录下文件时自动加载 |

### 2.1 入口与配置

| 文件                                    | 行  | 职责                                                                                                        |
| --------------------------------------- | --- | ----------------------------------------------------------------------------------------------------------- |
| [src/server.ts](apps/api/src/server.ts) | 89  | Fastify 入口：注册 cors → sensible → env → prisma → error_handler → 8 路由组（prefix `/api/v1`）→ `/health` |
| [package.json](apps/api/package.json)   | —   | fastify 4.28、@fastify/cors/sensible/env、prisma、ai SDK、openai、axios                                     |
| [tsconfig.json](apps/api/tsconfig.json) | —   | ES2022 + bundler + paths alias `@path-wise/shared`                                                          |

### 2.2 插件 · `src/plugins/`

| 文件                                                      | 行  | 职责                                                                                                     |
| --------------------------------------------------------- | --- | -------------------------------------------------------------------------------------------------------- |
| [error_handler.ts](apps/api/src/plugins/error_handler.ts) | 71  | 全局错误处理器：分类 Fastify 内置/FST_ERR_VALIDATION/未知 → 统一 `ErrorResponse` 信封 → 生产隐藏 details |
| [env.ts](apps/api/src/plugins/env.ts)                     | 58  | `@fastify/env` 注册，校验 DATABASE_URL/PORT/HOST/REDIS_URL/NODE_ENV                                      |
| [prisma.ts](apps/api/src/plugins/prisma.ts)               | 36  | `fastify-plugin`：连接 PostgreSQL、装饰 `fastify.prisma`、onClose 断连                                   |

### 2.3 路由 · `src/routes/` — 24 + 2 接口

| 文件                                                     | 行  | 接口数 | 端点                                                                                                                                 |
| -------------------------------------------------------- | --- | ------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| [trip_generate.ts](apps/api/src/routes/trip_generate.ts) | 201 | 3      | `POST /trips/generate`（SSE）、`GET /status/{taskId}`、`DELETE /{taskId}`                                                            |
| [trip_crud.ts](apps/api/src/routes/trip_crud.ts)         | 219 | 6      | `POST /validate`、`GET /{tripId}`、`GET /day/{dayIndex}`、`PUT /day/{dayIndex}`、`DELETE /{tripId}`、`GET /export`                   |
| [trip_share.ts](apps/api/src/routes/trip_share.ts)       | 229 | 6      | `POST /share`、`POST /suggestions`、`GET /suggestions`、`PATCH /suggestions/{id}`、`GET /share/{shareId}`、`POST /regenerate`（SSE） |
| [transport.ts](apps/api/src/routes/transport.ts)         | 45  | 2      | `POST /transport/search`、`POST /transport/route`                                                                                    |
| [accommodation.ts](apps/api/src/routes/accommodation.ts) | 57  | 2      | `POST /accommodation/search`、`POST /accommodation/booking`                                                                          |
| [city.ts](apps/api/src/routes/city.ts)                   | 99  | 3      | `GET /cities`、`GET /{cityName}/pois`、`GET /{cityName}/pois/{poiId}`                                                                |
| [user.ts](apps/api/src/routes/user.ts)                   | 61  | 2      | `GET /users/{userId}/preferences`、`PUT /users/{userId}/preferences`                                                                 |
| [share_cover.ts](apps/api/src/routes/share_cover.ts)     | 27  | 1      | `GET /share/cover/{tripId}` → 302                                                                                                    |

### 2.4 服务 · `src/services/`

| 文件                                                                                 | 行  | 职责                                                            | 状态                         |
| ------------------------------------------------------------------------------------ | --- | --------------------------------------------------------------- | ---------------------------- |
| [trip_service.ts](apps/api/src/services/trip_service.ts)                             | 133 | 攻略生成编排（validate / CRUD / export / regenerate）           | MVP stub                     |
| [trip_engine.ts](apps/api/src/services/trip_engine.ts)                               | 350 | Trip Lifecycle 引擎 — 时间轴初始化（ENGINE-001）                | ✅ 已交付                    |
| [trip_engine.test.ts](apps/api/src/services/trip_engine.test.ts)                     | 350 | ENGINE-001 单元测试 — 32 用例覆盖日类型/边界/时间窗口/返程日    | ✅ 全部通过                  |
| [trip_engine_candidate.ts](apps/api/src/services/trip_engine_candidate.ts)           | 230 | Trip Lifecycle 引擎 — 候选池生成与过滤（ENGINE-002）            | ✅ 已交付                    |
| [trip_engine_candidate.test.ts](apps/api/src/services/trip_engine_candidate.test.ts) | 320 | ENGINE-002 单元测试 — 29 用例覆盖构建/四维过滤/边界/配置        | ✅ 全部通过                  |
| [trip_engine_fill.ts](apps/api/src/services/trip_engine_fill.ts)                     | 320 | Trip Lifecycle 引擎 — 时间轴填充 贪心+回溯（ENGINE-003）        | ✅ 已交付                    |
| [trip_engine_fill.test.ts](apps/api/src/services/trip_engine_fill.test.ts)           | 800 | ENGINE-003 单元测试 — 76 用例覆盖评分/填充/回溯/体力/边界       | ✅ 全部通过                  |
| [city_service.ts](apps/api/src/services/city_service.ts)                             | 132 | 城市知识库查询（searchPOI / getPOIDetail / getSupportedCities） | Mock 长沙 3 POI + 北京 1 POI |
| [transport_service.ts](apps/api/src/services/transport_service.ts)                   | 122 | 大交通方案 + 市内路线规划                                       | Mock 北京→长沙 3 方案        |
| [accommodation_service.ts](apps/api/src/services/accommodation_service.ts)           | 93  | 住宿推荐 + 预约链接                                             | Mock 长沙 2 酒店             |
| [share_service.ts](apps/api/src/services/share_service.ts)                           | 106 | 分享 Token + 修改建议 CRUD                                      | MVP stub                     |
| [user_service.ts](apps/api/src/services/user_service.ts)                             | 39  | 用户偏好读写                                                    | 默认固定值                   |

### 2.5 适配器 · `src/adapters/`

| 文件                                                           | 行  | 职责                                     | 对接方                   |
| -------------------------------------------------------------- | --- | ---------------------------------------- | ------------------------ |
| [amap_adapter.ts](apps/api/src/adapters/amap_adapter.ts)       | 81  | POI 搜索/详情/路线/地理编码/天气（mock） | 高德地图 API             |
| [llm_router.ts](apps/api/src/adapters/llm_router.ts)           | 95  | LLM 提供商路由 + 文本生成（mock）        | DeepSeek/GLM-4/Kimi/MiMo |
| [llm_types.ts](apps/api/src/adapters/llm_types.ts)             | 50  | LLM 路由配置类型 + 能力矩阵常量          | —                        |
| [weather_adapter.ts](apps/api/src/adapters/weather_adapter.ts) | 30  | 城市天气查询（mock）                     | 和风天气 API             |

### 2.6 类型 · `src/types/`

| 文件                                      | 行  | 职责                                                                                |
| ----------------------------------------- | --- | ----------------------------------------------------------------------------------- |
| [errors.ts](apps/api/src/types/errors.ts) | 108 | `BusinessError` 基类 + 9 子类（CityNotFoundError、LLMAPIError、ValidationError 等） |

### 2.7 数据库 · `prisma/`

| 文件                                                                                                    | 行  | 职责                                                                                                                                              |
| ------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| [schema.prisma](apps/api/prisma/schema.prisma)                                                          | 293 | 9 模型：User / Trip / DayPlan / TimelineItem / HotelRecommendation / City / GenerationTask / TripShareLink / LlmCallLog。全部 UUID + JSONB + 索引 |
| [seed.ts](apps/api/prisma/seed.ts)                                                                      | 139 | Seed 5 城市（长沙/成都/杭州/西安/厦门）到 cities 表                                                                                               |
| [migrations/.../migration.sql](apps/api/prisma/migrations/20260623000001_init_all_tables/migration.sql) | 282 | 初始迁移：9 表 + 索引 + 外键                                                                                                                      |

---

## 三、前端 · `apps/web/`（~3,500 行）

### 3.0 目录级指南

| 文件                            | 行  | 职责                                                                           |
| ------------------------------- | --- | ------------------------------------------------------------------------------ |
| [CLAUDE.md](apps/web/CLAUDE.md) | 63  | 前端专用指南：命名规范/架构分层/状态管理/导入/命令——操作此目录下文件时自动加载 |

### 3.1 源文件

| 文件                                              | 行  | 职责                                                                   |
| ------------------------------------------------- | --- | ---------------------------------------------------------------------- |
| [src/main.tsx](apps/web/src/main.tsx)             | 18  | React 入口：BrowserRouter + QueryClientProvider + StrictMode           |
| [src/App.tsx](apps/web/src/App.tsx)               | 15  | Routes 容器 + 标题                                                     |
| [src/index.css](apps/web/src/index.css)           | 120 | Tailwind 指令 + Wanderlust Editorial 色彩系统 + 暗黑模式               |
| [tailwind.config.ts](apps/web/tailwind.config.ts) | 84  | 品牌色/字体/阴影/动画 keyframes 配置                                   |
| [package.json](apps/web/package.json)             | —   | react 18.3、react-router-dom、@tanstack/react-query、zustand、tailwind |

### 3.2 页面 · `src/pages/`

| 文件                                                                  | 行   | 职责                                             |
| --------------------------------------------------------------------- | ---- | ------------------------------------------------ |
| [src/pages/HomePage.tsx](apps/web/src/pages/HomePage.tsx)             | 200+ | 首页：Hero 区域 + Glass morph 表单卡片           |
| [src/pages/GeneratingPage.tsx](apps/web/src/pages/GeneratingPage.tsx) | 335  | SSE 进度页：骨架屏 + 品牌加载动画 + 取消确认弹窗 |
| [src/pages/TripResultPage.tsx](apps/web/src/pages/TripResultPage.tsx) | 210  | 攻略结果页：行程摘要侧栏                         |
| [src/pages/NotFoundPage.tsx](apps/web/src/pages/NotFoundPage.tsx)     | 26   | 404 页面                                         |
| [src/pages/ShareViewPage.tsx](apps/web/src/pages/ShareViewPage.tsx)   | 31   | 分享查看（占位）                                 |
| [src/pages/HistoryPage.tsx](apps/web/src/pages/HistoryPage.tsx)       | 30   | 历史攻略（占位）                                 |

### 3.3 组件 · `src/components/`

| 文件                                                                                       | 行   | 职责                                                   |
| ------------------------------------------------------------------------------------------ | ---- | ------------------------------------------------------ |
| [common/ErrorBoundary.tsx](apps/web/src/components/common/ErrorBoundary.tsx)               | 44   | ErrorBoundary                                          |
| [common/LoadingSpinner.tsx](apps/web/src/components/common/LoadingSpinner.tsx)             | 23   | 加载旋转器                                             |
| [common/EmptyState.tsx](apps/web/src/components/common/EmptyState.tsx)                     | 29   | 空状态                                                 |
| [common/ThemeToggle.tsx](apps/web/src/components/common/ThemeToggle.tsx)                   | 28   | 日/夜模式切换按钮                                      |
| [common/ConfirmDialog.tsx](apps/web/src/components/common/ConfirmDialog.tsx)               | 92   | 通用确认对话框，用于删除目的地、取消生成等二次确认操作 |
| [trip/CitySelector.tsx](apps/web/src/components/trip/CitySelector.tsx)                     | 219  | 城市选择器                                             |
| [trip/DestinationInput.tsx](apps/web/src/components/trip/DestinationInput.tsx)             | 255  | 目的地输入（含移除确认弹窗）                           |
| [trip/TravelerCounter.tsx](apps/web/src/components/trip/TravelerCounter.tsx)               | 159  | 人数选择                                               |
| [trip/PreferencesPanel.tsx](apps/web/src/components/trip/PreferencesPanel.tsx)             | 204  | 偏好面板                                               |
| [trip/DatePicker.tsx](apps/web/src/components/trip/DatePicker.tsx)                         | 78   | 日期选择                                               |
| [trip/ConflictWarningModal.tsx](apps/web/src/components/trip/ConflictWarningModal.tsx)     | 117  | 冲突警告弹窗                                           |
| [itinerary/DayPlanCard.tsx](apps/web/src/components/itinerary/DayPlanCard.tsx)             | 365  | 日行程卡片                                             |
| [itinerary/TimelineItemRow.tsx](apps/web/src/components/itinerary/TimelineItemRow.tsx)     | 110  | 时间线行                                               |
| [itinerary/TransportInfoCard.tsx](apps/web/src/components/itinerary/TransportInfoCard.tsx) | —    | 交通信息卡片                                           |
| [itinerary/AccommodationCard.tsx](apps/web/src/components/itinerary/AccommodationCard.tsx) | —    | 住宿信息卡片                                           |
| [ui/\*.tsx](apps/web/src/components/ui/)                                                   | ~500 | shadcn/ui 组件（14 个，含 tooltip & separator）        |

### 3.4 Hooks · `src/hooks/`

| 文件                                          | 行  | 职责                                        |
| --------------------------------------------- | --- | ------------------------------------------- |
| [useSSE.ts](apps/web/src/hooks/useSSE.ts)     | 259 | SSE 连接管理                                |
| [useTheme.ts](apps/web/src/hooks/useTheme.ts) | 49  | 主题切换：light/dark + localStorage（新增） |

### 3.5 工具库 · `src/lib/`

| 文件                                            | 行  | 职责          |
| ----------------------------------------------- | --- | ------------- |
| [apiClient.ts](apps/web/src/lib/apiClient.ts)   | 55  | Axios 封装    |
| [validation.ts](apps/web/src/lib/validation.ts) | 104 | 表单校验      |
| [format.ts](apps/web/src/lib/format.ts)         | 32  | 数据格式化    |
| [constants.ts](apps/web/src/lib/constants.ts)   | 38  | 前端常量      |
| [utils.ts](apps/web/src/lib/utils.ts)           | 9   | cn() 类名合并 |
| [index.ts](apps/web/src/lib/index.ts)           | 3   | barrel export |

### 3.6 状态管理 · `src/stores/`

| 文件                                                         | 行  | 职责         |
| ------------------------------------------------------------ | --- | ------------ |
| [tripFormStore.ts](apps/web/src/stores/tripFormStore.ts)     | 149 | 表单 Zustand |
| [generationStore.ts](apps/web/src/stores/generationStore.ts) | 149 | SSE 状态机   |

### 3.7 测试 · `tests/`

| 文件                                        | 行  | 职责         |
| ------------------------------------------- | --- | ------------ |
| [App.test.tsx](apps/web/tests/App.test.tsx) | 201 | 路由集成测试 |

---

## 四、共享包 · `packages/shared/`（~800 行）

### 类型定义 · `src/types/` — 前后端合约层

| 文件                                                           | 行  | 核心导出                                                                                                                                                             |
| -------------------------------------------------------------- | --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [base.ts](packages/shared/src/types/base.ts)                   | 71  | `TransportType`、`BudgetLevel`、`PaceLevel`、`EnergyLevel`、`TimelineItemType`、`DayType`、`TravelerGroup`、`GeoPoint`                                               |
| [error.ts](packages/shared/src/types/error.ts)                 | 111 | `ErrorCode` 枚举（25 码 0~42902）、`ErrorMessageMap`、`ErrorResponse`、`SSEEventType`                                                                                |
| [api.ts](packages/shared/src/types/api.ts)                     | 87  | `ApiResponse<T>`、`PaginatedResponse<T>`、SSE 事件类型（Connected / Progress / Done / Error / Warning）                                                              |
| [trip.ts](packages/shared/src/types/trip.ts)                   | 223 | `TripGenerateRequest`、`Departure`、`Destination`、`TimelineItem`、`DayPlan`、`AccommodationOption`、`HotelOption`、`TripResponse`、`TripConflict`、`ExportResponse` |
| [city.ts](packages/shared/src/types/city.ts)                   | 88  | `CityBasic`、`TransportOption`、`POI`、`POICategory`、`CityWeather`                                                                                                  |
| [user.ts](packages/shared/src/types/user.ts)                   | 23  | `UserPreferences`、`UserProfile`                                                                                                                                     |
| [share.ts](packages/shared/src/types/share.ts)                 | 83  | `Suggestion`、`ShareLink`、`ShareCard`、`SharedTripView`                                                                                                             |
| [transport.ts](packages/shared/src/types/transport.ts)         | 74  | `TransportSearchRequest/Response`、`RoutePlanRequest/Response`                                                                                                       |
| [accommodation.ts](packages/shared/src/types/accommodation.ts) | 70  | `AccommodationSearchRequest/Response`、`AccommodationBookingRequest/Response`                                                                                        |

---

## 五、基础设施 · `docker/`

| 文件                                            | 职责                                     |
| ----------------------------------------------- | ---------------------------------------- |
| [docker-compose.yml](docker/docker-compose.yml) | PostgreSQL 16（:5432）+ Redis 7（:6379） |
| [postgres/init.sql](docker/postgres/init.sql)   | `CREATE DATABASE pathwise`               |

---

## 六、根配置文件

| 文件                                       | 说明                                 |
| ------------------------------------------ | ------------------------------------ | -------------------------------------------- |
| [package.json](package.json)               | Monorepo 根：ESLint 9 + Prettier 3.4 |
| [pnpm-workspace.yaml](pnpm-workspace.yaml) | `apps/*` + `packages/*`              |
| [tsconfig.json](tsconfig.json)             | ES2022 + strict                      |
| [.gitignore](.gitignore)                   | node_modules、dist、.env             |
| [.prettierrc](.prettierrc)                 | 100 字符、单引号                     |
| [.env.example](.env.example)               | 环境变量模板                         |
| [CLAUDE.md](CLAUDE.md)                     | 97                                   | 项目核心指令 + 行为约束 + gotcha（始终加载） |
| [CLAUDE.local.md](CLAUDE.local.md)         | —                                    | 本地覆盖（不入 Git）                         |

---

## 七、设计文档 · `docs/`（37 份）

### 架构与需求

| 文档                                                       | 版本   | 说明                |
| ---------------------------------------------------------- | ------ | ------------------- |
| [旅游攻略生成平台\_SRS.md](docs/旅游攻略生成平台_SRS.md)   | v1.1.0 | 软件需求规格        |
| [技术栈选型文档\_v1.0.0.md](docs/技术栈选型文档_v1.0.0.md) | v1.0.0 | 技术选型 + 决策记录 |
| [项目初始化指南\_v1.0.0.md](docs/项目初始化指南_v1.0.0.md) | v1.0.0 | 环境搭建 / 目录结构 |
| [产品路线图\_v1.0.0.md](docs/产品路线图_v1.0.0.md)         | v1.0.0 | 版本规划            |
| [项目文档索引\_v1.0.0.md](docs/项目文档索引_v1.0.0.md)     | v1.0.0 | 文档导航入口        |

### 数据库

| [数据库设计规格书\_v1.0.0.md](docs/数据库设计规格书_v1.0.0.md) | v1.0.3 | 9 表 + 索引 + Redis + ES |
| [数据库迁移策略文档\_v1.0.0.md](docs/数据库迁移策略文档_v1.0.0.md) | v1.0.0 | 迁移规范 |
| [城市知识库数据规范\_v1.0.0.md](docs/城市知识库数据规范_v1.0.0.md) | v1.0.0 | JSON 知识库结构 |

### API

| [API接口设计规格书\_v1.0.0.md](docs/API接口设计规格书_v1.0.0.md) | v1.0.6 | 24 接口 + SSE 协议 |
| [API详细契约文档\_v1.0.0.md](docs/API详细契约文档_v1.0.0.md) | v1.0.0 | 接口详细契约 |
| [前后端接口契约文档\_v1.0.0.md](docs/前后端接口契约文档_v1.0.0.md) | v1.0.0 | TypeScript 共享类型 |
| [SSE 流式响应设计文档_v1.0.0.md](docs/SSE 流式响应设计文档\_v1.0.0.md) | v1.0.0 | SSE 事件格式 |
| [接口变更日志\_v1.0.0.md](docs/接口变更日志_v1.0.0.md) | v1.0.0 | API 变更记录 |

### 前端

| [前端交互设计规格书\_v1.0.0.md](docs/前端交互设计规格书_v1.0.0.md) | v1.0.0 | 前端交互 |
| [组件设计规范文档\_v1.0.0.md](docs/组件设计规范文档_v1.0.0.md) | v1.0.0 | shadcn/ui 组件规范 |
| [用户体验设计文档\_v1.0.0.md](docs/用户体验设计文档_v1.0.0.md) | v1.0.0 | 用户体验 |
| [前端交互设计\_新会话接手文档.md](docs/前端交互设计_新会话接手文档.md) | — | 会话管理 |

### 引擎与 LLM

| [Trip*Lifecycle*引擎算法设计.md](docs/Trip_Lifecycle_引擎算法设计.md) | — | 攻略生命周期引擎 |
| [LLM调用最佳实践文档\_v1.0.0.md](docs/LLM调用最佳实践文档_v1.0.0.md) | v1.0.0 | LLM 调用策略 |
| [LLM Prompt 设计文档_v1.0.0.md](docs/LLM Prompt 设计文档\_v1.0.0.md) | v1.0.0 | Prompt 模板 |
| [技术决策备忘录\_API数据源与MVP策略.md](docs/技术决策备忘录_API数据源与MVP策略.md) | — | 数据源决策 |

### 质量

| [错误处理规范文档\_v1.0.0.md](docs/错误处理规范文档_v1.0.0.md) | v1.0.0 | 错误码体系 |
| [安全设计文档\_v1.0.0.md](docs/安全设计文档_v1.0.0.md) | v1.0.0 | 安全规范 |
| [性能优化设计文档\_v1.0.0.md](docs/性能优化设计文档_v1.0.0.md) | v1.0.0 | 缓存 + 查询优化 |
| [测试用例文档\_v1.0.0.md](docs/测试用例文档_v1.0.0.md) | v1.0.0 | 测试汇总 |
| [测试用例文档\_完整版\_v1.0.0.md](docs/测试用例文档_完整版_v1.0.0.md) | v1.0.0 | 完整测试 |
| [测试用例文档\_第一部分~第五部分](docs/测试用例文档_第一部分_v1.0.0.md) | v1.0.0 | 分层测试（5 份） |
| [测试用例补充\_normal_train_bus_v1.0.0.md](docs/测试用例补充_normal_train_bus_v1.0.0.md) | v1.0.0 | 火车/大巴补充 |
| [MVP验收标准文档\_v1.0.0.md](docs/MVP验收标准文档_v1.0.0.md) | v1.0.0 | MVP 验收 |

### DevOps

| [部署架构设计文档\_v1.0.0.md](docs/部署架构设计文档_v1.0.0.md) | v1.0.0 | Vercel + Railway + Neon + Upstash |
| [数据分析与埋点设计文档\_v1.0.0.md](docs/数据分析与埋点设计文档_v1.0.0.md) | v1.0.0 | 埋点方案 |
| [任务分解\_WBS_v1.0.0.md](docs/任务分解_WBS_v1.0.0.md) | v1.0.0 | 开发任务分解 |

---

## 八、Claude Code 配置 · `.claude/`

| 路径                                                                 | 说明                                                  |
| -------------------------------------------------------------------- | ----------------------------------------------------- |
| [settings.json](.claude/settings.json)                               | 项目级设置（含 SessionStart hook → 自动检测文件变更） |
| [settings.local.json](.claude/settings.local.json)                   | 本地覆盖                                              |
| [rules/output-formats.md](.claude/rules/output-formats.md)           | 按需加载：代码模板/commit/测试报告格式（75 行）       |
| [rules/doc-index.md](.claude/rules/doc-index.md)                     | 按需加载：docs/ 阅读顺序 + 高频参考（32 行）          |
| [agents/code-reviewer.md](.claude/agents/code-reviewer.md)           | 代码审查 sub-agent                                    |
| [agents/explorer.md](.claude/agents/explorer.md)                     | 探索 sub-agent                                        |
| [agents/security-auditor.md](.claude/agents/security-auditor.md)     | 安全审查 sub-agent                                    |
| [commands/deploy.md](.claude/commands/deploy.md)                     | `/deploy` 命令                                        |
| [commands/fix-issue.md](.claude/commands/fix-issue.md)               | `/fix-issue` 命令                                     |
| [commands/prisma-studio.md](.claude/commands/prisma-studio.md)       | `/prisma-studio` 命令                                 |
| [commands/review.md](.claude/commands/review.md)                     | `/review` 命令                                        |
| [skills/deploy/](.claude/skills/deploy/SKILL.md)                     | 部署技能                                              |
| [skills/init-project/](.claude/skills/init-project/SKILL.md)         | 项目初始化技能                                        |
| [skills/security-review/](.claude/skills/security-review/SKILL.md)   | 安全审查技能                                          |
| [skills/testing-patterns/](.claude/skills/testing-patterns/SKILL.md) | 测试模式技能                                          |

---

## 九、项目统计

| 指标         | 数值                          |
| ------------ | ----------------------------- |
| 总源代码行数 | ~6,400                        |
| 后端         | ~2,600 行（含 prisma schema） |
| 前端         | ~3,500 行                     |
| 共享类型     | ~800 行                       |
| 设计文档     | 37 份                         |
| API 接口     | 24 + 2（全 stub 实现）        |
| 数据库表     | 9（全部 UUID + JSONB）        |
| TypeScript   | `strict: true`                |
| 包管理器     | pnpm 11.8+（workspace）       |
| Node         | ≥22                           |

---

> **最后更新**：2026-06-25
> **依据**：项目文件扫描 + `docs/` 目录

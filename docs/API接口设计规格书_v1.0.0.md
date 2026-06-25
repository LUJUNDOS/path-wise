# 旅游攻略生成平台 �?API 接口设计规格�?

> **文档版本**：v1.0.6
> **日期**�?026-06-19
> **对应 SRS**：旅游攻略生成平台\_SRS.md v1.1.0
> **作�?\*：Buddy 🏗�?
> **变更记录\*\*�?
>
> - v1.0.5�?026-06-19）：�?`day_ready` 事件�?`day` 对象中新�?`isFirstDayOfCity: boolean` 字段；更新前端处理规则，�?检�?`accommodation` 字段是否存在"改为"检�?`isFirstDayOfCity` 字段是否�?`true`"
> - v1.0.4�?026-06-19）：MVP 阶段去掉 LLM 响应缓存；删除第 0 层缓存方案；删除 LLM 缓存详细说明
> - v1.0.3�?026-06-19）：新增 4.1 用户输入校验与冲突检测接口；�?4.1~4.3 重编号为 4.2~4.4
> - v1.0.2�?026-06-18）：LLM Key 来源更正为平台环境变量（非用户自有）；交通数据源标注为静态知识库（MVP 不调实时 API�?
> - v1.0.1�?026-06-18）：修正 SSE 事件设计（accommodation 合并�?day_ready）；新增 LLM 结果缓存策略（第 10 章）
> - v1.0.0�?026-06-18）：初版，覆�?MVP 阶段所有接�?

---

## 目录

1. [设计原则与约束](#1-设计原则与约束)
2. [接口列表总览](#2-接口列表总览)
3. [认证与安全](#3-认证与安全)
4. [攻略生成模块（核心）](#4-攻略生成模块)
5. [SSE 流式返回协议](#5-sse-流式返回协议)
6. [攻略查询与修改模块](#6-攻略查询与修改模块)
7. [分享与协作模块](#7-分享与协作模块)
8. [交通与住宿模块](#8-交通与住宿模块)
9. [通用错误码规范](#9-通用错误码规范)
10. [性能与缓存策略](#10-性能与缓存策略)
11. [分页与限流规范](#11-分页与限流规范)
12. [LLM API 调用策略](#12-llm-api-调用策略)
13. [高德 API 调用逻辑](#13-高德-api-调用逻辑)

## 1. 设计原则与约�?

### 1.1 设计原则

| 原则           | 说明                                                             |
| -------------- | ---------------------------------------------------------------- |
| **流式优先**   | 耗时 > 3s 的接口必须支�?SSE 流式返回，避免客户端长时间等�?       |
| \*_幂等�?_     | GET / PUT / DELETE 必须幂等；POST 生成接口支持幂等键防止重复提�? |
| \*_透明�?_     | 每个接口返回 `meta.processingTimeMs`，方便前端展示耗时           |
| **渐进增强**   | 先返回核心数据，附属信息（深度解析链接等）可异步补全             |
| \*_错误可恢�?_ | 生成过程中部分步骤失败，返回已完成部�?+ 失败原因，而非整趟失败   |

### 1.2 基础约束

```
协议：HTTPS
Base URL（生产）：https://api.tripplanner.com/v1
Base URL（MVP 阶段）：http://localhost:8080/api/v1
Content-Type：application/json（SSE 除外�?
字符编码：UTF-8
时间格式：ISO 8601（如 "2026-07-01T14:00:00+08:00"�?
```

### 1.3 通用响应信封

所有非 SSE 接口返回统一信封�?

```json
{
  "code": 0,                  // 0 = 成功，非 0 = 错误�?
  "message": "success",
  "data": { ... },            // 业务数据
  "meta": {
    "requestId": "req_abc123",
    "processingTimeMs": 1234,
    "timestamp": "2026-06-18T02:30:00+08:00"
  }
}
```

---

## 2. 接口列表总览

### 2.1 接口分类

| 模块       | 接口数量 | 说明                             |
| ---------- | -------- | -------------------------------- |
| 攻略生成   | 3        | 核心接口，含 SSE 流式            |
| 攻略管理   | 5        | 查询 / 修改 / 删除 / 导出        |
| 交通查�?   | 2        | 大交�?+ 市内路线                 |
| 住宿推荐   | 2        | 查询 + 预约                      |
| 城市知识�? | 2        | POI 搜索 + 详情                  |
| 用户偏好   | 2        | 保存 / 读取偏好                  |
| 分享与协作 | 8        | 分享 Token + 修改建议 + 重新生成 |
| **合计**   | **24**   | MVP 阶段                         |

### 2.2 接口速查�?

| 方法   | 路径                                       | 说明                     | 流式  | 缓存     |
| ------ | ------------------------------------------ | ------------------------ | ----- | -------- |
| POST   | /trips/generate                            | 发起攻略生成任务         | ✅SSE | ❌       |
| GET    | /trips/generate/status/{taskId}            | 轮询生成进度（降级方案） | ❌    | ❌       |
| DELETE | /trips/generate/{taskId}                   | 取消生成任务             | ❌    | ❌       |
| GET    | /trips/{tripId}                            | 查询完整攻略             | ❌    | ✅ 5min  |
| GET    | /trips/{tripId}/day/{dayIndex}             | 查询单天行程             | ❌    | ✅ 5min  |
| PUT    | /trips/{tripId}/day/{dayIndex}             | 修改单天行程             | ❌    | ❌       |
| POST   | /trips/{tripId}/regenerate                 | 重新生成某天             | ✅SSE | ❌       |
| DELETE | /trips/{tripId}                            | 删除攻略                 | ❌    | ❌       |
| GET    | /trips/{tripId}/export                     | 导出攻略（PDF/图片）     | ❌    | ✅ 1h    |
| POST   | /transport/search                          | 查询大交通方案           | ❌    | ✅ 30min |
| POST   | /transport/route                           | 市内路线规划             | ❌    | ✅ 1h    |
| POST   | /accommodation/search                      | 查询住宿推荐             | ❌    | ✅ 15min |
| POST   | /accommodation/booking                     | 获取预约链接             | ❌    | ❌       |
| GET    | /cities/{cityName}/pois                    | 搜索城市 POI             | ❌    | ✅ 24h   |
| GET    | /cities/{cityName}/pois/{poiId}            | POI 详情                 | ❌    | ✅ 24h   |
| GET    | /users/{userId}/preferences                | 读取用户偏好             | ❌    | ✅ 1h    |
| PUT    | /users/{userId}/preferences                | 保存用户偏好             | ❌    | ❌       |
| POST   | /trips/{tripId}/share                      | 生成分享 Token           | ❌    | ❌       |
| GET    | /trips/{tripId}?shareToken=xxx             | 查看攻略（小程序）       | ❌    | ❌       |
| POST   | /trips/{tripId}/suggestions                | 提交修改建议             | ❌    | ❌       |
| GET    | /trips/{tripId}/suggestions                | 查看修改建议列表         | ❌    | ✅ 5min  |
| PATCH  | /trips/{tripId}/suggestions/{suggestionId} | 处理修改建议             | ❌    | ❌       |
| GET    | /share/{shareId}                           | 获取分享卡片数据         | ❌    | ✅ 1h    |
| GET    | /share/cover/{tripId}                      | 获取分享封面图           | ❌    | ✅ 24h   |

---

## 4. 攻略生成模块（核心）

### 4.1 用户输入校验与冲突检测：`POST /trips/validate`

> **调用时机**：用户点击「生成攻略」按钮后、正式发起生成前，前端先调用此接口�?
> 若有冲突，弹出提示弹窗；若无冲突，直接进入生成等待页�?

#### 请求规格

```json
POST /api/v1/trips/validate
Content-Type: application/json
Authorization: Bearer <token>

{
  // �?POST /trips/generate 相同的请求体
  "departure": { "city": "北京", "date": "2026-07-01", "timePeriod": "morning" },
  "destinations": [{ "cityName": "长沙", "days": 3, "transportTo": "high_speed_rail"  // high_speed_rail / normal_train / flight / bus / auto }],
  "travelers": { "adults": 2, "children": [{ "age": 5 }], "elders": [] },
  "preferences": {
    "budget": "economy",
    "pace": "intensive",
    "accommodation": "boutique",
    "dining": ["local_food"],
    "interests": ["culture"]
  }
}
```

#### 响应规格

**无冲突时**（HTTP 200）：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "valid": true,
    "conflicts": []
  },
  "meta": { "timestamp": "2026-06-19T03:15:00+08:00" }
}
```

**有冲突时**（HTTP 200，非错误，只是有提示）：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "valid": true,   // 仍为 true，冲突不阻断生成
    "conflicts": [
      {
        "type": "budget_accommodation",
        "severity": "warning",
        "message": "穷游预算下选择精品酒店可能超预算，建议调整为经济型或连锁酒�?,
        "suggestion": { "action": "set_accommodation", "value": "chain_hotel" }
      },
      {
        "type": "pace_elders",
        "severity": "warning",
        "message": "同行有老人，高强度节奏可能较辛苦，建议调整为适中节奏",
        "suggestion": { "action": "set_pace", "value": "moderate" }
      }
    ]
  },
  "meta": { ... }
}
```

#### 冲突类型枚举

| type �?                        | 检测规�?                                           | 提示文案                              |
| ------------------------------ | -------------------------------------------------- | ------------------------------------- |
| `budget_accommodation`         | `budget=economy` + `accommodation=boutique/luxury` | 穷游预算下选择精品/豪华酒店可能超预�? |
| `budget_dining`                | `budget=economy` + `dining` 含高端餐厅标�?         | 穷游预算下推荐本地小吃为�?            |
| `pace_elders`                  | `elders.length > 0` + `pace=intensive`             | 同行有老人，建议调整为适中节奏        |
| `pace_children`                | `children` �?`< 3 岁` + `pace=intensive`           | 同行有低龄幼儿，建议调整为轻松节�?    |
| `transport_children`           | `children` �?`< 3 岁` + 高铁 > 5h 且无航班替代     | 长途高铁带婴幼儿较辛苦，是否考虑飞机  |
| `budget_accommodation_reverse` | `budget=luxury` + `accommodation=hostel`           | 豪华预算下选择青旅，是否确�?          |

---

### 4.2 发起攻略生成：`POST /trips/generate`

此接口是系统的核心入口，**必须采用 SSE 流式返回**（见�?5 节）�?

#### 请求规格

```json
POST /api/v1/trips/generate
Content-Type: application/json
Accept: text/event-stream          // 关键：指�?SSE
Authorization: Bearer <token>
Idempotency-Key: <uuid>            // 幂等键，防止重复提交

{
  // ===== 出发信息 =====
  "departure": {
    "city": "北京",
    "date": "2026-07-01",
    "timePeriod": "morning"         // morning / afternoon / evening
  },

  // ===== 目的地列�?=====
  "destinations": [
    {
      "cityName": "长沙",
      "days": 3,
      "transportTo": "high_speed_rail"  // high_speed_rail / normal_train / flight / bus / auto
    },
    {
      "cityName": "广州",
      "days": 2,
      "transportTo": null
    }
  ],

  // ===== 出行人员 =====
  "travelers": {
    "adults": 2,
    "children": [{ "age": 5 }],
    "elders": []
  },

  // ===== 用户偏好 =====
  "preferences": {
    "budget": "comfort",           // economy / comfort / luxury
    "pace": "moderate",            // intensive / moderate / relaxed
    "accommodation": "chain_hotel",
    "dining": ["local_food", "spicy"],
    "interests": ["culture", "photography"]
  },

  // ===== 返程交通（可选）=====
  "needsReturnTransport": true,     // 是否预定返程票（默认 true）
  "returnTransportPref": "auto",    // 返程偏好：auto / high_speed_rail / normal_train / flight / bus（不填=auto）

  // ===== 可选：生成选项 =====
  "options": {
    "streamProgress": true,        // 是否启用 SSE 进度推送（默认 true�?
    "includeAlternatives": true,   // 是否生成 B 方案（默�?true�?
    "language": "zh-CN",          // 返回语言（未来扩展英文）
    "maxProcessingSeconds": 120     // 最大生成时间，超时返回已完成部�?
  }
}
```

#### 幂等性说�?

- 客户端生�?UUID 作为 `Idempotency-Key`，同一 key �?\**24 小时�?*重复提交直接返回第一次的结果
- 服务端将生成结果�?`Idempotency-Key` �?key 缓存 24 小时

#### 响应规格（SSE 流式，详见第 5 节）

正常情况：SSE 流式返回，最终事件类型为 `done`，包含完�?`tripId`

错误情况（极少）：若请求参数校验失败，立即返�?HTTP 错误（非 SSE）：

```json
// HTTP 400 Bad Request（非 SSE，因为还没进入生成流程）
{
  "code": 40001,
  "message": "参数校验失败：destinations 不能为空",
  "data": {
    "field": "destinations",
    "reason": "至少需�?1 个目的地"
  }
}
```

---

### 4.3 查询生成进度（降级方案）：`GET /trips/generate/status/{taskId}`

当客户端不支�?SSE（极少见）时，可用此接口轮询进度�?

#### 响应规格

```json
GET /api/v1/trips/generate/status/{taskId}

Response:
{
  "code": 0,
  "data": {
    "taskId": "task_abc123",
    "status": "processing",         // pending / processing / completed / failed / cancelled
    "progress": {
      "percent": 65,
      "currentStep": "正在生成 Day 4 行程...",
      "stepsCompleted": 8,
      "totalSteps": 12,
      "estimatedRemainingSeconds": 30
    },
    "partialResult": { ... },      // 已生成的部分结果（可选）
    "tripId": null                 // 完成时才�?
  }
}
```

---

### 4.4 取消生成任务：`DELETE /trips/generate/{taskId}`

用户主动取消生成时使用�?

#### 响应规格

```json
DELETE /api/v1/trips/generate/{taskId}

Response:
{
  "code": 0,
  "message": "生成任务已取�?,
  "data": {
    "taskId": "task_abc123",
    "cancelledAt": "2026-06-18T02:35:00+08:00",
    "partialTripId": "trip_xxx"   // 若已有部分结果，返回 ID
  }
}
```

---

## 5. SSE 流式返回协议

### 5.1 为什么用 SSE（而不�?WebSocket / 轮询�?

| 方案      | 优点                      | 缺点                   | 适用场景                      |
| --------- | ------------------------- | ---------------------- | ----------------------------- |
| **SSE**   | 简单、HTTP 原生、自动重�? | 单向                   | �?本系统（只需服务端→客户端） |
| WebSocket | 双向通信                  | 复杂、需要额外心跳维�? | 聊天类应�?                    |
| 轮询      | 最简�?                    | 浪费资源、延迟高       | 降级方案                      |

\*_结论：SSE 是最优方案�?_

### 5.2 SSE 事件格式

SSE 标准格式�?

```
event: <事件类型>
data: <JSON 数据>
id: <事件 ID（可选）>
retry: <重连毫秒数（可选）>

（空行表示事件结束）
```

### 5.3 事件类型定义

生成攻略过程中的 SSE 事件流：

```
┌─ event: connected  ──────────────────────�?
�? 服务端接受请求，返回 taskId               �?
└──────────────────────────────────────────�?
          �?
          �?
┌─ event: progress  ──────────────────────�?
�? 每个处理步骤开始时推�?                    �?
�? 例："正在解析目的地信�?.."               �?
└──────────────────────────────────────────�?
          �? 重复多次
          �?
┌─ event: day_ready  ─────────────────────�?
�? 每一天行程生成完成时推�?                  �?
�? 前端可立即渲染，无需等全部完�?            �?
└──────────────────────────────────────────�?
          │  重复（每天一次）
          ▼
┌─ event: done  ──────────────────────────�?
�? 全部完成，返�?tripId                     �?
�? 前端可跳转到攻略详情�?                   �?
└──────────────────────────────────────────�?
```

### 5.4 各事件详�?Schema

#### `connected` �?连接建立

```
event: connected
data: {
  "taskId": "task_abc123",
  "estimatedTotalSeconds": 60,
  "totalSteps": 12,
  "message": "已开始生成，预计需�?30~60 �?
}
```

前端收到此事件后�?

- 显示「生成中」动�?
- 显示预计等待时间
- 保存 `taskId`（用于取消）

---

#### `progress` �?进度更新

```
event: progress
data: {
  "step": 3,
  "totalSteps": 12,
  "percent": 25,
  "message": "正在�?Day 2 安排景点...",
  "subMessage": "已选择：岳麓山 �?橘子洲头",
  "estimatedRemainingSeconds": 45
}
```

前端收到此事件后�?

- 更新进度�?
- 显示当前步骤文字
- 更新预计剩余时间

---

#### `day_ready` �?单天行程完成�?\*最关键事件\*\*�?

```
event: day_ready
data: {
  "dayIndex": 2,
  "day": {
    "dayIndex": 2,
    "date": "2026-07-02",
    "dayType": "city_exploration",
    "cityName": "长沙",
    "isFirstDayOfCity": false,     // �?新增字段：是否为该城市的第一�?
    "title": "Day 2 · 长沙深度�?,
    "timeline": [
      {
        "id": "item_001",
        "type": "attraction",
        "title": "岳麓山风景区",
        "startTime": "09:00",
        "endTime": "12:00",
        "estimatedCostCNY": 0,
        "energyLevel": "MEDIUM",
        "bookingRequired": false
      }
      // ... 更多 items
    ],
    "accommodation": null,        // 非城市第一天时�?null
    "tips": ["岳麓山建议穿舒适鞋�?]
  }
}
```

前端收到此事件后�?

- **立即渲染这一天的卡片**，用户不用等全部完成
- 这是解决「用户等太久」问题的核心机制

---

> \*_设计修正（v1.0.1�?_：住宿推荐已合并�?`day_ready` 事件，不再有独立�?`accommodation_ready` 事件�?
> 理由：住宿按城市安排，应在用户到达该城市的第一天就展示，而非等待全局推送�?

#### `day_ready` 事件中的住宿字段（新增）

每个城市�?*第一�?*�?`day_ready` 事件中，包含 `accommodation` 字段�?

```
// day_ready 事件中的 day 对象（修正后�?
event: day_ready
data: {
  "dayIndex": 1,
  "day": {
    "dayIndex": 1,
    "date": "2026-07-01",
    "dayType": "transit_departure",
    "cityName": "长沙",
    "isFirstDayOfCity": true,      // �?新增字段：这是长沙的第一�?
    "title": "Day 1 · 抵达长沙",
    "timeline": [ ... ],
    "accommodation": {              // 仅城市第一天包含此字段
      "checkInDate": "2026-07-01",
      "checkOutDate": "2026-07-04",
      "nights": 3,
      "primary": {
        "name": "长沙IFS 国金中心亚朵酒店",
        "address": "长沙市芙蓉区解放西路 188 �?,
        "pricePerNight": 480,
        "totalPrice": 1440,
        "reason": "位于市中心，前往各景点交通便�?
      },
      "backup": { ... }
    },
    "tips": [ ... ]
  }
}
```

> **前端处理规则**�?
>
> - 收到 `day_ready` 事件后，检�?`day.isFirstDayOfCity` 字段
> - 若为 `true`，渲染住宿卡片（读取 `day.accommodation` 字段�?
> - 若为 `false`，不渲染住宿卡片
> - 注意：`day.accommodation` 字段仅在 `isFirstDayOfCity=true` 时有值，否则�?`null`

---

#### `done` �?全部完成

```
event: done
data: {
  "tripId": "trip_xyz789",
  "totalProcessingTimeSeconds": 52,
  "totalEstimatedCostCNY": 5800,
  "summary": "已为你生�?5 �?3 城行程，预计总花费约 ¥5800",
  "shareUrl": "https://tripplanner.com/share/trip_xyz789"
}
```

前端收到此事件后�?

- 跳转到攻略详情页
- 显示「生成完成」提�?
- 可分享链�?

---

#### `error` �?生成失败

```
event: error
data: {
  "code": 50001,
  "message": "部分景点预约信息查询失败",
  "recoverable": true,
  "partialTripId": "trip_xyz789",  // 若已有部分结�?
  "failedStep": "booking_info_fetch",
  "suggestion": "可继续查看已生成的行程，或稍后重新生�?
}
```

---

#### `warning` �?非致命警�?

```
event: warning
data: {
  "code": 30001,
  "message": "Day 3 的部分景点营业时间未确认，建议出行前核实",
  "dayIndex": 3
}
```

---

### 5.5 前端 SSE 连接示例代码（规格，非实现）

```javascript
// 前端连接 SSE 的规范说明（不写具体代码�?

/**
 * SSE 连接规范�?
 *
 * 1. 使用浏览器原�?EventSource API（或 @microsoft/fetch-event-source 支持 POST�?
 * 2. 连接超时设置�?120s（对�?maxProcessingSeconds�?
 * 3. 监听以下事件：connected / progress / day_ready / done / error / warning
 *    （注：accommodation 已合并到 day_ready 事件，不再有独立事件�?
 * 4. 收到 day_ready 立即更新 UI（渐进式渲染�?
 * 5. 收到 done 后关闭连�?
 * 6. 网络断开时自动重连（SSE 原生支持�?
 *
 * 超时处理�?
 *   - �?120s 内未收到 done 事件，前端主动关闭连�?
 *   - 显示「生成超时，可查看已生成部分」提�?
 *   - 提供「继续生成」按钮（重新连接 SSE�?
 */
```

---

## 6. 攻略查询与修改模�?

### 6.1 查询完整攻略：`GET /trips/{tripId}`

#### 请求参数

| 参数      | 类型   | 必填 | 说明                                                       |
| --------- | ------ | ---- | ---------------------------------------------------------- |
| `tripId`  | string | �?   | 攻略 ID                                                    |
| `include` | string | �?   | 可选字段：alternatives,booking_info,deep_links（逗号分隔�? |
| `format`  | string | �?   | 返回格式：full / summary（默�?full�?                       |

#### 响应规格

```json
GET /api/v1/trips/{tripId}?include=alternatives

Response:
{
  "code": 0,
  "data": {
    "tripId": "trip_xyz789",
    "generatedAt": "2026-06-18T02:35:00+08:00",
    "totalDays": 5,
    "totalEstimatedCostCNY": 5800,
    "days": [
      {
        "dayIndex": 1,
        "date": "2026-07-01",
        "dayType": "transit_departure",
        "cityName": "长沙",
        "title": "Day 1 · 抵达长沙",
        "transport": { /* 大交通信�?*/ },
        "timeline": [ /* ... */ ],
        "tips": ["到达后建议先办理入住"]
      }
      // ... 更多�?
    ],
    "accommodations": [ /* 住宿推荐 */ ]
  },
  "meta": { "processingTimeMs": 23 }
}
```

---

### 6.2 查询单天行程：`GET /trips/{tripId}/day/{dayIndex}`

用于用户点击某天查看详情，或前端懒加载�?

#### 响应规格

```json
GET /api/v1/trips/{tripId}/day/2

Response:
{
  "code": 0,
  "data": {
    "dayIndex": 2,
    "date": "2026-07-02",
    "dayType": "city_exploration",
    "cityName": "长沙",
    "title": "Day 2 · 长沙深度�?,
    "weather": {                    // 可选：接入天气 API 后返�?
      "forecast": "�?,
      "temperature": { "low": 26, "high": 34 }
    },
    "timeline": [
      {
        "id": "item_001",
        "type": "attraction",
        "title": "岳麓山风景区",
        "description": "长沙标志性景点，可俯瞰湘�?,
        "location": { "lat": 28.235, "lng": 112.907, "name": "岳麓山南�? },
        "startTime": "09:00",
        "endTime": "12:00",
        "estimatedDuration": 180,
        "estimatedCostCNY": 0,
        "energyLevel": "MEDIUM",
        "bookingRequired": false,
        "bookingUrl": null,
        "deepLink": null,
        "alternatives": [             // include=alternatives 时才返回
          {
            "title": "湖南省博物馆",
            "reason": "若不想爬山，可选择室内文化景点"
          }
        ]
      }
      // ... 更多 items
    ],
    "tips": [
      "岳麓山建议穿舒适鞋子，山上温度比市区低 2~3°C",
      "橘子洲头周末有烟花表演（20:00~20:30�?
    ]
  }
}
```

---

### 6.3 修改单天行程：`PUT /trips/{tripId}/day/{dayIndex}`

用户手动调整某天行程后，调用此接口保存�?

#### 请求规格

```json
PUT /api/v1/trips/{tripId}/day/{dayIndex}

Body:
{
  "timeline": [
    // 修改后的完整 timeline（前端拖拽后传完整列表）
    {
      "id": "item_001",
      "type": "attraction",
      "poiId": "poi_yuelu_001",
      "startTime": "10:00",        // 用户调整后的时间
      "endTime": "13:00",
      "notes": "用户备注：想晚点出发"
    }
    // ... 更多 items
  ],
  "userModified": true,             // 标记为用户手动修�?
  "modificationNote": "用户调整了岳麓山的时�?
}
```

#### 响应规格

```json
{
  "code": 0,
  "message": "行程已更�?,
  "data": {
    "dayIndex": 2,
    "validation": {
      "valid": true,
      "warnings": [
        {
          "code": 30002,
          "message": "岳麓山游玩时间调整为 3 小时，可能较�?,
          "severity": "low"
        }
      ]
    },
    "updatedAt": "2026-06-18T02:40:00+08:00"
  }
}
```

> **设计说明**：修改后服务端做增量校验（时间重叠、闭馆日等），但不重新生成整个攻略，只返回校验结果�?

---

### 6.4 重新生成某天：`POST /trips/{tripId}/regenerate`

用户对某天不满意，触发重新生成（SSE 流式）�?

#### 请求规格

```json
POST /api/v1/trips/{tripId}/regenerate
Accept: text/event-stream

Body:
{
  "dayIndex": 3,
  "reason": "user_dislike",          // user_dislike / weather_change / preference_update
  "constraints": {
    // 可选：用户额外约束
    "avoidPoiIds": ["poi_xxx"],     // 不要推荐�?POI
    "mustIncludePoiIds": [],         // 必须包含�?POI
    "maxEnergyLevel": "MEDIUM"      // 不要高强度活�?
  }
}
```

响应：同 `/trips/generate`，SSE 流式返回新的当天行程�?

---

### 6.5 删除攻略：`DELETE /trips/{tripId}`

```json
DELETE /api/v1/trips/{tripId}

Response:
{
  "code": 0,
  "message": "攻略已删�?,
  "data": { "deletedAt": "2026-06-18T02:45:00+08:00" }
}
```

---

### 6.6 导出攻略：`GET /trips/{tripId}/export`

#### 请求参数

| 参数     | 类型   | 必填 | 说明                                       |
| -------- | ------ | ---- | ------------------------------------------ |
| `format` | string | �?   | `pdf` / `image` / `text`                   |
| `size`   | string | �?   | 图片尺寸：`1080x1920`（默认）/ `1080x1440` |

#### 响应规格

```json
GET /api/v1/trips/{tripId}/export?format=pdf

Response（同步）:
{
  "code": 0,
  "data": {
    "exportId": "export_abc123",
    "status": "ready",
    "downloadUrl": "https://cdn.tripplanner.com/exports/trip_xyz789.pdf",
    "expiresAt": "2026-06-19T02:50:00+08:00",
    "format": "pdf",
    "sizeBytes": 2048000
  }
}

// 若导出耗时较长�? 3s），返回异步任务�?
{
  "code": 0,
  "data": {
    "exportId": "export_abc123",
    "status": "processing",
    "estimatedSeconds": 15,
    "pollUrl": "/trips/export/status/export_abc123"
  }
}
```

---

## 7. 分享与协作模块

> **功能定位**：支持用户将攻略分享给微信好友，并允许同行人提出修改建议，实现协同规划。
> **MVP 范围**：分享小程序卡片、查看攻略（只读）、提出修改建议、原用户确认/忽略修改。

### 7.1 生成分享 Token：`POST /trips/{tripId}/share`

> **用途**：原用户生成分享 Token，用于微信小程序分享。

#### 请求规格

```json
POST /api/v1/trips/{tripId}/share

Headers:
  Authorization: Bearer <jwt_token>

Body:
{
  "expireDays": 30,        // 有效期（天），默认 30
  "maxUsers": 20           // 最多可分享给多少人，默认 20
}
```

#### 响应规格

```json
{
  "code": 0,
  "data": {
    "shareToken": "abc123xyz",
    "shareUrl": "https://tripplanner.com/share/abc123xyz",
    "expireAt": "2026-07-20T00:00:00Z",
    "maxUsers": 20
  }
}
```

#### 权限要求

- 仅原用户（攻略创建者）可调用
- 需验证 JWT Token

#### 后端实现要点

- 生成唯一 `shareToken`（建议用 UUID 或随机字符串）
- 存储到 `share_tokens` 表
- 设置有效期（默认 30 天）
- 返回 `shareUrl`（前端用于生成微信分享卡片）

---

### 7.2 查看攻略（小程序）：`GET /trips/{tripId}?shareToken=xxx`

> **用途**：同行人通过分享链接查看攻略（只读模式）。

#### 请求规格

```
GET /api/v1/trips/{tripId}?shareToken=abc123xyz

Headers:
  （无需 Authorization，用 shareToken 鉴权）
```

#### 响应规格

```json
{
  "code": 0,
  "data": {
    "tripId": "trip_xyz789",
    "title": "北京 → 长沙 5 天游",
    "days": [ ... ],          // 完整攻略 JSON
    "isReadOnly": true,       // 前端据此隐藏"编辑"按钮
    "sharedBy": "张三",       // 分享者昵称
    "expireAt": "2026-07-20T00:00:00Z"
  }
}
```

#### 权限要求

- 需持有有效的 `shareToken`
- `shareToken` 未过期、未超限

#### 错误码

| 错误码 | 说明                      |
| ------ | ------------------------- |
| 403    | `shareToken` 无效或已过期 |
| 404    | 攻略不存在                |

---

### 7.3 提交修改建议：`POST /trips/{tripId}/suggestions`

> **用途**：同行人查看攻略后，提出修改建议（逐条填写）。

#### 请求规格

```json
POST /api/v1/trips/{tripId}/suggestions

Headers:
  X-Share-Token: abc123xyz    // 用 shareToken 鉴权（不是 JWT）

Body:
{
  "dayIndex": 2,              // 建议修改第几天（0-based）
  "type": "add_poi",          // 建议类型：add_poi | remove_poi | change_hotel | change_transport | note
  "poi": {                    // 当且仅当 type=add_poi 时必填
    "name": "岳麓书院",
    "category": "attraction",
    "durationMinutes": 120
  },
  "reason": "岳麓书院是长沙必去景点，建议加入 Day 3"  // 建议理由（选填）
}
```

#### 响应规格

```json
{
  "code": 0,
  "data": {
    "suggestionId": "sug_001",
    "status": "pending", // 状态：pending | accepted | rejected
    "createdAt": "2026-06-20T10:30:00Z"
  }
}
```

#### 权限要求

- 需持有有效的 `shareToken`
- 同一个 `shareToken` 对同一个攻略最多提交 10 条建议（防止刷屏）

#### 后端实现要点

- 保存建议到 `suggestions` 表
- 触发微信服务通知给原用户
- 建议状态初始为 `pending`

---

### 7.4 查看修改建议列表：`GET /trips/{tripId}/suggestions`

> **用途**：原用户查看所有同行人提交的修改建议。

#### 请求规格

```
GET /api/v1/trips/{tripId}/suggestions

Headers:
  Authorization: Bearer <jwt_token>

Query Params:
  status=pending              // 可选过滤条件：pending | accepted | rejected | all（默认 all）
```

#### 响应规格

```json
{
  "code": 0,
  "data": {
    "suggestions": [
      {
        "suggestionId": "sug_001",
        "dayIndex": 2,
        "type": "add_poi",
        "poi": { "name": "岳麓书院", ... },
        "reason": "岳麓书院是长沙必去景点",
        "status": "pending",
        "submitter": "李四",        // 建议提交者昵称
        "createdAt": "2026-06-20T10:30:00Z"
      }
    ],
    "summary": {
      "total": 5,
      "pending": 3,
      "accepted": 1,
      "rejected": 1
    }
  }
}
```

#### 权限要求

- 仅原用户可调用

---

### 7.5 处理修改建议：`PATCH /trips/{tripId}/suggestions/{suggestionId}`

> **用途**：原用户接受或忽略某条修改建议。

#### 请求规格

```json
PATCH /api/v1/trips/{tripId}/suggestions/{suggestionId}

Headers:
  Authorization: Bearer <jwt_token>

Body:
{
  "action": "accept",          // accept | reject
  "note": "好的，采纳这条建议"   // 原用户备注（选填）
}
```

#### 响应规格

```json
{
  "code": 0,
  "data": {
    "suggestionId": "sug_001",
    "status": "accepted", // 更新后的状态
    "regenerateRequired": true, // 是否需要重新生成（action=accept 时为 true）
    "affectedDayIndex": 2 // 受影响的 Day
  }
}
```

#### 权限要求

- 仅原用户可调用

#### 后端实现要点

- 若 `action=accept`：更新建议状态为 `accepted`，触发重新生成受影响 Day
- 若 `action=reject`：更新建议状态为 `rejected`，触发微信服务通知给提交者

---

### 7.6 重新生成某天行程：`POST /trips/{tripId}/regenerate`

> **用途**：原用户接受修改建议后，重新生成指定 Day 的行程（SSE 流式返回）。

#### 请求规格

```json
POST /api/v1/trips/{tripId}/regenerate

Headers:
  Authorization: Bearer <jwt_token>

Body:
{
  "dayIndex": 2,              // 重新生成第几天（0-based）
  "keepUnchanged": true,       // 是否保留其他 Day 不变（默认 true）
  "acceptedSuggestions": ["sug_001"]  // 本次采纳的建议 ID 列表
}
```

#### 响应规格

- 与 `POST /trips/generate` 相同，SSE 流式返回
- 仅返回重新生成的 Day（不是完整攻略）

#### 权限要求

- 仅原用户可调用

---

### 7.7 获取分享卡片数据：`GET /share/{shareId}`

> **用途**：网页端分享时，获取分享卡片的数据（标题、描述、封面图）。

#### 请求规格

```
GET /share/{shareId}

Headers:
  （无需鉴权，shareId 即唯一标识）
```

#### 响应规格

```json
{
  "code": 0,
  "data": {
    "title": "北京 → 长沙 5 天游 · 攻略",
    "description": "已生成专属攻略，预计总花费 ¥5800",
    "imageUrl": "https://cdn.tripplanner.com/share/cover/trip_xyz789.png",
    "url": "https://tripplanner.com/share/trip_xyz789"
  }
}
```

#### 后端实现要点

- `shareId` 对应 `share_tokens.token`
- 返回的数据用于微信 JS-SDK 分享卡片配置

---

### 7.8 获取分享封面图：`GET /share/cover/{tripId}`

> **用途**：获取攻略的分享封面图（用于微信分享卡片）。

#### 请求规格

```
GET /share/cover/{tripId}

Headers:
  （无需鉴权）
```

#### 响应规格

- 返回图片二进制流（`Content-Type: image/png`）
- 或返回 302 重定向到 CDN 地址

#### 后端实现要点

- 封面图规格：1080×864px（9:7.2），适合微信分享卡片
- 若未生成封面图，返回 404
- 建议提前生成封面图（攻略生成完成后异步生成）

---

## 8. 交通与住宿模块

### 7.1 查询大交通方案：`POST /transport/search`

#### 请求规格

```json
POST /api/v1/transport/search

Body:
{
  "fromCity": "长沙",
  "toCity": "广州",
  "date": "2026-07-03",
  "prefer": ["high_speed_rail"],     // 可选：high_speed_rail / normal_train / flight / bus     // 偏好交通方�?
  "departTimePeriod": "afternoon",   // 偏好出发时段
  "passengers": {
    "adults": 2,
    "children": 1
  }
}
```

#### 响应规格

```json
{
  "code": 0,
  "data": {
    "options": [
      {
        "type": "high_speed_rail", // high_speed_rail / normal_train / flight / bus
        "trainNumber": "G6113",
        "departTime": "16:45",
        "arriveTime": "19:00",
        "durationMinutes": 135,
        "pricePerPerson": { "secondClass": 314, "firstClass": 498 },
        "availableSeats": 45,
        "departureStation": "长沙南站",
        "arrivalStation": "广州南站",
        "bookingUrl": "https://www.12306.cn/...",
        "deepLink": {
          "platform": "12306",
          "url": "ctrip://xxx" // OTA 跳转链接
        },
        "note": "⚠️ 车次信息仅供参考，余票动态变化，请尽快到 12306 / 携程 / 飞猪订票"
      },
      {
        "type": "normal_train",
        "trainNumber": "Z1",
        "departTime": "18:20",
        "arriveTime": "次日 08:15",
        "durationMinutes": 835,
        "pricePerPerson": { "硬座": 156, "硬卧": 280, "软卧": 450 },
        "availableSeats": {
          "硬座": 120,
          "硬卧": 30,
          "软卧": 10
        },
        "departureStation": "北京西站",
        "arrivalStation": "长沙站",
        "isOvernight": true,
        "note": "⚠️ 隔夜车次，含卧铺。信息仅供参考，请及时订票"
      },
      {
        "type": "bus",
        "departTime": "09:00",
        "arriveTime": "次日 06:00",
        "durationMinutes": 1260,
        "pricePerPerson": { "普通座": 380, "商务座": 580 },
        "availableSeats": {
          "普通座": 35,
          "商务座": 15
        },
        "departureStation": "北京赵公口客运站",
        "arrivalStation": "长沙汽车东站",
        "isOvernight": true,
        "note": "⚠️ 隔夜班次，建议准备颈枕。信息仅供参考，请及时订票"
      }
    ],
    "source": "mock", // mock / amap_api / ctrip_api（数据源标注�?
    "expiresAt": "2026-06-18T10:00:00+08:00" // 数据有效�?
  }
}
```

---

### 7.2 市内路线规划：`POST /transport/route`

#### 请求规格

```json
POST /api/v1/transport/route

Body:
{
  "city": "长沙",
  "origin": { "lat": 28.235, "lng": 112.907, "name": "岳麓山南�? },
  "destination": { "lat": 28.227, "lng": 112.938, "name": "橘子洲头" },
  "mode": "transit",               // driving / transit / walking / cycling
  "departureTime": "14:30"        // 可选：加入实时路况
}
```

#### 响应规格

```json
{
  "code": 0,
  "data": {
    "distanceMeters": 8500,
    "durationMinutes": 35,
    "steps": [
      {
        "instruction": "从岳麓山南门步行至「湖南大学」公交站",
        "mode": "walking",
        "durationMinutes": 8,
        "distanceMeters": 600
      },
      {
        "instruction": "乘坐地铁4号线（溁湾镇方向），2 站后下车",
        "mode": "transit",
        "lineName": "地铁4号线",
        "durationMinutes": 12,
        "stations": 2
      }
    ],
    "polyline": "...", // 可选：路线坐标串（前端地图渲染用）
    "source": "amap_api"
  }
}
```

---

### 7.3 查询住宿推荐：`POST /accommodation/search`

#### 请求规格

```json
POST /api/v1/accommodation/search

Body:
{
  "cityName": "长沙",
  "checkInDate": "2026-07-01",
  "checkOutDate": "2026-07-04",
  "budget": "comfort",
  "preferences": {
    "location": "center",          // center / near_station / near_attraction
    "amenities": ["elevator", "wifi"],
    "roomType": "twin"             // twin / double / family
  },
  "travelers": {
    "adults": 2,
    "children": [{ "age": 5 }]
  }
}
```

#### 响应规格

```json
{
  "code": 0,
  "data": {
    "cityName": "长沙",
    "checkInDate": "2026-07-01",
    "options": [
      {
        "name": "长沙IFS 国金中心亚朵酒店",
        "address": "长沙市芙蓉区解放西路 188 �?,
        "location": { "lat": 28.228, "lng": 112.937 },
        "roomType": "标准双床�?,
        "pricePerNight": 480,
        "totalPrice": 1440,
        "amenities": ["wifi", "elevator", "breakfast"],
        "distanceToCenter": 0,
        "distanceToAttractions": {
          "岳麓�?: "15 分钟车程",
          "橘子洲头": "10 分钟车程"
        },
        "bookingUrl": "https://m.ctrip.com/...",
        "deepLink": {
          "platform": "ctrip",
          "url": "ctrip://hotel/xxx"
        },
        "availability": "available",   // available / few_left / sold_out
        "reason": "位于市中心，前往各景点交通便利，含早�?
      }
    ],
    "bookingTip": "建议提前 3~5 天预订，暑期房源紧张"
  }
}
```

---

## 9. 通用错误码规�?

### 8.1 错误码分段规�?

| �?       | 范围        | 含义                            |
| -------- | ----------- | ------------------------------- |
| `0`      | 0           | 成功                            |
| `1xxxxx` | 10000~19999 | 客户端错误（参数校验等）        |
| `2xxxxx` | 20000~29999 | 客户端错误（认证 / 权限�?       |
| `3xxxxx` | 30000~39999 | 服务端警告（非致命，可继续）    |
| `4xxxxx` | 40000~49999 | 外部 API 错误（高�?/ 12306 等） |
| `5xxxxx` | 50000~59999 | 服务端内部错�?                  |

### 8.2 完整错误码表

| 错误�?  | HTTP 状态码 | 说明                          |
| ------- | ----------- | ----------------------------- |
| `0`     | 200         | 成功                          |
| `10001` | 400         | 请求�?JSON 格式错误           |
| `10002` | 400         | 缺少必填字段：`{field}`       |
| `10003` | 400         | 字段格式错误：`{field}`       |
| `10004` | 400         | `destinations` 不能为空       |
| `10005` | 400         | 日期格式错误，应�?YYYY-MM-DD  |
| `10006` | 400         | `days` 必须�?1~30 之间的整�?  |
| `10007` | 400         | 出行人员数量不能�?0           |
| `20001` | 401         | 未提�?Token                   |
| `20002` | 401         | Token 已过�?                  |
| `20003` | 401         | Token 无效                    |
| `20004` | 403         | 无权访问该攻略（非本人）      |
| `30001` | 200         | 警告：部分景点营业时间未确认  |
| `30002` | 200         | 警告：行程安排较�?            |
| `30003` | 200         | 警告：预算可能超�?            |
| `40001` | 502         | 高德 API 调用失败：`{reason}` |
| `40002` | 502         | 12306 接口暂不可用            |
| `40003` | 502         | 外部 API 超时（`{apiName}`�?  |
| `40004` | 503         | 该城市知识库建设中，暂不支持  |
| `50001` | 500         | 攻略生成失败：`{reason}`      |
| `50002` | 500         | 服务端内部错误，请稍后重�?    |
| `50003` | 503         | 服务繁忙，请稍后重试          |
| `42901` | 429         | 攻略生成次数超限�? �?小时�?   |
| `42902` | 429         | 请求频率超限，请稍后再试      |

---

## 10. 性能与缓存策�?

### 9.1 攻略生成性能优化

#### 问题：生成耗时 30~90s，用户流失率�?

#### 解决方案（多层优化）

```


### 9.2 缓存策略详表

| 接口 | 缓存策略 | TTL | 缓存 key |
|------|---------|-----|---------|
| `GET /trips/{tripId}` | Redis | 5 min | `trip:{tripId}` |
| `POST /transport/search` | Redis | 30 min | `transport:{from}:{to}:{date}:{hash(prefer)}` |
| `POST /transport/route` | Redis | 1 h | `route:{city}:{hash(origin+dest+mode)}` |
| `POST /accommodation/search` | Redis | 15 min | `hotel:{city}:{checkIn}:{budget}` |
| `GET /cities/{cityName}/pois` | Redis + CDN | 24 h | `poi:{cityName}:{category}` |
| `POST /trips/generate` | Redis（幂等） | 24 h | `idem:{idempotencyKey}` |

### 9.3 数据库查询优�?

```

攻略列表查询�?

- 只返回摘要字段（tripId, title, totalDays, createdAt�?
- 完整数据按需加载（点击后查详情）

时间轴查询：

- �?dayIndex 建立索引
- 支持分页查询（虽然一�?8 天以内不需要分页）

````

---

## 11. 分页与限流规�?

### 10.1 分页参数（统一�?

| 参数 | 类型 | 默认�?| 说明 |
|------|------|--------|------|
| `page` | number | 1 | 页码（从 1 开始） |
| `pageSize` | number | 20 | 每页条数（最�?100�?|
| `sortBy` | string | `createdAt` | 排序字段 |
| `sortOrder` | string | `desc` | `asc` / `desc` |

#### 分页响应格式

```json
{
  "code": 0,
  "data": {
    "items": [ ... ],
    "pagination": {
      "page": 1,
      "pageSize": 20,
      "totalItems": 156,
      "totalPages": 8,
      "hasNext": true,
      "hasPrev": false
    }
  }
}
````

### 10.2 限流响应格式（见 3.2 节）

---

## 12. LLM API 调用策略

### 11.1 设计目标

攻略生成依赖 LLM 完成核心推理（POI 选择、时间轴排列、文案生成）。为避免单点故障和控制成本，设计\**多提供商优先级调用策�?*�?

### 11.2 提供商优先级

| 优先�?         | 提供�?          | 模型               | 适用场景   | 成本等级 |
| -------------- | --------------- | ------------------ | ---------- | -------- |
| **P0（主用）** | DeepSeek        | `deepseek-chat`    | 全场�?     | �?�?     |
| **P1（备用）** | 智谱 GLM        | `glm-4-plus`       | 全场�?     | ⭐⭐ �?  |
| **P2（备用）** | 小米 MiLM       | `miLM-6B` �?API    | 简单任�?   | �?�?     |
| **P3（降级）** | Kimi (Moonshot) | `moonshot-v1-128k` | 长文本场�? | ⭐⭐�?�? |

> **成本优化原则**�?
>
> - 默认使用 DeepSeek（成本最低，能力足够�?
> - 仅当主用提供商连续失�?�?2 次时，才切换到下一优先�?
> - 每天凌晨 2:00 重置所有提供商状态（给失败提供商恢复机会�?

### 11.3 调用流程

```
┌─────────────────────────────────────────────────�?
�? 攻略生成请求到达                           �?
└──────────┬──────────────────────────────────�?
             �?
             �?
┌─────────────────────────────────────────────────�?
�? 1. 检�?LLM 提供商健康状态表                �?
�?    - 读取 Redis: `llm:health:{provider}`    �?
�?    - 状态：healthy / degraded / unhealthy   �?
└──────────┬──────────────────────────────────�?
             �?
             �?
┌─────────────────────────────────────────────────�?
�? 2. 选择可用的主用提供商（按优先级）          �?
�?    - 优先�?healthy 状态的                  �?
�?    - 若无 healthy，�?degraded（限流中�?   �?
�?    - 若全 unhealthy，触发告�?+ 返回 503   �?
└──────────┬──────────────────────────────────�?
             �?
             �?
┌─────────────────────────────────────────────────�?
�? 3. 调用 LLM API                           �?
�?    - 设置超时�?0s（生成类�? 10s（查询类）│
�?    - 设置重试：最�?2 次（同一提供商）     �?
└──────────┬──────────────────────────────────�?
             �?
     ┌──────┴──────�?
     �?调用成功�?   �?
     └──────┬──────�?
          �?�?         �?�?
             �?         �?
┌─────────────────�? ┌─────────────────────────────────�?
�?返回结果         �? �?4. 标记失败 + 切换提供�?           �?
�?更新健康状�?    �? �?   - 记录失败次数�?Redis          �?
�?(success += 1) �? �?   - 若失�?�?2 次，标记 unhealthy �?
└─────────────────�? �?   - 自动切换到下一优先�?          �?
                      └──────────┬───────────────────────�?
                                 �?
                                 �?
                      ┌───────────────────────────────�?
                      �?5. 重试（从下一优先级提供商�?   �?
                      �?   - 最多重�?3 �?            �?
                      �?   - 若全部失败，返回 error 事件 �?
                      └───────────────────────────────�?
```

### 11.4 健康状态管�?

#### 状态定�?

| 状�?        | 含义   | 触发条件                   | 自动恢复条件                  |
| ----------- | ------ | -------------------------- | ----------------------------- |
| `healthy`   | 正常   | 初始状态，或连续成�?�?3 �? | -                             |
| `degraded`  | 限流�? | 收到 429 错误              | 限流冷却时间过后（见 11.5�?   |
| `unhealthy` | 不可�? | 连续失败 �?2 �?            | 每天凌晨 2:00 重置 / 手动重置 |

#### Redis 存储格式

```
Key: llm:health:{provider}
Value: {
  "status": "healthy",           // healthy / degraded / unhealthy
  "consecutiveFailures": 0,     // 连续失败次数
  "consecutiveSuccesses": 3,     // 连续成功次数
  "lastFailureAt": null,
  "lastSuccessAt": "2026-06-18T02:30:00+08:00",
  "totalRequests": 156,
  "totalFailures": 2,
  "currentQuota": 10000,         // 剩余配额（每日重置）
  "quotaResetAt": "2026-06-19T00:00:00+08:00"
}

TTL: 24 小时（自动过期，重启后重新探测）
```

### 11.5 限流与配额管�?

#### 各提供商限流规则

| 提供�?    | RPM（每分钟请求数） | TPM（每分钟 Token 数） | 每日配额    |
| --------- | ------------------- | ---------------------- | ----------- |
| DeepSeek  | 60                  | 400,000                | 按账户余�?  |
| 智谱 GLM  | 60                  | 400,000                | 按账户余�?  |
| 小米 MiLM | 30                  | 200,000                | 10,000 �?�? |
| Kimi      | 60                  | 400,000                | 按账户余�?  |

#### 限流处理逻辑

```
当收�?429 响应时：

  1. 解析 Retry-After 头（秒）
     若没�?Retry-After，默认等�?60s

  2. 标记该提供商状态为 degraded
     写入 Redis: llm:health:{provider}.status = "degraded"
     写入 Redis: llm:health:{provider}.retryAfter = <timestamp>

  3. 立即切换到下一优先级提供商（不等待�?

  4. 启动定时任务�?
     �?retryAfter 时间后，将状态恢复为 healthy（先发一个探测请求）
```

### 11.6 任务类型与模型选择

不是所有任务都需要最强模型，按任务类型选择合适模型可**降低成本 40~60%**�?

| 任务类型                     | 推荐模型              | 原因                   |
| ---------------------------- | --------------------- | ---------------------- |
| \*_攻略生成（主任务�?_       | DeepSeek Chat / GLM-4 | 需要强推理能力         |
| **POI 候选池过滤**           | DeepSeek Chat（轻量） | 规则明确，不需要强推理 |
| **时间轴微调（用户修改后）** | DeepSeek Chat         | 需要理解用户意�?       |
| **文案润色（生成描述文案）** | 智谱 GLM              | 中文文案质量�?         |
| **错误恢复（降级场景）**     | Kimi                  | 长上下文，适合复杂场景 |

#### 实现方式

```json
// 在攻略生成配置中指定
{
  "llmRouting": {
    "trip_generation": {
      "primary": "deepseek",
      "fallback": ["glm", "kimi"]
    },
    "poi_filtering": {
      "primary": "deepseek",
      "fallback": ["glm"]
    },
    "copywriting": {
      "primary": "glm",
      "fallback": ["deepseek"]
    }
  }
}
```

### 11.7 成本监控与告�?

#### 监控指标

| 指标                       | 说明                            | 告警阈�?   |
| -------------------------- | ------------------------------- | ---------- |
| `llm.daily_cost_rmb`       | 每日 LLM 花费（人民币�?         | > 500 �?�? |
| `llm.api_error_rate`       | API 错误�?                      | > 10%      |
| `llm.fallback_rate`        | 降级使用率（P1/P2/P3 调用占比�? | > 30%      |
| `llm.avg_response_time_ms` | 平均响应时间                    | > 5000ms   |

#### 日志记录规范

每次 LLM 调用必须记录�?

```json
{
  "timestamp": "2026-06-18T02:30:00+08:00",
  "provider": "deepseek",
  "model": "deepseek-chat",
  "taskType": "trip_generation",
  "requestId": "req_abc123",
  "inputTokens": 3200,
  "outputTokens": 1500,
  "costCNY": 0.015, // 本次调用成本（人民币�?
  "responseTimeMs": 8500,
  "status": "success", // success / timeout / error / rate_limited
  "errorMessage": null,
  "fallbackFrom": null // 若是降级调用，记录原始提供商
}
```

---

## 13. 高德 API 调用逻辑

### 12.1 设计目标

高德地图 API 是本系统�?_唯一地理数据�?_（MVP 阶段），提供 POI 搜索、路线规划、地理编码等能力。需要设�?\*健壮的调用逻辑\*\*，避免单点依赖和配额浪费�?

### 12.2 使用的高�?API 列表

| API              | 路径                            | 用�?                 | 频率限制           |
| ---------------- | ------------------------------- | -------------------- | ------------------ |
| POI 搜索         | `/place/text`                   | 搜索景点、餐厅、酒�? | 200 �?日（个人版） |
| POI 详情         | `/place/detail`                 | 获取 POI 详细信息    | 200 �?�?           |
| 路线规划（驾车） | `/direction/driving`            | 计算驾车路线         | 200 �?�?           |
| 路线规划（公交） | `/direction/transit/integrated` | 计算地铁+公交路线    | 200 �?�?           |
| 路线规划（步行） | `/direction/walking`            | 计算步行路线         | 200 �?�?           |
| 路线规划（骑行） | `/direction/bicycling`          | 计算骑行路线         | 200 �?�?           |
| 地理编码         | `/geocode/geo`                  | 地址 �?坐标          | 200 �?�?           |
| 逆地理编�?       | `/geocode/regeo`                | 坐标 �?地址          | 200 �?�?           |
| 天气查询         | `/weather/weatherInfo`          | 查询城市天气         | 200 �?�?           |

> **MVP 阶段限制**：高德个人版 API 每日配额 200 次，需严格缓存�?
> **升级方案**：企业认证后可提升至 3000~100000 �?日�?

### 12.3 调用架构

```
┌─────────────────────────────────────────────────�?
�? 应用层（攻略生成引擎�?                      �?
�? - 需�?POI 数据 / 路线数据                 �?
└──────────┬──────────────────────────────────�?
             �?
             �?
┌─────────────────────────────────────────────────�?
�? 高德 API 适配层（AmapAdapter�?              �?
�? - 统一封装所有高�?API 调用                  �?
�? - 处理签名、重试、限流、缓�?               �?
└──────────┬──────────────────────────────────�?
             �?
      ┌──────┴──────�?
      �?检查缓存？    �?
      └──────┬──────�?
           �?�?         �?�?
              �?         �?
       ┌──────────�? ┌──────────────────────────────�?
       �?返回缓存   �? �?1. 检查配额（Redis 计数器）    �?
       �?数据       �? �?   - 若配额用完，返回 429     �?
       └──────────�? �?2. 发起 HTTP 请求              �?
                      �?3. 若成功，写入缓存           �?
                      �?4. 若失败，记录错误 + 降级    �?
                      └──────────┬────────────────────�?
                                 �?
                                 �?
                      ┌──────────────────────────────�?
                      �?返回结果 / 触发降级            �?
                      └──────────────────────────────�?
```

### 12.4 缓存策略

#### 缓存 Key 设计

| API 类型   | 缓存 Key 格式                               | TTL     | 说明                            |
| ---------- | ------------------------------------------- | ------- | ------------------------------- |
| POI 搜索   | `amap:poi:{city}:{keywords}:{v}`            | 24 小时 | 同一城市+关键词，24h 内不重复�? |
| POI 详情   | `amap:poi:detail:{poiId}`                   | 7 �?    | POI 基本信息较稳�?              |
| 路线规划   | `amap:route:{originHash}:{destHash}:{mode}` | 1 小时  | 路线受实时路况影响，TTL �?      |
| 地理编码   | `amap:geocode:{address}`                    | 30 �?   | 地址坐标是固定的                |
| 逆地理编�? | `amap:regeocode:{lat}:{lng}`                | 30 �?   | 同上                            |
| 天气       | `amap:weather:{cityCode}:{date}`            | 2 小时  | 天气变化频率中等                |

#### 缓存预热

```
每日凌晨 3:00 执行缓存预热（针对热门城市）�?

  1. 从数据库查询过去 7 天热门目的地城市
  2. 对每个热门城市，预加载：
     - 热门 POI（景点、美食、酒店）�?50 �?
     - 市中心到主要景点的路�?
  3. 预热结果写入 Redis
  4. 预热失败不阻断主流程，仅记录日志
```

### 12.5 配额管理

#### 配额监控

```
Redis 计数器（每日重置）：

Key: amap:quota:{api_name}:{date}
Value: 剩余调用次数

每次调用前：
  1. 读取计数�?
  2. 若剩余次�?> 0�?
     - 调用 API
     - 计数�?-1
  3. 若剩余次�?= 0�?
     - 返回 mock 数据（见 12.6 降级策略�?
     - 触发告警（通知管理员）

每日凌晨 0:00 自动重置所有计数器
```

#### 配额优化

```
问题：MVP 阶段高德个人版只�?200 �?日，不够�?

优化方案�?

  1. 最大化缓存命中�?
     - 预热热门城市数据
     - 相同请求绝不重复�?API

  2. 使用本地知识库作为主数据�?
     - POI 数据优先从本�?JSON 读取
     - 高德 API 仅作为补充（查新�?POI / 实时信息�?

  3. 申请企业认证
     - 企业认证后配额提升至 3000 �?�?
     - 成本：认证免费，按调用量计费

  4. �?Key 轮转（进阶）
     - 注册多个高德账号，获取多�?API Key
     - 适配器自动轮转使�?
```

### 12.6 降级策略

当高�?API 不可用（配额用完 / 服务故障）时，按以下顺序降级�?

```
Level 0（正常）：高�?API 可用
  �?正常使用高德数据

Level 1（部分缓存）：高�?API 配额用完，但缓存有数�?
  �?返回缓存数据
  �?标记 meta.source = "cache"
  �?前端提示「数据可能不是最新的�?

Level 2（本地知识库）：缓存未命中，但本地知识库有用
  �?从本�?JSON 文件读取 POI 数据
  �?路线规划返回估算值（基于直线距离 × 1.3�?
  �?标记 meta.source = "local_kb"

Level 3（Mock 数据）：本地知识库也无数�?
  �?返回 Mock 数据（仅用于开�?测试�?
  �?标记 meta.source = "mock"
  �?前端提示「该城市数据建设中�?
```

#### 降级触发条件

| 触发条件              | 降级等级 | 恢复条件                    |
| --------------------- | -------- | --------------------------- |
| 高德 API 返回 429     | Level 1  | 次日配额重置 / 切换 API Key |
| 高德 API 返回 500/503 | Level 1  | 连续成功 3 次后恢复         |
| 高德 API 超时�? 5s�?  | Level 1  | 同上�?                      |
| 本地知识库无数据      | Level 2  | 补充知识库数�?              |
| 全部数据源不可用      | Level 3  | 人工介入                    |

### 12.7 调用示例与数据转�?

#### 示例 1：POI 搜索

```
请求�?
  GET https://restapi.amap.com/v3/place/text
  Params:
    key: <API_KEY>
    keywords: "岳麓�?
    city: "长沙"
    offset: 20
    page: 1
    extensions: "all"

响应（高德原始）�?
  {
    "status": "1",
    "pois": [
      {
        "id": "B0FFHP0J68",
        "name": "岳麓山风景区",
        "location": "112.907456,28.235678",
        "address": "岳麓区岳麓山",
        "tel": "0731-88888888",
        "open_time": "08:00-18:00",
        "cost": "免费",
        "category": "风景名胜;风景�?
      }
    ]
  }

转换后（系统内部格式）：
  {
    "id": "poi_yuelu_001",
    "name": "岳麓山风景区",
    "city": "长沙",
    "category": "attraction",
    "location": { "lat": 28.235678, "lng": 112.907456 },
    "duration": 180,                    // 人工补充（高德不提供�?
    "energyLevel": "MEDIUM",            // 人工补充
    "bestTimeSlot": ["morning", "afternoon"],
    "openingHours": { "open": "08:00", "close": "18:00" },
    "priceRange": { "min": 0, "max": 0 }
  }
```

> **注意**：高�?API 不提�?`duration`（游玩时长）、`energyLevel`（体力消耗）等字段，需�?\*补全逻辑\*\*�?
>
> - 从本地知识库读取（优先）
> - 基于类别估算（如：风景区默认 180 分钟�?

#### 示例 2：路线规�?

```
请求�?
  GET https://restapi.amap.com/v3/direction/transit/integrated
  Params:
    key: <API_KEY>
    origin: "112.907456,28.235678"
    destination: "112.938123,28.227456"
    city: "长沙"
    strategy: 0                      // 0=最省时�?

响应（高德原始）�?
  {
    "status": "1",
    "route": {
      "paths": [
        {
          "distance": 8500,
          "duration": 2100,            // �?
          "steps": [ ... ]
        }
      ]
    }
  }

转换后（系统内部格式）：
  {
    "distanceMeters": 8500,
    "durationMinutes": 35,
    "steps": [
      {
        "instruction": "从岳麓山南门步行至「湖南大学」公交站",
        "mode": "walking",
        "durationMinutes": 8
      }
    ]
  }
```

### 12.8 错误处理

| 错误�?  | 含义               | 处理方式                      |
| ------- | ------------------ | ----------------------------- |
| `10000` | 请求成功           | 正常处理                      |
| `10001` | Key 错误           | 切换 API Key / 告警           |
| `10002` | 没有权限           | 检�?API 权限配置              |
| `10003` | 访问已超出日访问�? | 触发降级（Level 1�?           |
| `10004` | 访问过于频繁       | 降低调用频率 / 提升缓存命中�? |
| `10005` | IP 白名单错�?      | 将服务器 IP 加入白名�?        |
| `20000` | 引擎返回数据有误   | 重试（最�?2 次）              |
| `30000` | 引擎连接超时       | 重试（最�?2 次）              |
| `30001` | 读取超时           | 重试（最�?2 次）              |
| `30002` | 连接超时           | 重试（最�?2 次）              |

#### 重试逻辑

```
重试条件�?
  - 网络错误（超时、连接失败）
  - 高德返回 30000~30002（服务端错误�?

不重试：
  - 参数错误�?0001~10005�?
  - 配额用完�?0003�?

重试策略�?
  - 次数：最�?2 �?
  - 间隔：指数退避（1s, 2s�?
  - 若全部失败：触发降级
```

---

## 附录 A：完整请�?响应示例

### A.1 完整攻略生成流程（SSE�?

```
客户�?                                        服务�?
  �?                                            �?
  │── POST /trips/generate (Accept: text/event-stream) ──�?
  �?                                            �?
  �?◀── SSE: event: connected ──────────────────�?
  �?   （显示「开始生成」动画）                     �?
  �?                                            �?
  �?◀── SSE: event: progress ───────────────────�?
  �?   （更新进度条�?0%，正在解析目的地...�?       �?
  �?                                            �?
  �?◀── SSE: event: day_ready (Day 1) ─────────�?
  �?   （渲�?Day 1 卡片，用户可见）               �?
  �?                                            �?
  �?◀── SSE: event: progress ───────────────────�?
  �?   （更新进度条�?0%，正在生�?Day 2...�?      �?
  �?                                            �?
  �?◀── SSE: event: day_ready (Day 2) ─────────�?
  �?   （渲�?Day 2 卡片�?                       �?
  �?                                            �?
  �?                 ...（重复）                   �?
  �?                                            �?
  �?◀── SSE: event: done ───────────────────────�?
  �?   （跳转详情页，显示「完成」）                 �?
  �?                                            �?
```

### A.2 cURL 测试示例

```bash
# 发起攻略生成（SSE�?
curl -N -X POST https://api.tripplanner.com/v1/trips/generate \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -H "Authorization: Bearer <token>" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{
    "departure": { "city": "北京", "date": "2026-07-01", "timePeriod": "morning" },
    "destinations": [
      { "cityName": "长沙", "days": 3, "transportTo": "high_speed_rail"  // high_speed_rail / normal_train / flight / bus / auto },
      { "cityName": "广州", "days": 2, "transportTo": null }
    ],
    "travelers": { "adults": 2, "children": [], "elders": [] },
    "preferences": { "budget": "comfort", "pace": "moderate", "accommodation": "chain_hotel", "dining": ["local_food"], "interests": ["culture"] }
  }'

# 查询已生成的攻略
curl -X GET https://api.tripplanner.com/v1/trips/trip_xyz789 \
  -H "Authorization: Bearer <token>"

# 导出攻略�?PDF
curl -X GET "https://api.tripplanner.com/v1/trips/trip_xyz789/export?format=pdf" \
  -H "Authorization: Bearer <token>"
```

---

_文档结束 · 版本 v1.0.1_

# LLM 集成测试用例

> **文档版本**：v1.0.0
> **日期**：2026-06-27
> **作者**：Buddy 🏗️（测试工程师）
> **对应开发任务**：T1.5-T1.11（LLM 集成）
> **状态**：草稿，待评审

---

## 文档说明

本文档定义 LLM 集成的测试用例，作为开发验收和回归测试的依据。

**测试范围**：

- LLM 适配器（`llm_router.ts`）
- 攻略生成服务（`trip_generate_service.ts`）
- SSE 流式返回（`trip_generate.ts` 路由）
- 提示词模板（`prompts/` 目录）

**测试依据**：

- `API接口设计规格书_v1.0.0.md` §4.2 `POST /trips/generate`
- `API接口设计规格书_v1.0.0.md` §5 SSE 流式返回协议
- `旅游攻略生成平台_SRS.md` §3.1 M03 模块（AI Agent）
- `前端交互设计规格书_v1.0.0.md` §4 SSE 流式渲染技术规范

---

## 目录

1. [测试环境准备](#1-测试环境准备)
2. [单元测试：LLM 适配器](#2-单元测试llm-适配器)
3. [单元测试：提示词生成](#3-单元测试提示词生成)
4. [集成测试：攻略生成 API](#4-集成测试攻略生成-api)
5. [E2E 测试：完整生成流程](#5-e2e-测试完整生成流程)
6. [性能测试](#6-性能测试)
7. [边界条件测试](#7-边界条件测试)
8. [错误处理测试](#8-错误处理测试)

---

## 1. 测试环境准备

### 1.1 测试数据

**必填字段说明**（依据 API 文档 §4.2）：

```json
{
  "departure": {
    "city": "北京",
    "date": "2026-07-01",
    "timePeriod": "morning"
  },
  "destinations": [
    {
      "cityName": "长沙",
      "days": 3,
      "transportTo": "high_speed_rail"
    }
  ],
  "travelers": {
    "adults": 2,
    "children": [],
    "elders": []
  },
  "preferences": {
    "budget": "comfort",
    "pace": "moderate",
    "interests": ["culture", "food"]
  }
}
```

### 1.2 Mock LLM 响应

用于单元测试，模拟 LLM 返回：

```json
{
  "tripId": "trip_test_001",
  "days": [
    {
      "dayIndex": 1,
      "date": "2026-07-01",
      "dayType": "transit_departure",
      "cityName": "长沙",
      "isFirstDayOfCity": true,
      "title": "Day 1 · 抵达长沙",
      "timeline": [
        {
          "id": "item_001",
          "type": "transport",
          "title": "北京南 → 长沙南",
          "startTime": "08:00",
          "endTime": "12:30",
          "estimatedCostCNY": 628,
          "energyLevel": "LOW"
        }
      ],
      "accommodation": {
        "primary": {
          "name": "长沙IFS 国金中心亚朵酒店",
          "pricePerNight": 480
        }
      },
      "tips": ["建议下载长沙地铁 APP"]
    }
  ]
}
```

---

## 2. 单元测试：LLM 适配器

### 2.1 测试目标

验证 `llm_router.ts` 能正确调用 LLM API 并返回结构化数据。

### 2.2 测试用例

| 用例 ID        | 用例名称          | 输入                        | 预期输出                 | 验收标准              |
| -------------- | ----------------- | --------------------------- | ------------------------ | --------------------- |
| **UT-LLM-001** | DeepSeek 调用成功 | 有效请求 + DeepSeek API Key | 结构化行程数据           | 返回完整 TripResponse |
| **UT-LLM-002** | GLM-4 调用成功    | 有效请求 + GLM-4 API Key    | 结构化行程数据           | 返回完整 TripResponse |
| **UT-LLM-003** | Kimi 调用成功     | 有效请求 + Kimi API Key     | 结构化行程数据           | 返回完整 TripResponse |
| **UT-LLM-004** | LLM API 超时      | 请求 + 模拟超时（>30s）     | 抛出 TimeoutError        | 错误被捕获并正确处理  |
| **UT-LLM-005** | LLM API 返回错误  | 无效 API Key                | 抛出 AuthenticationError | 错误信息清晰          |
| **UT-LLM-006** | LLM 返回格式错误  | LLM 返回非 JSON             | 抛出 ParseError          | 错误被捕获            |
| **UT-LLM-007** | 多 LLM 备份调用   | 主 LLM 失败                 | 自动切换备份 LLM         | 最终成功返回          |
| **UT-LLM-008** | 幂等性保证        | 同一 Idempotency-Key        | 返回缓存结果             | 不重复调用 LLM        |

**测试代码框架**：

```typescript
// apps/api/tests/unit/llm_router.test.ts

describe('LLM Router', () => {
  test('UT-LLM-001: DeepSeek 调用成功', async () => {
    // Mock DeepSeek API
    // 调用 llm_router.generateTrip(request)
    // 断言：返回完整 TripResponse
  });

  test('UT-LLM-004: LLM API 超时', async () => {
    // Mock 超时
    // 断言：抛出 TimeoutError
    // 断言：错误信息包含 "LLM API 超时"
  });
});
```

---

## 3. 单元测试：提示词生成

### 3.1 测试目标

验证提示词模板能正确生成，包含用户所有输入信息。

### 3.2 测试用例

| 用例 ID           | 用例名称       | 输入                      | 预期输出     | 验收标准                 |
| ----------------- | -------------- | ------------------------- | ------------ | ------------------------ |
| **UT-PROMPT-001** | 基础提示词生成 | 完整请求对象              | 提示词字符串 | 包含出发地、目的地、日期 |
| **UT-PROMPT-002** | 多目的地提示词 | 3 个目的地                | 提示词字符串 | 包含中转日逻辑           |
| **UT-PROMPT-003** | 带老人提示词   | 有老人 + 慢节奏           | 提示词字符串 | 包含"避免高强度活动"     |
| **UT-PROMPT-004** | 带幼儿提示词   | 有 <3 岁幼儿              | 提示词字符串 | 包含"推荐亲子设施"       |
| **UT-PROMPT-005** | 预算约束提示词 | 穷游预算                  | 提示词字符串 | 包含"推荐经济型选择"     |
| **UT-PROMPT-006** | 返程提示词     | needsReturnTransport=true | 提示词字符串 | 包含返程交通生成指令     |

**验证要点**：

- 提示词是否包含所有用户输入？
- 提示词是否明确指定返回格式（JSON Schema）？
- 提示词是否包含错误处理指令（如"景点闭馆时自动替换"）？

---

## 4. 集成测试：攻略生成 API

### 4.1 测试目标

验证 `POST /api/v1/trips/generate` 接口能正确触发 LLM 生成并返回 SSE 流。

### 4.2 测试用例

| 用例 ID        | 用例名称              | 输入                 | 预期输出               | 验收标准                                     |
| -------------- | --------------------- | -------------------- | ---------------------- | -------------------------------------------- |
| **IT-GEN-001** | 有效请求生成成功      | 完整请求 + Mock LLM  | SSE 事件流             | 收到 connected → progress → day_ready → done |
| **IT-GEN-002** | 参数校验失败          | 缺少 destinations    | HTTP 400               | 立即返回错误，不进入 SSE                     |
| **IT-GEN-003** | 日期格式错误          | 无效日期字符串       | HTTP 400               | 错误信息明确                                 |
| **IT-GEN-004** | 幂等键重复            | 同一 Idempotency-Key | 返回缓存结果           | 不重复生成                                   |
| **IT-GEN-005** | 取消生成              | 生成中调用 DELETE    | HTTP 200               | 生成任务停止                                 |
| **IT-GEN-006** | 部分失败恢复          | LLM 某步骤失败       | 返回部分结果 + warning | recoverable=true                             |
| **IT-GEN-007** | processingTimeMs 计算 | 任意请求             | SSE 元数据             | processingTimeMs > 0                         |

### 4.3 SSE 事件流验证

**必须收到的事件**（按顺序）：

```
1. connected（连接建立，返回 taskId）
2. progress（进度更新，至少 1 次）
3. day_ready（每天完成时推送，N 天 = N 次）
4. done（全部完成，返回 tripId）
```

**事件数据格式验证**（依据 API 文档 §5.4）：

| 事件        | 必填字段                           | 可选字段                                                   | 验证规则                  |
| ----------- | ---------------------------------- | ---------------------------------------------------------- | ------------------------- |
| `connected` | taskId, estimatedTotalSeconds      | -                                                          | taskId 格式：`task_` 前缀 |
| `progress`  | step, totalSteps, percent, message | subMessage, estimatedRemainingSeconds                      | percent: 0-100            |
| `day_ready` | dayIndex, day                      | -                                                          | day.timeline 数组非空     |
| `done`      | tripId                             | totalProcessingTimeSeconds, totalEstimatedCostCNY, summary | tripId 格式：`trip_` 前缀 |

### 4.4 测试代码框架

```typescript
// apps/api/tests/integration/trip_generate.test.ts

describe('POST /trips/generate', () => {
  test('IT-GEN-001: 有效请求生成成功', async () => {
    const response = await request(app)
      .post('/api/v1/trips/generate')
      .set('Accept', 'text/event-stream')
      .set('Idempotency-Key', uuidv4())
      .send(validRequest);

    // 断言：状态码 200
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('text/event-stream');

    // 解析 SSE 事件
    const events = parseSSEStream(response.text);

    // 断言：事件顺序正确
    expect(events[0].event).toBe('connected');
    expect(events[1].event).toBe('progress');
    // ... 每天一个 day_ready
    expect(events[events.length - 1].event).toBe('done');
  });
});
```

---

## 5. E2E 测试：完整生成流程

### 5.1 测试目标

验证从前端提交请求到收到完整攻略的端到端流程。

### 5.2 测试用例

| 用例 ID         | 用例名称     | 步骤                                                                                 | 预期结果           | 验收标准                |
| --------------- | ------------ | ------------------------------------------------------------------------------------ | ------------------ | ----------------------- |
| **E2E-GEN-001** | 单城市生成   | 1. 填写表单（北京 → 长沙，3 天）<br>2. 点击生成<br>3. 等待 SSE 流<br>4. 跳转到结果页 | 生成成功，看到攻略 | 无 500 错误，攻略可查看 |
| **E2E-GEN-002** | 多城市生成   | 1. 填写表单（北京 → 长沙 → 广州，各 3 天）<br>2. 点击生成                            | 生成成功，含中转日 | 中转日逻辑正确          |
| **E2E-GEN-003** | 生成中取消   | 1. 开始生成<br>2. 点击取消按钮                                                       | 生成停止，返回首页 | 无僵尸任务              |
| **E2E-GEN-004** | 网络中断重连 | 1. 开始生成<br>2. 断开网络 3s<br>3. 恢复网络                                         | SSE 自动重连       | 继续收到事件            |
| **E2E-GEN-005** | 分享链接可用 | 1. 生成完成后点击分享<br>2. 复制链接<br>3. 打开链接                                  | 看到攻略详情       | 无需登录可查看          |

### 5.3 手动测试检查清单

前端交互验证（依据前端交互设计规格书）：

- [ ] 生成中页面显示进度条
- [ ] 进度百分比实时更新
- [ ] 每天完成后立即渲染卡片（无需等全部完成）
- [ ] 住宿卡片仅在第一天展示
- [ ] 生成完成后自动跳转结果页
- [ ] 分享按钮可点击并复制链接
- [ ] 导出按钮可点击并下载 HTML

---

## 6. 性能测试

### 6.1 测试目标

验证 LLM 生成速度满足设计要求（< 120s）。

### 6.2 测试用例

| 用例 ID          | 用例名称       | 输入                  | 预期输出 | 验收标准       |
| ---------------- | -------------- | --------------------- | -------- | -------------- |
| **PERF-GEN-001** | 单城市生成时间 | 1 个城市，3 天        | 生成时间 | < 60s（目标）  |
| **PERF-GEN-002** | 多城市生成时间 | 3 个城市，各 3 天     | 生成时间 | < 120s（最大） |
| **PERF-GEN-003** | LLM 响应时间   | 单步 LLM 调用         | 响应时间 | < 30s          |
| **PERF-GEN-004** | 并发生成       | 10 个并发请求         | 所有成功 | 无超时         |
| **PERF-GEN-005** | SSE 流式延迟   | 从 LLM 返回到前端渲染 | 延迟     | < 1s           |

### 6.3 性能测试脚本

```typescript
// apps/api/tests/performance/trip_generate.test.ts

describe('Performance: Trip Generation', () => {
  test('PERF-GEN-001: 单城市生成时间', async () => {
    const start = Date.now();

    // 触发生成
    const response = await request(app).post('/api/v1/trips/generate').send(singleCityRequest);

    // 等待 done 事件
    const tripId = await waitForDone(response);

    const duration = Date.now() - start;

    // 断言：生成时间 < 60s
    expect(duration).toBeLessThan(60000);
  });
});
```

---

## 7. 边界条件测试

### 7.1 测试目标

验证系统在处理边界情况时的行为。

### 7.2 测试用例

| 用例 ID          | 用例名称       | 输入                   | 预期输出             | 验收标准         |
| ---------------- | -------------- | ---------------------- | -------------------- | ---------------- |
| **EDGE-GEN-001** | 最少目的地     | 1 个目的地，1 天       | 生成成功             | 至少有 1 天行程  |
| **EDGE-GEN-002** | 最多目的地     | 5 个目的地，各 14 天   | 生成成功或合理报错   | 不崩溃           |
| **EDGE-GEN-003** | 无偏好设置     | preferences={}         | 使用默认偏好         | 生成成功         |
| **EDGE-GEN-004** | 极端预算       | budget=luxury + 999 天 | 生成成功             | 提示"行程过长"   |
| **EDGE-GEN-005** | 特殊字符城市名 | 城市名含 emoji         | 生成成功或合理报错   | 不崩溃           |
| **EDGE-GEN-006** | LLM 返回空行程 | LLM 返回空 timeline    | 抛出 GenerationError | 前端显示错误提示 |
| **EDGE-GEN-007** | 景点全部闭馆   | 所有景点都闭馆         | 返回 warning + 备选  | 不返回空行程     |

---

## 8. 错误处理测试

### 8.1 测试目标

验证系统能优雅地处理各种错误情况。

### 8.2 测试用例

| 用例 ID         | 用例名称         | 输入            | 预期输出       | 验收标准           |
| --------------- | ---------------- | --------------- | -------------- | ------------------ |
| **ERR-GEN-001** | LLM API Key 无效 | 无效 API Key    | HTTP 401       | 错误信息清晰       |
| **ERR-GEN-002** | LLM API 限流     | 触发 rate limit | HTTP 429       | 自动重试或提示     |
| **ERR-GEN-003** | 数据库连接失败   | 模拟 DB 错误    | HTTP 500       | 返回 partialTripId |
| **ERR-GEN-004** | Redis 连接失败   | 模拟 Redis 错误 | 降级为内存存储 | 功能可用           |
| **ERR-GEN-005** | SSE 连接中断     | 模拟网络断开    | 前端自动重连   | 继续接收事件       |
| **ERR-GEN-006** | LLM 返回恶意内容 | 返回 XSS 脚本   | 前端转义显示   | 不执行脚本         |
| **ERR-GEN-007** | 生成超时         | 生成时间 > 120s | 返回部分结果   | timeout 事件       |

### 8.3 错误响应格式验证

所有错误必须返回统一格式（依据 API 文档 §9）：

```json
{
  "code": 50001,
  "message": "部分景点预约信息查询失败",
  "data": {
    "recoverable": true,
    "partialTripId": "trip_xyz789",
    "failedStep": "booking_info_fetch",
    "suggestion": "可继续查看已生成的行程"
  },
  "meta": {
    "requestId": "req_abc123",
    "timestamp": "2026-06-18T02:35:00+08:00"
  }
}
```

**验证要点**：

- `code` 必须是数字（非 HTTP 状态码）
- `message` 必须清晰描述问题
- `data.recoverable` 必须正确设置
- `meta.requestId` 必须存在（用于追踪）

---

## 9. 回归测试套件

### 9.1 冒烟测试（每次提交前必须通过）

| 用例 ID       | 用例名称       | 自动化 | 手动 |
| ------------- | -------------- | ------ | ---- |
| **SMOKE-001** | 单城市生成成功 | ✅     | -    |
| **SMOKE-002** | SSE 事件流完整 | ✅     | -    |
| **SMOKE-003** | 前端显示攻略   | -      | ✅   |
| **SMOKE-004** | 分享链接可用   | -      | ✅   |

### 9.2 完整回归测试（每次发布前必须通过）

- 所有单元测试（§2, §3）
- 所有集成测试（§4）
- 所有 E2E 测试（§5）
- 所有边界条件测试（§7）
- 所有错误处理测试（§8）

---

## 10. 测试执行计划

### 10.1 测试阶段

| 阶段             | 时间            | 内容               | 负责人                |
| ---------------- | --------------- | ------------------ | --------------------- |
| **开发同步测试** | T1.5-T1.11 期间 | 单元测试、集成测试 | 你（开发完成后提 MR） |
| **E2E 测试**     | T1.31           | 完整流程验证       | 我（测试工程师）      |
| **性能测试**     | T1.32           | 生成速度验证       | 我（测试工程师）      |
| **回归测试**     | T1.33           | 全量测试           | 我（测试工程师）      |

### 10.2 测试工具

| 工具           | 用途               | 配置位置                |
| -------------- | ------------------ | ----------------------- |
| **Jest**       | 单元测试、集成测试 | `apps/api/package.json` |
| **Supertest**  | HTTP 接口测试      | `apps/api/tests/`       |
| **Playwright** | E2E 测试           | `tests/e2e/`            |
| **Artillery**  | 性能测试           | `tests/performance/`    |

---

## 11. 测试报告模板

### 11.1 单元测试报告

```
## LLM 集成单元测试报告

**日期**：2026-XX-XX
**版本**：vX.X.X
**测试范围**：T1.5-T1.11

### 测试结果

| 测试套件 | 用例数 | 通过 | 失败 | 覆盖率 |
|----------|--------|------|------|--------|
| LLM 适配器 | 8 | 8 | 0 | 95% |
| 提示词生成 | 6 | 6 | 0 | 90% |
| **合计** | **14** | **14** | **0** | **93%** |

### 失败用例详情

（无）

### 建议

- 无
```

### 11.2 E2E 测试报告

```
## LLM 集成 E2E 测试报告

**日期**：2026-XX-XX
**版本**：vX.X.X
**测试环境**：本地开发环境

### 测试结果

| 用例 ID | 用例名称 | 状态 | 备注 |
|---------|----------|------|------|
| E2E-GEN-001 | 单城市生成 | ✅ 通过 | - |
| E2E-GEN-002 | 多城市生成 | ❌ 失败 | 中转日逻辑错误 |
| E2E-GEN-003 | 生成中取消 | ✅ 通过 | - |

### Bug 清单

| Bug ID | 描述 | 严重程度 | 状态 |
|--------|------|----------|------|
| BUG-001 | 中转日不显示大交通信息 | P1 | 待修复 |

### 建议

1. 修复中转日逻辑
2. 优化生成速度（当前 90s，目标 < 60s）
```

---

## 附录：测试数据准备

### A.1 测试城市列表

| 城市 | 省份 | 特点       | 用途       |
| ---- | ---- | ---------- | ---------- |
| 长沙 | 湖南 | 美食、文化 | 基础测试   |
| 广州 | 广东 | 美食、现代 | 多城市测试 |
| 北京 | 北京 | 文化、历史 | 出发地测试 |
| 上海 | 上海 | 现代、购物 | 偏好测试   |

### A.2 Mock LLM 响应模板

见 §1.2 Mock LLM 响应。

---

**文档结束**

---

## 使用说明

1. **开发前**：阅读本文档，理解验收标准
2. **开发中**：编写对应测试用例（可参考测试代码框架）
3. **开发完成后**：运行测试用例，确保所有测试通过
4. **提交 MR 前**：运行冒烟测试（§9.1），必须全部通过
5. **发布前**：运行完整回归测试（§9.2），我帮你验证

---

## 下一步

请告诉我：

1. 这个测试用例文档是否覆盖完整？
2. 是否需要我帮你生成具体的测试代码（Jest + Supertest）？
3. 还是你自己写测试，我负责审查？

**注意**：作为测试工程师，我不写生产代码，但可以写测试代码（这是我的职责）。

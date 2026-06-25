# LLM 调用最佳实践文档

**版本**：v1.0.0  
**日期**：2026-06-22  
**状态**：待评审  
**作者**：软件架构师  
**关联文档**：技术栈选型文档\_v1.0.0.md、LLM Prompt 设计文档\_v1.0.0.md

---

## 目录

1. [概述](#1-概述)
2. [模型能力矩阵](#2-模型能力矩阵)
3. [智能路由策略](#3-智能路由策略)
4. [各模型调用规范](#4-各模型调用规范)
5. [Prompt 工程规范](#5-prompt-工程规范)
6. [错误处理与降级](#6-错误处理与降级)
7. [成本优化策略](#7-成本优化策略)
8. [性能调优](#8-性能调优)
9. [质量评估](#9-质量评估)

---

## 1. 概述

### 1.1 支持的 LLM 模型

PATH-WISE 当前支持以下 4 个 LLM 模型，均为中国大陆可访问的 API：

| 模型标识         | 厂商             | 核心优势                     | 优先级          |
| ---------------- | ---------------- | ---------------------------- | --------------- |
| `deepseek-chat`  | DeepSeek         | 推理能力强、成本极低         | ✅ 默认主力     |
| `glm-4-flash`    | 智谱 AI（GLM）   | 中文语义理解优秀、响应快     | ✅ 高频轻量任务 |
| `moonshot-v1-8k` | Kimi（月之暗面） | 超长上下文（200K）、细节丰富 | ✅ 长文本任务   |
| `MiMo-7B-RL`     | 小米             | 轻量快速、成本极低           | ✅ 简单快速任务 |

### 1.2 设计原则

- **路由透明**：前端无需感知后端使用哪个模型
- **降级兜底**：主模型失败时自动切换到备用模型
- **成本控制**：根据任务复杂度选择合适模型（避免大模型做小任务）
- **结果可复现**：生产环境使用固定 temperature，避免输出不稳定

---

## 2. 模型能力矩阵

### 2.1 能力详细对比

| 维度                     | DeepSeek Chat | GLM-4-Flash | Kimi v1-8k |  MiMo-7B   |
| ------------------------ | :-----------: | :---------: | :--------: | :--------: |
| **中文理解**             |   ⭐⭐⭐⭐    | ⭐⭐⭐⭐⭐  | ⭐⭐⭐⭐⭐ |   ⭐⭐⭐   |
| **逻辑推理**             |  ⭐⭐⭐⭐⭐   |  ⭐⭐⭐⭐   |  ⭐⭐⭐⭐  |   ⭐⭐⭐   |
| **结构化输出（JSON）**   |  ⭐⭐⭐⭐⭐   |  ⭐⭐⭐⭐   |  ⭐⭐⭐⭐  |   ⭐⭐⭐   |
| **长文本处理**           |   ⭐⭐⭐⭐    |   ⭐⭐⭐    | ⭐⭐⭐⭐⭐ |    ⭐⭐    |
| **地理知识**             |   ⭐⭐⭐⭐    | ⭐⭐⭐⭐⭐  |  ⭐⭐⭐⭐  |   ⭐⭐⭐   |
| **文化背景理解**         |   ⭐⭐⭐⭐    | ⭐⭐⭐⭐⭐  | ⭐⭐⭐⭐⭐ |   ⭐⭐⭐   |
| **响应速度**             |   ⭐⭐⭐⭐    | ⭐⭐⭐⭐⭐  |   ⭐⭐⭐   | ⭐⭐⭐⭐⭐ |
| **成本（元/百万Token）** |      ¥1       |    ¥0.1     |    ¥12     |    ¥0.5    |
| **上下文窗口**           |     128K      |    128K     |    200K    |    32K     |

### 2.2 各模型适用场景

| 场景                  | 推荐模型         | 原因                                    |
| --------------------- | ---------------- | --------------------------------------- |
| 完整行程生成（5-7天） | `deepseek-chat`  | 逻辑推理强，JSON 结构输出稳定，性价比高 |
| 单日行程生成          | `glm-4-flash`    | 速度快，中文文化知识丰富，成本低        |
| 超长行程生成（10天+） | `moonshot-v1-8k` | 超长上下文，避免内容截断                |
| 景点简介/标签生成     | `glm-4-flash`    | 轻量任务，成本最低                      |
| 餐厅推荐文案          | `glm-4-flash`    | 中文本地知识优秀                        |
| 预算估算计算          | `deepseek-chat`  | 数学计算/推理准确                       |
| 简单 Q&A              | `MiMo-7B-RL`     | 最低成本，响应最快                      |

---

## 3. 智能路由策略

### 3.1 路由决策树

```
输入请求
    │
    ├── 判断 inputTokens（输入 Token 数）
    │       │
    │       ├── > 100,000 tokens → 强制使用 Kimi（上下文最长）
    │       │
    │       └── <= 100,000 tokens → 继续判断
    │
    ├── 判断 taskType（任务类型）
    │       │
    │       ├── full_itinerary_generation（完整行程生成）
    │       │       └── → DeepSeek（默认）
    │       │
    │       ├── single_day_generation（单日生成）
    │       │       └── → GLM-4-Flash（速度优先）
    │       │
    │       ├── poi_recommendation（景点推荐）
    │       │       └── → GLM-4-Flash（中文文化知识）
    │       │
    │       ├── text_generation（文案生成）
    │       │       └── → GLM-4-Flash（轻量快速）
    │       │
    │       └── simple_qa（简单问答）
    │               └── → MiMo-7B-RL（最低成本）
    │
    ├── 判断 costPriority（成本优先级）
    │       │
    │       ├── cost_first → MiMo-7B-RL（最便宜）
    │       ├── balanced → DeepSeek（平衡）
    │       └── quality_first → Kimi（最贵但质量高）
    │
    └── 默认 → DeepSeek
```

### 3.2 路由策略 TypeScript 实现

```typescript
// apps/api/src/services/llm-router.service.ts

export type TaskType =
  | "full_itinerary_generation" // 完整行程生成（多天）
  | "single_day_generation" // 单日行程生成
  | "poi_recommendation" // 景点推荐
  | "text_generation" // 文案生成（景点描述/餐厅推荐文案）
  | "budget_estimation" // 预算估算
  | "simple_qa"; // 简单问答

export type CostPriority = "cost_first" | "balanced" | "quality_first";
export type SpeedPriority = "fast" | "balanced" | "thorough";

export interface RoutingContext {
  taskType: TaskType;
  estimatedInputTokens: number;
  estimatedTotalDays?: number; // 行程天数（用于判断任务复杂度）
  costPriority?: CostPriority;
  speedPriority?: SpeedPriority;
  forceModel?: string; // 强制指定模型（跳过路由）
}

export type ModelId =
  | "deepseek-chat"
  | "glm-4-flash"
  | "moonshot-v1-8k"
  | "MiMo-7B-RL";

export function routeLLM(ctx: RoutingContext): ModelId {
  // 0. 强制指定模型
  if (ctx.forceModel) return ctx.forceModel as ModelId;

  // 1. 超长上下文强制走 Kimi
  if (ctx.estimatedInputTokens > 100_000) {
    return "moonshot-v1-8k";
  }

  // 2. 超长行程（10天以上）走 Kimi（避免内容截断）
  if (ctx.estimatedTotalDays && ctx.estimatedTotalDays >= 10) {
    return "moonshot-v1-8k";
  }

  // 3. 成本优先
  if (ctx.costPriority === "cost_first") {
    return ctx.taskType === "simple_qa" ? "MiMo-7B-RL" : "glm-4-flash";
  }

  // 4. 质量优先（高预算用户）
  if (ctx.costPriority === "quality_first") {
    return ctx.estimatedInputTokens > 50_000
      ? "moonshot-v1-8k"
      : "deepseek-chat";
  }

  // 5. 按任务类型路由
  switch (ctx.taskType) {
    case "full_itinerary_generation":
      return "deepseek-chat";

    case "single_day_generation":
      return ctx.speedPriority === "fast" ? "glm-4-flash" : "deepseek-chat";

    case "poi_recommendation":
    case "text_generation":
      return "glm-4-flash";

    case "budget_estimation":
      return "deepseek-chat"; // 数学计算准确

    case "simple_qa":
      return "MiMo-7B-RL";

    default:
      return "deepseek-chat"; // 默认 fallback
  }
}
```

---

## 4. 各模型调用规范

### 4.1 DeepSeek Chat

```typescript
// 基础配置
const DEEPSEEK_CONFIG = {
  baseURL: "https://api.deepseek.com/v1",
  model: "deepseek-chat",
  // 行程生成参数（注重结构输出稳定性）
  temperature: 0.7, // 适中创意，输出稳定
  top_p: 0.9,
  max_tokens: 8192, // 单次最大输出（行程生成需要大输出）
  response_format: {
    type: "json_object", // ✅ 强烈推荐开启：强制输出 JSON，减少解析失败
  },
  stream: true, // 启用流式输出（SSE）
};

// 调用示例
async function callDeepSeek(prompt: string, systemPrompt: string) {
  const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
    },
    body: JSON.stringify({
      model: "deepseek-chat",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 8192,
      response_format: { type: "json_object" },
      stream: true,
    }),
  });

  // 处理流式响应...
}
```

**DeepSeek 调用注意事项**：

- ✅ 必须启用 `response_format: { type: 'json_object' }` 确保 JSON 输出稳定
- ✅ Prompt 中明确要求输出 JSON 格式（即使已开启 json_object 模式）
- ⚠️ 单次 max_tokens 不超过 8192（超出可能截断）
- ⚠️ 行程生成 temperature 建议 0.7（低于 0.5 创意不足，高于 0.9 结构不稳）

---

### 4.2 GLM-4-Flash

```typescript
// 基础配置
const GLM_CONFIG = {
  baseURL: "https://open.bigmodel.cn/api/paas/v4",
  model: "glm-4-flash",
  // 轻量任务参数（注重速度）
  temperature: 0.8, // 稍高创意（文案生成场景）
  top_p: 0.9,
  max_tokens: 4096,
  stream: true,
};

// 调用示例
async function callGLM(prompt: string, systemPrompt: string) {
  const response = await fetch(
    "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GLM_API_KEY}`,
      },
      body: JSON.stringify({
        model: "glm-4-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.8,
        max_tokens: 4096,
        stream: true,
      }),
    },
  );
}
```

**GLM 调用注意事项**：

- ✅ 适合中文本地文化相关任务（景点描述、餐厅推荐等）
- ✅ 速度最快，适合用户等待敏感的场景
- ⚠️ 不支持 `response_format: json_object`，需要在 Prompt 中强调 JSON 格式
- ⚠️ GLM-4-Flash 的 JSON 输出稳定性略低于 DeepSeek，需要加强格式约束

---

### 4.3 Kimi（Moonshot）

```typescript
// 基础配置
const KIMI_CONFIG = {
  baseURL: "https://api.moonshot.cn/v1",
  model: "moonshot-v1-8k", // 短文本用 8k，长文本用 32k/128k
  temperature: 0.6, // 稍低温度，输出更稳定
  top_p: 0.85,
  max_tokens: 8192,
  stream: true,
};

// 注意：Kimi 有多个上下文窗口版本
// moonshot-v1-8k    - 8K 上下文（最便宜，适合短任务）
// moonshot-v1-32k   - 32K 上下文
// moonshot-v1-128k  - 128K 上下文（适合超长行程）

async function callKimi(
  prompt: string,
  systemPrompt: string,
  longContext = false,
) {
  const model = longContext ? "moonshot-v1-128k" : "moonshot-v1-8k";

  const response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.KIMI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt },
      ],
      temperature: 0.6,
      max_tokens: 8192,
      stream: true,
    }),
  });
}
```

**Kimi 调用注意事项**：

- ✅ 超长行程（10天以上）的首选，上下文不截断
- ✅ 内容细节丰富，适合高端用户（质量优先）
- ⚠️ 成本最高，谨慎使用（平均每次行程约 ¥0.1-0.3）
- ⚠️ 响应速度较慢（首 token 延迟约 3-5 秒）

---

### 4.4 MiMo-7B（小米）

```typescript
// 基础配置（小米 MiMo 尚在内测，API 可能变化）
const MIMO_CONFIG = {
  baseURL: "https://api.mi.com/v1", // 暂定，以实际文档为准
  model: "MiMo-7B-RL",
  temperature: 0.7,
  max_tokens: 2048, // 轻量模型，输出不宜过长
  stream: true,
};
```

**MiMo 调用注意事项**：

- ✅ 成本极低，适合高频简单任务（如景点标签生成、简短问答）
- ✅ 响应速度快
- ⚠️ 复杂推理任务质量不稳定，不适合完整行程生成
- ⚠️ API 目前处于内测阶段，可能存在变化，建议做好降级处理
- ⚠️ 上下文窗口仅 32K，不适合长文本任务

---

## 5. Prompt 工程规范

### 5.1 通用 Prompt 原则

```
1. 角色设定（Role）：明确 AI 的身份和专业领域
2. 任务描述（Task）：清晰描述要完成的具体任务
3. 上下文注入（Context）：注入用户配置、城市数据等关键信息
4. 格式约束（Format）：明确输出格式（JSON Schema、字段定义）
5. 约束条件（Constraints）：列出禁止项和边界条件
6. 输出示例（Examples）：提供 1-2 个示例（Few-shot）
```

### 5.2 完整行程生成 System Prompt

```
你是 PATH-WISE 旅游攻略助手，一位经验丰富的中国旅行规划专家。

你的任务是根据用户提供的信息，生成一份完整的旅游攻略 JSON。

## 输出格式要求

必须输出合法的 JSON，符合以下结构：
{
  "title": "行程标题（20字以内）",
  "summary": "行程简介（50字以内）",
  "days": [
    {
      "dayIndex": 1,
      "date": "YYYY-MM-DD",
      "dayType": "move_day | explore_day | transit_day",
      "theme": "今日主题（10字以内）",
      "activities": [
        {
          "name": "活动名称",
          "description": "活动描述（50字以内）",
          "location": "地点",
          "startTime": "HH:MM",
          "endTime": "HH:MM",
          "durationMinutes": 90,
          "type": "attraction | meal | transport | rest | free",
          "estimatedCost": 0,
          "tips": ["小贴士1"]
        }
      ],
      "tips": ["今日建议1"]
    }
  ]
}

## 约束条件

1. 第一天必须是 move_day（出发日），包含大交通安排
2. 最后一天必须安排回程交通
3. 每天活动数量：3-6 个（不含餐饮）
4. 活动时间不能重叠
5. 每天必须安排午餐和晚餐（type: meal）
6. 景点游览时间参考知识库中的 visitDurationMinutes
7. 避免在 explore_day 安排超过 4 个需要购票的景点
8. move_day 的活动总时间不超过 6 小时（到达后通常疲惫）

## 禁止项

- 禁止推荐已关闭或不确定是否存在的景点
- 禁止给出具体票价数字（使用 0 占位，前端会从知识库获取）
- 禁止在 JSON 之外输出任何文字
```

### 5.3 User Prompt 模板

```typescript
// 行程生成 User Prompt 构建函数
function buildItineraryPrompt(
  config: GeneratePlanRequest,
  cityData: CityKnowledgeBase,
): string {
  return `
请为以下旅行生成攻略：

## 基本信息
- 出发城市：${config.fromCity}
- 目的地：${config.toCity}
- 出行日期：${config.dateRange.startDate} 至 ${config.dateRange.endDate}（共 ${calculateDays(config.dateRange)} 天）
- 旅行人数：成人 ${config.travelers.adults} 人${config.travelers.children ? `，儿童 ${config.travelers.children} 人` : ""}
- 去程交通：${config.transportTo || "自动选择"}
- 节奏偏好：${config.preferences?.pace || "适中"}
- 风格偏好：${config.preferences?.style?.join("、") || "综合"}

## 目的地城市知识库

### 推荐景点（按优先级）
${cityData.attractions
  .slice(0, 15)
  .map(
    (a) =>
      `- ${a.name}（${a.category}，游玩${a.visitDurationMinutes}分钟，${a.priority === "must_visit" ? "必去" : "推荐"}）`,
  )
  .join("\n")}

### 特色美食
${cityData.foods
  .slice(0, 5)
  .map((f) => `- ${f.name}：${f.description}`)
  .join("\n")}

### 大交通信息
- 去程推荐：${cityData.intercityTransport.to.recommended
    .slice(0, 2)
    .map(
      (t) =>
        `${t.trainNumber || t.flightNumber}（出发${t.departureTime}，到达${t.arrivalTime}）`,
    )
    .join(" / ")}

请生成完整行程 JSON。
  `.trim();
}
```

### 5.4 JSON 输出稳定性保障

**问题**：部分模型（尤其是 GLM）有时会输出 Markdown 代码块包裹的 JSON，导致解析失败。

**解决方案**：

````typescript
// 后处理函数：清理 LLM 输出，提取纯 JSON
function extractJSON(rawOutput: string): string {
  // 尝试 1：直接解析
  try {
    JSON.parse(rawOutput);
    return rawOutput;
  } catch {}

  // 尝试 2：提取 ```json ... ``` 代码块
  const jsonBlockMatch = rawOutput.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    try {
      JSON.parse(jsonBlockMatch[1]);
      return jsonBlockMatch[1];
    } catch {}
  }

  // 尝试 3：提取第一个 { ... } 对象
  const jsonObjectMatch = rawOutput.match(/\{[\s\S]*\}/);
  if (jsonObjectMatch) {
    try {
      JSON.parse(jsonObjectMatch[0]);
      return jsonObjectMatch[0];
    } catch {}
  }

  // 兜底：抛出错误，触发降级策略
  throw new Error("Failed to extract valid JSON from LLM output");
}
````

---

## 6. 错误处理与降级

### 6.1 错误类型

| 错误类型               | 触发原因           | 处理策略                 |
| ---------------------- | ------------------ | ------------------------ |
| **API Key 无效**       | Key 过期或配置错误 | 立即报警，人工处理       |
| **余额不足**           | 账户余额耗尽       | 降级到备用模型，发送告警 |
| **Rate Limit（限流）** | 调用频率超限       | 等待重试（指数退避）     |
| **超时（Timeout）**    | 模型响应超时       | 切换到更快的模型重试     |
| **无效 JSON 输出**     | 模型输出格式错误   | 重试（加强 Prompt 约束） |
| **内容被拒绝**         | 触发内容安全策略   | 修改 Prompt 后重试       |
| **服务不可用（5xx）**  | 模型服务故障       | 降级到备用模型           |

### 6.2 降级链设计

```
主模型（DeepSeek）
    │ 失败（3次重试后）
    ▼
备用模型 1（GLM-4-Flash）
    │ 失败（2次重试后）
    ▼
备用模型 2（Kimi）
    │ 失败（2次重试后）
    ▼
错误响应（向用户报告生成失败，提供重试选项）
```

### 6.3 降级策略代码

```typescript
// apps/api/src/services/llm.service.ts

const FALLBACK_CHAIN: ModelId[] = [
  "deepseek-chat",
  "glm-4-flash",
  "moonshot-v1-8k",
];

const RETRY_CONFIG = {
  "deepseek-chat": { maxRetries: 3, timeout: 60000 },
  "glm-4-flash": { maxRetries: 2, timeout: 45000 },
  "moonshot-v1-8k": { maxRetries: 2, timeout: 90000 },
  "MiMo-7B-RL": { maxRetries: 2, timeout: 30000 },
};

async function callWithFallback(
  prompt: string,
  systemPrompt: string,
  ctx: RoutingContext,
): Promise<string> {
  const primaryModel = routeLLM(ctx);
  const fallbackChain = [
    primaryModel,
    ...FALLBACK_CHAIN.filter((m) => m !== primaryModel),
  ];

  for (let i = 0; i < fallbackChain.length; i++) {
    const model = fallbackChain[i];
    const config = RETRY_CONFIG[model];

    for (let retry = 0; retry < config.maxRetries; retry++) {
      try {
        const result = await callModel(
          model,
          prompt,
          systemPrompt,
          config.timeout,
        );
        const json = extractJSON(result); // 提取 JSON

        // 记录实际使用的模型（用于监控和计费）
        logLLMUsage({
          model,
          taskType: ctx.taskType,
          success: true,
          fallbackCount: i,
        });

        return json;
      } catch (error) {
        const isRetriable = isRetriableError(error);

        if (!isRetriable || retry === config.maxRetries - 1) {
          // 不可重试，或已达最大重试次数，切换到下一个模型
          logLLMUsage({ model, taskType: ctx.taskType, success: false, error });
          break;
        }

        // 指数退避重试
        const delay = Math.pow(2, retry) * 1000;
        await sleep(delay);
      }
    }
  }

  // 所有模型都失败了
  throw new Error("All LLM models failed, please try again later");
}

// 判断错误是否可重试
function isRetriableError(error: unknown): boolean {
  if (error instanceof Error) {
    // 超时、限流、服务器错误可以重试
    return (
      error.message.includes("timeout") ||
      error.message.includes("rate_limit") ||
      error.message.includes("500") ||
      error.message.includes("503")
    );
  }
  return false;
}
```

---

## 7. 成本优化策略

### 7.1 Token 计算参考

```
中文：1 个汉字 ≈ 1.5-2 Token
英文：1 个单词 ≈ 1.3 Token
数字：1 个数字 ≈ 1 Token

典型行程生成消耗：
  - System Prompt：约 500 Token
  - User Prompt（含城市数据）：约 2,000-3,000 Token
  - 输出（5天行程 JSON）：约 3,000-5,000 Token
  - 合计：约 5,500-8,500 Token / 次
```

### 7.2 成本估算

| 模型          | 单次生成成本（5天行程） | 月成本估算（1000次/月） |
| ------------- | ----------------------- | ----------------------- |
| DeepSeek Chat | ~¥0.01                  | ~¥10                    |
| GLM-4-Flash   | ~¥0.001                 | ~¥1                     |
| Kimi v1-8k    | ~¥0.10                  | ~¥100                   |
| MiMo-7B-RL    | ~¥0.004                 | ~¥4                     |

### 7.3 成本优化方法

#### 方法 1：缓存相同输入的输出

```typescript
// 对相同配置的行程请求，缓存 LLM 输出（24小时内有效）
async function getCachedOrGeneratePlan(
  config: GeneratePlanRequest,
): Promise<GeneratedPlan> {
  const cacheKey = `llm:plan:${generateConfigHash(config)}`;

  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached); // 命中缓存，无需调用 LLM
  }

  const plan = await generatePlanWithLLM(config);

  // 缓存 24 小时（相同配置的行程通常变化不大）
  await redis.setex(cacheKey, 86400, JSON.stringify(plan));

  return plan;
}
```

#### 方法 2：精简 Prompt，减少 Token 消耗

```typescript
// ❌ 冗余：在 Prompt 中注入所有景点数据
const bigPrompt = `
景点列表（共 50 个）：
${allAttractions.map((a) => JSON.stringify(a)).join("\n")}
`;

// ✅ 精简：只注入必要字段，只传前 15 个景点
const compactPrompt = `
推荐景点：
${topAttractions
  .slice(0, 15)
  .map(
    (a) =>
      `${a.name}(${a.category},${a.visitDurationMinutes}min,${a.priority === "must_visit" ? "必去" : "推荐"})`,
  )
  .join("；")}
`;
// 节省 ~60% Token
```

#### 方法 3：分任务拆解（大任务拆小）

```typescript
// 策略：先用轻量模型生成框架，再用主模型填充细节

// 步骤 1：用 MiMo（便宜快速）生成每天的主题框架
const framework = await callModel('MiMo-7B-RL', buildFrameworkPrompt(config), ...);

// 步骤 2：只对 explore_day 用 DeepSeek 填充详细景点（move_day 由规则引擎处理）
const detailedDays = await Promise.all(
  framework.days
    .filter(d => d.dayType === 'explore_day')
    .map(d => callModel('glm-4-flash', buildDayDetailPrompt(d, cityData), ...))
);
```

---

## 8. 性能调优

### 8.1 首 Token 延迟优化

| 模型          | 典型首 Token 延迟 | 优化方法                |
| ------------- | ----------------- | ----------------------- |
| GLM-4-Flash   | ~0.5-1s           | 默认最快                |
| DeepSeek Chat | ~1-2s             | 无特殊优化              |
| MiMo-7B-RL    | ~0.3-0.8s         | 默认快                  |
| Kimi v1-8k    | ~2-5s             | 减少 System Prompt 长度 |

### 8.2 并行化策略

```typescript
// 策略：并行调用多个独立的 LLM 任务

// 例：行程生成 + 天气查询 + 交通搜索 并行执行
const [planDraft, weatherData, transportOptions] = await Promise.allSettled([
  generatePlanDraft(config), // LLM 生成行程草稿
  getWeatherForecast(config), // 天气 API
  searchTransport(config), // 交通 API
]);

// 合并结果
const finalPlan = mergePlanWithWeatherAndTransport(
  planDraft,
  weatherData,
  transportOptions,
);
```

---

## 9. 质量评估

### 9.1 输出质量检查清单

**自动化检查（代码层）**：

- [ ] JSON 格式合法（能被 `JSON.parse` 解析）
- [ ] 必填字段不为空（`title`, `days`, `dayType` 等）
- [ ] 活动时间不重叠
- [ ] 第一天是 `move_day`
- [ ] 每天有午餐和晚餐安排
- [ ] 总天数与请求的 `dateRange` 一致

**人工抽样评估（定期）**：

- [ ] 景点推荐合理（不推荐明显不合适的景点）
- [ ] 行程节奏符合用户偏好
- [ ] 时间安排合理（不过于紧张或松散）
- [ ] 描述文字自然流畅（无生硬机翻感）

### 9.2 监控指标

| 指标            | 监控方式     | 告警阈值     |
| --------------- | ------------ | ------------ |
| LLM 调用成功率  | Prometheus   | < 95%        |
| 平均生成时间    | Prometheus   | > 45s        |
| JSON 解析失败率 | 应用日志     | > 2%         |
| 降级触发频率    | 应用日志     | > 5%         |
| 各模型使用占比  | Grafana 看板 | 关注模型分布 |

---

**文档状态**：✅ 已完成  
**下一步**：生成《用户体验设计文档》

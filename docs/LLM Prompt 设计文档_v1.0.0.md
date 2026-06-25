# 旅游攻略生成平台 · LLM Prompt 设计文档

> **文档版本**：v1.0.0
> **日期**：2026-06-21
> **作者**：Buddy（AI 架构师助手）
> **项目代号**：PATH-WISE

---

## 一、文档说明

### 1.1 文档用途

本文档定义 LLM（大语言模型）的 Prompt 设计，包括：

1. 攻略生成的核心 Prompt 模板
2. 不同任务类型的 Prompt 变体
3. 上下文管理机制
4. Prompt 优化策略

**目标**：生成高质量、个性化、可执行的旅游攻略。

---

## 二、Prompt 设计原则

### 2.1 核心原则

| 原则           | 说明                  | 示例                                     |
| -------------- | --------------------- | ---------------------------------------- |
| **明确角色**   | 定义 LLM 的角色和职责 | "你是一位资深旅游规划师..."              |
| **结构化输出** | 要求 JSON 格式输出    | "请严格按照以下 JSON 格式输出..."        |
| **分步思考**   | 引导 LLM 逐步推理     | "请按以下步骤思考：1... 2..."            |
| **约束条件**   | 明确限制和规则        | "预算不超过 X 元，每天步行不超过 Y 公里" |
| **示例引导**   | 提供 Few-shot 示例    | "参考以下示例格式..."                    |

### 2.2 Prompt 结构模板

````
【角色定义】
你是一位资深旅游规划师，擅长...

【任务描述】
根据用户需求，生成一份详细的旅游攻略。

【输入信息】
- 出发城市：{cityFrom}
- 目的地：{cityTo}
- 出发日期：{startDate}
- 返回日期：{endDate}
- 大交通方式：{transportTo}
- 当地交通方式：{transportLocal}
- 总预算：{budget} 元
- 旅客信息：{travelers}
- 偏好：{preferences}

【城市知识库】
{cityKnowledge}

【输出要求】
请严格按照以下 JSON 格式输出攻略：
```json
{
  "title": "攻略标题",
  "totalDays": 3,
  "dayPlans": [...]
}
````

【约束条件】

1. 预算限制：...
2. 体力限制：...
3. 开放时间：...

【参考示例】
（Few-shot 示例）

开始生成：

```

---

## 三、核心 Prompt 模板

### 3.1 攻略生成主 Prompt

```

【角色定义】
你是一位资深旅游规划师，拥有 10 年以上的旅游规划经验，熟悉中国各大旅游城市。
你的专长是根据用户需求，生成详细、可行、个性化的旅游攻略。

【任务描述】
根据用户提供的出行信息，生成一份完整的旅游攻略。
攻略应包含：

1. 大交通信息（去程和返程）
2. 每日详细行程（上午/下午/晚上）
3. 住宿推荐
4. 预算分配
5. 注意事项

【输入信息】

- 出发城市：{cityFrom}
- 目的地城市：{cityTo}
- 出发日期：{startDate}
- 返回日期：{endDate}
- 总天数：{totalDays} 天
- 大交通方式：{transportTo}
- 当地交通方式：{transportLocal}
- 总预算：{budget} 元
- 旅客信息：
  - 成人：{travelers.adults} 人
  - 儿童：{travelers.children} 人
  - 老人：{travelers.elders} 人
- 旅行节奏：{preferences.pace}（relaxed/balanced/intensive）
- 美食偏好：{preferences.foodPreference}
- 住宿偏好：{preferences.accommodationPreference}

【城市知识库】
以下是目的地城市的知识库信息（JSON 格式）：

```json
{cityKnowledgeJson}
```

【实时数据】
以下是实时查询的交通信息：

```json
{transportInfoJson}
```

【输出要求】
请严格按照以下 JSON Schema 输出攻略（不要输出其他内容）：

```json
{
  "title": "攻略标题（如：北京 3 日历史文化之旅）",
  "summary": "攻略总结（100 字以内）",
  "totalDays": {totalDays},
  "budgetAllocation": {
    "transport": 总交通费用（元）,
    "accommodation": 总住宿费用（元）,
    "attractions": 总景点门票（元）,
    "food": 总餐饮费用（元）,
    "others": 其他费用（元）
  },
  "dayPlans": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "title": "Day 1：{当天主题}",
      "summary": "当天总结",
      "transport": {
        "type": "high_speed_rail",
        "trainNumber": "G6113",
        "departTime": "16:45",
        "arrivalTime": "19:02",
        "departureStation": "长沙南站",
        "arrivalStation": "北京西站",
        "price": {"二等座": 649},
        "note": "建议提前 1.5 小时到达车站"
      },
      "morning": null,
      "afternoon": {
        "startTime": "19:30",
        "endTime": "21:00",
        "activity": "抵达北京，前往酒店办理入住",
        "location": "酒店",
        "cost": 0,
        "note": "从北京西站打车到酒店约 30 分钟"
      },
      "evening": null,
      "accommodation": {
        "name": "如家酒店（北京天安门广场店）",
        "address": "北京市东城区东交民巷 28 号",
        "pricePerNight": 350,
        "rating": 4.2,
        "note": "距离天安门步行 10 分钟"
      },
      "notes": [
        "第一天以抵达为主，不要安排太多活动",
        "建议提前预订酒店"
      ]
    }
  ]
}
```

【约束条件】

1. **预算约束**：总预算不超过 {budget} 元，合理分配各项费用
2. **体力约束**：
   - 每天步行距离不超过 15 公里
   - 老人/儿童同行时，每天安排 1-2 小时午休时间
3. **开放时间约束**：景点访问时间必须在开放时间内
4. **交通约束**：
   - 高铁/火车：提前 1.5 小时到达车站
   - 飞机：提前 2 小时到达机场
   - 大巴：提前 1 小时到达客运站
5. **餐饮约束**：
   - 早餐：07:00-09:00
   - 午餐：12:00-13:30
   - 晚餐：18:00-20:30
6. **住宿约束**：每天必须安排住宿（除了最后一天返程）

【生成步骤】
请按以下步骤生成攻略（内部思考，不需要输出中间步骤）：

Step 1：分析输入信息

- 确定旅行主题（历史文化/自然风光/美食探索/现代都市）
- 确定核心景点（必须去的景点）

Step 2：规划交通

- 查询去程交通（使用实时数据）
- 查询返程交通（使用实时数据）
- 计算交通费用

Step 3：规划每日行程

- 按"由近及远"原则串联景点
- 使用高德地图 API 计算景点间路线（模拟）
- 分配时间段（上午/下午/晚上）

Step 4：推荐住宿

- 选择地理位置优越的酒店（靠近核心景点）
- 根据预算推荐（经济/舒适/豪华）

Step 5：计算预算

- 统计交通费用
- 统计住宿费用
- 统计景点门票
- 统计餐饮费用
- 预留 10% 弹性费用

Step 6：生成 JSON 输出

- 严格按照输出要求中的 JSON Schema
- 确保字段完整、格式正确

开始生成（只输出 JSON，不要输出其他内容）：

````

---

## 四、Prompt 变体设计

### 4.1 根据任务类型选择 Prompt

```typescript
// apps/api/src/services/prompt.service.ts

// Prompt 模板枚举
enum PromptTemplate {
  ITINERARY_GENERATION = 'itinerary_generation',
  POI_RECOMMENDATION = 'poi_recommendation',
  TRANSPORT_OPTIMIZATION = 'transport_optimization',
  BUDGET_CALCULATION = 'budget_calculation',
}

// 根据任务类型选择 Prompt 模板
function getPromptTemplate(taskType: PromptTemplate, params: PromptParams): string {
  switch (taskType) {
    case PromptTemplate.ITINERARY_GENERATION:
      return buildItineraryPrompt(params);

    case PromptTemplate.POI_RECOMMENDATION:
      return buildPOIRecommendationPrompt(params);

    case PromptTemplate.TRANSPORT_OPTIMIZATION:
      return buildTransportOptimizationPrompt(params);

    case PromptTemplate.BUDGET_CALCULATION:
      return buildBudgetCalculationPrompt(params);
  }
}
````

### 4.2 POI 推荐 Prompt（变体）

````
【角色定义】
你是一位本地美食/景点推荐专家，熟悉...

【任务描述】
根据用户偏好，从以下 POI 列表中推荐最适合的景点/餐厅。

【输入信息】
- 城市：{cityName}
- 用户偏好：{preferences}
- 旅客类型：{travelers}
- 预算：{budgetPerDay} 元/天

【POI 列表】
```json
{poiListJson}
````

【输出要求】
请输出 JSON 数组（按推荐度排序）：

```json
[
  {
    "poiId": "xxx",
    "name": "故宫博物院",
    "reason": "推荐理由（50 字以内）",
    "estimatedDuration": 180, // 建议游览时长（分钟）
    "estimatedCost": 60 // 人均费用（元）
  }
]
```

开始推荐：

````

---

## 五、上下文管理机制

### 5.1 上下文窗口优化

**问题**：LLM 有上下文长度限制（如 DeepSeek V2 为 128K tokens）。

**解决方案**：

```typescript
// apps/api/src/services/context-manager.service.ts

interface ContextWindow {
  systemPrompt: string;    // 系统 Prompt（固定）
  cityKnowledge: string;     // 城市知识库（可压缩）
  transportInfo: string;     // 实时交通信息（必需）
  userInput: string;         // 用户输入（必需）
  conversationHistory: string; // 对话历史（可截断）
}

// 上下文压缩策略
function compressContext(context: ContextWindow, maxTokens: number): ContextWindow {
  let currentTokens = estimateTokens(context);

  if (currentTokens <= maxTokens) {
    return context; // 不需要压缩
  }

  // 策略 1：压缩城市知识库（保留核心信息）
  if (estimateTokens(context.cityKnowledge) > 10000) {
    context.cityKnowledge = compressCityKnowledge(context.cityKnowledge);
  }

  // 策略 2：截断对话历史（保留最近 5 轮）
  if (estimateTokens(context.conversationHistory) > 5000) {
    context.conversationHistory = truncateHistory(context.conversationHistory, 5);
  }

  // 策略 3：如果仍然超限，报错并建议切换长上下文模型
  currentTokens = estimateTokens(context);
  if (currentTokens > maxTokens) {
    throw new Error(`上下文超限，请使用 Kimi（200K 上下文）`);
  }

  return context;
}

// 压缩城市知识库
function compressCityKnowledge(json: string): string {
  const data = JSON.parse(json);

  // 只保留核心字段
  const compressed = {
    cityName: data.cityName,
    tags: data.tags,
    intercityTransport: data.intercityTransport,
    poiList: data.poiList.slice(0, 20), // 只保留前 20 个 POI
    accommodation: data.accommodation.slice(0, 10), // 只保留前 10 个酒店
  };

  return JSON.stringify(compressed);
}
````

---

## 六、Prompt 优化策略

### 6.1 链式思考（Chain-of-Thought）

**原理**：引导 LLM 逐步推理，提高输出质量。

**实现**：

```
【生成步骤】
请按以下步骤生成攻略（内部思考，不需要输出中间步骤）：

Step 1：分析输入信息
- 确定旅行主题：...
- 确定核心景点：...

（思考过程：为什么选择这些景点？）

Step 2：规划交通
- 查询去程交通：...
- 计算交通费用：...

（思考过程：为什么选择这个车次？）

...

开始生成：
```

### 6.2 自我一致性（Self-Consistency）

**原理**：让 LLM 生成多个方案，选择最优解。

**实现**：

```typescript
// 生成多个方案
const solutions = await Promise.all([
  llmClient.generate(prompt),
  llmClient.generate(prompt),
  llmClient.generate(prompt),
]);

// 评估方案质量
const scoredSolutions = solutions.map((solution) => ({
  solution,
  score: evaluateSolution(solution),
}));

// 选择最高分方案
const bestSolution = scoredSolutions.sort((a, b) => b.score - a.score)[0];
```

### 6.3 Few-shot 示例

**原理**：提供示例，引导 LLM 输出符合预期的格式。

**实现**：

````
【参考示例】
以下是一个北京 3 日游的攻略示例（JSON 格式）：

```json
{
  "title": "北京 3 日历史文化之旅",
  "totalDays": 3,
  "dayPlans": [
    {
      "day": 1,
      "title": "Day 1：抵达北京，初探天安门广场",
      ...
    }
  ]
}
````

请参考上述示例格式，生成用户请求的攻略。

````

---

## 七、Prompt 测试与评估

### 7.1 测试用例

| 测试场景 | 输入 | 预期输出 |
|---------|------|---------|
| **基础场景** | 北京 3 日游，高铁，预算 3000 元 | 完整攻略 JSON |
| **复杂场景** | 成都 + 重庆 5 日游，飞机 + 高铁，预算 5000 元 | 多目的地攻略 JSON |
| **边界场景** | 预算 1000 元，1 日游 | 简化攻略 JSON |
| **错误场景** | 目的地不存在 | 错误信息 |

### 7.2 评估指标

```typescript
interface PromptEvaluationMetrics {
  // 格式正确性
  formatAccuracy: number; // JSON 格式是否正确（0-1）

  // 内容完整性
  contentCompleteness: number; // 必填字段是否完整（0-1）

  // 可行性
  feasibilityScore: number; // 行程是否可行（0-1）

  // 个性化程度
  personalizationScore: number; // 是否符合用户偏好（0-1）

  // 成本
  tokenUsage: number; // 消耗的 tokens 数量
  latency: number; // 响应延迟（毫秒）
}
````

---

## 八、Prompt 版本管理

### 8.1 版本控制策略

```
prompts/
├── v1.0.0/
│   ├── itinerary-generation.txt
│   ├── poi-recommendation.txt
│   └── transport-optimization.txt
├── v1.1.0/
│   ├── ...
└── latest/
    └── (软链接到最新版本)
```

### 8.2 A/B 测试

```typescript
// Prompt A/B 测试
async function ABTestPrompt(params: PromptParams): Promise<Solution> {
  const promptA = loadPrompt("v1.0.0/itinerary-generation.txt");
  const promptB = loadPrompt("v1.1.0/itinerary-generation.txt");

  const [solutionA, solutionB] = await Promise.all([
    llmClient.generate(promptA),
    llmClient.generate(promptB),
  ]);

  const scoreA = evaluateSolution(solutionA);
  const scoreB = evaluateSolution(solutionB);

  return scoreA > scoreB ? solutionA : solutionB;
}
```

---

## 九、安全与合规

### 9.1 Prompt 注入防护

**风险**：用户可能在输入中注入恶意指令，绕过系统 Prompt。

**防护措施**：

```typescript
// 输入清洗
function sanitizeUserInput(input: string): string {
  // 移除可能的 Prompt 注入关键词
  const forbiddenKeywords = [
    "忽略以上指令",
    "ignore previous instructions",
    "你现在扮演",
    "you are now",
  ];

  let sanitized = input;
  for (const keyword of forbiddenKeywords) {
    sanitized = sanitized.replace(new RegExp(keyword, "gi"), "[已过滤]");
  }

  return sanitized;
}
```

### 9.2 输出内容审核

```typescript
// 输出内容审核
async function moderateOutput(output: string): Promise<boolean> {
  // 检查是否包含敏感词
  const sensitiveWords = ['政治', '色情', '暴力', ...];

  for (const word of sensitiveWords) {
    if (output.includes(word)) {
      return false; // 不通过审核
    }
  }

  return true; // 通过审核
}
```

---

## 十、下一步

### 10.1 开发者执行清单

- [ ] 实现 Prompt 模板加载器（`PromptTemplateLoader`）
- [ ] 实现上下文管理器（`ContextManager`）
- [ ] 实现 Prompt 优化策略（CoT、Self-Consistency）
- [ ] 编写 Prompt 测试用例
- [ ] 搭建 Prompt 版本管理系统

### 10.2 参考文档

- 《Trip_Lifecycle 引擎算法设计.md》 - 攻略生成核心逻辑
- 《技术栈选型文档\_v1.0.0.md》 - LLM 智能路由设计
- 《前后端接口契约文档\_v1.0.0.md》 - API 接口定义

---

**文档状态**：✅ 已完成（交付开发团队执行）

**下一步**：生成《SSE 流式响应设计文档\_v1.0.0.md》

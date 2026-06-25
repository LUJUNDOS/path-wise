# 旅游攻略生成平台 · SSE 流式响应设计文档

> **文档版本**：v1.0.0
> **日期**：2026-06-21
> **作者**：Buddy（AI 架构师助手）
> **项目代号**：PATH-WISE

---

## 一、文档说明

### 1.1 文档用途

本文档定义 SSE（Server-Sent Events）流式响应的详细设计，包括：

1. SSE 连接管理机制
2. 事件类型定义
3. 前端 SSE 客户端实现
4. 错误处理与重连策略

**目标**：实现实时进度推送，提升用户体验。

---

## 二、SSE 连接管理

### 2.1 连接建立流程

```
用户点击"生成攻略"
  │
  ▼
前端发起 POST /api/v1/trip/generate
  │
  ▼
后端验证请求参数
  │
  ├─ 验证失败 → 返回 400 Bad Request（JSON）
  │
  ▼
验证通过 → 返回 200 OK（Content-Type: text/event-stream）
  │
  ▼
建立 SSE 连接
  │
  ▼
后端开始生成攻略（异步）
  │
  ▼
定时推送进度事件（每 2-5 秒）
  │
  ▼
推送每日行程事件（生成完一天推送一天）
  │
  ▼
推送完成事件
  │
  ▼
关闭 SSE 连接
```

### 2.2 连接生命周期

```typescript
// apps/api/src/services/sse-connection-manager.service.ts

interface SSEConnection {
  connectionId: string;
  userId?: number;
  tripId?: number;
  createdAt: Date;
  lastEventTime: Date;
  status: 'active' | 'completed' | 'failed';
}

class SSEConnectionManager {
  private connections: Map<string, SSEConnection> = new Map();
  private readonly TIMEOUT_MS = 300000; // 5 分钟超时

  // 创建连接
  createConnection(response: ServerResponse, userId?: number): string {
    const connectionId = generateUUID();

    const connection: SSEConnection = {
      connectionId,
      userId,
      createdAt: new Date(),
      lastEventTime: new Date(),
      status: 'active',
    };

    this.connections.set(connectionId, connection);

    // 设置超时定时器
    setTimeout(() => {
      this.closeConnection(connectionId, 'timeout');
    }, this.TIMEOUT_MS);

    return connectionId;
  }

  // 更新最后事件时间
  updateLastEventTime(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastEventTime = new Date();
    }
  }

  // 关闭连接
  closeConnection(connectionId: string, reason: 'completed' | 'failed' | 'timeout'): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.status = reason === 'completed' ? 'completed' : 'failed';
      this.connections.delete(connectionId);

      console.log(`SSE 连接已关闭: ${connectionId}, 原因: ${reason}`);
    }
  }

  // 获取活跃连接数
  getActiveConnectionCount(): number {
    return Array.from(this.connections.values()).filter((c) => c.status === 'active').length;
  }
}
```

---

## 三、事件类型详细设计

### 3.1 进度事件（progress）

**用途**：推送攻略生成进度，让用户了解当前状态。

**推送频率**：每 2-5 秒推送一次（或状态变化时立即推送）。

**数据格式**：

```json
event: progress
data: {
  "progress": 45,
  "currentStep": "正在规划 Day 2 行程...",
  "estimatedSecondsRemaining": 30,
  "details": {
    "currentDay": 2,
    "totalDays": 3,
    "currentPhase": "poi_selection"
  }
}
```

**字段说明**：

| 字段                        | 类型    | 说明                                                                             |
| --------------------------- | ------- | -------------------------------------------------------------------------------- |
| `progress`                  | number  | 进度百分比（0-100）                                                              |
| `currentStep`               | string  | 当前步骤描述（如"正在查询交通信息..."）                                          |
| `estimatedSecondsRemaining` | number? | 预计剩余时间（秒，可选）                                                         |
| `details.currentDay`        | number? | 当前正在生成第几天（可选）                                                       |
| `details.totalDays`         | number? | 总天数（可选）                                                                   |
| `details.currentPhase`      | string? | 当前阶段（可选，如 `transport_search`, `poi_selection`, `itinerary_generation`） |

---

### 3.2 每日行程事件（day_plan）

**用途**：推送已生成完成的每日行程，实现"边生成边展示"。

**推送时机**：每天行程生成完成后立即推送。

**数据格式**：

```json
event: day_plan
data: {
  "day": 1,
  "title": "Day 1：抵达北京",
  "date": "2026-07-01",
  "summary": "第一天以抵达为主，安排入住酒店，晚上可逛王府井",
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
    "location": "如家酒店（天安门广场店）",
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
```

---

### 3.3 完成事件（complete）

**用途**：通知前端攻略生成完成。

**推送时机**：所有天数生成完成后推送。

**数据格式**：

```json
event: complete
data: {
  "tripId": 123,
  "title": "北京 3 日历史文化之旅",
  "totalDays": 3,
  "summary": "本攻略涵盖北京核心历史文化景点，包括故宫、长城、天坛等，预算控制在 3000 元以内",
  "budgetAllocation": {
    "transport": 1298,
    "accommodation": 1050,
    "attractions": 360,
    "food": 800,
    "others": 492
  },
  "generatedAt": "2026-06-21T03:45:00+08:00"
}
```

---

### 3.4 错误事件（error）

**用途**：通知前端生成过程中发生错误。

**推送时机**：发生不可恢复错误时推送。

**数据格式**：

```json
event: error
data: {
  "code": 1001,
  "message": "攻略生成失败",
  "details": "LLM API 调用超时，请稍后重试",
  "retryable": true,
  "retryAfterSeconds": 10
}
```

**字段说明**：

| 字段                | 类型    | 说明                                                    |
| ------------------- | ------- | ------------------------------------------------------- |
| `code`              | number  | 错误码（参考《前后端接口契约文档》中的 ErrorCode 枚举） |
| `message`           | string  | 错误信息（用户友好）                                    |
| `details`           | string? | 详细错误信息（开发者友好，可选）                        |
| `retryable`         | boolean | 是否可重试                                              |
| `retryAfterSeconds` | number? | 建议重试等待时间（秒，可选）                            |

---

## 四、前端 SSE 客户端实现

### 4.1 SSE 客户端核心类

```typescript
// apps/web/src/lib/sse-client.ts

export interface SSEEvent {
  type: 'progress' | 'day_plan' | 'complete' | 'error';
  data: any;
}

export interface SSEClientOptions {
  onProgress?: (data: ProgressData) => void;
  onDayPlan?: (data: DayPlan) => void;
  onComplete?: (data: CompleteData) => void;
  onError?: (data: ErrorData) => void;
  onTimeout?: () => void;
  maxRetries?: number; // 最大重试次数（默认 3）
  retryDelayMs?: number; // 重试延迟（默认 3000ms）
}

export class SSEClient {
  private url: string;
  private options: SSEClientOptions;
  private abortController: AbortController | null = null;
  private retryCount: number = 0;

  constructor(url: string, options: SSEClientOptions) {
    this.url = url;
    this.options = {
      maxRetries: 3,
      retryDelayMs: 3000,
      ...options,
    };
  }

  // 开始 SSE 连接
  async connect(body: any): Promise<void> {
    this.abortController = new AbortController();

    try {
      const response = await fetch(this.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('Response body is null');
      }

      // 读取 SSE 流
      await this.readSSEStream(response.body);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('SSE 连接已主动关闭');
        return;
      }

      // 触发重试
      this.handleRetry(error);
    }
  }

  // 读取 SSE 流
  private async readSSEStream(body: ReadableStream<Uint8Array>): Promise<void> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 解码数据块
      buffer += decoder.decode(value, { stream: true });

      // 解析完整的 SSE 事件
      const events = this.parseSSEBuffer(buffer);
      buffer = ''; // 清空缓冲区

      // 处理事件
      for (const event of events) {
        this.handleEvent(event);
      }
    }
  }

  // 解析 SSE 缓冲区
  private parseSSEBuffer(buffer: string): SSEEvent[] {
    const events: SSEEvent[] = [];
    const lines = buffer.split('\n');

    let currentEvent = '';
    let currentData = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        currentEvent = line.slice(6).trim();
      } else if (line.startsWith('data:')) {
        currentData = line.slice(5).trim();

        if (currentEvent && currentData) {
          try {
            const event: SSEEvent = {
              type: currentEvent as SSEEvent['type'],
              data: JSON.parse(currentData),
            };
            events.push(event);
          } catch (error) {
            console.error('解析 SSE 数据失败:', error);
          }

          currentEvent = '';
          currentData = '';
        }
      }
    }

    return events;
  }

  // 处理事件
  private handleEvent(event: SSEEvent): void {
    switch (event.type) {
      case 'progress':
        this.options.onProgress?.(event.data);
        break;
      case 'day_plan':
        this.options.onDayPlan?.(event.data);
        break;
      case 'complete':
        this.options.onComplete?.(event.data);
        this.close(); // 自动关闭连接
        break;
      case 'error':
        this.options.onError?.(event.data);

        // 如果可重试，触发重试逻辑
        if (event.data.retryable && this.retryCount < (this.options.maxRetries || 3)) {
          this.handleRetry(new Error(event.data.message));
        } else {
          this.close();
        }
        break;
    }
  }

  // 处理重试
  private handleRetry(error: any): void {
    if (this.retryCount >= (this.options.maxRetries || 3)) {
      console.error('SSE 连接重试次数已用尽');
      this.options.onError?.({
        code: 500,
        message: '连接失败，请刷新页面重试',
        details: error.message,
        retryable: false,
      });
      this.close();
      return;
    }

    this.retryCount++;
    console.log(`SSE 连接重试 ${this.retryCount}/${this.options.maxRetries}`);

    setTimeout(() => {
      this.connect({}); // 重新连接（需要传递原始 body）
    }, this.options.retryDelayMs);
  }

  // 关闭连接
  close(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }
}
```

---

## 五、SSE 进度展示 UI 设计

### 5.1 进度展示组件

```typescript
// apps/web/src/components/GenerationProgress.tsx

import { useState, useEffect } from 'react';
import { SSEClient, ProgressData, DayPlan } from '@/lib/sse-client';

interface GenerationProgressProps {
  tripConfig: TripConfig;
  onComplete: (tripId: number) => void;
}

export function GenerationProgress({ tripConfig, onComplete }: GenerationProgressProps) {
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('正在初始化...');
  const [dayPlans, setDayPlans] = useState<DayPlan[]>([]);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    const sseClient = new SSEClient('/api/v1/trip/generate', {
      onProgress: (data: ProgressData) => {
        setProgress(data.progress);
        setCurrentStep(data.currentStep);
      },
      onDayPlan: (data: DayPlan) => {
        setDayPlans(prev => [...prev, data]);
      },
      onComplete: (data: CompleteData) => {
        setIsCompleted(true);
        onComplete(data.tripId);
      },
      onError: (data: ErrorData) => {
        console.error('生成失败:', data.message);
        // 显示错误提示
      },
    });

    // 开始连接
    sseClient.connect({ config: tripConfig });

    // 组件卸载时关闭连接
    return () => {
      sseClient.close();
    };
  }, [tripConfig, onComplete]);

  return (
    <div className="generation-progress">
      <h2>正在生成攻略...</h2>

      {/* 进度条 */}
      <div className="progress-bar">
        <div
          className="progress-fill"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p>{progress}% - {currentStep}</p>

      {/* 已生成的每日行程 */}
      {dayPlans.map(dayPlan => (
        <div key={dayPlan.day} className="day-plan-preview">
          <h3>{dayPlan.title}</h3>
          <p>{dayPlan.summary}</p>
        </div>
      ))}

      {/* 完成状态 */}
      {isCompleted && (
        <div className="completion-message">
          <h3>✅ 攻略生成完成！</h3>
          <button onClick={() => onComplete}>查看完整攻略</button>
        </div>
      )}
    </div>
  );
}
```

### 5.2 进度条样式

```css
/* apps/web/src/styles/generation-progress.css */

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: #e5e7eb;
  border-radius: 9999px;
  overflow: hidden;
  margin: 16px 0;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #8b5cf6);
  transition: width 0.3s ease-in-out;
}

.day-plan-preview {
  margin-top: 16px;
  padding: 16px;
  background-color: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
}

.completion-message {
  margin-top: 24px;
  padding: 24px;
  background-color: #ecfdf5;
  border-radius: 8px;
  text-align: center;
}
```

---

## 六、错误处理与重连策略

### 6.1 错误分类

| 错误类型         | 是否可重试 | 重试策略                        | 用户提示                       |
| ---------------- | ---------- | ------------------------------- | ------------------------------ |
| **网络错误**     | ✅ 是      | 指数退避（1s, 2s, 4s）          | "网络连接中断，正在重试..."    |
| **LLM API 超时** | ✅ 是      | 立即重试（最多 3 次）           | "生成超时，正在重试..."        |
| **LLM API 限流** | ✅ 是      | 等待 `retryAfterSeconds` 后重试 | "API 限流中，请稍后..."        |
| **参数验证失败** | ❌ 否      | 不重试                          | "输入参数有误，请检查后重试"   |
| **数据库错误**   | ❌ 否      | 不重试                          | "服务器内部错误，请联系管理员" |

### 6.2 指数退避重试

```typescript
// 指数退避重试
private async handleRetryWithBackoff(error: any, attempt: number): Promise<void> {
  if (attempt >= this.maxRetries) {
    this.options.onError?.({
      code: 500,
      message: '连接失败，请刷新页面重试',
    });
    return;
  }

  // 计算重试延迟（指数退避）
  const delayMs = Math.min(1000 * Math.pow(2, attempt), 30000); // 最大 30 秒

  console.log(`SSE 重试 ${attempt + 1}/${this.maxRetries}，等待 ${delayMs}ms`);

  await new Promise(resolve => setTimeout(resolve, delayMs));

  // 重新连接
  await this.connect({});
}
```

---

## 七、性能优化

### 7.1 后端性能优化

| 优化策略     | 说明                       | 实现方式              |
| ------------ | -------------------------- | --------------------- |
| **流式生成** | 边生成边推送，减少等待时间 | 使用 `yield` 逐天生成 |
| **并行查询** | 并行查询交通/POI/天气      | 使用 `Promise.all()`  |
| **缓存策略** | 缓存城市知识库/POI 数据    | 使用 Redis 缓存       |
| **连接复用** | 复用 HTTP 连接             | 使用 `keep-alive`     |

### 7.2 前端性能优化

| 优化策略       | 说明               | 实现方式                    |
| -------------- | ------------------ | --------------------------- |
| **虚拟滚动**   | 长列表使用虚拟滚动 | 使用 `react-window`         |
| **懒加载**     | 每日行程懒加载     | 使用 `IntersectionObserver` |
| **防抖**       | 进度更新防抖       | 使用 `lodash/debounce`      |
| **Web Worker** | 复杂计算放 Worker  | 使用 `workerize-loader`     |

---

## 八、测试策略

### 8.1 单元测试

```typescript
// apps/api/src/services/sse.service.test.ts

import { SSEService } from './sse.service';

describe('SSEService', () => {
  it('应正确发送进度事件', async () => {
    const mockResponse = createMockResponse();
    const sseService = new SSEService(mockResponse);

    sseService.sendProgress({
      progress: 50,
      currentStep: '正在规划行程...',
    });

    const output = mockResponse.getOutput();
    expect(output).toContain('event: progress');
    expect(output).toContain('"progress": 50');
  });

  it('应正确关闭连接', async () => {
    const mockResponse = createMockResponse();
    const sseService = new SSEService(mockResponse);

    sseService.sendComplete({
      tripId: 123,
      title: 'Test Trip',
      totalDays: 3,
    });

    expect(mockResponse.closed).toBe(true);
  });
});
```

### 8.2 集成测试

```typescript
// apps/web/src/lib/sse-client.test.ts

import { SSEClient } from './sse-client';

describe('SSEClient', () => {
  it('应正确解析 SSE 事件', async () => {
    const mockStream = createMockSSEStream([
      { type: 'progress', data: { progress: 10 } },
      { type: 'day_plan', data: { day: 1, title: 'Day 1' } },
      { type: 'complete', data: { tripId: 123 } },
    ]);

    const client = new SSEClient('/api/v1/trip/generate', {
      onProgress: jest.fn(),
      onDayPlan: jest.fn(),
      onComplete: jest.fn(),
    });

    await client.connect({});

    expect(client.options.onProgress).toHaveBeenCalledTimes(1);
    expect(client.options.onDayPlan).toHaveBeenCalledTimes(1);
    expect(client.options.onComplete).toHaveBeenCalledTimes(1);
  });
});
```

---

## 九、监控与日志

### 9.1 关键指标

| 指标             | 说明                | 告警阈值 |
| ---------------- | ------------------- | -------- |
| **SSE 连接数**   | 当前活跃 SSE 连接数 | > 100    |
| **平均生成时间** | 攻略生成平均耗时    | > 60 秒  |
| **错误率**       | SSE 连接错误率      | > 5%     |
| **重试率**       | SSE 连接重试率      | > 10%    |

### 9.2 日志格式

```typescript
// SSE 连接日志
interface SSELog {
  timestamp: string;
  connectionId: string;
  userId?: number;
  tripId?: number;
  event: 'connected' | 'progress' | 'day_plan' | 'complete' | 'error' | 'closed';
  data?: any;
  duration?: number; // 连接持续时间（毫秒）
}
```

---

## 十、下一步

### 10.1 开发者执行清单

- [ ] 实现 `SSEConnectionManager`（后端）
- [ ] 实现 `SSEService`（后端）
- [ ] 实现 `SSEClient`（前端）
- [ ] 实现 `GenerationProgress` 组件（前端）
- [ ] 编写单元测试和集成测试
- [ ] 配置监控和日志

### 10.2 参考文档

- 《前后端接口契约文档\_v1.0.0.md》 - SSE 事件类型定义
- 《Trip_Lifecycle 引擎算法设计.md》 - 攻略生成核心逻辑
- 《技术栈选型文档\_v1.0.0.md》 - Fastify SSE 支持

---

**文档状态**：✅ 已完成（交付开发团队执行）

**下一步**：生成《组件设计规范文档\_v1.0.0.md》

/**
 * PATH-WISE · LLM 路由器内部类型
 */

/** LLM 任务类型 */
export type LLMTaskType =
  | "trip_generation"
  | "poi_filtering"
  | "copywriting"
  | "trip_validation";

/** LLM 路由配置 */
export interface LLMRouteConfig {
  taskType: LLMTaskType;
  inputTokens?: number;
  costPriority?: "low" | "normal";
  speedPriority?: "fast" | "normal";
}

/** LLM 能力矩阵（参考 docs/技术栈选型文档_v1.0.0.md §4.1） */
export const LLM_CAPABILITY_MATRIX = {
  deepseek: {
    strengths: ["code_generation", "logical_reasoning", "cost_efficiency"],
    contextWindow: 128000,
    costPer1KTokens: 0.14,
    speed: "fast",
    bestFor: ["trip_generation", "logical_optimization"],
  },
  glm: {
    strengths: ["chinese_comprehension", "cultural_context", "long_text"],
    contextWindow: 128000,
    costPer1KTokens: 0.1,
    speed: "balanced",
    bestFor: ["poi_recommendation", "local_culture"],
  },
  kimi: {
    strengths: ["long_context", "document_analysis", "detail_extraction"],
    contextWindow: 200000,
    costPer1KTokens: 0.12,
    speed: "medium",
    bestFor: ["complex_itinerary", "multi_day_planning"],
  },
  mimo: {
    strengths: ["lightweight", "fast_response", "simple_tasks"],
    contextWindow: 32000,
    costPer1KTokens: 0.05,
    speed: "very_fast",
    bestFor: ["quick_suggestion", "simple_qa"],
  },
} as const;

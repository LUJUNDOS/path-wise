/**
 * PATH-WISE · LLM 路由器内部类型
 */

/** LLM 任务类型 */
export type LLMTaskType = 'trip_generation' | 'poi_filtering' | 'copywriting' | 'trip_validation';

/** LLM 路由配置 */
export interface LLMRouteConfig {
  taskType: LLMTaskType;
  inputTokens?: number;
  costPriority?: 'low' | 'normal';
  speedPriority?: 'fast' | 'normal';
}

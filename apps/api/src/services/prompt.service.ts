/**
 * PATH-WISE · Prompt 模板服务
 * 依据：docs/LLM Prompt 设计文档_v1.0.0.md §3 + §5
 *
 * 职责：构建各任务类型的 System Prompt 和 User Prompt
 *
 * 安全：所有用户输入通过 sanitizePromptValue() 处理，防止 Prompt 注入
 */

import type { TripGenerateRequest, DayPlan } from '@path-wise/shared';
import type { CityTransport } from '../data/mock_cities.js';
import { CITY_DATA } from '../data/mock_cities.js';

// ─────────────────────────────────────────────
// S3: 用户输入安全清洗（防 Prompt 注入）
// ─────────────────────────────────────────────

/**
 * 清洗用户输入，防止 Prompt 注入攻击
 * - 去除控制字符（保留空格）
 * - 规范化空白符
 * - 截断到最大长度
 * @param value - 原始用户输入
 * @param maxLength - 最大允许长度，默认 200
 */
function sanitizePromptValue(value: string, maxLength = 200): string {
  return (
    value
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x1f]/g, ' ') // 去除控制字符，保留空格
      .replace(/\s+/g, ' ') // 规范化空白符
      .trim()
      .slice(0, maxLength)
  );
}

// ─────────────────────────────────────────────
// System Prompt（来自 LLM Prompt 设计文档 §3.1）
// ─────────────────────────────────────────────

export const SYSTEM_PROMPT = `你是一位资深旅游规划师，拥有 10 年以上的旅游规划经验，熟悉中国各大旅游城市。
你的专长是根据用户提供的信息，生成详细、可行、个性化的单日旅游行程。

你的任务是根据用户提供的出行信息和城市知识库，为指定的一天生成详细的行程安排 JSON。

## 输出格式要求

必须输出合法的 JSON，符合以下 DayPlan 结构（只输出 JSON，不要输出其他内容）：

{
  "dayIndex": 1,
  "date": "YYYY-MM-DD",
  "dayType": "transit_departure | city_exploration | transit_transfer | transit_return",
  "cityName": "城市名",
  "isFirstDayOfCity": true,
  "title": "Day 1 / 主题标题（20字以内）",
  "timeline": [
    {
      "id": "item_{dayIndex}_001",
      "type": "transport | attraction | dining | hotel | shopping | rest | transit_to_hub",
      "title": "活动名称",
      "description": "活动描述（50字以内）",
      "startTime": "HH:MM",
      "endTime": "HH:MM",
      "estimatedDuration": 90,
      "estimatedCostCNY": 0,
      "energyLevel": "LOW | MEDIUM | HIGH",
      "bookingRequired": false,
      "bookingUrl": null
    }
  ],
  "accommodation": null,
  "transport": null,
  "tips": ["当日建议1", "当日建议2"]
}

## 约束条件

1. 每天活动数量：3-6 个（含餐饮）
2. 活动时间不能重叠，时间格式严格使用 HH:MM
3. 每天必须安排午餐和晚餐（type: dining）
4. 景点游览时间参考知识库中的游玩时长
5. transit_departure 日（抵达日）的活动从中午 12:00 开始，不安排上午活动
6. city_exploration 日（游玩日）从 09:00 开始安排
7. 体力消耗等级要与用户节奏偏好匹配：
   - 宽松节奏(relaxed)：每天最多 1 个 HIGH 级别活动
   - 适中节奏(moderate)：每天最多 2 个 HIGH 级别活动
   - 高强度节奏(intensive)：不限制
8. 有老人同行时，避免安排 HIGH 级别活动超过 1 个，且安排午休时间
9. 有儿童同行时，优先安排趣味性强的景点，避免过于耗体力的活动
10. 预算约束：
    - economy：每日总花费不超过 150 元/人
    - comfort：每日总花费不超过 400 元/人
    - luxury：每日总花费不超过 1000 元/人
11. 住宿信息只在每个城市第一天（isFirstDayOfCity=true）提供，包含 checkInDate/checkOutDate/nights

## 禁止项

- 禁止在 JSON 之外输出任何文字
- 禁止推荐不存在于知识库的景点
- 禁止安排闭馆时间内的活动`;

// ─────────────────────────────────────────────
// 日计划生成 User Prompt 构建参数
// ─────────────────────────────────────────────

export interface DayGenerationPromptParams {
  /** 目标城市名称 */
  cityName: string;
  /** 全局天索引（1-based） */
  dayIndex: number;
  /** 日期 */
  date: string;
  /** 是否是该城市的第一天 */
  isFirstDayOfCity: boolean;
  /** 该城市总停留天数 */
  daysInCity: number;
  /** 用户偏好 */
  preferences: TripGenerateRequest['preferences'];
  /** 出行人员 */
  travelers: TripGenerateRequest['travelers'];
  /** 交通信息（抵达日时有值） */
  transport: CityTransport | null;
  /** 城市知识库（景点、餐饮、酒店、贴士） */
  cityData: Record<string, unknown> | null;
  /** 前几天的行程（用于上下文衔接） */
  previousDays: DayPlan[];
}

/**
 * 构建单日行程生成的 User Prompt
 * 依据：docs/LLM Prompt 设计文档_v1.0.0.md §5.3
 */
export function buildDayGenerationPrompt(params: DayGenerationPromptParams): string {
  const {
    cityName,
    dayIndex,
    date,
    isFirstDayOfCity,
    daysInCity,
    preferences,
    travelers,
    transport,
    cityData,
    previousDays,
  } = params;

  const budgetLabel =
    preferences.budget === 'economy' ? '穷游' : preferences.budget === 'luxury' ? '奢华' : '舒适';
  const paceLabel =
    preferences.pace === 'intensive' ? '高强度' : preferences.pace === 'relaxed' ? '宽松' : '适中';

  // S3: 清洗用户输入，防 Prompt 注入
  const safeCityName = sanitizePromptValue(cityName, 50);
  const safeInterests = preferences.interests.map((i) => sanitizePromptValue(i, 100));
  const safeDining = preferences.dining.map((d) => sanitizePromptValue(d, 100));

  // S3: 校验城市名是否在已知知识库中（不在时记录警告但仍允许生成）
  if (!CITY_DATA[cityName]) {
    console.warn(
      `[buildDayGenerationPrompt] City "${sanitizePromptValue(String(cityName), 50)}" not in CITY_DATA allowlist`,
    );
  }

  const parts: string[] = [];

  // 基本信息
  parts.push(`请为以下单日行程生成详细安排：`);
  parts.push(``);
  parts.push(`## 基本信息`);
  parts.push(`- 目标城市：${safeCityName}`);
  parts.push(`- 日期：${date}`);
  parts.push(`- 这是第 ${dayIndex} 天（共需生成多天）`);
  parts.push(
    `- 在${safeCityName}停留 ${daysInCity} 天，${isFirstDayOfCity ? '今天是抵达的第一天' : `今天是第 ${Math.min(dayIndex, daysInCity)} 天`}`,
  );
  parts.push(`- 抵达日为 transit_departure 类型，非抵达日为 city_exploration 类型`);

  // 用户偏好
  parts.push(``);
  parts.push(`## 用户偏好`);
  parts.push(`- 预算等级：${budgetLabel}（${preferences.budget}）`);
  parts.push(`- 节奏偏好：${paceLabel}（${preferences.pace}）`);
  parts.push(`- 住宿偏好：${preferences.accommodation}`);
  parts.push(`- 兴趣偏好：${safeInterests.length > 0 ? safeInterests.join('、') : '综合'}`);
  if (safeDining.length > 0) {
    parts.push(`- 饮食偏好：${safeDining.join('、')}`);
  }

  // 出行人员
  parts.push(``);
  parts.push(`## 出行人员`);
  parts.push(`- 成人：${travelers.adults} 人`);
  if (travelers.children.length > 0) {
    const childAges = travelers.children.map((c) => `${c.age}岁`).join('、');
    parts.push(
      `- 儿童：${travelers.children.length} 人（${childAges}）—— 优先安排趣味性强的景点，避免过于耗体力的活动`,
    );
  }
  if (travelers.elders > 0) {
    parts.push(
      `- 老人：${travelers.elders} 人 —— 避免安排 HIGH 级别活动超过 1 个，需要安排午休时间`,
    );
  }

  // 交通信息（抵达日）
  if (transport) {
    parts.push(``);
    parts.push(`## 大交通信息`);
    parts.push(`\`\`\`json`);
    parts.push(JSON.stringify(transport, null, 2));
    parts.push(`\`\`\``);
    parts.push(`请将大交通作为 timeline 的第一个条目（type: transport）。`);
  }

  // 城市知识库
  if (cityData) {
    parts.push(``);
    parts.push(`## 目的地城市知识库`);
    parts.push(`\`\`\`json`);
    parts.push(JSON.stringify(cityData, null, 2));
    parts.push(`\`\`\``);
    parts.push(`请从知识库中选择合适的景点和餐厅安排行程，只选择知识库中存在的项目。`);
  }

  // 前几日上下文
  if (previousDays.length > 0) {
    parts.push(``);
    parts.push(`## 前几日行程（仅作参考，避免重复）`);
    parts.push(
      `已安排的景点：${previousDays.map((d) => d.timeline.map((t) => t.title).join('、')).join('；')}`,
    );
    parts.push(`请避免重复选择前一天已经去过的景点，尽量安排不同的体验。`);
  }

  // 住宿（只在城市第一天提供）
  if (isFirstDayOfCity && cityData) {
    parts.push(``);
    parts.push(`## 住宿要求`);
    parts.push(`请在输出中提供 accommodation 字段，从知识库的 hotels 中选择合适的酒店。`);
    parts.push(`checkInDate 为 ${date}，checkOutDate 为离开日，共 ${daysInCity} 晚。`);
    parts.push(`预算偏好为 ${budgetLabel}，请选择匹配的酒店。`);
  }

  parts.push(``);
  parts.push(`请生成 Day ${dayIndex} 的完整行程 JSON：`);

  return parts.join('\n');
}

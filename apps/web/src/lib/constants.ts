export const CITIES_LIST = ["北京", "上海", "成都", "杭州", "厦门"] as const;

export const POPULAR_CITIES = ["北京", "上海", "成都", "杭州", "厦门", "长沙", "广州", "深圳", "重庆", "西安"] as const;

export const MAX_DESTINATIONS = 5;
export const MAX_TOTAL_DAYS = 30;
export const MAX_DAYS_PER_DESTINATION = 14;
export const SSE_TIMEOUT_MS = 120_000;
export const SSE_CONNECT_TIMEOUT_MS = 10_000;
export const INTEREST_TAGS = ["文化", "美食", "自然", "购物", "摄影", "夜生活", "亲子", "历史"] as const;
export const MAX_INTERESTS = 3;

export const BUDGET_LEVELS = [
  { value: "economy", label: "经济", description: "¥200~500/天/人，性价比优先", icon: "💼" },
  { value: "comfort", label: "舒适", description: "¥500~1200/天/人，品质与性价比平衡", icon: "⭐" },
  { value: "luxury", label: "豪华", description: "¥1200~3000/天/人，高端酒店 + 专车", icon: "🏆" },
] as const;

export const PACE_LEVELS = [
  { value: "intensive", label: "高强度", description: "每天 3~4 个景点，适合体力好的年轻人" },
  { value: "moderate", label: "舒适", description: "每天 2~3 个景点，留有足够的休息时间" },
  { value: "relaxed", label: "悠闲", description: "每天 1~2 个景点，不赶路，深度体验" },
] as const;

export const ACCOMMODATION_TYPES = [
  { value: "hostel", label: "青旅", description: "适合穷游，多人间" },
  { value: "chain_hotel", label: "连锁酒店", description: "如汉庭/如家，标准化" },
  { value: "boutique", label: "精品酒店", description: "设计感强，本地特色" },
  { value: "any", label: "不限", description: "让 AI 根据预算自动选择" },
] as const;

export const DINING_PREFERENCES = ["本地特色", "连锁餐厅", "网红店"] as const;

export const TIME_PERIODS = [
  { value: "morning", label: "上午", range: "06:00~12:00" },
  { value: "afternoon", label: "下午", range: "12:00~18:00" },
  { value: "evening", label: "晚上", range: "18:00~24:00" },
] as const;

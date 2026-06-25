/**
 * PATH-WISE · 浏览器 localStorage 工具
 * 封装 localStorage 读写，提供类型安全 + 异常安全 + 默认值。
 */

const RECENT_CITIES_KEY = 'pathwise_recent_cities';

/**
 * 安全读取 JSON 值，异常或不存在时返回默认值。
 */
function readJSON<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? (JSON.parse(stored) as T) : fallback;
  } catch {
    return fallback;
  }
}

/**
 * 安全写入 JSON 值，异常时静默忽略。
 */
function writeJSON<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* localStorage full or disabled — silently noop */
  }
}

/**
 * 获取最近选择的城市列表（最多 5 个）
 */
export function getRecentCities(): string[] {
  return readJSON<string[]>(RECENT_CITIES_KEY, []);
}

/**
 * 保存最近选择的城市（最近选中的置顶）
 */
export function saveRecentCity(city: string): void {
  const recent = getRecentCities().filter((c) => c !== city);
  recent.unshift(city);
  writeJSON(RECENT_CITIES_KEY, recent.slice(0, 5));
}

/**
 * 清除所有 path-wise 相关 localStorage 数据
 */
export function clearAllStorage(): void {
  try {
    localStorage.removeItem(RECENT_CITIES_KEY);
  } catch {
    /* noop */
  }
}

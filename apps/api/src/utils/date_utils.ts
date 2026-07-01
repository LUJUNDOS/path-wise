/**
 * PATH-WISE · 共享时间工具函数
 * 引擎模块统一导入，消除 trip_engine.ts / trip_engine_fill.ts 的重复定义。
 */

/**
 * 将 HH:MM 字符串转换为分钟数
 */
export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * 将分钟数转换为 HH:MM 字符串
 * 支持负数和极大值：负数返回 "00:00"，>24h 时有 % 24 溢出兜底
 */
export function minutesToTime(minutes: number): string {
  if (minutes < 0) return '00:00';
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

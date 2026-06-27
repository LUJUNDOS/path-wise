/**
 * PATH-WISE · 时间工具函数
 */

/**
 * 将 HH:MM 格式时钟时间转换为分钟数
 * @param time - 时钟时间字符串，格式 HH:MM（如 "14:30"）
 * @returns 总分钟数（如 14*60 + 30 = 870），输入无效时返回 0
 */
export function clockTimeToMinutes(time: string): number {
  if (!time || typeof time !== 'string' || !/^\d{1,2}:\d{2}$/.test(time)) {
    return 0;
  }
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * SSR-friendly formatting utilities
 */

export function formatCurrency(cny: number): string {
  return `¥${cny.toFixed(0)}`;
}

export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

export function formatTimeRange(start: string, end: string): string {
  return `${start} - ${end}`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}分钟`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}小时${mins}分` : `${hours}小时`;
}

export function getTodayStr(): string {
  const today = new Date();
  return today.toISOString().slice(0, 10);
}

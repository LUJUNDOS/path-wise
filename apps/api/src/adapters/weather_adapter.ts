/**
 * PATH-WISE · 和风天气 API 适配器（MVP Stub）
 * 依据：docs/技术栈选型文档_v1.0.0.md §5.1
 *
 * MVP 阶段返回静态 mock 天气数据。
 */

/**
 * 查询城市天气
 */
export async function getWeather(
  cityName: string,
  date?: string,
): Promise<{
  cityName: string;
  date: string;
  forecast: string;
  temperature: { low: number; high: number };
  humidity: number;
  wind: string;
}> {
  return {
    cityName,
    date: date ?? new Date().toISOString().split('T')[0],
    forecast: '晴转多云',
    temperature: { low: 24, high: 33 },
    humidity: 65,
    wind: '东南风 3级',
  };
}

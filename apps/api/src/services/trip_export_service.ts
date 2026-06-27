/**
 * PATH-WISE · 攻略导出服务
 * 职责：攻略导出（HTML 格式）及 HTML 构建
 */

import type { TripResponse, ExportOptions, ExportResponse } from '@path-wise/shared';

/** 从 tripStore（由 trip_crud_service 中的 getTrip 返回）读取攻略并生成格式化内容 */
export async function exportTrip(
  trip: TripResponse,
  _options: ExportOptions,
): Promise<ExportResponse> {
  const html = buildExportHtml(trip);
  const sizeBytes = Buffer.byteLength(html, 'utf-8');

  return {
    exportId: `export_${trip.tripId}`,
    status: 'ready',
    format: _options.format ?? 'html',
    sizeBytes,
    // 返回 HTML 内容作为 data URL（前端可直接打开或下载）
    downloadUrl: `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
    expiresAt: new Date(Date.now() + 3600000).toISOString(),
  };
}

/**
 * 构建导出 HTML（自包含样式，可直接打印）
 */
export function buildExportHtml(trip: TripResponse): string {
  const days = trip.days ?? [];

  function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const dayRows = days
    .map((day) => {
      const tl = (day.timeline ?? [])
        .map(
          (item) => `
        <tr>
          <td class="time">${esc(item.startTime)}–${esc(item.endTime)}</td>
          <td class="title">${esc(item.title)}</td>
          <td>${esc(item.description ?? '')}</td>
          <td class="cost">${item.estimatedCostCNY > 0 ? `¥${item.estimatedCostCNY}` : '-'}</td>
        </tr>`,
        )
        .join('');

      return `
      <section class="day">
        <h3>Day ${day.dayIndex} · ${esc(day.date)} · ${esc(day.cityName)}</h3>
        ${day.title ? `<p class="day-title">${esc(day.title)}</p>` : ''}
        <table>
          <thead><tr><th>时间</th><th>项目</th><th>说明</th><th>花费</th></tr></thead>
          <tbody>${tl}</tbody>
        </table>
        ${day.tips?.length ? `<div class="tips">💡 ${day.tips.map(esc).join('；')}</div>` : ''}
      </section>`;
    })
    .join('');

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>${esc(trip.title)} — PATH–WISE 攻略</title>
  <style>
    body{font-family:"PingFang SC","Microsoft YaHei",sans-serif;max-width:800px;margin:0 auto;padding:24px;color:#222}
    h1{font-size:24px;border-bottom:2px solid #333;padding-bottom:8px;margin-bottom:4px}
    .meta{color:#666;font-size:14px;margin-bottom:24px}
    .day{margin-bottom:32px}
    .day h3{font-size:16px;background:#f5f5f5;padding:6px 12px;border-radius:4px}
    .day-title{color:#555;font-size:14px;margin-top:-8px;margin-bottom:12px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th,td{padding:6px 8px;border-bottom:1px solid #eee;text-align:left;vertical-align:top}
    th{background:#fafafa;font-weight:600;color:#555}
    .time{white-space:nowrap;width:100px;color:#888}
    .cost{white-space:nowrap;width:72px;text-align:right;color:#e67e22;font-weight:600}
    .tips{font-size:13px;color:#888;margin-top:8px;padding:6px 12px;background:#f9f9f9;border-radius:4px}
    .footer{text-align:center;color:#aaa;font-size:12px;margin-top:40px;border-top:1px solid #eee;padding-top:16px}
  </style>
</head>
<body>
  <h1>${esc(trip.title)}</h1>
  <div class="meta">
    ${trip.generateTime ? `生成于 ${new Date(trip.generateTime).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })} · ` : ''}${trip.totalDays} 天 · 出发城市：${esc(trip.departureCity)}${trip.totalEstimatedCostCNY ? ` · 预估 ¥${trip.totalEstimatedCostCNY}` : ''}
  </div>
  ${dayRows}
  <div class="footer">由 PATH–WISE 生成 · 仅供参考</div>
</body>
</html>`;
}

import { cn } from '@/lib/utils';
import { Train, Plane, Bus, Car, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDuration } from '@/lib/format';

export interface TransportInfoCardProps {
  transport: Record<string, unknown> | null | undefined;
  /** 行程日期（YYYY-MM-DD），用于展示 */
  date?: string;
  className?: string;
}

// ---- 图标映射 ----

const TRANSPORT_ICONS: Record<string, React.ReactNode> = {
  high_speed_rail: <Train className="h-5 w-5" />,
  normal_train: <Train className="h-5 w-5" />,
  flight: <Plane className="h-5 w-5" />,
  bus: <Bus className="h-5 w-5" />,
  auto: <Car className="h-5 w-5" />,
};

const TRANSPORT_LABELS: Record<string, string> = {
  high_speed_rail: '高铁',
  normal_train: '普速火车',
  flight: '航班',
  bus: '大巴',
  auto: '自驾',
};

/** 座位类型中文标签 */
const SEAT_LABELS: Record<string, string> = {
  secondClass: '二等座',
  firstClass: '一等座',
  businessClass: '商务座',
  hardSeat: '硬座',
  hardSleeper: '硬卧',
  softSleeper: '软卧',
  standing: '无座',
  economy: '经济舱',
  business: '商务舱',
  first: '头等舱',
  normal: '普通座',
  vip: '商务座',
};

/**
 * 将英文座位类型转换为中文标签
 */
function seatLabel(key: string): string {
  return SEAT_LABELS[key] ?? key;
}

/**
 * 格式化日期为中文显示
 */
function formatDateChinese(dateStr: string): string {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// ---- TransportInfoCard ----

export function TransportInfoCard({ transport, date, className }: TransportInfoCardProps) {
  if (!transport) return null;
  const t = transport as Record<string, unknown>;
  if (!t.type) return null;

  const type = String(t.type);
  const icon = TRANSPORT_ICONS[type] ?? <Car className="h-5 w-5" />;
  const label = TRANSPORT_LABELS[type] ?? type;

  // 车次 / 航班号
  const trainNumber = t.trainNumber ? String(t.trainNumber) : null;
  const flightNumber = t.flightNumber ? String(t.flightNumber) : null;
  const routeNumber = trainNumber ?? flightNumber;

  const departStation = t.departureStation ? String(t.departureStation) : '--';
  const arriveStation = t.arrivalStation ? String(t.arrivalStation) : '--';
  const departTime = t.departTime ? String(t.departTime) : '--';
  const arriveTime = t.arriveTime ? String(t.arriveTime) : '--';
  const durationMin = t.durationMinutes ? Number(t.durationMinutes) : 0;
  const isOvernight = Boolean(t.isOvernight);
  const prices = t.pricePerPerson as Record<string, number> | undefined;
  const note = t.note ? String(t.note) : null;

  const durationStr = formatDuration(durationMin);
  const showDate = date ? formatDateChinese(date) : null;

  return (
    <Card className={cn('border-l-4 border-l-blue-500', className)}>
      <CardContent className="pt-5">
        {/* ── 头部：交通类型 + 车次/航班号 + 隔夜标识 ── */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-blue-600">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            {/* 类型 + 车次号 */}
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="font-semibold text-sm">
                {routeNumber ?? label}
                {routeNumber && (
                  <span className="text-muted-foreground ml-1 font-normal">({label})</span>
                )}
              </h4>
              {isOvernight && (
                <Badge variant="secondary" className="text-xs gap-1">
                  隔夜
                </Badge>
              )}
            </div>

            {/* ── 出发站 → 到达站 ── */}
            <p className="text-sm mt-1">
              <span className="text-muted-foreground">出发：</span>
              <span>{departStation}</span>
              <span className="text-muted-foreground mx-1.5">→</span>
              <span className="text-muted-foreground">到达：</span>
              <span>{arriveStation}</span>
            </p>

            {/* ── 日期 + 时间 + 历时 ── */}
            <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
              {showDate && <span>{showDate}</span>}
              <time>{departTime}</time>
              <span>→</span>
              <time>{arriveTime}</time>
              <span className="text-foreground/60">历时 {durationStr}</span>
            </div>

            {/* ── 隔夜提示 ── */}
            {isOvernight && type === 'normal_train' && (
              <p className="text-xs text-muted-foreground mt-0.5">隔夜车次，含卧铺</p>
            )}
            {isOvernight && type === 'bus' && (
              <p className="text-xs text-muted-foreground mt-0.5">隔夜班次，建议准备颈枕</p>
            )}

            {/* ── 价格明细 ── */}
            {prices && Object.keys(prices).length > 0 && (
              <div className="mt-2 flex gap-3 flex-wrap">
                {Object.entries(prices).map(([key, price]) => (
                  <span key={key} className="text-xs">
                    <span className="text-muted-foreground">{seatLabel(key)}：</span>
                    <span className="font-medium">{formatCurrency(Number(price))}</span>
                    <span className="text-muted-foreground">/人</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── 免责声明 ── */}
        <div className="mt-3.5 rounded-md bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/30 px-3 py-2">
          <p className="text-xs text-orange-600 dark:text-orange-400 leading-relaxed">
            <AlertTriangle className="inline h-3 w-3 mr-1 -mt-0.5" />
            {note ??
              '车次/航班/大巴信息仅供参考，余票/班次动态变化，请尽快到 12306 / 携程 / 飞猪 订票'}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

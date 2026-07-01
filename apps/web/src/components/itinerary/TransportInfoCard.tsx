import { cn } from '@/lib/utils';
import { Train, Plane, Bus, Car, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDuration } from '@/lib/format';

export interface TransportInfoCardProps {
  transport: Record<string, unknown> | null | undefined;
  className?: string;
}

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

export function TransportInfoCard({ transport, className }: TransportInfoCardProps) {
  if (!transport) return null;
  const t = transport as Record<string, unknown>;
  if (!t.type) return null;

  const type = String(t.type);
  const icon = TRANSPORT_ICONS[type] ?? <Car className="h-5 w-5" />;
  const label = TRANSPORT_LABELS[type] ?? type;
  const trainNumber = t.trainNumber ? String(t.trainNumber) : null;
  const departStation = t.departureStation ? String(t.departureStation) : '--';
  const arriveStation = t.arrivalStation ? String(t.arrivalStation) : '--';
  const departTime = t.departTime ? String(t.departTime) : '--';
  const arriveTime = t.arriveTime ? String(t.arriveTime) : '--';
  const durationMin = t.durationMinutes ? Number(t.durationMinutes) : 0;
  const isOvernight = Boolean(t.isOvernight);
  const prices = t.pricePerPerson as Record<string, number> | undefined;

  const durationStr = formatDuration(durationMin);

  return (
    <Card className={cn('border-l-4 border-l-blue-500', className)}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
            {icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-semibold text-sm">
                {trainNumber ?? label}
                {trainNumber && <span className="text-muted-foreground ml-1">({label})</span>}
              </h4>
              {isOvernight && (
                <Badge variant="secondary" className="text-xs">
                  隔夜
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              <span className="text-xs">{departStation} </span>
              <time>{departTime}</time>
              {' → '}
              <span className="text-xs">{arriveStation} </span>
              <time>{arriveTime}</time>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">历时 {durationStr}</p>
            {prices && (
              <div className="mt-1.5 flex gap-3">
                {Object.entries(prices).map(([seat, price]) => (
                  <span key={seat} className="text-xs">
                    <span className="text-muted-foreground">{seat}：</span>
                    <span className="font-medium">{formatCurrency(Number(price))}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="mt-3 rounded-md bg-orange-50 px-3 py-2 text-xs text-orange-600">
          <AlertTriangle className="inline h-3 w-3 mr-1" />
          车次/航班/大巴信息仅供参考，请尽快到 12306 / 携程 / 飞猪 订票
        </div>
      </CardContent>
    </Card>
  );
}

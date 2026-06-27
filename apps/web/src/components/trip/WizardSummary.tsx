import { useMemo } from 'react';
import { MapPin, Target, Calendar, Users, Settings, ArrowLeftRight } from 'lucide-react';
import { TIME_PERIODS, BUDGET_LEVELS, PACE_LEVELS, ACCOMMODATION_TYPES } from '@/lib/constants';
import type { TimePeriod, TripPreferences, TravelerGroup } from '@path-wise/shared';

interface DestInfo {
  cityName: string;
  days: number;
}

interface WizardSummaryProps {
  departureCity: string;
  destinations: DestInfo[];
  departureDate: string;
  timePeriod: TimePeriod;
  travelers: TravelerGroup;
  preferences: TripPreferences;
  needsReturnTransport: boolean;
  returnTransportPref: string;
}

const TRANSPORT_LABELS: Record<string, string> = {
  auto: '智能推荐',
  high_speed_rail: '高铁',
  normal_train: '普速火车',
  flight: '航班',
  bus: '大巴',
};

function SummaryRow({
  icon: Icon,
  label,
  value,
  delay,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  delay: number;
}) {
  return (
    <div
      className="summary-row flex items-start gap-3 py-2.5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-[var(--wz-icon-bg)] text-[var(--wz-icon-fg)]">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        <p className="text-sm font-medium text-foreground">{value}</p>
      </div>
    </div>
  );
}

export function WizardSummary({
  departureCity,
  destinations,
  departureDate,
  timePeriod,
  travelers,
  preferences,
  needsReturnTransport,
  returnTransportPref,
}: WizardSummaryProps) {
  const destStr = useMemo(
    () =>
      destinations.length > 0
        ? destinations.map((d) => `${d.cityName}（${d.days}天）`).join(' → ')
        : '未设置',
    [destinations],
  );

  const totalDays = useMemo(() => destinations.reduce((sum, d) => sum + d.days, 0), [destinations]);

  const dateStr = useMemo(() => {
    const tp = TIME_PERIODS.find((t) => t.value === timePeriod);
    return `${departureDate} · ${tp?.label ?? timePeriod}（${tp?.range ?? ''}）`;
  }, [departureDate, timePeriod]);

  const travelerStr = useMemo(() => {
    const parts = [`成人 ${travelers.adults}`];
    if (travelers.children.length > 0) parts.push(`儿童 ${travelers.children.length}`);
    if (travelers.elders > 0) parts.push(`老人 ${travelers.elders}`);
    return parts.join(' · ');
  }, [travelers]);

  const budgetLabel = BUDGET_LEVELS.find((b) => b.value === preferences.budget)?.label ?? '舒适';
  const paceLabel = PACE_LEVELS.find((p) => p.value === preferences.pace)?.label ?? '舒适';
  const accLabel =
    ACCOMMODATION_TYPES.find((a) => a.value === preferences.accommodation)?.label ?? '连锁酒店';

  const prefStr = [
    `预算：${budgetLabel}`,
    `节奏：${paceLabel}`,
    `住宿：${accLabel}`,
    preferences.interests.length > 0 && `兴趣：${preferences.interests.join('、')}`,
    preferences.dining.length > 0 && `美食：${preferences.dining.join('、')}`,
  ]
    .filter(Boolean)
    .join('  ·  ');

  // Calculate individual row delays for stagger
  const rows = [
    { icon: MapPin, label: '出发城市', value: departureCity || '未设置' },
    { icon: Target, label: `目的地（共 ${totalDays} 天）`, value: destStr },
    { icon: Calendar, label: '出发时间', value: dateStr },
    { icon: Users, label: '同行人员', value: travelerStr },
    {
      icon: ArrowLeftRight,
      label: '返程交通',
      value: needsReturnTransport
        ? (TRANSPORT_LABELS[returnTransportPref] ?? '智能推荐')
        : '不需要',
    },
    { icon: Settings, label: '偏好设置', value: prefStr },
  ];

  return (
    <div className="divide-y divide-[var(--wz-rule-color)]">
      {rows.map((row, i) => (
        <SummaryRow key={row.label} {...row} delay={i * 80} />
      ))}
    </div>
  );
}

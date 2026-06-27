import { useMemo, useState, useEffect } from 'react';
import {
  MapPin,
  Target,
  Calendar,
  Users,
  Settings,
  ArrowLeftRight,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIME_PERIODS, BUDGET_LEVELS, PACE_LEVELS, ACCOMMODATION_TYPES } from '@/lib/constants';
import type { TimePeriod, TripPreferences, TravelerGroup } from '@path-wise/shared';

interface DestInfo {
  cityName: string;
  days: number;
}

interface WizardSummaryPanelProps {
  departureCity: string;
  destinations: DestInfo[];
  departureDate: string;
  timePeriod: TimePeriod;
  travelers: TravelerGroup;
  preferences: TripPreferences;
  needsReturnTransport: boolean;
  returnTransportPref: string;
  submitError?: string;
}

const TRANSPORT_LABELS: Record<string, string> = {
  auto: '智能推荐',
  high_speed_rail: '高铁',
  normal_train: '普速火车',
  flight: '航班',
  bus: '大巴',
};

function SummaryItem({
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
      className="summary-slide-panel--row flex items-start gap-2.5 py-2"
      style={{ animationDelay: `${delay}ms` }}
    >
      <span className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full bg-[var(--wz-icon-bg)] text-[var(--wz-icon-fg)] mt-0.5">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
        <p className="text-sm font-medium text-foreground leading-snug">{value}</p>
      </div>
    </div>
  );
}

/**
 * WizardSummaryPanel — a summary card that slides in from the right
 * when the user reaches the confirm step. No collapse toggle.
 */
export function WizardSummaryPanel({
  departureCity,
  destinations,
  departureDate,
  timePeriod,
  travelers,
  preferences,
  needsReturnTransport,
  returnTransportPref,
  submitError,
}: WizardSummaryPanelProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

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
    <div className={cn('summary-slide-panel w-full', !visible && 'translate-x-full opacity-0')}>
      <div className="rounded-2xl border border-border/50 bg-card shadow-modal overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-4 pb-1">
          <div className="flex items-center gap-2 mb-1">
            <ClipboardCheck className="h-4 w-4 text-[var(--wz-icon-fg)]" />
            <h3 className="text-sm font-semibold text-foreground tracking-tight">行程摘要</h3>
          </div>
          <p className="text-xs text-muted-foreground">确认无误后即可生成攻略</p>
        </div>

        <div className="mx-5 border-t border-[var(--wz-rule-color)]" />

        <div className="px-5 py-2">
          {rows.map((row, i) => (
            <SummaryItem key={row.label} {...row} delay={260 + i * 70} />
          ))}
        </div>

        {submitError && (
          <div className="mx-5 mb-3 px-3 py-2 rounded-lg text-xs text-destructive bg-destructive/5">
            {submitError}
          </div>
        )}
      </div>
    </div>
  );
}

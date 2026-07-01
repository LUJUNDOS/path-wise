import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { DayPlan, DayType } from '@path-wise/shared';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { TransportInfoCard } from './TransportInfoCard';
import { AccommodationCard } from './AccommodationCard';
import { TimelineItemRow } from './TimelineItemRow';

// ---- Props ----

interface DayPlanCardProps {
  dayPlan: DayPlan;
  isGenerating?: boolean;
  isCompact?: boolean;
  /** Whether the card content is expanded (controlled from parent) */
  expanded?: boolean;
  /** Called when the user clicks the header to toggle */
  onToggle?: () => void;
}

// ---- Constants ----

const DAY_TYPE_LABELS: Record<DayType, string> = {
  transit_departure: '出发日',
  city_exploration: '探索日',
  transit_transfer: '中转日',
  transit_return: '返程日',
};

// ---- DayPlanCard ----

export function DayPlanCard({
  dayPlan,
  isGenerating = false,
  isCompact = false,
  expanded = true,
  onToggle,
}: DayPlanCardProps) {
  const dayTypeLabel = DAY_TYPE_LABELS[dayPlan.dayType] ?? dayPlan.dayType;

  if (isGenerating) {
    return (
      <Card className="animate-pulse">
        <CardHeader>
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-48 mt-1" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn('transition-shadow hover:shadow-md', isCompact && 'text-sm')}>
      {/* ── Clickable header ── */}
      <CardHeader
        className={cn('pb-3 cursor-pointer select-none', !expanded && 'pb-3')}
        onClick={onToggle}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle?.();
          }
        }}
        aria-expanded={expanded}
      >
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Day {dayPlan.dayIndex} · {dayPlan.title}
          </CardTitle>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted-foreground transition-transform duration-300',
              expanded && 'rotate-180',
            )}
          />
        </div>
        <CardDescription className="flex items-center gap-2">
          <span>{dayPlan.date}</span>
          <Badge variant="outline" className="text-xs">
            {dayTypeLabel}
          </Badge>
          <Badge variant="secondary" className="text-xs">
            {dayPlan.cityName}
          </Badge>
        </CardDescription>
      </CardHeader>

      {/* ── Collapsible content ── */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-400 ease-out',
          expanded ? 'max-h-[4000px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        <CardContent className="space-y-3 pt-0">
          {/* Transport info for departure/transfer days */}
          {dayPlan.transport &&
            (dayPlan.dayType === 'transit_departure' ||
              dayPlan.dayType === 'transit_transfer' ||
              dayPlan.dayType === 'transit_return') && (
              <TransportInfoCard transport={dayPlan.transport} date={dayPlan.date} />
            )}

          {/* Accommodation for first day of city */}
          {dayPlan.isFirstDayOfCity && dayPlan.accommodation && (
            <AccommodationCard accommodation={dayPlan.accommodation} cityName={dayPlan.cityName} />
          )}

          {/* Timeline */}
          {dayPlan.timeline.length > 0 ? (
            <div className="relative">
              {/* Vertical timeline line */}
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />

              <div className="space-y-2">
                {dayPlan.timeline.map((item) => (
                  <TimelineItemRow key={item.id} item={item} />
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">当天暂无安排</p>
          )}

          {/* Tips */}
          {dayPlan.tips && dayPlan.tips.length > 0 && (
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">当日提示</p>
              <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                {dayPlan.tips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </div>
    </Card>
  );
}

// Re-exports
export type { DayPlanCardProps };

import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Train,
  MapPin,
  UtensilsCrossed,
  Building2,
  ShoppingBag,
  Coffee,
  ChevronDown,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/format';
import type { TimelineItem as TimelineItemType } from '@path-wise/shared';

const ITEM_TYPE_ICONS: Record<string, React.ReactNode> = {
  transport: <Train className="h-4 w-4" />,
  attraction: <MapPin className="h-4 w-4" />,
  dining: <UtensilsCrossed className="h-4 w-4" />,
  hotel: <Building2 className="h-4 w-4" />,
  shopping: <ShoppingBag className="h-4 w-4" />,
  rest: <Coffee className="h-4 w-4" />,
  transit_to_hub: <Train className="h-4 w-4" />,
};

interface TimelineItemRowProps {
  item: TimelineItemType;
}

export function TimelineItemRow({ item }: TimelineItemRowProps) {
  const [showAlternatives, setShowAlternatives] = useState(false);

  const icon = ITEM_TYPE_ICONS[item.type] ?? <MapPin className="h-4 w-4" />;
  const hasAlternatives = item.alternatives && item.alternatives.length > 0;
  const displayAlternatives = hasAlternatives ? item.alternatives!.slice(0, 3) : [];

  return (
    <div className="flex gap-3">
      {/* Timeline dot */}
      <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-border bg-background">
        {icon}
      </div>

      <div className="flex-1 min-w-0 pb-1">
        <div className="rounded-lg border bg-card px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-medium truncate">{item.title}</p>
            <span className="text-xs text-muted-foreground shrink-0">
              {item.startTime} - {item.endTime}
            </span>
          </div>

          {item.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
          )}

          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {item.estimatedCostCNY > 0 && (
              <Badge variant="outline" className="text-xs">
                {formatCurrency(item.estimatedCostCNY)}
              </Badge>
            )}
            {item.bookingRequired && (
              <Badge variant="outline" className="text-xs text-yellow-600 border-yellow-300">
                需预约
              </Badge>
            )}
            {item.bookingRequired && item.bookingUrl && (
              <a
                href={item.bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary underline"
              >
                预约入口
              </a>
            )}
          </div>

          {hasAlternatives && (
            <>
              <button
                className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowAlternatives(!showAlternatives)}
                type="button"
              >
                <ChevronDown
                  className={cn('h-3 w-3 transition-transform', showAlternatives && 'rotate-180')}
                />
                备选方案 ({displayAlternatives.length})
              </button>
              {showAlternatives && (
                <div className="mt-1.5 space-y-1">
                  {displayAlternatives.map((alt) => (
                    <div key={alt.id} className="rounded bg-muted/50 px-2 py-1 text-xs">
                      <span className="font-medium">{alt.title}</span>
                      {alt.description && (
                        <span className="text-muted-foreground"> - {alt.description}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useCallback } from 'react';
import { Plus, X, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MAX_DESTINATIONS, MAX_DAYS_PER_DESTINATION } from '@/lib/constants';

interface DestinationInputProps {
  destinations: { cityName: string; days: number }[];
  onAdd: (cityName: string) => void;
  onRemove: (index: number) => void;
  onUpdateDays: (index: number, days: number) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

export function DestinationInput({
  destinations,
  onAdd,
  onRemove,
  onUpdateDays,
  onReorder,
}: DestinationInputProps) {
  const canAdd = destinations.length < MAX_DESTINATIONS;

  const handleDaysChange = useCallback(
    (index: number, delta: number) => {
      const current = destinations[index]?.days ?? 2;
      const next = Math.max(1, Math.min(MAX_DAYS_PER_DESTINATION, current + delta));
      onUpdateDays(index, next);
    },
    [destinations, onUpdateDays],
  );

  const totalDays = destinations.reduce((sum, d) => sum + d.days, 0);

  return (
    <div className="space-y-3">
      {destinations.length === 0 && (
        <p className="text-sm text-muted-foreground">请从出发城市选择器中添加目的地</p>
      )}

      <div className="flex flex-wrap gap-2">
        {destinations.map((dest, index) => (
          <div
            key={`${dest.cityName}-${index}`}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-2',
              'shadow-sm transition-shadow hover:shadow-md',
            )}
          >
            {onReorder && (
              <button
                className="cursor-grab text-muted-foreground hover:text-foreground"
                draggable
                onDragEnd={() => {}}
                type="button"
                aria-label="拖拽排序"
              >
                <GripVertical className="h-4 w-4" />
              </button>
            )}

            <span className="font-medium text-sm">{dest.cityName}</span>

            <div className="flex items-center gap-1 rounded-md border bg-muted/50 px-1">
              <button
                className="flex h-5 w-5 items-center justify-center rounded text-xs hover:bg-accent"
                onClick={() => handleDaysChange(index, -1)}
                disabled={dest.days <= 1}
                type="button"
                aria-label="减少天数"
              >
                -
              </button>
              <span className="min-w-[3ch] text-center text-xs font-medium">{dest.days}天</span>
              <button
                className="flex h-5 w-5 items-center justify-center rounded text-xs hover:bg-accent"
                onClick={() => handleDaysChange(index, 1)}
                disabled={dest.days >= MAX_DAYS_PER_DESTINATION}
                type="button"
                aria-label="增加天数"
              >
                +
              </button>
            </div>

            <button
              className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onRemove(index)}
              type="button"
              aria-label={`移除${dest.cityName}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {canAdd && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1 border-dashed"
            onClick={() => onAdd('')}
            type="button"
          >
            <Plus className="h-3.5 w-3.5" />
            添加目的地
          </Button>
        )}
      </div>

      {destinations.length >= 2 && (
        <p className="text-xs text-muted-foreground">共 {totalDays} 天</p>
      )}
    </div>
  );
}

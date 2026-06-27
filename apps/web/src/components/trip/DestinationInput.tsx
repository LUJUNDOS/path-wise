import { useCallback, useState } from 'react';
import { X, GripVertical, Plus, ArrowDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { MAX_DESTINATIONS, MAX_DAYS_PER_DESTINATION, TRANSPORT_OPTIONS } from '@/lib/constants';
import { CitySelector } from './CitySelector';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import type { TransportType } from '@path-wise/shared';

export interface DestInfo {
  cityName: string;
  days: number;
  transportTo: TransportType | null;
}

interface DestinationInputProps {
  departureCity: string;
  destinations: DestInfo[];
  onAdd: (cityName: string) => void;
  onRemove: (index: number) => void;
  onUpdateDays: (index: number, days: number) => void;
  onUpdateTransport: (index: number, transport: TransportType | null) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
}

/**
 * 多目的地输入组件，每个目的地卡片内嵌交通选择器，
 * 清晰标注"从 XX 出发 → 到达 XX"的流向关系。
 */
export function DestinationInput({
  departureCity,
  destinations,
  onAdd,
  onRemove,
  onUpdateDays,
  onUpdateTransport,
  onReorder,
}: DestinationInputProps) {
  const [showSelector, setShowSelector] = useState(false);
  const [removeConfirmIndex, setRemoveConfirmIndex] = useState<number | null>(null);
  const canAdd = destinations.length < MAX_DESTINATIONS;

  const handleDaysChange = useCallback(
    (index: number, delta: number) => {
      const current = destinations[index]?.days ?? 2;
      const next = Math.max(1, Math.min(MAX_DAYS_PER_DESTINATION, current + delta));
      onUpdateDays(index, next);
    },
    [destinations, onUpdateDays],
  );

  const handleCitySelect = useCallback(
    (city: string) => {
      onAdd(city);
      setShowSelector(false);
    },
    [onAdd],
  );

  const handleConfirmRemove = useCallback(() => {
    if (removeConfirmIndex !== null) {
      onRemove(removeConfirmIndex);
      setRemoveConfirmIndex(null);
    }
  }, [removeConfirmIndex, onRemove]);

  const excludeCities = destinations.map((d) => d.cityName);

  /**第一个目的地的来源；后续目的地的来源是前一个目的地 */
  const sourceCity = (index: number): string =>
    index === 0 ? departureCity : (destinations[index - 1]?.cityName ?? '');

  /**最后一个目的地才是"目的地"标签；其余是经停站 */
  const isLast = (index: number): boolean => index === destinations.length - 1;

  return (
    <div className="space-y-3">
      {destinations.length === 0 && departureCity && (
        <p className="text-sm text-muted-foreground">添加你想去的城市</p>
      )}

      <div className="flex flex-col gap-3">
        {destinations.map((dest, index) => {
          const from = sourceCity(index);
          const hasSource = from.length > 0;
          const last = isLast(index);

          return (
            <div
              key={`${dest.cityName}-${index}`}
              className={cn(
                'rounded-xl border bg-card px-4 py-3',
                'shadow-sm transition-shadow hover:shadow-md',
                last && dest.transportTo && dest.transportTo !== 'auto'
                  ? 'border-primary/30'
                  : 'border-border',
              )}
            >
              {/* ── Header: city name + days + remove ── */}
              <div className="flex items-center gap-2">
                {onReorder && (
                  <button
                    className="cursor-grab text-muted-foreground hover:text-foreground flex-shrink-0"
                    draggable
                    onDragEnd={() => {}}
                    type="button"
                    aria-label="拖拽排序"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                )}

                {/* City badge */}
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-sm font-semibold',
                    last ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary',
                  )}
                >
                  {last ? '目的地' : `第${index + 1}站`}
                </span>

                <span className="font-semibold text-sm flex-1">{dest.cityName}</span>

                {/* Days stepper */}
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

                {/* Remove */}
                <button
                  className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex-shrink-0"
                  onClick={() => setRemoveConfirmIndex(index)}
                  type="button"
                  aria-label={`移除${dest.cityName}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </div>

              {/* ── Transport: from → to ── */}
              {hasSource && (
                <div className="mt-2.5 flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                    {from}
                  </span>
                  <ArrowDown className="h-3 w-3 text-muted-foreground shrink-0 rotate-[210deg]" />
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                    {dest.cityName}
                  </span>
                  <div className="flex-1 min-w-0" />
                  <Select
                    value={dest.transportTo ?? 'auto'}
                    onValueChange={(val) => {
                      onUpdateTransport(index, val === 'auto' ? null : (val as TransportType));
                    }}
                  >
                    <SelectTrigger className="h-8 w-[110px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TRANSPORT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {!hasSource && (
                <p className="mt-2 text-xs text-muted-foreground italic">请先设置出发城市</p>
              )}
            </div>
          );
        })}

        {/* Add destination button / CitySelector */}
        {canAdd && !showSelector && (
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1 border-dashed self-start"
            onClick={() => setShowSelector(true)}
            type="button"
          >
            <Plus className="h-3.5 w-3.5" />
            {destinations.length === 0 ? '添加目的地' : '添加下一站'}
          </Button>
        )}

        {showSelector && (
          <div className="inline-flex items-center gap-2">
            <div className="w-44">
              <CitySelector
                value=""
                onChange={handleCitySelect}
                placeholder={destinations.length === 0 ? '想去哪里？' : '添加下一站...'}
                excludeCities={excludeCities}
              />
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-9 px-2"
              onClick={() => setShowSelector(false)}
              type="button"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {destinations.length >= 2 && (
        <p className="text-xs text-muted-foreground">
          共 {destinations.reduce((sum, d) => sum + d.days, 0)} 天
        </p>
      )}

      <ConfirmDialog
        open={removeConfirmIndex !== null}
        onOpenChange={(open) => {
          if (!open) setRemoveConfirmIndex(null);
        }}
        title="移除目的地"
        description={
          removeConfirmIndex !== null
            ? `确定要移除「${destinations[removeConfirmIndex]?.cityName ?? ''}」吗？已填写的信息将丢失。`
            : undefined
        }
        confirmText="移除"
        cancelText="保留"
        variant="destructive"
        onConfirm={handleConfirmRemove}
      />
    </div>
  );
}

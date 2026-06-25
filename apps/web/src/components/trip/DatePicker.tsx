import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TIME_PERIODS } from '@/lib/constants';
import { getTodayStr } from '@/lib/format';
import type { TimePeriod } from '@path-wise/shared';

interface DatePickerProps {
  date: string;
  timePeriod: TimePeriod;
  onDateChange: (date: string) => void;
  onTimePeriodChange: (period: TimePeriod) => void;
  disabled?: boolean;
}

export function DatePicker({
  date,
  timePeriod,
  onDateChange,
  onTimePeriodChange,
  disabled = false,
}: DatePickerProps) {
  const today = getTodayStr();

  const handleDateChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onDateChange(e.target.value);
    },
    [onDateChange],
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
        <div className="flex-1 space-y-1.5">
          <Label className="text-xs text-muted-foreground">出发日期</Label>
          <input
            type="date"
            value={date}
            min={today}
            onChange={handleDateChange}
            disabled={disabled}
            className={cn(
              'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm',
              'ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium',
              'placeholder:text-muted-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          />
        </div>

        <div className="w-full sm:w-[140px] space-y-1.5">
          <Label className="text-xs text-muted-foreground">出发时段</Label>
          <Select value={timePeriod} onValueChange={onTimePeriodChange} disabled={disabled}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIME_PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label} ({p.range})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

import { useCallback, useMemo, useState } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { TIME_PERIODS } from '@/lib/constants';
import { getTodayStr } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { TimePeriod } from '@path-wise/shared';

interface DatePickerProps {
  date: string;
  timePeriod: TimePeriod;
  onDateChange: (date: string) => void;
  onTimePeriodChange: (period: TimePeriod) => void;
  disabled?: boolean;
}

const WEEKDAYS = ['一', '二', '三', '四', '五', '六', '日'];
const MONTHS = [
  '1月',
  '2月',
  '3月',
  '4月',
  '5月',
  '6月',
  '7月',
  '8月',
  '9月',
  '10月',
  '11月',
  '12月',
];

export function DatePicker({
  date,
  timePeriod,
  onDateChange,
  onTimePeriodChange,
  disabled = false,
}: DatePickerProps) {
  const today = getTodayStr();
  const [open, setOpen] = useState(false);

  const selected = useMemo(() => {
    if (!date) return null;
    const d = new Date(date + 'T00:00:00');
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }, [date]);

  const todayParsed = useMemo(() => {
    const d = new Date(today + 'T00:00:00');
    return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
  }, [today]);

  const [viewYear, setViewYear] = useState(selected?.year ?? todayParsed.year);
  const [viewMonth, setViewMonth] = useState(selected?.month ?? todayParsed.month);

  const daysInMonth = useMemo(
    () => new Date(viewYear, viewMonth + 1, 0).getDate(),
    [viewYear, viewMonth],
  );

  const firstDayOfWeek = useMemo(() => {
    const jsDay = new Date(viewYear, viewMonth, 1).getDay();
    return jsDay === 0 ? 6 : jsDay - 1; // Monday = 0
  }, [viewYear, viewMonth]);

  const isPast = useCallback(
    (d: number) => {
      if (viewYear < todayParsed.year) return true;
      if (viewYear === todayParsed.year && viewMonth < todayParsed.month) return true;
      if (viewYear === todayParsed.year && viewMonth === todayParsed.month && d < todayParsed.day)
        return true;
      return false;
    },
    [viewYear, viewMonth, todayParsed],
  );

  const displayText = useMemo(() => {
    if (!selected) return '选择日期';
    const m = selected.month + 1;
    const d = selected.day;
    return `${m}月${d}日`;
  }, [selected]);

  const handleSelect = useCallback(
    (d: number) => {
      if (isPast(d)) return;
      const mm = String(viewMonth + 1).padStart(2, '0');
      const dd = String(d).padStart(2, '0');
      onDateChange(`${viewYear}-${mm}-${dd}`);
      setOpen(false); // close popover on selection
    },
    [viewYear, viewMonth, isPast, onDateChange],
  );

  const prevMonth = useCallback(() => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else setViewMonth((m) => m - 1);
  }, [viewMonth]);

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else setViewMonth((m) => m + 1);
  }, [viewMonth]);

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-3">
        {/* ── Calendar popover trigger ── */}
        <div className="space-y-1" style={{ width: '215px' }}>
          <Label className="text-[11px] text-muted-foreground">出发日期</Label>
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                disabled={disabled}
                className={cn(
                  'w-full justify-start text-left font-normal h-9 px-2.5 text-sm',
                  !date && 'text-muted-foreground',
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5 mr-1 shrink-0 text-muted-foreground" />
                <span className="truncate">{displayText}</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
              <div className="p-2 select-none">
                {/* Month nav */}
                <div className="flex items-center justify-between mb-1 px-0.5">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      prevMonth();
                    }}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted"
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </button>
                  <span className="text-[11px] font-semibold tabular-nums">
                    {viewYear}年{MONTHS[viewMonth]}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      nextMonth();
                    }}
                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted"
                  >
                    <ChevronRight className="h-3 w-3" />
                  </button>
                </div>

                {/* Weekday headers */}
                <div className="grid grid-cols-7 mb-0.5">
                  {WEEKDAYS.map((wd) => (
                    <div
                      key={wd}
                      className="h-6 w-7 flex items-center justify-center text-[10px] text-muted-foreground/70"
                    >
                      {wd}
                    </div>
                  ))}
                </div>

                {/* Day grid */}
                <div className="grid grid-cols-7">
                  {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                    <div key={`e-${i}`} className="h-7 w-7" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const d = i + 1;
                    const past = isPast(d);
                    const sel =
                      selected !== null &&
                      viewYear === selected.year &&
                      viewMonth === selected.month &&
                      d === selected.day;
                    const isTdy =
                      viewYear === todayParsed.year &&
                      viewMonth === todayParsed.month &&
                      d === todayParsed.day;

                    return (
                      <button
                        key={`d-${d}`}
                        type="button"
                        disabled={past}
                        onClick={(e) => {
                          e.preventDefault();
                          handleSelect(d);
                        }}
                        className={cn(
                          'h-7 w-7 rounded-full text-[11px] font-medium flex items-center justify-center',
                          'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          past && 'text-muted-foreground/25 cursor-not-allowed',
                          sel && 'bg-primary text-primary-foreground hover:bg-primary/90',
                          isTdy && !sel && 'border border-primary/50 text-primary',
                          !past && !sel && !isTdy && 'text-foreground',
                        )}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        {/* ── Time period select ── */}
        <div className="space-y-1 shrink-0" style={{ width: '150px' }}>
          <Label className="text-[11px] text-muted-foreground">出发时段</Label>
          <Select value={timePeriod} onValueChange={onTimePeriodChange} disabled={disabled}>
            <SelectTrigger className="h-9 px-2.5 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="start" side="bottom" sideOffset={4}>
              {TIME_PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value} className="text-sm py-1.5">
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

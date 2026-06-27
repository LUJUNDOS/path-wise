import React from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Wallet, Gem, Crown } from 'lucide-react';
import { BUDGET_LEVELS, PACE_LEVELS, ACCOMMODATION_TYPES } from '@/lib/constants';
import type { BudgetLevel, PaceLevel } from '@path-wise/shared';

const BUDGET_ICONS: Record<string, React.ReactNode> = {
  wallet: <Wallet className="h-5 w-5" />,
  gem: <Gem className="h-5 w-5" />,
  crown: <Crown className="h-5 w-5" />,
};

interface PreferencesPanelProps {
  budget: BudgetLevel;
  pace: PaceLevel;
  accommodation: string;
  onBudgetChange: (b: BudgetLevel) => void;
  onPaceChange: (p: PaceLevel) => void;
  onAccommodationChange: (a: string) => void;
}

/**
 * Step 4 — Budget, pace & accommodation only.
 * Interests and dining moved to step 5 (`InterestsDiningPanel`).
 */
export function PreferencesPanel({
  budget,
  pace,
  accommodation,
  onBudgetChange,
  onPaceChange,
  onAccommodationChange,
}: PreferencesPanelProps) {
  return (
    <div className="space-y-3.5">
      {/* Budget + Pace + Accommodation — single-page compact */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">预算等级</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {BUDGET_LEVELS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={cn(
                'rounded-lg border px-2 py-2 text-center text-sm transition-all',
                'flex flex-col items-center gap-1',
                budget === item.value
                  ? 'border-primary bg-primary/10 text-primary font-medium shadow-sm'
                  : 'hover:bg-accent hover:border-border/80',
              )}
              onClick={() => onBudgetChange(item.value)}
            >
              <span
                className={cn(
                  'flex items-center justify-center h-7 w-7 rounded-full',
                  budget === item.value
                    ? 'bg-primary/15 text-primary'
                    : 'bg-primary/10 text-primary/70',
                )}
              >
                {React.cloneElement(BUDGET_ICONS[item.icon] as React.ReactElement, {
                  className: 'h-4 w-4',
                })}
              </span>
              <span className="text-[11px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
        <p className="text-[11px] text-muted-foreground">
          {BUDGET_LEVELS.find((b) => b.value === budget)?.description}
        </p>
      </div>

      {/* Pace — single row grid */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">行程节奏</Label>
        <div className="grid grid-cols-3 gap-1.5">
          {PACE_LEVELS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={cn(
                'rounded-lg border px-2 py-2 text-center text-sm transition-colors',
                pace === item.value
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'hover:bg-accent',
              )}
              onClick={() => onPaceChange(item.value)}
            >
              <span className="text-[11px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Accommodation — compact */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">住宿偏好</Label>
        <div className="grid grid-cols-2 gap-1.5">
          {ACCOMMODATION_TYPES.map((item) => (
            <button
              key={item.value}
              type="button"
              className={cn(
                'rounded-lg border px-2.5 py-1.5 text-center text-sm transition-colors',
                accommodation === item.value
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'hover:bg-accent',
              )}
              onClick={() => onAccommodationChange(item.value)}
            >
              <span className="text-[11px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Also export the full version for backward compatibility.
 */
export { BUDGET_ICONS };

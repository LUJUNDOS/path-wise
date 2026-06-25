import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Wallet, Gem, Crown } from 'lucide-react';
import {
  BUDGET_LEVELS,
  PACE_LEVELS,
  ACCOMMODATION_TYPES,
  INTEREST_TAGS,
  DINING_PREFERENCES,
  MAX_INTERESTS,
} from '@/lib/constants';
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
  interests: string[];
  dining: string[];
  onBudgetChange: (b: BudgetLevel) => void;
  onPaceChange: (p: PaceLevel) => void;
  onAccommodationChange: (a: string) => void;
  onInterestsChange: (interests: string[]) => void;
  onDiningChange: (dining: string[]) => void;
}

export function PreferencesPanel({
  budget,
  pace,
  accommodation,
  interests,
  dining,
  onBudgetChange,
  onPaceChange,
  onAccommodationChange,
  onInterestsChange,
  onDiningChange,
}: PreferencesPanelProps) {
  const toggleInterest = useCallback(
    (tag: string) => {
      if (interests.includes(tag)) {
        onInterestsChange(interests.filter((t) => t !== tag));
      } else if (interests.length < MAX_INTERESTS) {
        onInterestsChange([...interests, tag]);
      }
    },
    [interests, onInterestsChange],
  );

  const toggleDining = useCallback(
    (option: string) => {
      if (dining.includes(option)) {
        onDiningChange(dining.filter((d) => d !== option));
      } else {
        onDiningChange([...dining, option]);
      }
    },
    [dining, onDiningChange],
  );

  const budgetLabel = BUDGET_LEVELS.find((b) => b.value === budget)?.label ?? budget;
  const paceLabel = PACE_LEVELS.find((p) => p.value === pace)?.label ?? pace;
  const interestSummary = interests.length > 0 ? interests.join(',') : '无';

  return (
    <div className="space-y-6">
      {/* Budget */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">预算等级</Label>
        <div className="grid grid-cols-3 gap-2">
          {BUDGET_LEVELS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={cn(
                'rounded-xl border px-3 py-3 text-center text-sm transition-all',
                'flex flex-col items-center gap-2',
                budget === item.value
                  ? 'border-primary bg-primary/10 text-primary font-medium shadow-sm'
                  : 'hover:bg-accent hover:border-border/80',
              )}
              onClick={() => onBudgetChange(item.value)}
            >
              <span
                className={cn(
                  'flex items-center justify-center h-9 w-9 rounded-full',
                  budget === item.value
                    ? 'bg-primary/15 text-primary'
                    : 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
                )}
              >
                {BUDGET_ICONS[item.icon]}
              </span>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {BUDGET_LEVELS.find((b) => b.value === budget)?.description}
        </p>
      </div>

      {/* Pace */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">行程节奏</Label>
        <div className="flex flex-col gap-2">
          {PACE_LEVELS.map((item) => (
            <button
              key={item.value}
              type="button"
              className={cn(
                'rounded-lg border px-4 py-3 text-left text-sm transition-colors',
                pace === item.value
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'hover:bg-accent',
              )}
              onClick={() => onPaceChange(item.value)}
            >
              <span className="font-medium">{item.label}</span>
              <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Accommodation */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">住宿偏好</Label>
        <div className="grid grid-cols-2 gap-2">
          {ACCOMMODATION_TYPES.map((item) => (
            <button
              key={item.value}
              type="button"
              className={cn(
                'rounded-lg border px-3 py-2 text-center text-sm transition-colors',
                accommodation === item.value
                  ? 'border-primary bg-primary/10 text-primary font-medium'
                  : 'hover:bg-accent',
              )}
              onClick={() => onAccommodationChange(item.value)}
            >
              <span className="block font-medium">{item.label}</span>
              <span className="block text-xs text-muted-foreground mt-0.5">{item.description}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Interests */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">
          兴趣标签（最多{MAX_INTERESTS}个）
        </Label>
        <div className="flex flex-wrap gap-2">
          {INTEREST_TAGS.map((tag) => {
            const isSelected = interests.includes(tag);
            const isDisabled = !isSelected && interests.length >= MAX_INTERESTS;
            return (
              <button
                key={tag}
                type="button"
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors border',
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : isDisabled
                      ? 'opacity-40 cursor-not-allowed border-border'
                      : 'hover:bg-accent border-border',
                )}
                onClick={() => toggleInterest(tag)}
                disabled={isDisabled}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Dining */}
      <div className="space-y-2">
        <Label className="text-xs font-medium text-muted-foreground">饮食偏好</Label>
        <div className="flex flex-wrap gap-2">
          {DINING_PREFERENCES.map((option) => {
            const isSelected = dining.includes(option);
            return (
              <button
                key={option}
                type="button"
                className={cn(
                  'rounded-full px-3 py-1 text-xs font-medium transition-colors border',
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'hover:bg-accent border-border',
                )}
                onClick={() => toggleDining(option)}
              >
                {isSelected ? '✓ ' : ''}
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary (shown when collapsed) */}
      <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        预算：{budgetLabel}　节奏：{paceLabel}　兴趣：{interestSummary}
      </div>
    </div>
  );
}

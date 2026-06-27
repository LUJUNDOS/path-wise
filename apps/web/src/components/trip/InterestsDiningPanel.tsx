import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { INTEREST_TAGS, DINING_PREFERENCES, MAX_INTERESTS } from '@/lib/constants';

interface InterestsDiningPanelProps {
  interests: string[];
  dining: string[];
  onInterestsChange: (interests: string[]) => void;
  onDiningChange: (dining: string[]) => void;
}

/**
 * Step 5 — Interest tags & dining preferences.
 * Split from the main PreferencesPanel to reduce scrolling.
 */
export function InterestsDiningPanel({
  interests,
  dining,
  onInterestsChange,
  onDiningChange,
}: InterestsDiningPanelProps) {
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

  return (
    <div className="space-y-6">
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
                  'rounded-full px-3 py-1.5 text-sm font-medium transition-colors border',
                  isSelected
                    ? 'bg-primary text-primary-foreground border-primary'
                    : isDisabled
                      ? 'opacity-40 cursor-not-allowed border-border'
                      : 'hover:bg-accent border-border',
                )}
                onClick={() => toggleInterest(tag)}
                disabled={isDisabled}
              >
                {isSelected ? '✓ ' : ''}
                {tag}
              </button>
            );
          })}
        </div>
        {interests.length === 0 && (
          <p className="text-xs text-muted-foreground">选择你感兴趣的旅行主题</p>
        )}
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
                  'rounded-full px-3 py-1.5 text-sm font-medium transition-colors border',
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
        {dining.length === 0 && (
          <p className="text-xs text-muted-foreground">选择你喜欢的饮食风格</p>
        )}
      </div>

      {/* Summary */}
      <div className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
        兴趣：{interests.length > 0 ? interests.join('、') : '无'}
        {'　·　'}
        饮食：{dining.length > 0 ? dining.join('、') : '无'}
      </div>
    </div>
  );
}

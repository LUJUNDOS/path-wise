import { useCallback, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface TravelerCounterProps {
  adults: number;
  children: { age: number }[];
  elders: number;
  onAdultsChange: (count: number) => void;
  onChildrenChange: (children: { age: number }[]) => void;
  onEldersChange: (count: number) => void;
  disabled?: boolean;
}

const CHILD_AGE_GROUPS: { label: string; age: number }[] = [
  { label: '<3岁', age: 2 },
  { label: '3~6岁', age: 4 },
  { label: '7~12岁', age: 10 },
];

function Counter({
  label,
  value,
  min = 0,
  max = 10,
  onChange,
  disabled = false,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-3 py-2">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 rounded-full"
          onClick={() => onChange(value - 1)}
          disabled={disabled || value <= min}
          type="button"
        >
          <Minus className="h-3 w-3" />
        </Button>
        <span className="w-6 text-center text-sm font-mono">{value}</span>
        <Button
          variant="outline"
          size="icon"
          className="h-7 w-7 rounded-full"
          onClick={() => onChange(value + 1)}
          disabled={disabled || value >= max}
          type="button"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function TravelerCounter({
  adults,
  children,
  elders,
  onAdultsChange,
  onChildrenChange,
  onEldersChange,
  disabled = false,
}: TravelerCounterProps) {
  const [showChildAge, setShowChildAge] = useState(children.length > 0);

  const handleChildCountChange = useCallback(
    (count: number) => {
      if (count <= 0) {
        onChildrenChange([]);
        setShowChildAge(false);
        return;
      }
      if (count > children.length) {
        onChildrenChange([...children, { age: 4 }]);
      } else {
        onChildrenChange(children.slice(0, count));
      }
      setShowChildAge(true);
    },
    [children, onChildrenChange],
  );

  const handleChildAgeChange = useCallback(
    (childIndex: number, age: number) => {
      const updated = children.map((c, i) => (i === childIndex ? { ...c, age } : c));
      onChildrenChange(updated);
    },
    [children, onChildrenChange],
  );

  return (
    <div className="space-y-3">
      <Counter
        label="成人"
        value={adults}
        min={1}
        max={10}
        onChange={onAdultsChange}
        disabled={disabled}
      />
      <Counter
        label="儿童"
        value={children.length}
        max={10}
        onChange={handleChildCountChange}
        disabled={disabled}
      />
      {showChildAge && children.length > 0 && (
        <div className="space-y-2 pl-4">
          <Label className="text-xs text-muted-foreground">儿童年龄</Label>
          <div className="flex flex-wrap gap-2">
            {children.map((child, index) => (
              <div key={index} className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">#{index + 1}</span>
                <div className="flex rounded-md border overflow-hidden">
                  {CHILD_AGE_GROUPS.map((group) => (
                    <button
                      key={group.age}
                      type="button"
                      className={cn(
                        'px-2 py-1 text-xs transition-colors',
                        child.age === group.age
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-accent',
                      )}
                      onClick={() => handleChildAgeChange(index, group.age)}
                    >
                      {group.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <Counter
        label="老人"
        value={elders}
        max={10}
        onChange={onEldersChange}
        disabled={disabled}
      />
    </div>
  );
}

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { POPULAR_CITIES } from '@/lib/constants';
import { getRecentCities, saveRecentCity } from '@/lib/storage';

interface CitySelectorProps {
  value: string;
  onChange: (city: string) => void;
  placeholder?: string;
  disabled?: boolean;
  excludeCities?: string[];
}

const HOT_CITIES = POPULAR_CITIES.slice(0, 8);

export function CitySelector({
  value,
  onChange,
  placeholder = '选择城市...',
  disabled = false,
  excludeCities = [],
}: CitySelectorProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const triggerRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  const recentCities = useMemo(() => getRecentCities(), []);

  const availableCities = useMemo(() => {
    const excludeSet = new Set(excludeCities);
    return POPULAR_CITIES.filter((c) => !excludeSet.has(c));
  }, [excludeCities]);

  const filteredCities = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return availableCities.filter((c) => c.toLowerCase().includes(q) || c === search);
  }, [search, availableCities]);

  // Calculate dropdown position relative to viewport
  const recalcPosition = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, []);

  useEffect(() => {
    if (open) {
      recalcPosition();
      window.addEventListener('scroll', recalcPosition, true);
      window.addEventListener('resize', recalcPosition);
    }
    return () => {
      window.removeEventListener('scroll', recalcPosition, true);
      window.removeEventListener('resize', recalcPosition);
    };
  }, [open, recalcPosition]);

  const handleSelect = useCallback(
    (city: string) => {
      onChange(city);
      saveRecentCity(city);
      setSearch('');
      setOpen(false);
    },
    [onChange],
  );

  const handleClear = useCallback(() => {
    onChange('');
    setOpen(true);
  }, [onChange]);

  const dropdown = open && !disabled && (
    <div className="fixed inset-0 z-[9998]" onClick={() => setOpen(false)}>
      <div
        className="absolute z-[9999] rounded-xl border bg-popover shadow-modal animate-fade-in"
        style={{
          top: dropdownPos.top,
          left: dropdownPos.left,
          width: dropdownPos.width,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-3">
          {!value && (
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="输入城市名搜索..."
              className="mb-3"
              autoFocus
            />
          )}

          {search.trim() && filteredCities.length > 0 && (
            <ScrollArea className="max-h-[200px]">
              <div className="space-y-1">
                {filteredCities.map((city) => (
                  <button
                    key={city}
                    className={cn(
                      'w-full rounded-md px-3 py-2 text-left text-sm',
                      'hover:bg-accent hover:text-accent-foreground',
                      'transition-colors',
                    )}
                    onClick={() => handleSelect(city)}
                    type="button"
                  >
                    {city}
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          {!search.trim() && (
            <>
              {recentCities.length > 0 && (
                <div className="mb-3">
                  <p className="mb-2 text-xs text-muted-foreground">最近选择</p>
                  <div className="flex flex-wrap gap-1.5">
                    {recentCities.map((city) => (
                      <Badge
                        key={city}
                        variant="secondary"
                        className="cursor-pointer hover:bg-accent"
                        onClick={() => handleSelect(city)}
                      >
                        {city}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <p className="mb-2 text-xs text-muted-foreground">热门城市</p>
                <div className="flex flex-wrap gap-1.5">
                  {HOT_CITIES.map((city) => (
                    <Badge
                      key={city}
                      variant="outline"
                      className="cursor-pointer hover:bg-accent"
                      onClick={() => handleSelect(city)}
                    >
                      {city}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          {search.trim() && filteredCities.length === 0 && (
            <p className="py-4 text-center text-sm text-muted-foreground">
              该城市暂不支持，我们正在努力扩展中...
            </p>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className="relative" ref={triggerRef}>
        <div className="relative">
          {value ? (
            <div
              className={cn(
                'flex h-10 w-full items-center rounded-md border border-input bg-background px-3 py-2',
                'text-sm cursor-pointer',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
              onClick={() => !disabled && setOpen(!open)}
              onKeyDown={(e) => e.key === 'Enter' && !disabled && setOpen(!open)}
              tabIndex={0}
              role="combobox"
              aria-expanded={open}
            >
              <span className="flex-1 font-medium">{value}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClear();
                }}
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => {
                  recalcPosition();
                  setOpen(true);
                }}
                onBlur={() => {
                  // delay close so click on dropdown works
                  setTimeout(() => {
                    const trimmed = search.trim();
                    if (trimmed && !POPULAR_CITIES.includes(trimmed as never)) {
                      setSearch('');
                    }
                  }, 150);
                }}
                placeholder={placeholder}
                disabled={disabled}
                className="pl-9"
              />
            </div>
          )}
        </div>
      </div>

      {dropdown && createPortal(dropdown, document.body)}
    </>
  );
}

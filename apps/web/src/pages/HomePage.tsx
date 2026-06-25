import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { MapPin, Target, Calendar, Users, Settings, Rocket, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTripFormStore } from '@/stores/tripFormStore';
import { CitySelector } from '@/components/trip/CitySelector';
import { DestinationInput } from '@/components/trip/DestinationInput';
import { DatePicker } from '@/components/trip/DatePicker';
import { TravelerCounter } from '@/components/trip/TravelerCounter';
import { PreferencesPanel } from '@/components/trip/PreferencesPanel';
import { ConflictWarningModal } from '@/components/trip/ConflictWarningModal';
import { apiClient, ApiError } from '@/lib/apiClient';
import { validateHomeForm } from '@/lib/validation';
import { cn } from '@/lib/utils';
import type { TripConflict, TripValidationResponse } from '@path-wise/shared';

export default function HomePage() {
  const navigate = useNavigate();
  const store = useTripFormStore();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConflict, setShowConflict] = useState(false);
  const [conflicts, setConflicts] = useState<TripConflict[]>([]);

  const validateMutation = useMutation({
    mutationFn: async () => {
      const rawResponse = await apiClient.post<TripValidationResponse>('/trips/validate', {
        departure: {
          city: store.departureCity,
          date: store.departureDate,
          timePeriod: store.timePeriod,
        },
        destinations: store.destinations,
        travelers: store.travelers,
        preferences: store.preferences,
      });
      // apiClient 返回 ApiResponse<TripValidationResponse>，提取 data
      return rawResponse.data;
    },
  });

  const handleGenerate = useCallback(async () => {
    const allErrors: Record<string, string> = {};
    const validationErrors = validateHomeForm({
      departureCity: store.departureCity,
      destinations: store.destinations,
      departureDate: store.departureDate,
      adults: store.travelers.adults,
    });

    validationErrors.forEach((e) => {
      allErrors[e.field] = e.message;
    });
    setErrors(allErrors);

    if (Object.keys(allErrors).length > 0) {
      const firstField = validationErrors[0]?.field ?? '';
      const el = document.querySelector(`[data-field="${firstField}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    try {
      const data = await validateMutation.mutateAsync();

      if (data.conflicts && data.conflicts.length > 0) {
        setConflicts(data.conflicts);
        setShowConflict(true);
      } else {
        navigate('/generating');
      }
    } catch (err: unknown) {
      const message = err instanceof ApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : '请求失败，请稍后重试';
      setErrors({ submit: message });
    }
  }, [store, navigate, validateMutation]);

  const handleForceGenerate = useCallback(() => {
    setShowConflict(false);
    navigate('/generating');
  }, [navigate]);

  const handleResolveConflict = useCallback(
    (_index: number, action: string, value: string) => {
      switch (action) {
        case 'adjust_budget':
          store.setBudget(value as never);
          break;
        case 'adjust_pace':
          store.setPace(value as never);
          break;
        case 'adjust_accommodation':
          store.setAccommodation(value);
          break;
        default:
          break;
      }
    },
    [store],
  );

  const totalDays = useMemo(
    () => store.destinations.reduce((sum, d) => sum + d.days, 0),
    [store.destinations],
  );

  const hasPreferences =
    store.preferences.budget !== 'comfort' ||
    store.preferences.pace !== 'moderate' ||
    store.preferences.accommodation !== 'chain_hotel' ||
    store.preferences.interests.length > 0 ||
    store.preferences.dining.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            <span className="font-bold text-lg">PATH-WISE</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
            我的攻略
          </Button>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-6 space-y-8">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">生成你的专属旅行攻略</h1>
          <p className="text-sm text-muted-foreground">
            AI 驱动，智能规划，让每次出行都从容不迫
          </p>
        </div>

        {/* Section 1: Departure City (FE-002) */}
        <section data-field="departureCity" className="space-y-2">
          <Label className="flex items-center gap-1.5 text-base font-semibold">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            从哪里出发
          </Label>
          <CitySelector
            value={store.departureCity}
            onChange={store.setDepartureCity}
            placeholder="选择出发城市..."
          />
          {errors['departureCity'] && (
            <p className="text-xs text-destructive">{errors['departureCity']}</p>
          )}
        </section>

        {/* Section 2: Destinations (FE-003) */}
        <section data-field="destinations" className="space-y-2">
          <Label className="flex items-center gap-1.5 text-base font-semibold">
            <Target className="h-4 w-4 text-muted-foreground" />
            要去哪里
          </Label>
          <DestinationInput
            destinations={store.destinations.map((d) => ({
              cityName: d.cityName,
              days: d.days,
            }))}
            onAdd={() => {}}
            onRemove={store.removeDestination}
            onUpdateDays={store.updateDestinationDays}
          />
          {store.destinations.length > 0 && (
            <p className="text-xs text-muted-foreground">
              共 {totalDays} 天
              {store.destinations.length >= 2 && '（含中转日）'}
            </p>
          )}
          {errors['destinations'] && (
            <p className="text-xs text-destructive">{errors['destinations']}</p>
          )}
        </section>

        {/* Section 3: Departure Date (FE-004) */}
        <section data-field="departureDate" className="space-y-2">
          <Label className="flex items-center gap-1.5 text-base font-semibold">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            什么时候出发
          </Label>
          <DatePicker
            date={store.departureDate}
            timePeriod={store.timePeriod}
            onDateChange={store.setDepartureDate}
            onTimePeriodChange={store.setTimePeriod}
          />
          {errors['departureDate'] && (
            <p className="text-xs text-destructive">{errors['departureDate']}</p>
          )}
        </section>

        {/* Section 4: Travelers (FE-005) */}
        <section data-field="adults" className="space-y-2">
          <Label className="flex items-center gap-1.5 text-base font-semibold">
            <Users className="h-4 w-4 text-muted-foreground" />
            和谁一起去
          </Label>
          <TravelerCounter
            adults={store.travelers.adults}
            children={store.travelers.children}
            elders={store.travelers.elders}
            onAdultsChange={store.setAdults}
            onChildrenChange={store.setChildren}
            onEldersChange={store.setElders}
          />
          {errors['adults'] && (
            <p className="text-xs text-destructive">{errors['adults']}</p>
          )}
        </section>

        {/* Section 5: Preferences (FE-006) */}
        <section className="space-y-2">
          <button
            className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors hover:bg-accent"
            onClick={store.togglePreferences}
            type="button"
          >
            <span className="flex items-center gap-2 text-base font-semibold">
              <Settings className="h-4 w-4 text-muted-foreground" />
              {hasPreferences ? '更多偏好设置' : '展开更多偏好设置'}
            </span>
            {store.showPreferences ? (
              <ChevronUp className="h-5 w-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-5 w-5 text-muted-foreground" />
            )}
          </button>

          <div
            className={cn(
              'grid transition-all duration-300',
              store.showPreferences ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="overflow-hidden">
              <div className={cn('rounded-lg border bg-card px-4 py-4')}>
                <PreferencesPanel
                  budget={store.preferences.budget}
                  pace={store.preferences.pace}
                  accommodation={store.preferences.accommodation}
                  interests={store.preferences.interests}
                  dining={store.preferences.dining}
                  onBudgetChange={store.setBudget}
                  onPaceChange={store.setPace}
                  onAccommodationChange={store.setAccommodation}
                  onInterestsChange={store.setInterests}
                  onDiningChange={store.setDining}
                />
              </div>
            </div>
          </div>
        </section>

        {/* Submit */}
        <section className="pb-8">
          {errors['submit'] && (
            <p className="mb-2 text-sm text-destructive text-center">{errors['submit']}</p>
          )}
          <Button
            size="xl"
            className="w-full gap-2 text-base font-semibold"
            onClick={handleGenerate}
            disabled={validateMutation.isPending}
          >
            <Rocket className="h-5 w-5" />
            {validateMutation.isPending ? '正在检查...' : '生成我的攻略'}
          </Button>
        </section>
      </main>

      <ConflictWarningModal
        open={showConflict}
        conflicts={conflicts}
        onForceGenerate={handleForceGenerate}
        onBackToEdit={() => setShowConflict(false)}
        onResolveConflict={handleResolveConflict}
      />
    </div>
  );
}

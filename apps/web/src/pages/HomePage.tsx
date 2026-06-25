import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  MapPin,
  Target,
  Calendar,
  Users,
  Settings,
  Rocket,
  ChevronDown,
  ChevronUp,
  Compass,
  ArrowLeftRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTripFormStore } from '@/stores/tripFormStore';
import { CitySelector } from '@/components/trip/CitySelector';
import { DestinationInput } from '@/components/trip/DestinationInput';
import { DatePicker } from '@/components/trip/DatePicker';
import { TravelerCounter } from '@/components/trip/TravelerCounter';
import { PreferencesPanel } from '@/components/trip/PreferencesPanel';
import { ConflictWarningModal } from '@/components/trip/ConflictWarningModal';
import { PageHeader } from '@/components/common/PageHeader';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { apiClient, ApiError } from '@/lib/apiClient';
import { TRANSPORT_OPTIONS } from '@/lib/constants';
import { validateHomeForm } from '@/lib/validation';
import { cn } from '@/lib/utils';
import type { TripConflict, TripValidationResponse } from '@path-wise/shared';

/* ── Splash animation timeline (ms from mount) ──
   0      Splash: gradient background fades in
   200    Compass logo mark scales up (0.3→1, 1s spring)
   900    Tagline "探索世界，从这里出发" fades in
   1800   Brand name "PATH–WISE" reveals with glow
   3000   Splash fades out, form card slides in
   3300+  Sections stagger in (120ms each × 6)
── */

export default function HomePage() {
  const navigate = useNavigate();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConflict, setShowConflict] = useState(false);
  const [conflicts, setConflicts] = useState<TripConflict[]>([]);

  // Splash sequencing
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => setPhase(3), 1800),
      setTimeout(() => setPhase(4), 3000),
      ...Array.from({ length: 7 }, (_, i) => setTimeout(() => setPhase(5 + i), 3300 + i * 120)),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // ── Form logic: always read fresh from Zustand store ──
  const validateMutation = useMutation({
    mutationFn: async () => {
      const s = useTripFormStore.getState();
      const rawResponse = await apiClient.post<TripValidationResponse>('/trips/validate', {
        departure: { city: s.departureCity, date: s.departureDate, timePeriod: s.timePeriod },
        destinations: s.destinations,
        travelers: s.travelers,
        preferences: s.preferences,
      });
      return rawResponse.data;
    },
  });

  const handleGenerate = useCallback(async () => {
    const s = useTripFormStore.getState();

    // Local validation
    const allErrors: Record<string, string> = {};
    const validationErrors = validateHomeForm({
      departureCity: s.departureCity,
      destinations: s.destinations,
      departureDate: s.departureDate,
      adults: s.travelers.adults,
    });
    validationErrors.forEach((e) => {
      allErrors[e.field] = e.message;
    });
    setErrors(allErrors);

    if (Object.keys(allErrors).length > 0) {
      const firstField = validationErrors[0]?.field ?? '';
      document
        .querySelector(`[data-field="${firstField}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    try {
      const data = await validateMutation.mutateAsync();
      if (data.conflicts?.length) {
        setConflicts(data.conflicts);
        setShowConflict(true);
      } else {
        navigate('/generating');
      }
    } catch (err: unknown) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : '请求失败，请稍后重试';
      setErrors({ submit: message });
    }
  }, [navigate, validateMutation]);

  const handleForceGenerate = useCallback(() => {
    setShowConflict(false);
    navigate('/generating');
  }, [navigate]);

  const handleResolveConflict = useCallback((_index: number, action: string, value: string) => {
    const s = useTripFormStore.getState();
    switch (action) {
      case 'adjust_budget':
        s.setBudget(value as never);
        break;
      case 'adjust_pace':
        s.setPace(value as never);
        break;
      case 'adjust_accommodation':
        s.setAccommodation(value);
        break;
    }
  }, []);

  const destinations = useTripFormStore((s) => s.destinations);
  const departureCity = useTripFormStore((s) => s.departureCity);
  const departureDate = useTripFormStore((s) => s.departureDate);
  const timePeriod = useTripFormStore((s) => s.timePeriod);
  const travelers = useTripFormStore((s) => s.travelers);
  const preferences = useTripFormStore((s) => s.preferences);
  const showPreferences = useTripFormStore((s) => s.showPreferences);
  const setDepartureCity = useTripFormStore((s) => s.setDepartureCity);
  const addDestination = useTripFormStore((s) => s.addDestination);
  const removeDestination = useTripFormStore((s) => s.removeDestination);
  const updateDestinationDays = useTripFormStore((s) => s.updateDestinationDays);
  const updateDestinationTransport = useTripFormStore((s) => s.updateDestinationTransport);
  const setDepartureDate = useTripFormStore((s) => s.setDepartureDate);
  const setTimePeriod = useTripFormStore((s) => s.setTimePeriod);
  const setAdults = useTripFormStore((s) => s.setAdults);
  const setChildren = useTripFormStore((s) => s.setChildren);
  const setElders = useTripFormStore((s) => s.setElders);
  const setBudget = useTripFormStore((s) => s.setBudget);
  const setPace = useTripFormStore((s) => s.setPace);
  const setAccommodation = useTripFormStore((s) => s.setAccommodation);
  const setInterests = useTripFormStore((s) => s.setInterests);
  const setDining = useTripFormStore((s) => s.setDining);
  const togglePreferences = useTripFormStore((s) => s.togglePreferences);
  const needsReturnTransport = useTripFormStore((s) => s.needsReturnTransport);
  const returnTransportPref = useTripFormStore((s) => s.returnTransportPref);
  const setNeedsReturnTransport = useTripFormStore((s) => s.setNeedsReturnTransport);
  const setReturnTransportPref = useTripFormStore((s) => s.setReturnTransportPref);

  const totalDays = useMemo(() => destinations.reduce((sum, d) => sum + d.days, 0), [destinations]);

  const hasPreferences =
    preferences.budget !== 'comfort' ||
    preferences.pace !== 'moderate' ||
    preferences.accommodation !== 'chain_hotel' ||
    preferences.interests.length > 0 ||
    preferences.dining.length > 0;

  const secStyle = (p: number) => ({
    opacity: phase >= p ? 1 : 0,
    transform: phase >= p ? 'translateY(0)' : 'translateY(16px)',
    transition: 'all 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)',
  });

  return (
    <div className="min-h-screen bg-background relative">
      {/* ══════════════════════════════════════════════
          SPLASH SCREEN
          ══════════════════════════════════════════════ */}
      <div
        className={cn(
          'fixed inset-0 z-50 flex flex-col items-center justify-center',
          'bg-hero texture-paper overflow-hidden',
          'transition-all',
          phase >= 4 ? 'opacity-0 pointer-events-none' : 'opacity-100',
        )}
        style={{ transitionDuration: '800ms', transitionTimingFunction: 'ease-in-out' }}
      >
        {/* Ambient glow orbs — slow float */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-amber-300/15 blur-[120px] pointer-events-none animate-orb-float" />
        <div className="absolute top-1/3 -left-20 w-80 h-80 rounded-full bg-white/8 blur-3xl pointer-events-none animate-orb-float-delayed" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full bg-orange-400/10 blur-3xl pointer-events-none animate-orb-float-slow" />

        {/* Logo mark — phase 1 (slow scale 0.3→1) */}
        <div
          className="transition-all mb-10"
          style={{
            transitionDuration: '1000ms',
            transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
            opacity: phase >= 1 ? 1 : 0,
            transform: `scale(${phase >= 1 ? 1 : 0.3})`,
          }}
        >
          <div className="relative">
            <div
              className={cn(
                'absolute -inset-6 rounded-full bg-white/15 blur-xl',
                phase >= 1 && 'animate-glow-pulse',
              )}
            />
            <div
              className={cn(
                'absolute -inset-2 rounded-full bg-amber-300/20 blur-md',
                phase >= 1 && 'animate-glow-pulse',
              )}
              style={{ animationDelay: '0.4s' }}
            />
            <div className="relative flex items-center justify-center h-28 w-28 rounded-full bg-white/12 backdrop-blur border-2 border-white/25 shadow-2xl">
              <Compass className="h-14 w-14 text-white" strokeWidth={1.2} />
            </div>
          </div>
        </div>

        {/* Tagline — phase 2 (larger font) */}
        <p
          className="text-white/85 text-2xl md:text-3xl lg:text-4xl font-light tracking-[0.25em] uppercase mb-6 transition-all"
          style={{
            transitionDuration: '800ms',
            transitionTimingFunction: 'ease-out',
            opacity: phase >= 2 ? 1 : 0,
            transform: `translateY(${phase >= 2 ? 0 : 20}px)`,
          }}
        >
          探索世界，从这里出发
        </p>

        {/* Brand name — phase 3 (slightly smaller) */}
        <h1
          className="editorial-title text-white text-4xl md:text-5xl lg:text-6xl transition-all"
          style={{
            transitionDuration: '900ms',
            transitionTimingFunction: 'ease-out',
            opacity: phase >= 3 ? 1 : 0,
            transform: `translateY(${phase >= 3 ? 0 : 24}px)`,
            textShadow:
              phase >= 3
                ? '0 0 80px rgba(255,255,255,0.25), 0 0 160px rgba(251,191,36,0.15)'
                : 'none',
          }}
        >
          PATH–WISE
        </h1>

        {/* Loading line */}
        <div
          className="absolute bottom-16 left-1/2 -translate-x-1/2 transition-all duration-500"
          style={{ opacity: phase < 4 ? 1 : 0 }}
        >
          <div className="h-0.5 w-40 bg-white/15 rounded-full overflow-hidden">
            <div
              className="h-full bg-white/40 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, phase * 33)}%` }}
            />
          </div>
        </div>
      </div>

      {/* ════════════════════════════════════════
          PAGE CONTENT (below splash)
          ════════════════════════════════════════ */}
      <PageHeader
        className={cn(
          'z-40 transition-opacity duration-500',
          phase >= 4 ? 'opacity-100' : 'opacity-0',
        )}
        left={
          <>
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-hero shadow-sm">
              <Compass className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="editorial-title text-lg">PATH–WISE</span>
          </>
        }
        right={
          <>
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>
              我的攻略
            </Button>
          </>
        }
      />

      {/* Hero bar */}
      <section
        className={cn(
          'relative overflow-hidden bg-hero texture-paper transition-all duration-700 ease-out pt-4 pb-20',
          phase >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0',
        )}
      >
        <div className="absolute -top-16 -right-24 w-96 h-96 rounded-full bg-white/8 blur-3xl pointer-events-none" />
        <div className="relative z-10 container mx-auto max-w-2xl px-4 pt-6 text-center">
          <p
            className="text-white/70 text-sm tracking-[0.25em] uppercase mb-2 transition-all duration-500 delay-100"
            style={secStyle(4)}
          >
            AI-Powered Travel Planning
          </p>
          <p
            className="text-white/60 text-sm transition-all duration-500 delay-150"
            style={secStyle(4)}
          >
            智能规划每一段旅程，让每次出行都从容而精彩
          </p>
        </div>
      </section>

      {/* Form Card */}
      <main className="container mx-auto max-w-2xl px-4 -mt-14 relative z-20 pb-12">
        <div
          className={cn(
            'rounded-2xl bg-card-glass border border-white/20 shadow-modal p-6 md:p-8 space-y-7',
            'transition-all duration-600 ease-out',
          )}
          style={{
            opacity: phase >= 4 ? 1 : 0,
            transform: phase >= 4 ? 'translateY(0)' : 'translateY(24px)',
          }}
        >
          {/* Section 1: Departure */}
          <section data-field="departureCity" className="space-y-2.5" style={secStyle(5)}>
            <Label className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-amber-50 dark:bg-amber-900/20">
                <MapPin className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
              </span>
              从哪里出发
            </Label>
            <CitySelector
              value={departureCity}
              onChange={setDepartureCity}
              placeholder="选择出发城市..."
            />
            {errors['departureCity'] && (
              <p className="text-xs text-destructive">{errors['departureCity']}</p>
            )}
          </section>

          {/* Section 2: Destinations (transport embedded per card) */}
          <section data-field="destinations" className="space-y-2.5" style={secStyle(6)}>
            <Label className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-teal-50 dark:bg-teal-900/20">
                <Target className="h-3.5 w-3.5 text-teal-600 dark:text-teal-400" />
              </span>
              要去哪里
            </Label>
            <DestinationInput
              departureCity={departureCity}
              destinations={destinations.map((d) => ({
                cityName: d.cityName,
                days: d.days,
                transportTo: d.transportTo,
              }))}
              onAdd={addDestination}
              onRemove={removeDestination}
              onUpdateDays={updateDestinationDays}
              onUpdateTransport={(index, transport) => updateDestinationTransport(index, transport)}
            />
            {destinations.length > 0 && (
              <p className="text-xs text-muted-foreground">
                共 {totalDays} 天{destinations.length >= 2 && '（含中转日）'}
              </p>
            )}
            {errors['destinations'] && (
              <p className="text-xs text-destructive">{errors['destinations']}</p>
            )}
          </section>

          {/* Section 3: Date */}
          <section data-field="departureDate" className="space-y-2.5" style={secStyle(7)}>
            <Label className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-purple-50 dark:bg-purple-900/20">
                <Calendar className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
              </span>
              什么时候出发
            </Label>
            <DatePicker
              date={departureDate}
              timePeriod={timePeriod}
              onDateChange={setDepartureDate}
              onTimePeriodChange={setTimePeriod}
            />
            {errors['departureDate'] && (
              <p className="text-xs text-destructive">{errors['departureDate']}</p>
            )}
          </section>

          {/* Section 4: Travelers */}
          <section data-field="adults" className="space-y-2.5" style={secStyle(8)}>
            <Label className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-blue-50 dark:bg-blue-900/20">
                <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              </span>
              和谁一起去
            </Label>
            <TravelerCounter
              adults={travelers.adults}
              children={travelers.children}
              elders={travelers.elders}
              onAdultsChange={setAdults}
              onChildrenChange={setChildren}
              onEldersChange={setElders}
            />
            {errors['adults'] && <p className="text-xs text-destructive">{errors['adults']}</p>}
          </section>

          {/* Section 5: Return Transport */}
          <section className="space-y-2.5" style={secStyle(9)}>
            <Label className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span className="flex items-center justify-center h-7 w-7 rounded-full bg-indigo-50 dark:bg-indigo-900/20">
                <ArrowLeftRight className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              </span>
              返程交通
            </Label>

            {destinations.length > 0 ? (
              <>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={needsReturnTransport}
                    onChange={(e) => setNeedsReturnTransport(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
                  />
                  <span className="text-sm">
                    预定返程票
                    <span className="text-xs text-muted-foreground ml-1.5">
                      （{destinations[destinations.length - 1]?.cityName} → {departureCity}）
                    </span>
                  </span>
                </label>

                {needsReturnTransport && (
                  <div className="flex items-center gap-2 pl-6">
                    <span className="text-xs text-muted-foreground shrink-0">返程方式：</span>
                    <select
                      value={returnTransportPref}
                      onChange={(e) => setReturnTransportPref(e.target.value as never)}
                      className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      {TRANSPORT_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            ) : (
              <p className="text-xs text-muted-foreground">添加目的地后将自动计算返程路线</p>
            )}
          </section>

          {/* Section 6: Preferences */}
          <section className="space-y-2.5" style={secStyle(10)}>
            <button
              className="flex w-full items-center justify-between rounded-xl border border-border/60 px-4 py-3 text-left transition-all hover:border-primary/30 hover:bg-primary/[0.02]"
              onClick={togglePreferences}
              type="button"
            >
              <span className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <span className="flex items-center justify-center h-7 w-7 rounded-full bg-rose-50 dark:bg-rose-900/20">
                  <Settings className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                </span>
                {hasPreferences ? '更多偏好设置' : '展开更多偏好设置'}
              </span>
              {showPreferences ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
            <div
              className={cn(
                'grid transition-all duration-300',
                showPreferences ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
              )}
            >
              <div className="overflow-hidden">
                <div className={cn('rounded-xl border border-border/40 bg-card px-5 py-5')}>
                  <PreferencesPanel
                    budget={preferences.budget}
                    pace={preferences.pace}
                    accommodation={preferences.accommodation}
                    interests={preferences.interests}
                    dining={preferences.dining}
                    onBudgetChange={setBudget}
                    onPaceChange={setPace}
                    onAccommodationChange={setAccommodation}
                    onInterestsChange={setInterests}
                    onDiningChange={setDining}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Submit */}
          <section className="pt-2" style={secStyle(11)}>
            {errors['submit'] && (
              <p className="mb-3 text-sm text-destructive text-center bg-destructive/5 rounded-lg py-2">
                {errors['submit']}
              </p>
            )}
            <Button
              size="xl"
              className="w-full gap-2.5 text-base font-semibold tracking-tight rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-shadow"
              onClick={handleGenerate}
              disabled={validateMutation.isPending}
            >
              <Rocket className="h-5 w-5" />
              {validateMutation.isPending ? '正在检查...' : '生成我的攻略'}
            </Button>
          </section>
        </div>
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

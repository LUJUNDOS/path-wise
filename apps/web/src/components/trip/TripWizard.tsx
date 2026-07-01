import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import {
  MapPin,
  Target,
  Calendar,
  Users,
  ClipboardList,
  Heart,
  Rocket,
  ArrowRight,
  ArrowLeft,
  Palette,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useTripFormStore } from '@/stores/tripFormStore';
import { CitySelector } from '@/components/trip/CitySelector';
import { DestinationInput } from '@/components/trip/DestinationInput';
import { DatePicker } from '@/components/trip/DatePicker';
import { TravelerCounter } from '@/components/trip/TravelerCounter';
import { PreferencesPanel as PreferencesPanelShort } from '@/components/trip/PreferencesPanel';
import { InterestsDiningPanel } from '@/components/trip/InterestsDiningPanel';
import { ConflictWarningModal } from '@/components/trip/ConflictWarningModal';
import { StepNavigation } from '@/components/trip/StepNavigation';
import { WizardStep } from '@/components/trip/WizardStep';
import { RouteAnimation } from '@/components/trip/RouteAnimation';
import { WizardSummaryPanel } from '@/components/trip/WizardSummaryPanel';
import { apiClient, ApiError } from '@/lib/apiClient';
import { TRANSPORT_OPTIONS } from '@/lib/constants';
import { validateHomeForm } from '@/lib/validation';
import { cn } from '@/lib/utils';
import type { TripConflict, TripValidationResponse, TimePeriod } from '@path-wise/shared';

type ThemeVariant = 'editorial' | 'minimal' | 'dark';
type Direction = 'forward' | 'backward';

interface TripWizardProps {
  className?: string;
  style?: React.CSSProperties;
}

/* ── Wizard Steps Definition ── */
const STEPS = [
  { id: 'departure', title: '从哪里出发', icon: MapPin },
  { id: 'destinations', title: '要去哪里', icon: Target },
  { id: 'date', title: '什么时候出发', icon: Calendar },
  { id: 'travelers', title: '和谁一起去', icon: Users },
  { id: 'preferences', title: '行程偏好', icon: ClipboardList },
  { id: 'interests', title: '兴趣与饮食', icon: Heart },
  { id: 'confirm', title: '确认并生成', icon: Rocket },
] as const;

const TOTAL_STEPS = STEPS.length;

export function TripWizard({ className, style }: TripWizardProps) {
  const navigate = useNavigate();

  /* ── Wizard State ── */
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<Direction>('forward');
  const [exitingStep, setExitingStep] = useState<number | null>(null);
  const [theme, setTheme] = useState<ThemeVariant>('editorial');

  /* ── Form State (Zustand) ── */
  const destinations = useTripFormStore((s) => s.destinations);
  const departureCity = useTripFormStore((s) => s.departureCity);
  const departureDate = useTripFormStore((s) => s.departureDate);
  const timePeriod = useTripFormStore((s) => s.timePeriod);
  const travelers = useTripFormStore((s) => s.travelers);
  const preferences = useTripFormStore((s) => s.preferences);
  const needsReturnTransport = useTripFormStore((s) => s.needsReturnTransport);
  const returnTransportPref = useTripFormStore((s) => s.returnTransportPref);
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
  const setNeedsReturnTransport = useTripFormStore((s) => s.setNeedsReturnTransport);
  const setReturnTransportPref = useTripFormStore((s) => s.setReturnTransportPref);

  /* ── Form Errors & Conflicts ── */
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConflict, setShowConflict] = useState(false);
  const [conflicts, setConflicts] = useState<TripConflict[]>([]);

  /* ── Remote Validation ── */
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

  /* ── Navigation ── */
  const stepTimerRef = useRef<ReturnType<typeof setTimeout>>();

  // Cleanup timer on unmount
  useEffect(() => {
    return () => clearTimeout(stepTimerRef.current);
  }, []);

  const goToStep = useCallback(
    (target: number) => {
      if (target === currentStep) return;
      clearTimeout(stepTimerRef.current);
      const dir: Direction = target > currentStep ? 'forward' : 'backward';
      setExitingStep(currentStep);
      setDirection(dir);
      // After exit animation completes, switch step
      stepTimerRef.current = setTimeout(() => {
        setCurrentStep(target);
        setExitingStep(null);
      }, 250);
    },
    [currentStep],
  );

  const handleNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      goToStep(currentStep + 1);
    } else {
      // Final step — generate
      handleGenerate();
    }
  }, [currentStep, goToStep]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep]);

  /* ── Generate ── */
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
      // Navigate back to the relevant step
      const firstField = validationErrors[0]?.field ?? '';
      const stepIndex = FIELD_TO_STEP[firstField] ?? 0;
      goToStep(stepIndex);
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
  }, [navigate, validateMutation, goToStep]);

  const handleForceGenerate = useCallback(() => {
    setShowConflict(false);
    navigate('/generating');
  }, [navigate]);

  const handleResolveConflict = useCallback((_index: number, action: string, value: string) => {
    const s = useTripFormStore.getState();
    switch (action) {
      case 'set_budget':
        s.setBudget(value as never);
        break;
      case 'set_pace':
        s.setPace(value as never);
        break;
      case 'set_accommodation':
        s.setAccommodation(value);
        break;
      case 'set_timePeriod':
        s.setTimePeriod(value as never);
        break;
    }
  }, []);

  /* ── Theme Cycle ── */
  const cycleTheme = useCallback(() => {
    setTheme((prev) => {
      const order: ThemeVariant[] = ['editorial', 'minimal', 'dark'];
      const idx = order.indexOf(prev);
      return order[(idx + 1) % order.length];
    });
  }, []);

  /* ── Is current step "complete enough" to proceed? ── */
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case 0:
        return departureCity.trim().length > 0;
      case 1:
        return destinations.length > 0;
      case 2:
        return true;
      case 3:
        return travelers.adults > 0;
      case 4:
        return true;
      case 5:
        return true;
      case 6:
        return departureCity.trim().length > 0 && destinations.length > 0;
      default:
        return true;
    }
  }, [currentStep, departureCity, destinations.length, travelers.adults]);

  /* ── Render step content by index ── */
  const renderStepContent = useCallback(
    (stepIndex: number) => {
      switch (stepIndex) {
        case 0:
          return (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">选择你的出发城市，旅程从这里开始</p>
              <CitySelector
                value={departureCity}
                onChange={setDepartureCity}
                placeholder="选择出发城市..."
              />
              {errors['departureCity'] && (
                <p className="text-xs text-destructive">{errors['departureCity']}</p>
              )}
            </div>
          );

        case 1:
          return (
            <div className="space-y-3">
              {departureCity ? (
                <>
                  <RouteAnimation
                    active={direction === 'forward'}
                    from={departureCity}
                    to={
                      destinations.length > 0
                        ? (destinations[destinations.length - 1]?.cityName ?? '')
                        : '?'
                    }
                  />
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
                    onUpdateTransport={(index, transport) =>
                      updateDestinationTransport(index, transport)
                    }
                  />
                  {destinations.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      共 {destinations.reduce((s, d) => s + d.days, 0)} 天
                      {destinations.length >= 2 && '（含中转日）'}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  请先在第一步设置出发城市，然后回到这里选择目的地
                </p>
              )}
              {errors['destinations'] && (
                <p className="text-xs text-destructive">{errors['destinations']}</p>
              )}
            </div>
          );

        case 2:
          return (
            <div className="space-y-5">
              <div>
                <p className="text-sm text-muted-foreground mb-3">选择出发日期和时段</p>
                <DatePicker
                  date={departureDate}
                  timePeriod={timePeriod}
                  onDateChange={setDepartureDate}
                  onTimePeriodChange={setTimePeriod as (p: TimePeriod) => void}
                />
                {errors['departureDate'] && (
                  <p className="text-xs text-destructive mt-1.5">{errors['departureDate']}</p>
                )}
              </div>
              <div>
                <Label className="text-sm font-semibold mb-3 block">返程交通</Label>
                {destinations.length > 0 ? (
                  <div className="space-y-3">
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
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">添加目的地后将自动计算返程路线</p>
                )}
              </div>
            </div>
          );

        case 3:
          return (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">告诉我们需要为谁规划行程</p>
              <TravelerCounter
                adults={travelers.adults}
                children={travelers.children}
                elders={travelers.elders}
                onAdultsChange={setAdults}
                onChildrenChange={setChildren}
                onEldersChange={setElders}
              />
              {errors['adults'] && <p className="text-xs text-destructive">{errors['adults']}</p>}
            </div>
          );

        case 4:
          return (
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-semibold mb-3 block">行程偏好</Label>
                <PreferencesPanelShort
                  budget={preferences.budget}
                  pace={preferences.pace}
                  accommodation={preferences.accommodation}
                  onBudgetChange={setBudget}
                  onPaceChange={setPace}
                  onAccommodationChange={setAccommodation}
                />
              </div>
            </div>
          );

        case 5:
          return (
            <div className="space-y-5">
              <div>
                <Label className="text-sm font-semibold mb-3 block">兴趣标签（最多3个）</Label>
                <InterestsDiningPanel
                  interests={preferences.interests}
                  dining={preferences.dining}
                  onInterestsChange={setInterests}
                  onDiningChange={setDining}
                />
              </div>
            </div>
          );

        case 6:
          return (
            <WizardSummaryPanel
              departureCity={departureCity}
              destinations={destinations.map((d) => ({
                cityName: d.cityName,
                days: d.days,
              }))}
              departureDate={departureDate}
              timePeriod={timePeriod}
              travelers={travelers}
              preferences={preferences}
              needsReturnTransport={needsReturnTransport}
              returnTransportPref={returnTransportPref}
              submitError={errors['submit']}
            />
          );

        default:
          return null;
      }
    },
    [
      direction,
      departureCity,
      destinations,
      departureDate,
      timePeriod,
      travelers,
      preferences,
      needsReturnTransport,
      returnTransportPref,
      errors,
      setDepartureCity,
      addDestination,
      removeDestination,
      updateDestinationDays,
      updateDestinationTransport,
      setDepartureDate,
      setTimePeriod,
      setAdults,
      setChildren,
      setElders,
      setBudget,
      setPace,
      setAccommodation,
      setInterests,
      setDining,
      setNeedsReturnTransport,
      setReturnTransportPref,
    ],
  );

  /* ── Theme label ── */
  const themeLabel = useMemo(() => {
    switch (theme) {
      case 'editorial':
        return '编辑美学';
      case 'minimal':
        return '极简克制';
      case 'dark':
        return '沉浸暗色';
    }
  }, [theme]);

  return (
    <>
      <div
        className={cn(
          'trip-wizard',
          `theme-${theme}`,
          'relative rounded-2xl border shadow-modal transition-colors duration-500',
          'p-6 md:p-8',
          'bg-[var(--wz-card-bg)] border-[var(--wz-card-border)]',
          className,
        )}
        style={style}
      >
        {/* Theme toggle */}
        <div className="absolute top-4 right-4 z-10">
          <button
            type="button"
            onClick={cycleTheme}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
              'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground',
              'transition-colors duration-200',
            )}
            title="切换视觉主题"
          >
            <Palette className="h-3 w-3" />
            <span className="hidden sm:inline">{themeLabel}</span>
          </button>
        </div>

        {/* Step indicator */}
        <div className="mb-8 pt-2">
          <StepNavigation
            steps={STEPS.map((s) => ({ id: s.id, title: s.title, icon: s.icon }))}
            currentStep={currentStep}
            onStepClick={(i) => {
              if (i < currentStep) goToStep(i);
            }}
          />
        </div>

        {/* Step content */}
        <div className="relative overflow-hidden p-0.5" style={{ minHeight: 200 }}>
          {STEPS.map((step, i) => {
            const isVisible = i === currentStep;
            const isExiting = i === exitingStep;
            return (
              <WizardStep
                key={step.id}
                stepNumber={i + 1}
                title={step.title}
                visible={isVisible}
                exiting={isExiting}
                direction={direction}
              >
                {isVisible || isExiting ? renderStepContent(i) : null}
              </WizardStep>
            );
          })}
        </div>

        {/* Navigation buttons */}
        <div
          className={cn(
            'flex items-center gap-3 mt-8 pt-6',
            'border-t border-[var(--wz-rule-color)]',
            currentStep > 0 ? 'justify-between' : 'justify-end',
          )}
        >
          {currentStep > 0 && (
            <Button
              variant="ghost"
              size="lg"
              onClick={handlePrev}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              上一步
            </Button>
          )}

          <Button
            size="xl"
            onClick={handleNext}
            disabled={!canProceed || validateMutation.isPending}
            className={cn(
              'gap-2 text-base font-semibold tracking-tight rounded-xl',
              'shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30',
              'transition-all duration-300',
            )}
          >
            {currentStep === TOTAL_STEPS - 1 ? (
              <>
                <Rocket className="h-5 w-5" />
                {validateMutation.isPending ? '正在检查...' : '生成我的攻略'}
              </>
            ) : (
              <>
                下一步
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      <ConflictWarningModal
        open={showConflict}
        conflicts={conflicts}
        onForceGenerate={handleForceGenerate}
        onBackToEdit={() => setShowConflict(false)}
        onResolveConflict={handleResolveConflict}
      />
    </>
  );
}

/* ── Map validation field → wizard step ── */
const FIELD_TO_STEP: Record<string, number> = {
  departureCity: 0,
  destinations: 1,
  departureDate: 2,
  adults: 3,
};

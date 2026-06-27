import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StepInfo {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface StepNavigationProps {
  steps: StepInfo[];
  currentStep: number;
  onStepClick?: (index: number) => void;
}

export function StepNavigation({ steps, currentStep, onStepClick }: StepNavigationProps) {
  return (
    <nav className="w-full" aria-label="向导步骤">
      <ol className="flex items-center justify-center gap-0">
        {steps.map((step, i) => {
          const isDone = i < currentStep;
          const isActive = i === currentStep;

          return (
            <li key={step.id} className="flex items-center">
              {/* Dot / Icon */}
              <button
                type="button"
                onClick={() => onStepClick?.(i)}
                disabled={!isDone && !isActive}
                className={cn(
                  'group relative flex items-center justify-center',
                  'h-8 w-8 rounded-full text-xs font-medium transition-all duration-300',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  isActive &&
                    'step-dot--active bg-[var(--wz-step-active-color)] text-white shadow-lg shadow-[var(--wz-step-active-color)]/25',
                  isDone &&
                    'bg-[var(--wz-step-done-color)] text-white cursor-pointer hover:scale-110',
                  !isActive && !isDone && 'bg-muted text-muted-foreground cursor-default',
                )}
                aria-label={`${step.title}${isActive ? '（当前）' : ''}${isDone ? '（已完成）' : ''}`}
                aria-current={isActive ? 'step' : undefined}
              >
                {isDone ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                ) : (
                  <step.icon className="h-3.5 w-3.5" />
                )}
              </button>

              {/* Connecting line */}
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 w-6 sm:w-10 transition-colors duration-500',
                    i < currentStep
                      ? 'bg-[var(--wz-step-done-color)]'
                      : 'bg-[var(--wz-step-line-color)]',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>

      {/* Step label */}
      <p className="mt-2 text-center text-sm font-medium text-foreground/80 transition-all duration-300">
        <span className="tabular-nums text-[var(--wz-step-active-color)] font-semibold">
          {currentStep + 1}
        </span>
        <span className="text-muted-foreground"> / {steps.length}</span>
        <span className="mx-2 text-muted-foreground/50">·</span>
        {steps[currentStep]?.title}
      </p>
    </nav>
  );
}

import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface WizardStepProps {
  stepNumber: number;
  title: string;
  visible: boolean;
  exiting: boolean;
  direction?: 'forward' | 'backward';
  children: ReactNode;
}

/**
 * Single wizard step with title + content + enter/exit transitions.
 * Uses CSS classes for animation — zero JS animation.
 * Supports forward (right→center) and backward (left→center) directions.
 */
export function WizardStep({
  stepNumber,
  title,
  visible,
  exiting,
  direction = 'forward',
  children,
}: WizardStepProps) {
  const enterFromLeft = visible && direction === 'backward';

  return (
    <div
      className={cn(
        'wizard-step',
        enterFromLeft && 'wizard-step--enter-left',
        visible && !enterFromLeft && 'wizard-step--active',
        !visible && exiting && direction === 'forward' && 'wizard-step--exit-left',
        !visible && exiting && direction === 'backward' && 'wizard-step--exit-right',
      )}
      aria-hidden={!visible}
    >
      {/* Step header */}
      <div className="mb-6">
        <div className="flex items-baseline gap-3 mb-3">
          <span
            className={cn(
              'flex-shrink-0 flex items-center justify-center',
              'h-9 w-9 rounded-full text-sm font-semibold tabular-nums',
              'bg-[var(--wz-icon-bg)] text-[var(--wz-icon-fg)]',
              'transition-colors duration-300',
            )}
          >
            {String(stepNumber).padStart(2, '0')}
          </span>
          <h2
            className={cn(
              'text-2xl sm:text-3xl font-bold tracking-tight text-foreground',
              'transition-all duration-300',
            )}
            style={{ fontFamily: 'var(--wz-title-font)' }}
          >
            {title}
          </h2>
        </div>
        <hr
          className={cn(
            'border-0 h-px transition-colors duration-300',
            'bg-[var(--wz-rule-color)]',
          )}
        />
      </div>

      {/* Step body */}
      <div className="min-h-[160px]">{children}</div>
    </div>
  );
}

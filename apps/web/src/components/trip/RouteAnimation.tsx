import { useEffect, useRef, useState } from 'react';
import { MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RouteAnimationProps {
  /** Show the animated traveling dot */
  active: boolean;
  /** Origin city name */
  from: string;
  /** Destination city name */
  to: string;
}

/**
 * Animated route line with traveling dot — drawn when `active` becomes true.
 * Pure CSS animation via stroke-dashoffset.
 */
export function RouteAnimation({ active, from, to }: RouteAnimationProps) {
  const [animate, setAnimate] = useState(false);
  const [showDot, setShowDot] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (active) {
      // Slight delay so the step entrance completes first
      timerRef.current = setTimeout(() => {
        setAnimate(true);
        setShowDot(true);
      }, 400);
    } else {
      setAnimate(false);
      setShowDot(false);
    }
    return () => clearTimeout(timerRef.current);
  }, [active]);

  // Remove traveling dot after animation completes
  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setShowDot(false), 1300);
      return () => clearTimeout(timer);
    }
  }, [animate]);

  return (
    <div className="flex flex-col items-center py-3 select-none">
      {/* Labels */}
      <div className="flex items-center justify-between w-full max-w-xs text-xs text-foreground/65 mb-1">
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {from || '出发地'}
        </span>
        <span className="flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          {to || '目的地'}
        </span>
      </div>

      {/* SVG Route line */}
      <svg
        viewBox="0 0 350 50"
        className="w-full max-w-xs h-10 overflow-visible"
        aria-hidden="true"
      >
        {/* Dashed guide line */}
        <path
          d="M 30 25 Q 175 25 320 25"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
          strokeDasharray="4 6"
          className="text-muted-foreground/30"
        />

        {/* Animated solid path */}
        <path
          d="M 30 25 Q 175 25 320 25"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className={cn('route-path text-[var(--wz-icon-fg)]', animate && 'route-path--animate')}
        />

        {/* Origin dot */}
        <circle cx="30" cy="25" r="4" className="fill-[var(--wz-icon-fg)]" />

        {/* Destination dot — appears after line is drawn */}
        <circle
          cx="320"
          cy="25"
          r="4"
          className="fill-[var(--wz-icon-fg)] transition-all duration-300"
          style={{
            opacity: animate ? 1 : 0,
            transform: `scale(${animate ? 1 : 0.3})`,
            transitionDelay: animate ? '0.9s' : '0s',
          }}
        />

        {/* Traveling dot — only visible during animation */}
        {showDot && <circle r="5" className="fill-[var(--wz-icon-fg)] route-dot" />}
      </svg>
    </div>
  );
}

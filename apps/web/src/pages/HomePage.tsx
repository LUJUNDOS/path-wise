import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TripWizard } from '@/components/trip/TripWizard';
import { PageHeader } from '@/components/common/PageHeader';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { cn } from '@/lib/utils';

/* ── Splash animation timeline (ms from mount) ──
   0      Splash: gradient background fades in
   200    Compass logo mark scales up (0.3→1, 1s spring)
   900    Tagline "探索世界，从这里出发" fades in
   1800   Brand name "PATH–WISE" reveals with glow
   3000   Splash fades out, TripWizard slides in
   3800   Splash removed from DOM
── */

export default function HomePage() {
  const navigate = useNavigate();

  // Splash sequencing
  const [phase, setPhase] = useState(0);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timers = [
      setTimeout(() => setPhase(1), 200),
      setTimeout(() => setPhase(2), 900),
      setTimeout(() => setPhase(3), 1800),
      setTimeout(() => setPhase(4), 3000),
    ];
    return () => timers.forEach(clearTimeout);
  }, []);

  // Remove splash from DOM after fade-out completes
  useEffect(() => {
    if (phase >= 4) {
      const timer = setTimeout(() => setShowSplash(false), 900);
      return () => clearTimeout(timer);
    }
  }, [phase]);

  // ── Splash animation styles ──
  const secStyle = (p: number) => ({
    opacity: phase >= p ? 1 : 0,
    transform: phase >= p ? 'translateY(0)' : 'translateY(16px)',
    transition:
      'opacity 0.5s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.5s cubic-bezier(0.22, 0.61, 0.36, 1)',
  });

  return (
    <div className="min-h-screen bg-background relative">
      {/* ══════════════════════════════════════════════
          SPLASH SCREEN
          ══════════════════════════════════════════════ */}
      {showSplash && (
        <div
          className={cn(
            'fixed inset-0 z-50 flex flex-col items-center justify-center',
            'bg-hero texture-paper overflow-hidden',
            'transition-opacity',
            phase >= 4 ? 'opacity-0 pointer-events-none' : 'opacity-100',
          )}
          style={{ transitionDuration: '800ms', transitionTimingFunction: 'ease-in-out' }}
        >
          {/* Ambient glow orbs — slow float */}
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full bg-primary/10 blur-[120px] pointer-events-none animate-orb-float" />
          <div className="absolute top-1/3 -left-20 w-80 h-80 rounded-full bg-background/8 blur-3xl pointer-events-none animate-orb-float-delayed" />
          <div className="absolute bottom-1/4 -right-20 w-96 h-96 rounded-full bg-accent/10 blur-3xl pointer-events-none animate-orb-float-slow" />

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

          {/* Tagline — phase 2 */}
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

          {/* Brand name — phase 3 */}
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
            className="absolute bottom-16 left-1/2 -translate-x-1/2 transition-opacity duration-500"
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
      )}

      {/* ════════════════════════════════════════
          PAGE CONTENT (below splash)
          ════════════════════════════════════════ */}
      <PageHeader
        className={cn(
          'z-40 transition-all duration-500',
          phase >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2',
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
          'relative overflow-hidden bg-hero texture-paper pt-4 pb-20',
          phase >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0',
        )}
        style={{
          transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
        }}
      >
        <div className="absolute -top-16 -right-24 w-96 h-96 rounded-full bg-white/8 blur-3xl pointer-events-none" />
        <div className="relative z-10 container mx-auto max-w-2xl px-4 pt-6 text-center">
          <p
            className="text-white/70 text-sm tracking-[0.25em] uppercase mb-2"
            style={{
              opacity: phase >= 4 ? 1 : 0,
              transform: phase >= 4 ? 'translateY(0)' : 'translateY(16px)',
              transition:
                'opacity 0.5s 0.1s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.5s 0.1s cubic-bezier(0.22, 0.61, 0.36, 1)',
            }}
          >
            AI-Powered Travel Planning
          </p>
          <p
            className="text-white/60 text-sm"
            style={{
              opacity: phase >= 4 ? 1 : 0,
              transform: phase >= 4 ? 'translateY(0)' : 'translateY(16px)',
              transition:
                'opacity 0.5s 0.15s cubic-bezier(0.22, 0.61, 0.36, 1), transform 0.5s 0.15s cubic-bezier(0.22, 0.61, 0.36, 1)',
            }}
          >
            智能规划每一段旅程，让每次出行都从容而精彩
          </p>
        </div>
      </section>

      {/* Wizard */}
      <main className="container mx-auto max-w-2xl px-4 -mt-14 relative z-20 pb-12">
        <div
          className="transition-all duration-600 ease-out"
          style={{
            opacity: phase >= 4 ? 1 : 0,
            transform: phase >= 4 ? 'translateY(0)' : 'translateY(24px)',
          }}
        >
          <TripWizard />
        </div>
      </main>
    </div>
  );
}

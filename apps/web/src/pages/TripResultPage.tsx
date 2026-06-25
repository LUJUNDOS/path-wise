import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Download, RefreshCw, Coins, Compass } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DayPlanCard } from '@/components/itinerary/DayPlanCard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { apiClient, ApiError } from '@/lib/apiClient';
import { formatCurrency } from '@/lib/format';
import type { TripResponse, DayPlan } from '@path-wise/shared';

export default function TripResultPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const [activeDay, setActiveDay] = useState('1');
  const [shareUrlCopied, setShareUrlCopied] = useState(false);

  const {
    data: trip,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['trip', tripId],
    queryFn: async (): Promise<TripResponse> => {
      const response = await apiClient.get<TripResponse>(`/trips/${tripId}`);
      return response.data;
    },
    enabled: !!tripId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const handleShare = useCallback(() => {
    if (trip?.shareUrl) {
      navigator.clipboard
        .writeText(trip.shareUrl)
        .then(() => {
          setShareUrlCopied(true);
          setTimeout(() => setShareUrlCopied(false), 3000);
        })
        .catch(() => {
          /* clipboard failed — silently ignore */
        });
    }
  }, [trip?.shareUrl]);

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="正在加载攻略..." />
      </div>
    );
  }

  // ── Error ──
  if (error || !trip) {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : '攻略不存在';

    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-lg">
          <div className="container mx-auto flex h-14 items-center px-4">
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <ArrowLeft className="h-4 w-4 mr-1" />
              返回首页
            </Button>
          </div>
        </header>
        <main className="container mx-auto flex items-center justify-center py-12">
          <EmptyState
            title="加载失败"
            description={message}
            action={
              <Button variant="outline" onClick={() => navigate('/')} className="rounded-xl">
                返回首页
              </Button>
            }
          />
        </main>
      </div>
    );
  }

  const days = trip.days ?? [];

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-background">
        {/* ── Header ── */}
        <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-lg">
          <div className="container mx-auto flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                返回首页
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={handleShare} className="rounded-full">
                <Share2 className="h-4 w-4 mr-1" />
                {shareUrlCopied ? '已复制链接' : '分享'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled
                title="导出功能即将推出"
                className="rounded-full"
              >
                <Download className="h-4 w-4 mr-1" />
                导出
              </Button>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="container mx-auto max-w-5xl px-4 py-8">
          {/* ── Trip Title ── */}
          <div className="mb-8 space-y-3">
            <h1 className="editorial-title text-3xl md:text-4xl text-foreground">{trip.title}</h1>
            <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              {trip.generateTime && (
                <span>
                  生成于{' '}
                  {new Date(trip.generateTime).toLocaleDateString('zh-CN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              )}
              {trip.totalEstimatedCostCNY !== undefined && trip.totalEstimatedCostCNY > 0 && (
                <span className="flex items-center gap-1.5 font-semibold text-foreground bg-muted/50 rounded-full px-3 py-1">
                  <Coins className="h-4 w-4 text-amber-500" />约{' '}
                  {formatCurrency(trip.totalEstimatedCostCNY)}
                </span>
              )}
            </div>
          </div>

          {/* ── Desktop Layout ── */}
          <div className="lg:grid lg:grid-cols-3 lg:gap-8">
            {/* Left: day cards */}
            <div className="lg:col-span-2 space-y-4">
              {/* Mobile tabs */}
              <div className="lg:hidden">
                <Tabs value={activeDay} onValueChange={setActiveDay}>
                  <TabsList className="w-full overflow-x-auto flex-nowrap rounded-xl p-1">
                    {days.map((day: DayPlan) => (
                      <TabsTrigger
                        key={day.dayIndex}
                        value={String(day.dayIndex)}
                        className="shrink-0 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm"
                      >
                        Day {day.dayIndex}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {days.map((day: DayPlan) => (
                    <TabsContent key={day.dayIndex} value={String(day.dayIndex)}>
                      <DayPlanCard dayPlan={day} />
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              {/* Desktop vertical scroll */}
              <div className="hidden lg:block space-y-4">
                {days.map((day: DayPlan) => (
                  <DayPlanCard key={day.dayIndex} dayPlan={day} />
                ))}
              </div>
            </div>

            {/* Right: trip summary sidebar */}
            <aside className="hidden lg:block">
              <div className="sticky top-24 rounded-2xl border border-border/40 bg-card p-6 shadow-sm space-y-5">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  行程摘要
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">总天数</span>
                    <span className="text-sm font-semibold">{days.length} 天</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">途经城市</span>
                    <span className="text-sm font-semibold">
                      {new Set(days.map((d: DayPlan) => d.cityName)).size} 个
                    </span>
                  </div>
                  {trip.totalEstimatedCostCNY !== undefined && trip.totalEstimatedCostCNY > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">预估花费</span>
                      <span className="text-sm font-semibold">
                        {formatCurrency(trip.totalEstimatedCostCNY)}
                      </span>
                    </div>
                  )}
                </div>

                <div className="border-t border-border/40 pt-4">
                  <div className="flex items-center justify-center">
                    <Compass className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    地图视图将在后续版本推出
                  </p>
                </div>
              </div>
            </aside>
          </div>

          {/* ── Regenerate CTA ── */}
          <div className="mt-10 text-center">
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/')}
              className="gap-2 rounded-xl"
            >
              <RefreshCw className="h-4 w-4" />
              重新生成攻略
            </Button>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}

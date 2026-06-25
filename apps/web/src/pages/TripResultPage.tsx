import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share2, Download, RefreshCw, Coins } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { DayPlanCard } from '@/components/itinerary/DayPlanCard';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';
import { EmptyState } from '@/components/common/EmptyState';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
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
      // apiClient 返回 ApiResponse<TripResponse>，提取 data 字段
      return response.data;
    },
    enabled: !!tripId,
    staleTime: 5 * 60 * 1000, // 5 分钟内不重新请求
    retry: 1,
  });

  const handleShare = useCallback(() => {
    if (trip?.shareUrl) {
      navigator.clipboard.writeText(trip.shareUrl).then(() => {
        setShareUrlCopied(true);
        setTimeout(() => setShareUrlCopied(false), 3000);
      }).catch(() => {
        /* clipboard failed — silently ignore */
      });
    }
  }, [trip?.shareUrl]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" text="正在加载攻略..." />
      </div>
    );
  }

  if (error || !trip) {
    const message = error instanceof ApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : '攻略不存在';

    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-sm">
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
              <Button variant="outline" onClick={() => navigate(0)}>
                重试
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
        {/* Header */}
        <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-sm">
          <div className="container mx-auto flex h-14 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
                <ArrowLeft className="h-4 w-4 mr-1" />
                返回首页
              </Button>
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={handleShare}>
                <Share2 className="h-4 w-4 mr-1" />
                {shareUrlCopied ? '已复制链接' : '分享'}
              </Button>
              <Button variant="ghost" size="sm" disabled title="导出功能即将推出">
                <Download className="h-4 w-4 mr-1" />
                导出
              </Button>
            </div>
          </div>
        </header>

        <main className="container mx-auto max-w-5xl px-4 py-6">
          {/* Trip Header */}
          <div className="mb-6 space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">{trip.title}</h1>
            <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {trip.generateTime && (
                <span>生成时间：{new Date(trip.generateTime).toLocaleDateString('zh-CN')}</span>
              )}
              {trip.totalEstimatedCostCNY !== undefined && trip.totalEstimatedCostCNY > 0 && (
                <span className="flex items-center gap-1 font-medium text-foreground">
                  <Coins className="h-4 w-4" />
                  总花费：约 {formatCurrency(trip.totalEstimatedCostCNY)}
                </span>
              )}
            </div>
          </div>

          {/* Desktop: left card list + right placeholder */}
          <div className="lg:grid lg:grid-cols-3 lg:gap-6">
            {/* Left: day cards */}
            <div className="lg:col-span-2 space-y-4">
              {/* Mobile: day tabs */}
              <div className="lg:hidden">
                <Tabs value={activeDay} onValueChange={setActiveDay}>
                  <TabsList className="w-full overflow-x-auto flex-nowrap">
                    {days.map((day: DayPlan) => (
                      <TabsTrigger
                        key={day.dayIndex}
                        value={String(day.dayIndex)}
                        className="shrink-0"
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

              {/* Desktop: vertical scroll */}
              <div className="hidden lg:block space-y-4">
                {days.map((day: DayPlan) => (
                  <DayPlanCard key={day.dayIndex} dayPlan={day} />
                ))}
              </div>
            </div>

            {/* Right: map placeholder (Phase 2) */}
            <div className="hidden lg:block">
              <div className="sticky top-20 rounded-lg border bg-muted/30 p-6 text-center">
                <p className="text-sm text-muted-foreground">地图视图</p>
                <p className="text-xs text-muted-foreground/70 mt-1">阶段二实现</p>
              </div>
            </div>
          </div>

          {/* Bottom: regenerate CTA */}
          <div className="mt-8 text-center">
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/')}
              className="gap-2"
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

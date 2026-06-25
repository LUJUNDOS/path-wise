import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Loader2, CheckCircle2, Clock, Compass } from 'lucide-react';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DayPlanCard } from '@/components/itinerary/DayPlanCard';
import { PageHeader } from '@/components/common/PageHeader';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { useSSE } from '@/hooks/useSSE';
import { useGenerationStore } from '@/stores/generationStore';
import { useTripFormStore } from '@/stores/tripFormStore';

const TIPS = [
  '长沙的茶颜悦色值得一试！',
  '岳麓山建议穿舒适鞋子',
  '橘子洲头的最佳观赏时间是傍晚',
  '湖南省博物馆周一闭馆，注意避开',
  '太平街有很多地道小吃',
  '杜甫江阁夜景非常美',
  '剁椒鱼头是长沙必尝菜',
  '五一广场是长沙最繁华的商圈',
];

const FUN_MESSAGES = [
  'AI 正在绞尽脑汁为你规划...',
  '攻略即将出炉，请稍候',
  '正在分析最佳路线...',
  '正在匹配合适的餐厅...',
];

function buildRequestBody(formStore: ReturnType<typeof useTripFormStore.getState>) {
  return {
    departure: {
      city: formStore.departureCity,
      date: formStore.departureDate,
      timePeriod: formStore.timePeriod,
    },
    travelers: {
      adults: formStore.travelers.adults,
      children: formStore.travelers.children.map((c) => ({ age: c.age })),
    },
    destinations: formStore.destinations.map((d) => ({
      cityName: d.cityName,
      days: d.days,
      transportTo: d.transportTo ?? null,
    })),
    preferences: {
      budget: formStore.preferences.budget,
      pace: formStore.preferences.pace,
      accommodation: formStore.preferences.accommodation,
      interests: formStore.preferences.interests,
      dining: formStore.preferences.dining,
    },
    needsReturnTransport: formStore.needsReturnTransport,
    returnTransportPref: formStore.returnTransportPref ?? 'auto',
  };
}

export default function GeneratingPage() {
  const navigate = useNavigate();
  const { connect, disconnect } = useSSE();
  const store = useGenerationStore();
  useTripFormStore(); // 订阅 store 变化以保持 handleStart 中的 getState() 最新
  const tipsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [tipIndex, setTipIndex] = useState(0);
  const [funIndex, setFunIndex] = useState(0);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const handleStart = useCallback(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
    const sseUrl = `${baseUrl}/trips/generate`;
    const body = buildRequestBody(useTripFormStore.getState());

    connect(sseUrl, { body });
  }, [connect]);

  useEffect(() => {
    store.resetGeneration();
    handleStart();

    return () => {
      disconnect();
      if (tipsIntervalRef.current) clearInterval(tipsIntervalRef.current);
    };
  }, []);

  useEffect(() => {
    if (store.status === 'all_complete' && store.tripId) {
      const timer = setTimeout(() => {
        navigate(`/trip/${store.tripId}`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [store.status, store.tripId, navigate]);

  useEffect(() => {
    if (store.status !== 'streaming') return;
    tipsIntervalRef.current = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % TIPS.length);
      setFunIndex((prev) => (prev + 1) % FUN_MESSAGES.length);
    }, 15000);
    return () => {
      if (tipsIntervalRef.current) clearInterval(tipsIntervalRef.current);
    };
  }, [store.status]);

  const currentTip = TIPS[tipIndex];
  const currentFun = FUN_MESSAGES[funIndex];

  const handleCancel = useCallback(() => {
    setShowCancelConfirm(true);
  }, []);

  const handleConfirmCancel = useCallback(() => {
    disconnect();
    navigate('/');
  }, [disconnect, navigate]);

  const handleRetry = useCallback(() => {
    store.resetGeneration();
    handleStart();
  }, [store, handleStart]);

  const isStreaming = store.status === 'streaming' || store.status === 'connecting';
  const isError = store.status === 'error' || store.status === 'timeout';
  const isComplete = store.status === 'all_complete';

  const pendingCount = Math.max(0, store.totalSteps - store.completedDays.length);

  return (
    <div className="min-h-screen bg-background">
      {/* ── Header ── */}
      <PageHeader
        left={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                disconnect();
                navigate('/');
              }}
              disabled={isStreaming}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              返回
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-hero shadow-sm">
                <Compass className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="editorial-title text-base">PATH–WISE</span>
            </div>
          </>
        }
        right={<ThemeToggle />}
      />

      <main className="container mx-auto max-w-2xl px-4 py-8 space-y-8">
        {/* ── Status Header ── */}
        <div className="text-center space-y-3">
          {store.status === 'connecting' && (
            <>
              <div className="relative inline-flex items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full bg-primary/10 animate-ping"
                  style={{ animationDuration: '2s' }}
                />
                <Loader2 className="relative h-10 w-10 animate-spin text-primary" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">正在连接...</h2>
            </>
          )}
          {isStreaming && (
            <>
              <div className="relative inline-flex items-center justify-center">
                <div
                  className="absolute inset-0 rounded-full bg-primary/10 animate-ping"
                  style={{ animationDuration: '2s' }}
                />
                <Loader2 className="relative h-10 w-10 animate-spin text-primary" />
              </div>
              <h2 className="text-xl font-semibold tracking-tight">正在为你生成专属攻略...</h2>
              <p className="text-sm text-muted-foreground animate-pulse-soft">{currentFun}</p>
            </>
          )}
          {isComplete && (
            <div className="bg-success-soft rounded-2xl px-6 py-6 border border-green-100 dark:border-green-900/30">
              <CheckCircle2 className="h-10 w-10 mx-auto text-green-500 mb-2" />
              <h2 className="text-xl font-semibold text-green-700 dark:text-green-400 tracking-tight">
                生成完成！
              </h2>
              <p className="text-sm text-muted-foreground mt-1">即将跳转到行程结果页...</p>
            </div>
          )}
          {isError && (
            <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-6">
              <AlertTriangle className="h-10 w-10 mx-auto text-destructive mb-2" />
              <h2 className="text-xl font-semibold text-destructive tracking-tight">生成失败</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {store.errorMessage ?? '未知错误'}
              </p>
            </div>
          )}
        </div>

        {/* ── Progress ── */}
        {isStreaming && (
          <div className="space-y-4 rounded-xl border border-border/40 bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Step {store.currentStep} / {store.totalSteps}
              </span>
              <span className="font-semibold tabular-nums">{store.progressPercent}%</span>
            </div>
            <Progress value={store.progressPercent} className="h-2" />
            <p className="text-sm font-medium">{store.message}</p>
            {store.subMessage && (
              <p className="text-xs text-muted-foreground">{store.subMessage}</p>
            )}
            {store.estimatedRemainingSeconds > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                预计还需 {store.estimatedRemainingSeconds} 秒
              </p>
            )}
            <p className="text-xs text-muted-foreground italic border-t border-border/40 pt-3 mt-1">
              {currentTip}
            </p>
          </div>
        )}

        {/* ── Warnings ── */}
        {store.warnings.length > 0 && (
          <div className="space-y-1.5">
            {store.warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-center gap-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/30 px-4 py-2.5 text-xs text-amber-700 dark:text-amber-300"
              >
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {w.message}
              </div>
            ))}
          </div>
        )}

        {/* ── Day Cards ── */}
        {store.totalSteps > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              已生成
            </h3>

            {store.completedDays
              .sort((a, b) => a.dayIndex - b.dayIndex)
              .map((day) => (
                <div key={day.dayIndex} className="relative animate-fade-up">
                  <Badge className="absolute -top-2.5 right-3 z-10 bg-green-500 hover:bg-green-500 text-white text-xs rounded-full px-3 py-0.5 shadow-sm">
                    <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                    已完成
                  </Badge>
                  <DayPlanCard dayPlan={day} />
                </div>
              ))}

            {/* Skeleton placeholders for pending days */}
            {Array.from({ length: pendingCount }).map((_, i) => {
              const dayIndex = store.completedDays.length + i + 1;
              return (
                <div
                  key={`pending-${dayIndex}`}
                  className="rounded-xl border border-dashed border-border/60 bg-card/40 px-6 py-6"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <Skeleton className="h-5 w-20 rounded-md" />
                    <Skeleton className="h-4 w-32 rounded-md" />
                  </div>
                  <div className="space-y-3">
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-lg" />
                    <Skeleton className="h-12 w-3/4 rounded-lg" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Error Actions ── */}
        {isError && (
          <div className="flex flex-col items-center gap-3">
            {store.partialTripId && (
              <Button
                variant="outline"
                onClick={() => navigate(`/trip/${store.partialTripId}`)}
                className="rounded-xl"
              >
                查看已生成部分
              </Button>
            )}
            <Button onClick={handleRetry} className="rounded-xl shadow-lg shadow-primary/20">
              重新生成
            </Button>
          </div>
        )}

        {/* ── Cancel ── */}
        {isStreaming && (
          <div className="sticky bottom-4 flex justify-center">
            <Button
              variant="outline"
              className="shadow-lg rounded-full px-8"
              onClick={handleCancel}
            >
              取消生成
            </Button>
          </div>
        )}

        <ConfirmDialog
          open={showCancelConfirm}
          onOpenChange={setShowCancelConfirm}
          title="取消生成"
          description={`确定要取消生成吗？已生成 Day ${
            store.completedDays.map((d) => d.dayIndex).join('、') || '—'
          } 的内容将被保留。`}
          confirmText="确认取消"
          cancelText="继续生成"
          variant="destructive"
          onConfirm={handleConfirmCancel}
        />
      </main>
    </div>
  );
}

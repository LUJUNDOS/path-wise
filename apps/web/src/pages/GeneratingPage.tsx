import { useEffect, useCallback, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, AlertTriangle, Loader2, CheckCircle2, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { DayPlanCard } from '@/components/itinerary/DayPlanCard';
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

/** 将表单 store 数据序列化为 TripGenerateRequest POST body */
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
      transportTo: null,
    })),
    preferences: {
      budget: formStore.preferences.budget,
      pace: formStore.preferences.pace,
      accommodation: formStore.preferences.accommodation,
      interests: formStore.preferences.interests,
      dining: formStore.preferences.dining,
    },
  };
}

export default function GeneratingPage() {
  const navigate = useNavigate();
  const { connect, disconnect } = useSSE();
  const store = useGenerationStore();
  const formStore = useTripFormStore();
  const tipsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [tipIndex, setTipIndex] = useState(0);
  const [funIndex, setFunIndex] = useState(0);

  const handleStart = useCallback(() => {
    const baseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api/v1';
    const sseUrl = `${baseUrl}/trips/generate`;
    const body = buildRequestBody(useTripFormStore.getState());

    connect(sseUrl, { body });
  }, [connect]);

  // Start SSE on mount
  useEffect(() => {
    store.resetGeneration();
    handleStart();

    return () => {
      disconnect();
      if (tipsIntervalRef.current) clearInterval(tipsIntervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redirect on completion
  useEffect(() => {
    if (store.status === 'all_complete' && store.tripId) {
      const timer = setTimeout(() => {
        navigate(`/trip/${store.tripId}`);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [store.status, store.tripId, navigate]);

  // Cycle tips/fun messages every 15 seconds
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

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/80 backdrop-blur-sm">
        <div className="container mx-auto flex h-14 items-center px-4">
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
          <span className="ml-4 font-bold text-lg">PATH-WISE</span>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-8 space-y-6">
        {/* Status Header */}
        <div className="text-center space-y-2">
          {store.status === 'connecting' && (
            <>
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <h2 className="text-lg font-semibold">正在连接...</h2>
            </>
          )}
          {isStreaming && (
            <>
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
              <h2 className="text-lg font-semibold">正在为你生成专属攻略...</h2>
              <p className="text-sm text-muted-foreground">{currentFun}</p>
            </>
          )}
          {isComplete && (
            <>
              <CheckCircle2 className="h-8 w-8 mx-auto text-green-500" />
              <h2 className="text-lg font-semibold text-green-600">生成完成！</h2>
              <p className="text-sm text-muted-foreground">即将跳转到行程结果页...</p>
            </>
          )}
          {isError && (
            <>
              <AlertTriangle className="h-8 w-8 mx-auto text-destructive" />
              <h2 className="text-lg font-semibold text-destructive">生成失败</h2>
              <p className="text-sm text-muted-foreground">{store.errorMessage ?? '未知错误'}</p>
            </>
          )}
        </div>

        {/* Progress */}
        {isStreaming && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Step {store.currentStep} / {store.totalSteps}
              </span>
              <span className="font-medium">{store.progressPercent}%</span>
            </div>
            <Progress value={store.progressPercent} className="h-2" />
            <p className="text-sm font-medium">{store.message}</p>
            {store.subMessage && (
              <p className="text-xs text-muted-foreground">{store.subMessage}</p>
            )}
            {store.estimatedRemainingSeconds > 0 && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock className="h-3 w-3" />
                预计还需 {store.estimatedRemainingSeconds} 秒
              </p>
            )}
            <p className="text-xs text-muted-foreground italic">{currentTip}</p>
          </div>
        )}

        {/* Warnings */}
        {store.warnings.length > 0 && (
          <div className="space-y-1">
            {store.warnings.map((w, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md bg-yellow-50 px-3 py-2 text-xs text-yellow-700"
              >
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {w.message}
              </div>
            ))}
          </div>
        )}

        {/* Day Cards (progressive rendering) */}
        {store.totalSteps > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground">已生成</h3>

            {/* Completed days */}
            {store.completedDays
              .sort((a, b) => a.dayIndex - b.dayIndex)
              .map((day) => (
                <div key={day.dayIndex} className="relative">
                  <Badge className="absolute -top-2 right-2 z-10 bg-green-500 text-white text-xs">
                    <CheckCircle2 className="h-3 w-3 mr-1 inline" />
                    已完成
                  </Badge>
                  <DayPlanCard dayPlan={day} />
                </div>
              ))}

            {/* Upcoming days placeholder */}
            {Array.from({
              length: Math.max(0, store.totalSteps - store.completedDays.length),
            }).map((_, i) => {
              const dayIndex = store.completedDays.length + i + 1;
              return (
                <div
                  key={`pending-${dayIndex}`}
                  className="rounded-lg border border-dashed bg-muted/30 px-6 py-8 text-center"
                >
                  <p className="text-sm text-muted-foreground">Day {dayIndex} · 等待生成...</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Error state */}
        {isError && (
          <div className="flex flex-col items-center gap-3">
            {store.partialTripId && (
              <Button variant="outline" onClick={() => navigate(`/trip/${store.partialTripId}`)}>
                查看已生成部分
              </Button>
            )}
            <Button onClick={handleRetry}>重新生成</Button>
          </div>
        )}

        {/* Cancel button */}
        {isStreaming && (
          <div className="sticky bottom-4 flex justify-center">
            <Button variant="outline" className="shadow-lg" onClick={handleCancel}>
              取消生成
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}

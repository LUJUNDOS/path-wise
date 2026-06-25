import { useCallback, useRef } from 'react';
import { useGenerationStore } from '@/stores/generationStore';
import { SSE_TIMEOUT_MS, SSE_CONNECT_TIMEOUT_MS } from '@/lib/constants';
import type { DayPlan } from '@path-wise/shared';

interface SSEDayReadyData {
  dayIndex: number;
  day: DayPlan;
}

interface SSEConnectOptions {
  /** POST 请求体，将作为 JSON 发送 */
  body: unknown;
}

/**
 * SSE 连接管理 Hook（FE-010）
 * - 基于 fetch + ReadableStream，支持 POST 发送参数
 * - 手动解析 SSE 事件流
 * - 120s 僵死连接检测
 * - 连接超时检测
 * - 支持主动断开
 *
 * 相比 EventSource 原生 API 的优势：支持 POST body，不将敏感表单数据暴露在 URL 中。
 */
export function useSSE() {
  const abortRef = useRef<AbortController | null>(null);
  const deadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    setConnected,
    setProgress,
    addDayPlan,
    setDone,
    setError,
    setTimeout: setTimeoutState,
    addWarning,
  } = useGenerationStore();

  const clearTimers = useCallback(() => {
    if (deadTimerRef.current) {
      clearTimeout(deadTimerRef.current);
      deadTimerRef.current = null;
    }
    if (connectTimerRef.current) {
      clearTimeout(connectTimerRef.current);
      connectTimerRef.current = null;
    }
  }, []);

  const resetDeadTimer = useCallback(() => {
    if (deadTimerRef.current) clearTimeout(deadTimerRef.current);
    deadTimerRef.current = setTimeout(() => {
      abortRef.current?.abort();
      setTimeoutState();
    }, SSE_TIMEOUT_MS);
  }, [setTimeoutState]);

  /**
   * 解析 SSE 文本行并分发到对应处理函数
   * 参考：https://html.spec.whatwg.org/multipage/server-sent-events.html
   */
  const parseSSEChunk = useCallback(
    (buffer: string, handlers: Record<string, (data: string) => void>): string => {
      const lines = buffer.split('\n');
      // 保留最后一个不完整的行
      let remainder = '';
      if (!buffer.endsWith('\n')) {
        const last = lines.pop();
        if (last !== undefined) remainder = last;
      }

      let currentEvent = '';
      let currentData = '';

      for (const line of lines) {
        if (line === '') {
          // 空行 = 事件结束，分发
          if (currentData && handlers[currentEvent]) {
            try {
              // 移除末尾换行符
              const dataStr = currentData.endsWith('\n') ? currentData.slice(0, -1) : currentData;
              handlers[currentEvent](dataStr);
            } catch {
              // JSON 解析失败静默跳过（由具体 handler 处理）
            }
          }
          currentEvent = '';
          currentData = '';
          continue;
        }

        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7);
        } else if (line.startsWith('data: ')) {
          currentData += (currentData ? '\n' : '') + line.slice(6);
        }
        // 忽略注释行（以 : 开头）
      }

      return remainder;
    },
    [],
  );

  const connect = useCallback(
    (url: string, options: SSEConnectOptions) => {
      const store = useGenerationStore.getState();
      if (store.status !== 'idle' && store.status !== 'error') {
        useGenerationStore.setState({ status: 'connecting' });
      }

      const controller = new AbortController();
      abortRef.current = controller;

      // 连接超时
      connectTimerRef.current = setTimeout(() => {
        controller.abort();
        setError('连接超时，请重试');
      }, SSE_CONNECT_TIMEOUT_MS);

      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(options.body),
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            clearTimers();
            const errorBody = await response.json().catch(() => null);
            setError(
              (errorBody as { message?: string })?.message ?? `请求失败 (HTTP ${response.status})`,
            );
            return;
          }

          if (!response.body) {
            clearTimers();
            setError('浏览器不支持流式响应');
            return;
          }

          if (connectTimerRef.current) clearTimeout(connectTimerRef.current);

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          const handlers: Record<string, (data: string) => void> = {
            connected: (dataStr) => {
              const data = JSON.parse(dataStr);
              setConnected(data.taskId, data.totalSteps, data.message);
              resetDeadTimer();
            },
            progress: (dataStr) => {
              const data = JSON.parse(dataStr);
              setProgress(
                data.step,
                data.totalSteps,
                data.percent,
                data.message,
                data.subMessage,
                data.estimatedRemainingSeconds,
              );
              resetDeadTimer();
            },
            day_ready: (dataStr) => {
              const data: SSEDayReadyData = JSON.parse(dataStr);
              addDayPlan(data.day);
              resetDeadTimer();
            },
            done: (dataStr) => {
              clearTimers();
              const data = JSON.parse(dataStr);
              setDone(data.tripId, data.totalEstimatedCostCNY, data.summary, data.shareUrl);
              reader.cancel();
            },
            error_event: (dataStr) => {
              resetDeadTimer();
              const data = JSON.parse(dataStr);
              if (data.recoverable) {
                addWarning(data.code, data.message);
              } else {
                clearTimers();
                setError(data.message, data.partialTripId);
                reader.cancel();
              }
            },
            warning: (dataStr) => {
              const data = JSON.parse(dataStr);
              addWarning(data.code, data.message, data.dayIndex);
            },
          };

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              buffer = parseSSEChunk(buffer, handlers);
            }

            // 处理 stream 结束时的残留数据
            const final = decoder.decode();
            if (final) {
              buffer += final;
              parseSSEChunk(buffer + '\n', handlers);
            }

            // Stream 正常结束但未收到 done 事件 → 服务端提前关闭
            const currentState = useGenerationStore.getState();
            if (currentState.status === 'streaming') {
              clearTimers();
              setError('服务端连接提前关闭，可查看已生成部分', currentState.taskId ?? undefined);
            }
          } catch (err) {
            if ((err as Error).name === 'AbortError') {
              // 主动取消，不报错
              return;
            }
            clearTimers();
            const currentState = useGenerationStore.getState();
            setError(`SSE 连接中断 (HTTP ${response.status})`, currentState.taskId ?? undefined);
          }
        })
        .catch((err) => {
          if ((err as Error).name === 'AbortError') {
            return; // 主动取消
          }
          clearTimers();
          setError('网络连接失败，请检查网络后重试');
        });
    },
    [
      setConnected,
      setProgress,
      addDayPlan,
      setDone,
      setError,
      setTimeoutState,
      addWarning,
      resetDeadTimer,
      clearTimers,
      parseSSEChunk,
    ],
  );

  const disconnect = useCallback(() => {
    clearTimers();
    abortRef.current?.abort();
    abortRef.current = null;
  }, [clearTimers]);

  return { connect, disconnect };
}

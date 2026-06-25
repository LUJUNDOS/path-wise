import { create } from 'zustand';
import type { DayPlan } from '@path-wise/shared';

/**
 * SSE 生成过程中的前端状态机状态
 */
export type GenerationStatus =
  | 'idle'
  | 'connecting'
  | 'streaming'
  | 'all_complete'
  | 'error'
  | 'timeout';

interface TripGenerationState {
  status: GenerationStatus;
  taskId: string | null;
  tripId: string | null;
  progressPercent: number;
  currentStep: number;
  totalSteps: number;
  message: string;
  subMessage: string;
  estimatedRemainingSeconds: number;
  completedDays: DayPlan[];
  warnings: Array<{ code: number; message: string; dayIndex?: number }>;
  errorMessage: string | null;
  totalEstimatedCost: number;
  shareUrl: string | null;
  partialTripId: string | null;

  // Actions
  setConnected: (taskId: string, totalSteps: number, message: string) => void;
  setProgress: (
    step: number,
    totalSteps: number,
    percent: number,
    message: string,
    subMessage?: string,
    estimatedRemainingSeconds?: number,
  ) => void;
  addDayPlan: (day: DayPlan) => void;
  setDone: (tripId: string, totalCost: number, summary: string, shareUrl?: string) => void;
  setError: (message: string, partialTripId?: string) => void;
  setTimeout: (partialTripId?: string) => void;
  addWarning: (code: number, message: string, dayIndex?: number) => void;
  resetGeneration: () => void;
}

export const useGenerationStore = create<TripGenerationState>((set) => ({
  status: 'idle',
  taskId: null,
  tripId: null,
  progressPercent: 0,
  currentStep: 0,
  totalSteps: 0,
  message: '',
  subMessage: '',
  estimatedRemainingSeconds: 0,
  completedDays: [],
  warnings: [],
  errorMessage: null,
  totalEstimatedCost: 0,
  shareUrl: null,
  partialTripId: null,

  setConnected: (taskId, totalSteps, message) =>
    set({
      status: 'streaming',
      taskId,
      totalSteps,
      message,
      progressPercent: 0,
    }),

  setProgress: (step, totalSteps, percent, message, subMessage, estimatedRemainingSeconds) =>
    set((state) => ({
      currentStep: step,
      totalSteps,
      progressPercent: percent,
      message,
      subMessage: subMessage ?? state.subMessage,
      estimatedRemainingSeconds: estimatedRemainingSeconds ?? state.estimatedRemainingSeconds,
    })),

  addDayPlan: (day) =>
    set((state) => ({
      completedDays: [...state.completedDays.filter((d) => d.dayIndex !== day.dayIndex), day].sort(
        (a, b) => a.dayIndex - b.dayIndex,
      ),
    })),

  setDone: (tripId, totalCost, summary, shareUrl) =>
    set({
      status: 'all_complete',
      tripId,
      totalEstimatedCost: totalCost,
      message: summary,
      shareUrl: shareUrl ?? null,
    }),

  setError: (message, partialTripId) =>
    set({
      status: 'error',
      errorMessage: message,
      partialTripId: partialTripId ?? null,
    }),

  setTimeout: (partialTripId) =>
    set({
      status: 'timeout',
      errorMessage: '生成超时，可查看已生成部分',
      partialTripId: partialTripId ?? null,
    }),

  addWarning: (code, message, dayIndex) =>
    set((state) => ({
      warnings: [...state.warnings, { code, message, dayIndex }],
    })),

  resetGeneration: () =>
    set({
      status: 'idle',
      taskId: null,
      tripId: null,
      progressPercent: 0,
      currentStep: 0,
      totalSteps: 0,
      message: '',
      subMessage: '',
      estimatedRemainingSeconds: 0,
      completedDays: [],
      warnings: [],
      errorMessage: null,
      totalEstimatedCost: 0,
      shareUrl: null,
      partialTripId: null,
    }),
}));

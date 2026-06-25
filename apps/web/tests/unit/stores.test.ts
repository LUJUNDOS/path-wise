/**
 * Zustand Store 单元测试
 * 依据：docs/测试用例文档_v1.0.0.md
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useTripFormStore } from '@/stores/tripFormStore';
import { useGenerationStore } from '@/stores/generationStore';
import type { DayPlan } from '@path-wise/shared';

const mockDayPlan: DayPlan = {
  dayIndex: 1,
  date: '2026-12-25',
  dayType: 'transit_departure',
  cityName: '长沙',
  isFirstDayOfCity: true,
  title: '抵达长沙',
  timeline: [],
  accommodation: null,
  transport: null,
  weather: null,
  tips: [],
};

describe('useTripFormStore', () => {
  beforeEach(() => {
    useTripFormStore.getState().resetForm();
  });

  describe('出发城市', () => {
    it('应设置出发城市', () => {
      useTripFormStore.getState().setDepartureCity('北京');
      expect(useTripFormStore.getState().departureCity).toBe('北京');
    });
  });

  describe('目的地管理', () => {
    it('应添加目的地', () => {
      useTripFormStore.getState().addDestination('长沙', 3);
      const dests = useTripFormStore.getState().destinations;
      expect(dests).toHaveLength(1);
      expect(dests[0].cityName).toBe('长沙');
      expect(dests[0].days).toBe(3);
    });

    it('添加目的地时默认停留2天', () => {
      useTripFormStore.getState().addDestination('上海');
      expect(useTripFormStore.getState().destinations[0].days).toBe(2);
    });

    it('应删除目的地', () => {
      useTripFormStore.getState().addDestination('长沙');
      useTripFormStore.getState().addDestination('上海');
      useTripFormStore.getState().removeDestination(0);
      expect(useTripFormStore.getState().destinations[0].cityName).toBe('上海');
    });

    it('应更新目的地停留天数', () => {
      useTripFormStore.getState().addDestination('长沙', 3);
      useTripFormStore.getState().updateDestinationDays(0, 5);
      expect(useTripFormStore.getState().destinations[0].days).toBe(5);
    });

    it('应重排目的地顺序', () => {
      useTripFormStore.getState().addDestination('长沙');
      useTripFormStore.getState().addDestination('上海');
      useTripFormStore.getState().reorderDestinations(0, 1);
      const dests = useTripFormStore.getState().destinations;
      expect(dests[0].cityName).toBe('上海');
      expect(dests[1].cityName).toBe('长沙');
    });
  });

  describe('出行人数', () => {
    it('应设置成人人数', () => {
      useTripFormStore.getState().setAdults(3);
      expect(useTripFormStore.getState().travelers.adults).toBe(3);
    });

    it('应设置儿童信息', () => {
      useTripFormStore.getState().setChildren([{ age: 4 }, { age: 10 }]);
      const children = useTripFormStore.getState().travelers.children;
      expect(children).toHaveLength(2);
      expect(children[0].age).toBe(4);
    });

    it('应设置老人人数', () => {
      useTripFormStore.getState().setElders(2);
      expect(useTripFormStore.getState().travelers.elders).toBe(2);
    });
  });

  describe('偏好设置', () => {
    it('应设置预算', () => {
      useTripFormStore.getState().setBudget('luxury');
      expect(useTripFormStore.getState().preferences.budget).toBe('luxury');
    });

    it('应设置节奏', () => {
      useTripFormStore.getState().setPace('relaxed');
      expect(useTripFormStore.getState().preferences.pace).toBe('relaxed');
    });

    it('应设置兴趣标签', () => {
      useTripFormStore.getState().setInterests(['文化', '美食']);
      expect(useTripFormStore.getState().preferences.interests).toEqual(['文化', '美食']);
    });

    it('应切换偏好面板显示', () => {
      expect(useTripFormStore.getState().showPreferences).toBe(false);
      useTripFormStore.getState().togglePreferences();
      expect(useTripFormStore.getState().showPreferences).toBe(true);
    });
  });

  describe('重置', () => {
    it('应重置所有表单状态', () => {
      useTripFormStore.getState().setDepartureCity('北京');
      useTripFormStore.getState().addDestination('长沙');
      useTripFormStore.getState().setAdults(3);
      useTripFormStore.getState().resetForm();

      const state = useTripFormStore.getState();
      expect(state.departureCity).toBe('');
      expect(state.destinations).toHaveLength(0);
      expect(state.travelers.adults).toBe(1);
    });
  });
});

describe('useGenerationStore', () => {
  beforeEach(() => {
    useGenerationStore.getState().resetGeneration();
  });

  it('初始状态应为 idle', () => {
    expect(useGenerationStore.getState().status).toBe('idle');
  });

  it('connected 事件应设置 taskId 和状态为 streaming', () => {
    useGenerationStore.getState().setConnected('task-123', 10, '正在生成...');
    const state = useGenerationStore.getState();
    expect(state.status).toBe('streaming');
    expect(state.taskId).toBe('task-123');
    expect(state.totalSteps).toBe(10);
    expect(state.message).toBe('正在生成...');
  });

  it('progress 事件应更新进度', () => {
    useGenerationStore.getState().setConnected('task-123', 10, '');
    useGenerationStore.getState().setProgress(3, 10, 30, '处理中...', '已选择岳麓山', 45);
    const state = useGenerationStore.getState();
    expect(state.currentStep).toBe(3);
    expect(state.progressPercent).toBe(30);
    expect(state.estimatedRemainingSeconds).toBe(45);
  });

  it('addDayPlan 应添加并排序已完成的天', () => {
    const day2: DayPlan = { ...mockDayPlan, dayIndex: 2, title: 'Day 2' };
    const day1: DayPlan = { ...mockDayPlan, dayIndex: 1, title: 'Day 1' };
    useGenerationStore.getState().addDayPlan(day2);
    useGenerationStore.getState().addDayPlan(day1);

    const days = useGenerationStore.getState().completedDays;
    expect(days).toHaveLength(2);
    expect(days[0].dayIndex).toBe(1);
    expect(days[1].dayIndex).toBe(2);
  });

  it('done 事件应设置状态为 all_complete', () => {
    useGenerationStore.getState().setDone('trip-456', 5800, '生成完成', 'https://share.url');
    const state = useGenerationStore.getState();
    expect(state.status).toBe('all_complete');
    expect(state.tripId).toBe('trip-456');
    expect(state.totalEstimatedCost).toBe(5800);
    expect(state.shareUrl).toBe('https://share.url');
  });

  it('error 事件应设置错误信息', () => {
    useGenerationStore.getState().setError('LLM调用失败', 'partial-789');
    const state = useGenerationStore.getState();
    expect(state.status).toBe('error');
    expect(state.errorMessage).toBe('LLM调用失败');
    expect(state.partialTripId).toBe('partial-789');
  });

  it('timeout 应设置状态', () => {
    useGenerationStore.getState().setTimeout('partial-789');
    const state = useGenerationStore.getState();
    expect(state.status).toBe('timeout');
    expect(state.errorMessage).toContain('超时');
  });
});

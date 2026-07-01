/**
 * ENGINE-001 时间轴初始化 · 单元测试
 *
 * 依据：
 *   - docs/任务分解_WBS_v1.0.0.md §5.2 ENGINE-001 验收标准
 *   - docs/Trip_Lifecycle_引擎算法设计.md §3
 *   - docs/测试用例文档_第三部分_引擎层_v1.0.0.md
 */

import { describe, it, expect } from 'vitest';
import type { TripGenerateRequest } from '@path-wise/shared';
import { BusinessError } from '../types/errors.js';
import { initializeTimeline, computeTransferDayWindow, TIMELINE_CONFIG } from './trip_engine.js';

// ─────────────────────────────────────────────
// 辅助：构造最小合法 TripGenerateRequest
// ─────────────────────────────────────────────

function makeRequest(overrides: Partial<TripGenerateRequest> = {}): TripGenerateRequest {
  return {
    departure: {
      city: '北京',
      date: '2026-07-01',
      timePeriod: 'morning',
    },
    destinations: [
      { cityName: '长沙', days: 3, transportTo: 'high_speed_rail' },
      { cityName: '广州', days: 2, transportTo: 'high_speed_rail' },
    ],
    travelers: { adults: 2, children: [], elders: 0 },
    preferences: {
      budget: 'comfort',
      pace: 'moderate',
      accommodation: 'chain_hotel',
      dining: [],
      interests: [],
    },
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// WBS §5.2 验收标准 1：功能验收 — 日类型标记正确性
// ─────────────────────────────────────────────

describe('ENGINE-001 · initializeTimeline — 日类型标记正确性', () => {
  // ── 验收标准 1.1：单城市 — Day 1 = transit_departure，其余 = city_exploration ──
  describe('单城市行程（WBS 验收 1.1）', () => {
    it('单城市 2 天：Day 1 = transit_departure, Day 2 = city_exploration', () => {
      const req = makeRequest({
        destinations: [{ cityName: '长沙', days: 2, transportTo: null }],
      });
      const { timeline, totalDays } = initializeTimeline(req);

      expect(totalDays).toBe(2);
      expect(timeline).toHaveLength(2);
      expect(timeline[0].dayType).toBe('transit_departure');
      expect(timeline[0].city).toBe('长沙');
      expect(timeline[1].dayType).toBe('city_exploration');
    });

    it('单城市 4 天：Day 1 = transit_departure，其余全部 city_exploration', () => {
      const req = makeRequest({
        destinations: [{ cityName: '北京', days: 4, transportTo: null }],
      });
      const { timeline, totalDays } = initializeTimeline(req);

      expect(totalDays).toBe(4);
      expect(timeline).toHaveLength(4);
      expect(timeline[0].dayType).toBe('transit_departure');
      for (let i = 1; i < timeline.length; i++) {
        expect(timeline[i].dayType).toBe('city_exploration');
      }
    });
  });

  // ── 验收标准 1.2：多城市 — 正确插入 transit_transfer 日 ──
  describe('多城市行程（WBS 验收 1.2）', () => {
    it('北京→长沙(3d)→广州(2d)：验证 dayType 序列', () => {
      const req = makeRequest({
        destinations: [
          { cityName: '长沙', days: 3, transportTo: 'high_speed_rail' },
          { cityName: '广州', days: 2, transportTo: 'high_speed_rail' },
        ],
      });
      const { timeline, totalDays } = initializeTimeline(req);

      // totalDays = 3 + 2 = 5
      expect(totalDays).toBe(5);

      // 期望：
      // Day 1: transit_departure（长沙出发日）
      // Day 2: city_exploration（长沙）
      // Day 3: transit_transfer（长沙→广州）
      // Day 4: city_exploration（广州）
      // Day 5: city_exploration（广州）
      const dayTypes = timeline.map((d) => d.dayType);
      expect(dayTypes).toEqual([
        'transit_departure',
        'city_exploration',
        'transit_transfer',
        'city_exploration',
        'city_exploration',
      ]);

      const cities = timeline.map((d) => d.city);
      expect(cities).toEqual(['长沙', '长沙', '长沙', '广州', '广州']);
    });

    it('北京→长沙(5d)→南昌(3d)→广州(4d)：验证 dayType 序列', () => {
      const req = makeRequest({
        destinations: [
          { cityName: '长沙', days: 5, transportTo: 'high_speed_rail' },
          { cityName: '南昌', days: 3, transportTo: 'flight' },
          { cityName: '广州', days: 4, transportTo: 'high_speed_rail' },
        ],
      });
      const { timeline, totalDays } = initializeTimeline(req);

      // totalDays = 5 + 3 + 4 = 12
      expect(totalDays).toBe(12);

      // 期望：
      // Day 1:  transit_departure（长沙出发日）
      // Day 2-4: city_exploration（长沙 × 3）
      // Day 5:  transit_transfer（长沙→南昌）
      // Day 6-7: city_exploration（南昌 × 2）
      // Day 8:  transit_transfer（南昌→广州）
      // Day 9-12: city_exploration（广州 × 4）
      const expectedDayTypes = [
        'transit_departure',
        'city_exploration',
        'city_exploration',
        'city_exploration',
        'transit_transfer',
        'city_exploration',
        'city_exploration',
        'transit_transfer',
        'city_exploration',
        'city_exploration',
        'city_exploration',
        'city_exploration',
      ];
      expect(timeline.map((d) => d.dayType)).toEqual(expectedDayTypes);
    });
  });

  // ── 验收标准 1.3：每个 Day 的 availableWindow 计算正确 ──
  describe('availableWindow 计算（WBS 验收 1.3）', () => {
    it('transit_departure 日：窗口为 14:00~22:00（480min）', () => {
      const req = makeRequest({
        destinations: [{ cityName: '长沙', days: 2, transportTo: null }],
      });
      const { timeline } = initializeTimeline(req);

      const day1 = timeline[0];
      expect(day1.dayType).toBe('transit_departure');
      expect(day1.availableWindow.start).toBe('14:00');
      expect(day1.availableWindow.end).toBe('22:00');
      expect(day1.availableWindow.totalMinutes).toBe(480);
    });

    it('city_exploration 日：窗口为 09:00~22:00（780min）', () => {
      const req = makeRequest({
        destinations: [{ cityName: '长沙', days: 2, transportTo: null }],
      });
      const { timeline } = initializeTimeline(req);

      const deepPlayDay = timeline[1];
      expect(deepPlayDay.dayType).toBe('city_exploration');
      expect(deepPlayDay.availableWindow.start).toBe('09:00');
      expect(deepPlayDay.availableWindow.end).toBe('22:00');
      expect(deepPlayDay.availableWindow.totalMinutes).toBe(780);
    });

    it('transit_transfer 日（high_speed_rail）：窗口受大交通出发时间约束', () => {
      const req = makeRequest({
        destinations: [
          { cityName: '长沙', days: 3, transportTo: 'high_speed_rail' },
          { cityName: '广州', days: 2, transportTo: 'high_speed_rail' },
        ],
      });
      const { timeline } = initializeTimeline(req);

      // Day 3 是 transit_transfer（长沙→广州），transportTo = high_speed_rail
      const transferDay = timeline[2];
      expect(transferDay.dayType).toBe('transit_transfer');
      // 默认出发时间 16:00，buffer = 90min，transitToHub = 60min
      // 最晚离开市区 = 960 - 90 - 60 = 810min = 13:30
      expect(transferDay.availableWindow.start).toBe('09:00');
      expect(transferDay.availableWindow.end).toBe('13:30');
      expect(transferDay.availableWindow.totalMinutes).toBe(270);
    });

    it('transit_transfer 日（flight）：缓冲 120min', () => {
      const req = makeRequest({
        destinations: [
          { cityName: '长沙', days: 3, transportTo: null },
          // transit_transfer from 长沙→广州 uses flight
          { cityName: '广州', days: 2, transportTo: 'flight' },
        ],
      });
      const { timeline } = initializeTimeline(req);

      // Day 3 是 transit_transfer（长沙→广州），transportTo = flight
      const transferDay = timeline[2];
      expect(transferDay.dayType).toBe('transit_transfer');
      // 16:00 - 120min(flight buffer) - 60min(transitToHub) = 780min = 13:00
      expect(transferDay.availableWindow.start).toBe('09:00');
      expect(transferDay.availableWindow.end).toBe('13:00');
      expect(transferDay.availableWindow.totalMinutes).toBe(240);
    });
  });
});

// ─────────────────────────────────────────────
// WBS §5.2 验收标准 2：边界验收
// ─────────────────────────────────────────────

describe('ENGINE-001 · initializeTimeline — 边界情况', () => {
  it('单城市 days=1：只有 transit_departure 日', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 1, transportTo: null }],
    });
    const { timeline, totalDays } = initializeTimeline(req);

    expect(totalDays).toBe(1);
    expect(timeline).toHaveLength(1);
    expect(timeline[0].dayType).toBe('transit_departure');
  });

  it('中间城市 days=1：直接 transit_transfer，无 city_exploration（WBS §10.1）', () => {
    const req = makeRequest({
      destinations: [
        { cityName: '长沙', days: 3, transportTo: 'high_speed_rail' },
        { cityName: '南昌', days: 1, transportTo: 'high_speed_rail' },
        { cityName: '广州', days: 2, transportTo: 'high_speed_rail' },
      ],
    });
    const { timeline, totalDays } = initializeTimeline(req);

    // totalDays = 3 + 1 + 2 = 6
    expect(totalDays).toBe(6);

    // 期望：
    // Day 1: transit_departure（长沙）
    // Day 2: city_exploration（长沙）
    // Day 3: transit_transfer（长沙→南昌）
    // Day 4: transit_transfer（南昌→广州）-- 南昌只有 1 天，直接中转
    // Day 5: city_exploration（广州）
    // Day 6: city_exploration（广州）
    const dayTypes = timeline.map((d) => d.dayType);
    expect(dayTypes).toEqual([
      'transit_departure',
      'city_exploration',
      'transit_transfer',
      'transit_transfer',
      'city_exploration',
      'city_exploration',
    ]);

    // 验证南昌只有 transit_transfer，无 city_exploration
    const nanchangDays = timeline.filter((d) => d.city === '南昌');
    expect(nanchangDays).toHaveLength(1);
    expect(nanchangDays[0].dayType).toBe('transit_transfer');
  });

  it('总天数超过 30 时抛出错误', () => {
    const req = makeRequest({
      destinations: [
        { cityName: '长沙', days: 15, transportTo: 'high_speed_rail' },
        { cityName: '广州', days: 16, transportTo: 'high_speed_rail' },
      ],
    });
    expect(() => initializeTimeline(req)).toThrow(BusinessError);
  });

  it('总天数恰好 30 时不抛错', () => {
    const req = makeRequest({
      destinations: [
        { cityName: '长沙', days: 15, transportTo: 'high_speed_rail' },
        { cityName: '广州', days: 15, transportTo: 'high_speed_rail' },
      ],
    });
    expect(() => initializeTimeline(req)).not.toThrow();
  });

  it('destinations 为空时抛出错误', () => {
    const req = makeRequest({ destinations: [] });
    expect(() => initializeTimeline(req)).toThrow(BusinessError);
  });
});

// ─────────────────────────────────────────────
// WBS §5.2 验收标准 3：单元测试 — 验证输出结构
// ─────────────────────────────────────────────

describe('ENGINE-001 · initializeTimeline — 验证输出结构', () => {
  it('每个 TimelineDay 包含所有必需字段', () => {
    const req = makeRequest();
    const { timeline, totalDays } = initializeTimeline(req);

    for (const day of timeline) {
      expect(day).toHaveProperty('dayIndex');
      expect(day).toHaveProperty('date');
      expect(day).toHaveProperty('dayType');
      expect(day).toHaveProperty('city');
      expect(day).toHaveProperty('availableWindow');
      expect(day.availableWindow).toHaveProperty('start');
      expect(day.availableWindow).toHaveProperty('end');
      expect(day.availableWindow).toHaveProperty('totalMinutes');
      expect(day.dayIndex).toBeGreaterThan(0);
      expect(day.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }

    expect(totalDays).toBe(timeline.length);
  });

  it('dayIndex 从 1 开始连续递增', () => {
    const req = makeRequest();
    const { timeline } = initializeTimeline(req);

    for (let i = 0; i < timeline.length; i++) {
      expect(timeline[i].dayIndex).toBe(i + 1);
    }
  });

  it('日期按天递增，无重复', () => {
    const req = makeRequest({
      departure: { city: '北京', date: '2026-07-01', timePeriod: 'morning' },
      destinations: [
        { cityName: '长沙', days: 3, transportTo: 'high_speed_rail' },
        { cityName: '广州', days: 2, transportTo: 'high_speed_rail' },
      ],
    });
    const { timeline } = initializeTimeline(req);

    const dates = timeline.map((d) => d.date);
    const uniqueDates = new Set(dates);
    expect(uniqueDates.size).toBe(dates.length);

    // 验证日期严格递增
    for (let i = 0; i < dates.length - 1; i++) {
      expect(new Date(dates[i + 1] + 'T00:00:00Z') > new Date(dates[i] + 'T00:00:00Z')).toBe(true);
    }

    // 第一天应该是出发日期
    expect(dates[0]).toBe('2026-07-01');
  });

  it('transit_transfer 日携带 transferInfo', () => {
    const req = makeRequest({
      destinations: [
        { cityName: '长沙', days: 2, transportTo: 'high_speed_rail' },
        { cityName: '广州', days: 2, transportTo: 'high_speed_rail' },
      ],
    });
    const { timeline } = initializeTimeline(req);

    const transferDays = timeline.filter((d) => d.dayType === 'transit_transfer');
    for (const day of transferDays) {
      expect(day.transferInfo).toBeDefined();
      expect(day.transferInfo!.departCity).toBeTruthy();
      expect(day.transferInfo!.arriveCity).toBeTruthy();
      expect(day.transferInfo!.suggestion).toBeTruthy();
    }
  });

  it('city_exploration 日不携带 transferInfo', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 4, transportTo: null }],
    });
    const { timeline } = initializeTimeline(req);

    const deepPlayDays = timeline.filter((d) => d.dayType === 'city_exploration');
    for (const day of deepPlayDays) {
      expect(day.transferInfo).toBeUndefined();
    }
  });
});

// ─────────────────────────────────────────────
// WBS §5.2 验收标准 4：computeTransferDayWindow 缓冲时间
// ─────────────────────────────────────────────

describe('ENGINE-001 · computeTransferDayWindow — 缓冲时间', () => {
  it('high_speed_rail：缓冲 90min', () => {
    const window = computeTransferDayWindow('high_speed_rail', '16:00', 60);
    // 16:00(960min) - 90min - 60min = 810min = 13:30
    expect(window.end).toBe('13:30');
    expect(window.totalMinutes).toBe(270); // 09:00→13:30 = 270min
  });

  it('normal_train：缓冲 90min', () => {
    const window = computeTransferDayWindow('normal_train', '16:00', 60);
    expect(window.end).toBe('13:30');
  });

  it('flight：缓冲 120min', () => {
    const window = computeTransferDayWindow('flight', '16:00', 60);
    // 16:00(960min) - 120min - 60min = 780min = 13:00
    expect(window.end).toBe('13:00');
    expect(window.totalMinutes).toBe(240); // 09:00→13:00 = 240min
  });

  it('bus：缓冲 60min', () => {
    const window = computeTransferDayWindow('bus', '16:00', 60);
    // 16:00(960min) - 60min - 60min = 840min = 14:00
    expect(window.end).toBe('14:00');
    expect(window.totalMinutes).toBe(300); // 09:00→14:00 = 300min
  });

  it('出发时间极早导致窗口为零', () => {
    const window = computeTransferDayWindow('high_speed_rail', '08:00', 60);
    // 08:00(480min) - 90min - 60min = 330min = 05:30，早于 09:00
    expect(window.totalMinutes).toBe(0);
    expect(window.start).toBe('09:00');
    expect(window.end).toBe('09:00');
  });

  it('出发时间恰好让窗口为零', () => {
    // 09:00 + 90min(buffer) + 60min(transit) = 11:30
    const window = computeTransferDayWindow('high_speed_rail', '11:30', 60);
    expect(window.totalMinutes).toBe(0);
  });

  it('transportType 为 null 时默认按 high_speed_rail 处理', () => {
    const window = computeTransferDayWindow(null, '16:00', 60);
    expect(window.end).toBe('13:30'); // 同 high_speed_rail
  });

  it('不同的 transitToHubMinutes 影响窗口', () => {
    const window1 = computeTransferDayWindow('high_speed_rail', '16:00', 30);
    // 16:00 - 90 - 30 = 14:00
    expect(window1.end).toBe('14:00');

    const window2 = computeTransferDayWindow('high_speed_rail', '16:00', 90);
    // 16:00 - 90 - 90 = 13:00
    expect(window2.end).toBe('13:00');
  });
});

// ─────────────────────────────────────────────
// 返程日支持
// ─────────────────────────────────────────────

describe('ENGINE-001 · initializeTimeline — 返程日', () => {
  it('多城市 needsReturnTransport=true 时最后一天为 transit_return', () => {
    const req = makeRequest({
      destinations: [
        { cityName: '长沙', days: 3, transportTo: 'high_speed_rail' },
        { cityName: '广州', days: 2, transportTo: 'high_speed_rail' },
      ],
      needsReturnTransport: true,
      returnTransportPref: 'high_speed_rail',
    });
    const { timeline } = initializeTimeline(req);

    const lastDay = timeline[timeline.length - 1];
    expect(lastDay.dayType).toBe('transit_return');
    expect(lastDay.transferInfo).toBeDefined();
    expect(lastDay.transferInfo!.arriveCity).toBe('北京'); // 返回到出发城市
  });

  it('needsReturnTransport=false 时最后一天为 city_exploration', () => {
    const req = makeRequest({
      destinations: [
        { cityName: '长沙', days: 3, transportTo: 'high_speed_rail' },
        { cityName: '广州', days: 2, transportTo: 'high_speed_rail' },
      ],
      needsReturnTransport: false,
    });
    const { timeline } = initializeTimeline(req);

    const lastDay = timeline[timeline.length - 1];
    expect(lastDay.dayType).toBe('city_exploration');
    expect(lastDay.transferInfo).toBeUndefined();
  });

  it('单城市 + needsReturnTransport：最后一天为 transit_return', () => {
    const req = makeRequest({
      destinations: [{ cityName: '长沙', days: 3, transportTo: null }],
      needsReturnTransport: true,
      returnTransportPref: 'flight',
    });
    const { timeline } = initializeTimeline(req);

    // Day 1=transit_departure, Day 2=city_exploration, Day 3=transit_return
    expect(timeline.length).toBe(3);
    const types = timeline.map((d) => d.dayType);
    expect(types).toEqual(['transit_departure', 'city_exploration', 'transit_return']);
  });
});

// ─────────────────────────────────────────────
// 算法配置常量验证
// ─────────────────────────────────────────────

describe('ENGINE-001 · TIMELINE_CONFIG', () => {
  it('所有交通类型都有对应的缓冲时间', () => {
    const types = ['flight', 'bus', 'high_speed_rail', 'normal_train', 'auto'];
    for (const t of types) {
      expect(
        TIMELINE_CONFIG.BUFFER_MINUTES[t as keyof typeof TIMELINE_CONFIG.BUFFER_MINUTES],
      ).toBeGreaterThan(0);
    }
  });

  it('默认可用分钟数 = 13h = 780min', () => {
    expect(TIMELINE_CONFIG.DEFAULT_AVAILABLE_MINUTES).toBe(780);
  });

  it('MAX_TOTAL_DAYS = 30', () => {
    expect(TIMELINE_CONFIG.MAX_TOTAL_DAYS).toBe(30);
  });
});

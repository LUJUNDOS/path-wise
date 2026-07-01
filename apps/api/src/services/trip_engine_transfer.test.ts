/**
 * ENGINE-004 中转日特殊逻辑 · 单元测试
 *
 * 依据：
 *   - docs/任务分解_WBS_v1.0.0.md §5.2 ENGINE-004 验收标准
 *   - docs/Trip_Lifecycle_引擎算法设计.md §6
 *   - docs/测试用例文档_第三部分_引擎层_v1.0.0.md §4.4
 */

import { describe, it, expect } from 'vitest';
import type { EnginePOI } from './trip_engine_candidate.js';
import type { TimelineDay, TransferInfo } from './trip_engine.js';
import type {
  TransferDayContext,
  HubTimeBlock,
  TransferDayResult,
} from './trip_engine_transfer.js';
import {
  handleTransferDay,
  isHighIntensityActivity,
  isTransferDaySuitable,
  buildHubTimeBlock,
  isTransferDay,
  TRANSFER_CONFIG,
} from './trip_engine_transfer.js';
import { timeToMinutes } from '../utils/date_utils.js';

// ─────────────────────────────────────────────
// 辅助：构造测试数据
// ─────────────────────────────────────────────

function makePOI(overrides: Partial<EnginePOI> = {}): EnginePOI {
  return {
    id: 'test_poi_1',
    name: '测试景点',
    city: '长沙',
    category: 'attraction',
    durationMin: 120,
    energyLevel: 'MEDIUM',
    bestTimeSlot: ['morning', 'afternoon'],
    suitableFor: ['adult', 'elder', 'child'],
    priceRange: { min: 30, max: 100 },
    bookingRequired: false,
    ...overrides,
  };
}

function makeTimelineDay(overrides: Partial<TimelineDay> = {}): TimelineDay {
  return {
    dayIndex: 3,
    date: '2026-07-03',
    dayType: 'transit_transfer',
    city: '长沙',
    availableWindow: {
      start: '09:00',
      end: '13:30',
      totalMinutes: timeToMinutes('13:30') - timeToMinutes('09:00'), // 270 min
    },
    transferInfo: {
      departCity: '长沙',
      arriveCity: '广州',
      departTime: '16:00',
      arriveTime: '19:00',
      transportType: 'high_speed_rail',
      suggestion: '今天下午从长沙出发前往广州',
    },
    ...overrides,
  };
}

function makeContext(overrides: Partial<TransferDayContext> = {}): TransferDayContext {
  return {
    currentCity: '长沙',
    nextCity: '广州',
    transportType: 'high_speed_rail',
    departTime: '16:00',
    transitToHubMinutes: 90,
    ...overrides,
  };
}

// ─────────────────────────────────────────────
// 1. isHighIntensityActivity
// ─────────────────────────────────────────────

describe('ENGINE-004 · isHighIntensityActivity', () => {
  describe('体力等级判断', () => {
    it('energyLevel === HIGH 的 POI 应判定为高强度', () => {
      const poi = makePOI({ energyLevel: 'HIGH', name: '普通公园' });
      expect(isHighIntensityActivity(poi)).toBe(true);
    });

    it('energyLevel === MEDIUM 且名称不含关键词 → 非高强度', () => {
      const poi = makePOI({ energyLevel: 'MEDIUM', name: '太平老街' });
      expect(isHighIntensityActivity(poi)).toBe(false);
    });

    it('energyLevel === LOW 的 POI 应判定为非高强度', () => {
      const poi = makePOI({ energyLevel: 'LOW', name: '咖啡馆' });
      expect(isHighIntensityActivity(poi)).toBe(false);
    });
  });

  describe('关键词匹配', () => {
    it('名称包含"徒步" → 高强度', () => {
      const poi = makePOI({ energyLevel: 'LOW', name: '漓江徒步路线' });
      expect(isHighIntensityActivity(poi)).toBe(true);
    });

    it('名称包含"登山" → 高强度', () => {
      const poi = makePOI({ energyLevel: 'LOW', name: '香山登山步道' });
      expect(isHighIntensityActivity(poi)).toBe(true);
    });

    it('名称包含"爬山" → 高强度', () => {
      const poi = makePOI({ energyLevel: 'MEDIUM', name: '岳麓爬山' });
      expect(isHighIntensityActivity(poi)).toBe(true);
    });

    it('名称包含"攀岩" → 高强度', () => {
      const poi = makePOI({ energyLevel: 'MEDIUM', name: '室内攀岩馆' });
      expect(isHighIntensityActivity(poi)).toBe(true);
    });

    it('名称包含"滑雪" → 高强度', () => {
      const poi = makePOI({ energyLevel: 'HIGH', name: '室内滑雪场' }); // 名称命中 + 能量双重
      expect(isHighIntensityActivity(poi)).toBe(true);
    });

    it('名称包含"长城" → 高强度', () => {
      const poi = makePOI({ energyLevel: 'MEDIUM', name: '八达岭长城' });
      expect(isHighIntensityActivity(poi)).toBe(true);
    });

    it('名称包含"漂流" → 高强度', () => {
      const poi = makePOI({ energyLevel: 'MEDIUM', name: '猛洞河漂流' });
      expect(isHighIntensityActivity(poi)).toBe(true);
    });

    it('名称包含"冲浪" → 高强度', () => {
      const poi = makePOI({ energyLevel: 'HIGH', name: '海上冲浪体验' });
      expect(isHighIntensityActivity(poi)).toBe(true);
    });

    it('名称包含"潜水" → 高强度', () => {
      const poi = makePOI({ energyLevel: 'HIGH', name: '深海潜水' });
      expect(isHighIntensityActivity(poi)).toBe(true);
    });

    it('名称包含"骑行全程" → 高强度', () => {
      const poi = makePOI({ energyLevel: 'MEDIUM', name: '环湖骑行全程路线' });
      expect(isHighIntensityActivity(poi)).toBe(true);
    });

    it('名称不包含任何关键词的 LOW/MEDIUM POI → 非高强度', () => {
      const poi = makePOI({ energyLevel: 'LOW', name: '五一广场' });
      expect(isHighIntensityActivity(poi)).toBe(false);
    });
  });
});

// ─────────────────────────────────────────────
// 2. isTransferDaySuitable
// ─────────────────────────────────────────────

describe('ENGINE-004 · isTransferDaySuitable', () => {
  it('LOW 体力 attraction POI → 适合', () => {
    const poi = makePOI({ energyLevel: 'LOW', category: 'attraction' });
    expect(isTransferDaySuitable(poi)).toBe(true);
  });

  it('MEDIUM 体力 attraction POI → 适合', () => {
    const poi = makePOI({ energyLevel: 'MEDIUM', category: 'attraction' });
    expect(isTransferDaySuitable(poi)).toBe(true);
  });

  it('HIGH 体力 POI → 不适合', () => {
    const poi = makePOI({ energyLevel: 'HIGH', category: 'attraction' });
    expect(isTransferDaySuitable(poi)).toBe(false);
  });

  it('nature 类别 + MEDIUM 体力 → 不适合（高强度类别）', () => {
    const poi = makePOI({ energyLevel: 'MEDIUM', category: 'nature' });
    expect(isTransferDaySuitable(poi)).toBe(false);
  });

  it('nature 类别 + HIGH 体力 → 不适合', () => {
    const poi = makePOI({ energyLevel: 'HIGH', category: 'nature' });
    expect(isTransferDaySuitable(poi)).toBe(false);
  });

  it('nature 类别 + LOW 体力 → 适合（允许轻松自然景点）', () => {
    const poi = makePOI({ energyLevel: 'LOW', category: 'nature', name: '城市公园' });
    expect(isTransferDaySuitable(poi)).toBe(true);
  });

  it('dining 类别 → 适合（用餐不受限制）', () => {
    const poi = makePOI({ energyLevel: 'LOW', category: 'dining' });
    expect(isTransferDaySuitable(poi)).toBe(true);
  });

  it('shopping 类别 → 适合', () => {
    const poi = makePOI({ energyLevel: 'LOW', category: 'shopping' });
    expect(isTransferDaySuitable(poi)).toBe(true);
  });

  it('名称含关键词但 LOW 体力 → 不适合（关键词优先）', () => {
    const poi = makePOI({ energyLevel: 'LOW', category: 'attraction', name: '徒步入门体验' });
    expect(isTransferDaySuitable(poi)).toBe(false);
  });
});

// ─────────────────────────────────────────────
// 3. buildHubTimeBlock
// ─────────────────────────────────────────────

describe('ENGINE-004 · buildHubTimeBlock', () => {
  it('应返回 type 为 transit_to_hub', () => {
    const block = buildHubTimeBlock(800, 90, '长沙南站', '长沙');
    expect(block.type).toBe('transit_to_hub');
  });

  it('应正确计算 startTimeMinutes = windowEnd - transitDuration', () => {
    const block = buildHubTimeBlock(800, 90);
    expect(block.startTimeMinutes).toBe(710); // 800 - 90
    expect(block.endTimeMinutes).toBe(800);
  });

  it('固定 1.5h (90min) 交通时长', () => {
    const block = buildHubTimeBlock(840, TRANSFER_CONFIG.HUB_TRANSIT_DURATION_MINUTES);
    expect(block.transitDurationMinutes).toBe(90);
    expect(block.endTimeMinutes - block.startTimeMinutes).toBe(90);
  });

  it('windowEndMinutes 很小时 startTimeMinutes 不应为负', () => {
    const block = buildHubTimeBlock(30, 90);
    expect(block.startTimeMinutes).toBe(0);
    expect(block.endTimeMinutes).toBe(30);
  });

  it('description 应包含城市名和枢纽名', () => {
    const block = buildHubTimeBlock(800, 90, '长沙南站', '长沙');
    expect(block.description).toContain('长沙');
    expect(block.description).toContain('长沙南站');
    expect(block.description).toContain('90 分钟');
  });

  it('description 应包含 transitMode', () => {
    const block = buildHubTimeBlock(800, 90, '机场', '北京');
    expect(block.description).toContain('地铁/出租车');
  });

  it('transitMode 默认为地铁/出租车', () => {
    const block = buildHubTimeBlock(800, 90);
    expect(block.transitMode).toBe('地铁/出租车');
  });

  it('无城市名时 description 仍可工作', () => {
    const block = buildHubTimeBlock(800, 90, '机场');
    expect(block.description).toContain('机场');
  });
});

// ─────────────────────────────────────────────
// 4. handleTransferDay
// ─────────────────────────────────────────────

describe('ENGINE-004 · handleTransferDay', () => {
  describe('过滤高强度活动', () => {
    it('应过滤掉所有 energyLevel === HIGH 的 POI', () => {
      const day = makeTimelineDay();
      const candidates = [
        makePOI({ id: '1', energyLevel: 'HIGH', name: '岳麓山' }),
        makePOI({ id: '2', energyLevel: 'MEDIUM', name: '太平老街' }),
        makePOI({ id: '3', energyLevel: 'HIGH', name: '橘子洲头' }),
        makePOI({ id: '4', energyLevel: 'LOW', name: '咖啡馆' }),
      ];
      const context = makeContext();

      const result = handleTransferDay(day, candidates, context);

      expect(result.filteredPOIs).toHaveLength(2);
      expect(result.filteredPOIs.map((p) => p.id)).toEqual(['2', '4']);
    });

    it('应过滤掉名称包含高强度关键词的 POI（即使体力为 LOW）', () => {
      const day = makeTimelineDay();
      const candidates = [
        makePOI({ id: '1', energyLevel: 'LOW', name: '漓江徒步路线' }),
        makePOI({ id: '2', energyLevel: 'MEDIUM', name: '五一广场' }),
      ];
      const context = makeContext();

      const result = handleTransferDay(day, candidates, context);

      expect(result.filteredPOIs).toHaveLength(1);
      expect(result.filteredPOIs[0].id).toBe('2');
    });

    it('应过滤掉 nature + MEDIUM/HIGH 的 POI', () => {
      const day = makeTimelineDay();
      const candidates = [
        makePOI({ id: '1', energyLevel: 'MEDIUM', category: 'nature', name: '岳麓山' }),
        makePOI({ id: '2', energyLevel: 'LOW', category: 'attraction', name: '博物馆' }),
        makePOI({ id: '3', energyLevel: 'HIGH', category: 'nature', name: '徒步路线' }),
        makePOI({ id: '4', energyLevel: 'LOW', category: 'nature', name: '城市公园' }),
      ];
      const context = makeContext();

      const result = handleTransferDay(day, candidates, context);

      expect(result.filteredPOIs).toHaveLength(2);
      expect(result.filteredPOIs.map((p) => p.id)).toEqual(['2', '4']);
    });

    it('空活动列表 → 返回空 filteredPOIs', () => {
      const day = makeTimelineDay();
      const result = handleTransferDay(day, [], makeContext());

      expect(result.filteredPOIs).toHaveLength(0);
    });

    it('全部是高强度活动 → 返回空 filteredPOIs', () => {
      const day = makeTimelineDay();
      const candidates = [
        makePOI({ id: '1', energyLevel: 'HIGH', name: '登山路线' }),
        makePOI({ id: '2', energyLevel: 'HIGH', name: '攀岩馆' }),
        makePOI({ id: '3', energyLevel: 'HIGH', name: '主题公园' }),
      ];
      const context = makeContext();

      const result = handleTransferDay(day, candidates, context);

      expect(result.filteredPOIs).toHaveLength(0);
    });

    it('dining 和 shopping 类别不受过滤', () => {
      const day = makeTimelineDay();
      const candidates = [
        makePOI({ id: '1', energyLevel: 'LOW', category: 'dining', name: '火宫殿' }),
        makePOI({ id: '2', energyLevel: 'LOW', category: 'shopping', name: '五一商圈' }),
        makePOI({ id: '3', energyLevel: 'MEDIUM', category: 'dining', name: '文和友' }),
      ];
      const context = makeContext();

      const result = handleTransferDay(day, candidates, context);

      expect(result.filteredPOIs).toHaveLength(3);
    });
  });

  describe('枢纽时间块注入', () => {
    it('应生成 hubBlock 且 type 为 transit_to_hub', () => {
      const day = makeTimelineDay();
      const candidates = [makePOI()];
      const context = makeContext();

      const result = handleTransferDay(day, candidates, context);

      expect(result.hubBlock).toBeDefined();
      expect(result.hubBlock.type).toBe('transit_to_hub');
    });

    it('hubBlock 时长应为 90 分钟', () => {
      const day = makeTimelineDay();
      const result = handleTransferDay(day, [makePOI()], makeContext());

      expect(result.hubBlock.transitDurationMinutes).toBe(90);
      expect(result.hubBlock.endTimeMinutes - result.hubBlock.startTimeMinutes).toBe(90);
    });

    it('hubBlock 应位于当日时间窗口末尾', () => {
      const day = makeTimelineDay();
      const windowEndMin = timeToMinutes(day.availableWindow.end);

      const result = handleTransferDay(day, [makePOI()], makeContext());

      expect(result.hubBlock.endTimeMinutes).toBe(windowEndMin);
      expect(result.hubBlock.startTimeMinutes).toBe(windowEndMin - 90);
    });

    it('不同 transportType 不应影响 hubBlock（去枢纽时间固定）', () => {
      const day = makeTimelineDay();
      const contextFlight = makeContext({ transportType: 'flight' });
      const contextTrain = makeContext({ transportType: 'normal_train' });

      const resultFlight = handleTransferDay(day, [makePOI()], contextFlight);
      const resultTrain = handleTransferDay(day, [makePOI()], contextTrain);

      // hubBlock 时长相同（固定 1.5h），但窗口结束时间取决于引擎初始化计算
      expect(resultFlight.hubBlock.transitDurationMinutes).toBe(90);
      expect(resultTrain.hubBlock.transitDurationMinutes).toBe(90);
    });

    it('可自定义 transitToHubMinutes', () => {
      const day = makeTimelineDay();
      const context = makeContext({ transitToHubMinutes: 60 });

      const result = handleTransferDay(day, [makePOI()], context);

      expect(result.hubBlock.transitDurationMinutes).toBe(60);
    });

    it('latestDepartureMinutes 应为窗口结束分钟数', () => {
      const day = makeTimelineDay();
      const windowEndMin = timeToMinutes(day.availableWindow.end);

      const result = handleTransferDay(day, [makePOI()], makeContext());

      expect(result.latestDepartureMinutes).toBe(windowEndMin);
    });
  });

  describe('边界情况', () => {
    it('时间窗口为 0 时仍应正常工作（不崩溃）', () => {
      const day = makeTimelineDay({
        availableWindow: {
          start: '09:00',
          end: '09:00',
          totalMinutes: 0,
        },
      });
      const result = handleTransferDay(day, [makePOI()], makeContext());

      expect(result.filteredPOIs).toBeDefined();
      expect(result.hubBlock).toBeDefined();
      expect(result.hubBlock.endTimeMinutes).toBe(timeToMinutes('09:00'));
    });

    it('transit_transfer 日处理', () => {
      const day = makeTimelineDay({ dayType: 'transit_transfer' });
      const result = handleTransferDay(day, [makePOI()], makeContext());

      expect(result.filteredPOIs).toHaveLength(1);
      expect(result.hubBlock.type).toBe('transit_to_hub');
    });

    it('transit_return 日处理（返程日同逻辑）', () => {
      const day = makeTimelineDay({
        dayType: 'transit_return',
        transferInfo: {
          departCity: '广州',
          arriveCity: '北京',
          departTime: '14:00',
          arriveTime: '21:00',
          transportType: 'flight',
          suggestion: '返程日：从广州返回北京',
        },
      });
      const context = makeContext({
        currentCity: '广州',
        nextCity: '北京',
        transportType: 'flight',
        departTime: '14:00',
      });
      const result = handleTransferDay(day, [makePOI()], context);

      expect(result.filteredPOIs).toHaveLength(1);
      expect(result.hubBlock.type).toBe('transit_to_hub');
    });

    it('大量 POI 混合过滤性能（50 个 POI 中 25 个 HIGH）', () => {
      const day = makeTimelineDay();
      const candidates: EnginePOI[] = [];
      for (let i = 0; i < 50; i++) {
        candidates.push(
          makePOI({
            id: `poi_${i}`,
            energyLevel: i < 25 ? 'HIGH' : 'LOW',
            name: `景点${i}`,
          }),
        );
      }

      const result = handleTransferDay(day, candidates, makeContext());

      expect(result.filteredPOIs).toHaveLength(25);
    });
  });

  describe('与后续填充的配合', () => {
    it('过滤后的 POI 应符合 fillTimeline 可接受的格式', () => {
      const day = makeTimelineDay();
      const candidates = [
        makePOI({ id: '1', energyLevel: 'LOW', durationMin: 60 }),
        makePOI({ id: '2', energyLevel: 'MEDIUM', durationMin: 120 }),
        makePOI({ id: '3', energyLevel: 'HIGH', durationMin: 180 }),
      ];
      const result = handleTransferDay(day, candidates, makeContext());

      // 过滤后的 POI 应保留完整的 EnginePOI 字段
      for (const poi of result.filteredPOIs) {
        expect(poi.id).toBeDefined();
        expect(poi.name).toBeDefined();
        expect(poi.durationMin).toBeGreaterThan(0);
        expect(poi.energyLevel).toBeDefined();
        expect(poi.category).toBeDefined();
      }
    });

    it('hubBlock 提供的 endTimeMinutes 可作为填充的窗口约束', () => {
      const day = makeTimelineDay({
        availableWindow: {
          start: '09:00',
          end: '13:30',
          totalMinutes: 270, // 09:00 - 13:30
        },
      });
      const result = handleTransferDay(day, [makePOI()], makeContext());

      // 枢纽时间块应在填充活动的末尾之后
      // 实际填充时：活动结束时间 <= hubBlock.startTimeMinutes
      expect(result.hubBlock.endTimeMinutes).toBe(timeToMinutes('13:30'));
      expect(result.hubBlock.startTimeMinutes).toBe(timeToMinutes('13:30') - 90);
    });
  });
});

// ─────────────────────────────────────────────
// 5. isTransferDay
// ─────────────────────────────────────────────

describe('ENGINE-004 · isTransferDay', () => {
  it('transit_transfer → true', () => {
    expect(isTransferDay('transit_transfer')).toBe(true);
  });

  it('transit_return → true', () => {
    expect(isTransferDay('transit_return')).toBe(true);
  });

  it('transit_departure → false', () => {
    expect(isTransferDay('transit_departure')).toBe(false);
  });

  it('city_exploration → false', () => {
    expect(isTransferDay('city_exploration')).toBe(false);
  });
});

// ─────────────────────────────────────────────
// 6. TRANSFER_CONFIG 常量合规性
// ─────────────────────────────────────────────

describe('ENGINE-004 · TRANSFER_CONFIG', () => {
  it('HUB_TRANSIT_DURATION_MINUTES 应为 90（固定 1.5h）', () => {
    expect(TRANSFER_CONFIG.HUB_TRANSIT_DURATION_MINUTES).toBe(90);
  });

  it('HUB_SAFETY_MARGIN_MINUTES 应为 60', () => {
    expect(TRANSFER_CONFIG.HUB_SAFETY_MARGIN_MINUTES).toBe(60);
  });

  it('HIGH_INTENSITY_KEYWORDS 应包含徒步、登山、爬山等核心关键词', () => {
    expect(TRANSFER_CONFIG.HIGH_INTENSITY_KEYWORDS).toContain('徒步');
    expect(TRANSFER_CONFIG.HIGH_INTENSITY_KEYWORDS).toContain('登山');
    expect(TRANSFER_CONFIG.HIGH_INTENSITY_KEYWORDS).toContain('爬山');
    expect(TRANSFER_CONFIG.HIGH_INTENSITY_KEYWORDS).toContain('长城');
  });

  it('HIGH_INTENSITY_CATEGORIES 应包含 nature', () => {
    expect(TRANSFER_CONFIG.HIGH_INTENSITY_CATEGORIES).toContain('nature');
  });
});

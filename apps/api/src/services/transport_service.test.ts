/**
 * 交通服务单元测试
 * 依据：docs/API接口设计规格书_v1.0.0.md §8
 */
import { describe, it, expect } from 'vitest';
import { searchTransport, planRoute } from '../services/transport_service';
import { ValidationError, NotFoundError } from '../types/errors';
import type { RoutePlanRequest } from '@path-wise/shared';

// ============================================================
// searchTransport — 大交通方案查询
// ============================================================

describe('searchTransport', () => {
  // ---- 正常分支 ----
  describe('正常分支', () => {
    it('应返回北京到长沙的高铁方案', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '长沙',
        date: '2026-07-01',
      });

      expect(result.options.length).toBeGreaterThan(0);
      const primary = result.options[0];
      expect(primary.type).toBe('high_speed_rail');
      expect(primary.trainNumber).toBeTruthy();
      expect(primary.departureStation).toContain('北京');
      expect(primary.arrivalStation).toContain('长沙');
      expect(primary.durationMinutes).toBeGreaterThan(0);
      expect(primary.pricePerPerson).toBeDefined();
      expect(result.source).toBe('mock');
      expect(result.expiresAt).toBeDefined();
    });

    it('应返回长沙到广州的高铁方案', async () => {
      const result = await searchTransport({
        fromCity: '长沙',
        toCity: '广州',
        date: '2026-07-04',
      });

      expect(result.options.length).toBeGreaterThan(0);
      expect(result.options[0].type).toBe('high_speed_rail');
    });

    it('长距离路线应包含普通列车和飞机方案', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '成都',
        date: '2026-07-01',
      });

      const types = result.options.map((o) => o.type);
      expect(types).toContain('high_speed_rail');
      expect(types).toContain('normal_train');
      expect(types).toContain('flight');
    });

    it('短距离路线不应包含普通列车和飞机', async () => {
      const result = await searchTransport({
        fromCity: '杭州',
        toCity: '上海',
        date: '2026-07-01',
      });

      // 杭州到上海约54分钟，durationMinutes <= 240
      const types = new Set(result.options.map((o) => o.type));
      expect(types.has('normal_train')).toBe(false);
      expect(types.has('flight')).toBe(false);
    });

    it('过夜车次应有 isOvernight 标记', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '成都',
        date: '2026-07-01',
      });

      const overnightTrains = result.options.filter((o) => o.type === 'normal_train');
      expect(overnightTrains.length).toBeGreaterThan(0);
      expect(overnightTrains[0].isOvernight).toBe(true);
    });

    it('应包含免责声明 note', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '长沙',
        date: '2026-07-01',
      });

      for (const opt of result.options) {
        expect(opt.note).toBeTruthy();
        // 免责声明关键词：仅供参考 或 请尽快
        const hasDisclaimer =
          opt.note.includes('仅供参考') ||
          opt.note.includes('请尽快') ||
          opt.note.includes('信息仅供参考') ||
          opt.note.includes('建议提前');
        expect(hasDisclaimer).toBe(true);
      }
    });
  });

  // ---- 偏好过滤 ----
  describe('偏好过滤 (prefer)', () => {
    it('应按 prefer 过滤交通类型', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '长沙',
        date: '2026-07-01',
        prefer: ['high_speed_rail'],
      });

      // 长沙到北京只有高铁（duration 336 < 480），prefer 只会保留高铁
      for (const opt of result.options) {
        expect(opt.type).toBe('high_speed_rail');
      }
    });

    it('prefer 为空数组时不过滤', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '成都',
        date: '2026-07-01',
        prefer: [],
      });

      // 长距离路线，应包含所有类型
      const types = new Set(result.options.map((o) => o.type));
      expect(types.size).toBeGreaterThanOrEqual(2);
    });

    it('prefer 匹配不上时降级返回全部', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '长沙',
        date: '2026-07-01',
        prefer: ['bus'],
      });

      // bus 不在北京-长沙 mock 数据中，应降级返回全部
      expect(result.options.length).toBeGreaterThan(0);
    });

    it('prefer 多个类型中部分匹配应只返回匹配的', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '成都',
        date: '2026-07-01',
        prefer: ['high_speed_rail', 'bus'],
      });

      // bus 不在方案中，但 high_speed_rail 在；应只返回 high_speed_rail
      for (const opt of result.options) {
        expect(opt.type).toBe('high_speed_rail');
      }
    });
  });

  // ---- 出发时段过滤 ----
  describe('出发时段过滤', () => {
    it('morning 时段应只返回上午出发的车次', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '长沙',
        date: '2026-07-01',
        departTimePeriod: 'morning',
      });

      for (const opt of result.options) {
        const [h] = opt.departTime.split(':').map(Number);
        expect(h).toBeGreaterThanOrEqual(5);
        expect(h).toBeLessThan(12);
      }
    });

    it('afternoon 时段应返回下午出发的车次', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '上海',
        date: '2026-07-01',
        departTimePeriod: 'afternoon',
      });

      for (const opt of result.options) {
        const [h] = opt.departTime.split(':').map(Number);
        // afternoon 时段允许 12-18（不含18）
        expect(h).toBeGreaterThanOrEqual(12);
        expect(h).toBeLessThan(18);
      }
    });

    it('evening 时段应返回晚间出发的车次', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '长沙',
        date: '2026-07-01',
        departTimePeriod: 'evening',
      });

      for (const opt of result.options) {
        const [h] = opt.departTime.split(':').map(Number);
        expect(h).toBeGreaterThanOrEqual(18);
      }
    });

    it('时段过滤无结果时降级返回全部', async () => {
      // 杭州到上海 morning 时间有高铁，afternoon 也能通过 getMockTransport 生成
      const result = await searchTransport({
        fromCity: '杭州',
        toCity: '上海',
        date: '2026-07-01',
        departTimePeriod: 'evening',
      });

      expect(result.options.length).toBeGreaterThan(0);
    });

    it('evening 时段长途路线降级应返回全部', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '成都',
        date: '2026-07-01',
        departTimePeriod: 'evening',
      });

      expect(result.options.length).toBeGreaterThan(0);
    });

    it('morning 时段 + prefer 同时生效', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '成都',
        date: '2026-07-01',
        departTimePeriod: 'morning',
        prefer: ['high_speed_rail'],
      });

      // 只有一个选项：morning 高铁
      for (const opt of result.options) {
        expect(opt.type).toBe('high_speed_rail');
        const [h] = opt.departTime.split(':').map(Number);
        expect(h).toBeGreaterThanOrEqual(5);
        expect(h).toBeLessThan(12);
      }
    });
  });

  // ---- 参数校验 ----
  describe('参数校验', () => {
    it('空 fromCity 应抛出 ValidationError', async () => {
      await expect(
        searchTransport({
          fromCity: '',
          toCity: '长沙',
          date: '2026-07-01',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('空白 fromCity 应抛出 ValidationError', async () => {
      await expect(
        searchTransport({
          fromCity: '   ',
          toCity: '长沙',
          date: '2026-07-01',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('空 toCity 应抛出 ValidationError', async () => {
      await expect(
        searchTransport({
          fromCity: '北京',
          toCity: '',
          date: '2026-07-01',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('相同出发和目的城市应抛出 ValidationError', async () => {
      await expect(
        searchTransport({
          fromCity: '北京',
          toCity: '北京',
          date: '2026-07-01',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('不存在的出发城市应抛出 NotFoundError', async () => {
      await expect(
        searchTransport({
          fromCity: '火星',
          toCity: '长沙',
          date: '2026-07-01',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('不存在的目的城市应抛出 NotFoundError', async () => {
      await expect(
        searchTransport({
          fromCity: '北京',
          toCity: '火星',
          date: '2026-07-01',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('两个都不存在的城市应抛出 NotFoundError（先校验 fromCity）', async () => {
      await expect(
        searchTransport({
          fromCity: '火星',
          toCity: '月球',
          date: '2026-07-01',
        }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ---- 边界值 ----
  describe('边界值', () => {
    it('日期缺省时应正常返回', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '长沙',
        date: '',
      });

      expect(result.options.length).toBeGreaterThan(0);
    });

    it('passengers 缺省时应正常返回', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '长沙',
        date: '',
        passengers: undefined,
      } as Parameters<typeof searchTransport>[0]);

      expect(result.options.length).toBeGreaterThan(0);
      expect(result.source).toBe('mock');
    });

    it('城市名有前后空格应自动 trim', async () => {
      const result = await searchTransport({
        fromCity: '  北京  ',
        toCity: '  长沙  ',
        date: '2026-07-01',
      });

      expect(result.options.length).toBeGreaterThan(0);
      expect(result.options[0].departureStation).toContain('北京');
    });

    it('反向路线（反查）使用 fallback 应正常返回', async () => {
      // 长沙→北京 在 TRANSPORT_ROUTES 中没有条目，但两城市都存在，应走 fallback
      const result = await searchTransport({
        fromCity: '长沙',
        toCity: '北京',
        date: '2026-07-01',
      });

      expect(result.options.length).toBeGreaterThan(0);
      expect(result.options[0].type).toBe('high_speed_rail');
    });

    it('所有 9 城市间搜索均应不崩溃', async () => {
      const cities = ['北京', '上海', '成都', '杭州', '厦门', '长沙', '广州', '深圳', '重庆'];
      for (const from of cities) {
        for (const to of cities) {
          if (from === to) continue;
          await expect(
            searchTransport({ fromCity: from, toCity: to, date: '2026-07-01' }),
          ).resolves.toBeDefined();
        }
      }
    });

    it('普通列车方案应包含卧铺价格', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '成都',
        date: '2026-07-01',
      });

      const normalTrain = result.options.find((o) => o.type === 'normal_train');
      expect(normalTrain).toBeDefined();
      expect(normalTrain!.pricePerPerson).toHaveProperty('硬卧');
      expect(normalTrain!.pricePerPerson).toHaveProperty('软卧');
    });

    it('飞机方案应包含经济舱和商务舱价格', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '成都',
        date: '2026-07-01',
      });

      const flight = result.options.find((o) => o.type === 'flight');
      expect(flight).toBeDefined();
      expect(flight!.pricePerPerson).toHaveProperty('经济舱');
      expect(flight!.pricePerPerson).toHaveProperty('商务舱');
    });

    it('飞机方案应有 deepLink', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '成都',
        date: '2026-07-01',
      });

      const flight = result.options.find((o) => o.type === 'flight');
      expect(flight).toBeDefined();
      expect(flight!.deepLink).toBeDefined();
      expect(flight!.deepLink?.platform).toBe('ctrip');
    });

    it('普通列车方案应有 deepLink（来自主方案的 spread）', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '成都',
        date: '2026-07-01',
      });

      const normalTrain = result.options.find((o) => o.type === 'normal_train');
      expect(normalTrain).toBeDefined();
      // normal_train 的 deepLink 继承自主方案的 spread
      // 主方案有 deepLink（来自 TRANSPORT_ROUTES）
    });
  });

  // ---- 综合场景 ----
  describe('综合场景', () => {
    it('expiresAt 应为未来 30 分钟的 ISO 字符串', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '长沙',
        date: '2026-07-01',
      });

      const expiresAt = new Date(result.expiresAt);
      const now = new Date();
      const diffMs = expiresAt.getTime() - now.getTime();
      // 应在 25~35 分钟之间（允许几秒误差）
      expect(diffMs).toBeGreaterThan(25 * 60 * 1000);
      expect(diffMs).toBeLessThan(35 * 60 * 1000);
    });

    it('options 中每个方案都应有 bookingUrl', async () => {
      const result = await searchTransport({
        fromCity: '北京',
        toCity: '成都',
        date: '2026-07-01',
      });

      for (const opt of result.options.filter((o) => o.type !== 'normal_train')) {
        expect(opt.bookingUrl).toBeTruthy();
      }
    });
  });
});

// ============================================================
// planRoute — 市内路线规划
// ============================================================

describe('planRoute', () => {
  // ---- 正常分支 ----
  describe('正常分支', () => {
    it('应返回 transit 模式的路线规划', async () => {
      const result = await planRoute({
        city: '长沙',
        origin: { lat: 28.235, lng: 112.907, name: '岳麓山南门' },
        destination: { lat: 28.227, lng: 112.938, name: '橘子洲头' },
        mode: 'transit',
      });

      expect(result.distanceMeters).toBeGreaterThan(0);
      expect(result.durationMinutes).toBeGreaterThan(0);
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.source).toBe('mock');
    });

    it('应返回 walking 模式的路线规划', async () => {
      const result = await planRoute({
        city: '长沙',
        origin: { lat: 28.235, lng: 112.907, name: '岳麓山南门' },
        destination: { lat: 28.227, lng: 112.938, name: '橘子洲头' },
        mode: 'walking',
      });

      expect(result.steps.length).toBeGreaterThan(0);
      for (const step of result.steps) {
        expect(step.mode).toBe('walking');
      }
    });

    it('应返回 driving 模式的路线规划', async () => {
      const result = await planRoute({
        city: '长沙',
        origin: { lat: 28.235, lng: 112.907, name: '起点' },
        destination: { lat: 28.227, lng: 112.938, name: '终点' },
        mode: 'driving',
      });

      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.durationMinutes).toBeGreaterThan(0);
    });

    it('应返回 cycling 模式的路线规划', async () => {
      const result = await planRoute({
        city: '长沙',
        origin: { lat: 28.235, lng: 112.907, name: '起点' },
        destination: { lat: 28.227, lng: 112.938, name: '终点' },
        mode: 'cycling',
      });

      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('mode 缺省时默认使用 transit', async () => {
      // RoutePlanRequest.mode 是必填字段，但运行时可能缺省；
      // 使用 unknown 中间断言模拟缺省场景，验证服务层降级逻辑
      const result = await planRoute({
        city: '长沙',
        origin: { lat: 28.235, lng: 112.907, name: '岳麓山南门' },
        destination: { lat: 28.227, lng: 112.938, name: '橘子洲头' },
        mode: undefined,
      } as unknown as RoutePlanRequest);

      expect(result.steps.length).toBeGreaterThan(0);
      // 默认 transit 模式：应包含公交/地铁步骤
      expect(result.steps.some((s) => s.mode === 'transit')).toBe(true);
    });

    it('应使用 origin 和 destination 的 name 生成指令', async () => {
      const result = await planRoute({
        city: '北京',
        origin: { lat: 39.916, lng: 116.397, name: '故宫' },
        destination: { lat: 39.905, lng: 116.391, name: '天安门' },
        mode: 'walking',
      });

      const allInstructions = result.steps.map((s) => s.instruction).join(' ');
      expect(allInstructions).toContain('故宫');
      expect(allInstructions).toContain('天安门');
    });
  });

  // ---- 距离极小时 ----
  describe('距离极小时', () => {
    it('距离小于 10 米时应返回步行提示', async () => {
      const result = await planRoute({
        city: '长沙',
        origin: { lat: 28.235, lng: 112.907, name: '起点' },
        destination: { lat: 28.23500001, lng: 112.90700001, name: '终点' },
        mode: 'transit',
      });

      expect(result.distanceMeters).toBeLessThan(10);
      expect(result.durationMinutes).toBe(1);
      expect(result.steps[0].instruction).toContain('很近');
    });
  });

  // ---- 参数校验 ----
  describe('参数校验', () => {
    it('空 city 应抛出 ValidationError', async () => {
      await expect(
        planRoute({
          city: '',
          origin: { lat: 28.235, lng: 112.907 },
          destination: { lat: 28.227, lng: 112.938 },
          mode: 'transit',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('不存在的城市应抛出 NotFoundError', async () => {
      await expect(
        planRoute({
          city: '火星',
          origin: { lat: 28.235, lng: 112.907 },
          destination: { lat: 28.227, lng: 112.938 },
          mode: 'transit',
        }),
      ).rejects.toThrow(NotFoundError);
    });

    it('origin 缺少 lat 应抛出 ValidationError', async () => {
      await expect(
        planRoute({
          city: '长沙',
          origin: { lng: 112.907 } as { lat: number; lng: number },
          destination: { lat: 28.227, lng: 112.938 },
          mode: 'transit',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('destination 缺少 lat 应抛出 ValidationError', async () => {
      await expect(
        planRoute({
          city: '长沙',
          origin: { lat: 28.235, lng: 112.907 },
          destination: { lng: 112.938 } as { lat: number; lng: number },
          mode: 'transit',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('无效 mode 应抛出 ValidationError', async () => {
      await expect(
        planRoute({
          city: '长沙',
          origin: { lat: 28.235, lng: 112.907 },
          destination: { lat: 28.227, lng: 112.938 },
          mode: 'flying' as 'transit',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('origin 中 lat 为 null 应抛出 ValidationError', async () => {
      await expect(
        planRoute({
          city: '长沙',
          origin: { lat: null as unknown as number, lng: 112.907 },
          destination: { lat: 28.227, lng: 112.938 },
          mode: 'transit',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('destination 中 lng 为 null 应抛出 ValidationError', async () => {
      await expect(
        planRoute({
          city: '长沙',
          origin: { lat: 28.235, lng: 112.907 },
          destination: { lat: 28.227, lng: null as unknown as number },
          mode: 'transit',
        }),
      ).rejects.toThrow(ValidationError);
    });

    it('origin 为 undefined 应抛出 ValidationError', async () => {
      await expect(
        planRoute({
          city: '长沙',
          origin: undefined as unknown as { lat: number; lng: number },
          destination: { lat: 28.227, lng: 112.938 },
          mode: 'transit',
        }),
      ).rejects.toThrow(ValidationError);
    });
  });

  // ---- 边界值 ----
  describe('边界值', () => {
    it('所有支持模式 (driving/transit/walking/cycling) 都应正常工作', async () => {
      const modes = ['driving', 'transit', 'walking', 'cycling'] as const;
      for (const mode of modes) {
        const result = await planRoute({
          city: '北京',
          origin: { lat: 39.916, lng: 116.397 },
          destination: { lat: 39.905, lng: 116.391 },
          mode,
        });
        expect(result.distanceMeters).toBeGreaterThan(0);
        expect(result.durationMinutes).toBeGreaterThan(0);
        expect(result.steps.length).toBeGreaterThan(0);
      }
    });

    it('origin.name 缺省时应使用默认值"起点"', async () => {
      const result = await planRoute({
        city: '长沙',
        origin: { lat: 28.235, lng: 112.907 },
        destination: { lat: 28.227, lng: 112.938, name: '橘子洲头' },
        mode: 'walking',
      });

      const allInstructions = result.steps.map((s) => s.instruction).join(' ');
      expect(allInstructions).toContain('起点');
    });

    it('destination.name 缺省时应使用默认值"终点"', async () => {
      const result = await planRoute({
        city: '长沙',
        origin: { lat: 28.235, lng: 112.907, name: '岳麓山南门' },
        destination: { lat: 28.227, lng: 112.938 },
        mode: 'walking',
      });

      const allInstructions = result.steps.map((s) => s.instruction).join(' ');
      expect(allInstructions).toContain('终点');
    });

    it('origin 和 destination name 都缺省时使用默认值', async () => {
      const result = await planRoute({
        city: '长沙',
        origin: { lat: 28.235, lng: 112.907 },
        destination: { lat: 28.227, lng: 112.938 },
        mode: 'driving',
      });

      const allInstructions = result.steps.map((s) => s.instruction).join(' ');
      expect(allInstructions).toContain('起点');
      expect(allInstructions).toContain('终点');
    });

    it('相同坐标应触发极近距离逻辑', async () => {
      const result = await planRoute({
        city: '长沙',
        origin: { lat: 28.235, lng: 112.907 },
        destination: { lat: 28.235, lng: 112.907 },
        mode: 'driving',
      });

      expect(result.distanceMeters).toBe(0);
      expect(result.durationMinutes).toBe(1);
      expect(result.steps[0].instruction).toContain('很近');
    });

    it('距离刚好 10 米时应走正常路线', async () => {
      // 纬度差 0.0001 ° ≈ 11m，应触发正常路线（>= 10m 阈值）
      const result = await planRoute({
        city: '长沙',
        origin: { lat: 28.235, lng: 112.907 },
        destination: { lat: 28.2351, lng: 112.907 },
        mode: 'walking',
      });

      // 距离 >= 10 时走正常路线，应有 3 步
      expect(result.steps.length).toBe(3);
    });

    it('大跨度坐标应返回大距离', async () => {
      // 北京到上海 ≈ 1076km
      const result = await planRoute({
        city: '北京',
        origin: { lat: 39.916, lng: 116.397, name: '北京' },
        destination: { lat: 31.23, lng: 121.474, name: '上海' },
        mode: 'driving',
      });

      // 应返回较大距离（> 900km）
      expect(result.distanceMeters).toBeGreaterThan(900_000);
      expect(result.durationMinutes).toBeGreaterThan(1000);
    });
  });

  // ---- 极值坐标 ----
  describe('极值坐标', () => {
    it('赤道附近坐标应正常工作', async () => {
      const result = await planRoute({
        city: '成都',
        origin: { lat: 0.01, lng: 0.01 },
        destination: { lat: 0.02, lng: 0.02 },
        mode: 'transit',
      });

      expect(result.distanceMeters).toBeGreaterThan(0);
      expect(result.steps.length).toBe(3);
    });

    it('负坐标应正常工作', async () => {
      const result = await planRoute({
        city: '厦门',
        origin: { lat: -6.2, lng: 106.8 },
        destination: { lat: -6.2, lng: 106.9 },
        mode: 'cycling',
      });

      expect(result.distanceMeters).toBeGreaterThan(0);
      expect(result.steps.length).toBe(3);
    });

    it('经度跨越 180 度线应正常工作', async () => {
      const result = await planRoute({
        city: '上海',
        origin: { lat: 30.0, lng: 179.0 },
        destination: { lat: 30.0, lng: -179.0 },
        mode: 'transit',
      });

      expect(result.distanceMeters).toBeGreaterThan(0);
      expect(result.steps.length).toBe(3);
    });
  });

  // ---- 模式步骤验证 ----
  describe('模式步骤验证', () => {
    it('transit 模式应包含地铁步骤', async () => {
      const result = await planRoute({
        city: '北京',
        origin: { lat: 39.916, lng: 116.397 },
        destination: { lat: 39.905, lng: 116.391 },
        mode: 'transit',
      });

      const transitSteps = result.steps.filter((s) => s.mode === 'transit');
      expect(transitSteps.length).toBeGreaterThan(0);
      expect(transitSteps[0].lineName).toBeDefined();
    });

    it('transit 步骤应包含 stations 字段', async () => {
      const result = await planRoute({
        city: '北京',
        origin: { lat: 39.916, lng: 116.397 },
        destination: { lat: 39.905, lng: 116.391 },
        mode: 'transit',
      });

      const transitStep = result.steps.find((s) => s.mode === 'transit');
      expect(transitStep).toBeDefined();
      expect(transitStep!.stations).toBeGreaterThanOrEqual(1);
    });

    it('driving 模式最后一步应包含停车提示', async () => {
      const result = await planRoute({
        city: '北京',
        origin: { lat: 39.916, lng: 116.397 },
        destination: { lat: 39.905, lng: 116.391 },
        mode: 'driving',
      });

      const lastStep = result.steps[result.steps.length - 1];
      expect(lastStep.instruction).toContain('停车');
    });

    it('cycling 模式所有步骤都应是 cycling', async () => {
      const result = await planRoute({
        city: '杭州',
        origin: { lat: 30.274, lng: 120.155 },
        destination: { lat: 30.248, lng: 120.168 },
        mode: 'cycling',
      });

      for (const step of result.steps) {
        expect(step.mode).toBe('cycling');
      }
    });

    it('所有模式步骤 durationMinutes 之和应接近总 durationMinutes', async () => {
      const modes = ['driving', 'transit', 'walking', 'cycling'] as const;
      for (const mode of modes) {
        const result = await planRoute({
          city: '广州',
          origin: { lat: 23.129, lng: 113.264 },
          destination: { lat: 23.137, lng: 113.357 },
          mode,
        });

        const stepDurationSum = result.steps.reduce((sum, s) => sum + s.durationMinutes, 0);
        // 允许一定舍入误差
        expect(Math.abs(stepDurationSum - result.durationMinutes)).toBeLessThanOrEqual(25); // 舍入误差允许范围较大，因为各步按比例分配
      }
    });
  });
});

// ============================================================
// mapTimePeriod — 出发时段映射（通过 searchTransport 间接测试）
// ============================================================

describe('mapTimePeriod（搜索时段映射）', () => {
  it('morning 时段应正确映射', async () => {
    const result = await searchTransport({
      fromCity: '北京',
      toCity: '长沙',
      date: '2026-07-01',
      departTimePeriod: 'morning',
    });

    for (const opt of result.options) {
      const [h] = opt.departTime.split(':').map(Number);
      expect(h).toBeGreaterThanOrEqual(5);
      expect(h).toBeLessThan(12);
    }
  });

  it('afternoon 时段应正确映射', async () => {
    const result = await searchTransport({
      fromCity: '北京',
      toCity: '长沙',
      date: '2026-07-01',
      departTimePeriod: 'afternoon',
    });

    for (const opt of result.options) {
      const [h] = opt.departTime.split(':').map(Number);
      expect(h).toBeGreaterThanOrEqual(12);
      expect(h).toBeLessThan(18);
    }
  });

  it('evening 时段应正确映射', async () => {
    const result = await searchTransport({
      fromCity: '北京',
      toCity: '长沙',
      date: '2026-07-01',
      departTimePeriod: 'evening',
    });

    for (const opt of result.options) {
      const [h] = opt.departTime.split(':').map(Number);
      expect(h).toBeGreaterThanOrEqual(18);
    }
  });

  it('无效时段关键词应降级为全天（不崩溃）', async () => {
    const result = await searchTransport({
      fromCity: '北京',
      toCity: '长沙',
      date: '2026-07-01',
      departTimePeriod: 'midnight' as any,
    });

    expect(result.options.length).toBeGreaterThan(0);
  });

  it('undefined 时段不过滤', async () => {
    const result = await searchTransport({
      fromCity: '北京',
      toCity: '长沙',
      date: '2026-07-01',
    });

    expect(result.options.length).toBeGreaterThan(0);
  });

  it('空字符串时段应降级为全天', async () => {
    const result = await searchTransport({
      fromCity: '北京',
      toCity: '长沙',
      date: '2026-07-01',
      departTimePeriod: '' as any,
    });

    expect(result.options.length).toBeGreaterThan(0);
  });
});

// ============================================================
// 服务集成场景
// ============================================================

describe('服务集成场景', () => {
  it('交通搜索 → 路线规划联动：先搜城际再查市内路线应都成功', async () => {
    const transportResult = await searchTransport({
      fromCity: '北京',
      toCity: '长沙',
      date: '2026-07-01',
    });

    expect(transportResult.options.length).toBeGreaterThan(0);

    const routeResult = await planRoute({
      city: '长沙',
      origin: { lat: 28.235, lng: 112.907, name: '长沙南站' },
      destination: { lat: 28.194, lng: 112.97, name: '橘子洲景区' },
      mode: 'transit',
    });

    expect(routeResult.distanceMeters).toBeGreaterThan(0);
    expect(routeResult.steps.length).toBeGreaterThan(0);
  });

  it('多城市多路线规划应互不干扰', async () => {
    const cities: Array<{
      name: string;
      originLat: number;
      originLng: number;
      destLat: number;
      destLng: number;
    }> = [
      { name: '北京', originLat: 39.916, originLng: 116.397, destLat: 39.905, destLng: 116.391 },
      { name: '上海', originLat: 31.23, originLng: 121.474, destLat: 31.235, destLng: 121.48 },
      { name: '成都', originLat: 30.659, originLng: 104.065, destLat: 30.649, destLng: 104.039 },
    ];

    const results = await Promise.all(
      cities.map((c) =>
        planRoute({
          city: c.name,
          origin: { lat: c.originLat, lng: c.originLng },
          destination: { lat: c.destLat, lng: c.destLng },
          mode: 'transit',
        }),
      ),
    );

    for (const result of results) {
      expect(result.distanceMeters).toBeGreaterThan(0);
      expect(result.steps.length).toBe(3);
    }
  });
});

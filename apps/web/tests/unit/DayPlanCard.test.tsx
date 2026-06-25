/**
 * DayPlanCard 组件单元测试（FE-015）
 * 依据：docs/测试用例文档_v1.0.0.md
 *      docs/前端交互设计规格书_v1.0.0.md §3.5.2
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DayPlanCard } from '@/components/itinerary/DayPlanCard';
import { TransportInfoCard } from '@/components/itinerary/TransportInfoCard';
import { AccommodationCard } from '@/components/itinerary/AccommodationCard';
import type { DayPlan } from '@path-wise/shared';

describe('DayPlanCard', () => {
  const fullDay: DayPlan = {
    dayIndex: 1,
    date: '2026-12-25',
    dayType: 'transit_departure',
    cityName: '长沙',
    isFirstDayOfCity: true,
    title: '抵达长沙',
    timeline: [
      {
        id: 'item-1',
        type: 'attraction',
        title: '岳麓山',
        description: '推荐游玩3小时',
        startTime: '09:00',
        endTime: '12:00',
        estimatedDuration: 180,
        estimatedCostCNY: 0,
        energyLevel: 'MEDIUM',
        bookingRequired: false,
        alternatives: [
          {
            id: 'alt-1',
            type: 'attraction',
            title: '橘子洲头',
            description: '备选方案',
            startTime: '09:00',
            endTime: '12:00',
            estimatedDuration: 180,
            estimatedCostCNY: 0,
            energyLevel: 'MEDIUM',
            bookingRequired: false,
          },
        ],
      },
    ],
    accommodation: null,
    transport: {
      type: 'high_speed_rail',
      trainNumber: 'G6113',
      departureStation: '北京南',
      arrivalStation: '长沙南',
      departTime: '16:45',
      arriveTime: '19:00',
      durationMinutes: 135,
      pricePerPerson: { 二等座: 314, 一等座: 498 },
    },
    weather: null,
    tips: ['岳麓山建议穿舒适鞋子', '湖南省博物馆周一闭馆'],
  };

  const emptyDay: DayPlan = {
    dayIndex: 2,
    date: '2026-12-26',
    dayType: 'city_exploration',
    cityName: '长沙',
    isFirstDayOfCity: false,
    title: '长沙探索',
    timeline: [],
    accommodation: null,
    transport: null,
    weather: null,
    tips: [],
  };

  const dayWithAccommodation: DayPlan = {
    dayIndex: 1,
    date: '2026-12-25',
    dayType: 'city_exploration',
    cityName: '北京',
    isFirstDayOfCity: true,
    title: '北京第一天',
    timeline: [
      {
        id: 'item-1',
        type: 'attraction',
        title: '故宫',
        startTime: '09:00',
        endTime: '12:00',
        estimatedDuration: 180,
        estimatedCostCNY: 60,
        energyLevel: 'MEDIUM',
        bookingRequired: true,
        bookingUrl: 'https://example.com/booking',
      },
    ],
    accommodation: {
      checkInDate: '2026-12-25',
      checkOutDate: '2026-12-28',
      nights: 3,
      primary: {
        name: '北京王府井酒店',
        address: '北京市东城区王府井大街100号',
        pricePerNight: 800,
        totalPrice: 2400,
        reason: '位于市中心，交通便利',
        amenities: ['含早餐', '免费WiFi', '电梯'],
      },
      backup: {
        name: '北京天安门快捷酒店',
        address: '北京市东城区前门大街50号',
        pricePerNight: 400,
        totalPrice: 1200,
        reason: '性价比高',
      },
    },
    transport: null,
    weather: null,
    tips: [],
  };

  describe('功能验收', () => {
    it('应渲染天级卡片标题和日期', () => {
      render(<DayPlanCard dayPlan={fullDay} />);
      expect(screen.getByText(/Day 1/)).toBeTruthy();
      expect(screen.getByText(/抵达长沙/)).toBeTruthy();
    });

    it('应渲染时间轴条目', () => {
      render(<DayPlanCard dayPlan={fullDay} />);
      expect(screen.getByText('岳麓山')).toBeTruthy();
      expect(screen.getByText(/09:00 - 12:00/)).toBeTruthy();
    });

    it('应显示备选方案按钮', () => {
      render(<DayPlanCard dayPlan={fullDay} />);
      expect(screen.getByText(/备选方案/)).toBeTruthy();
    });

    it('应渲染交通运输信息', () => {
      render(<DayPlanCard dayPlan={fullDay} />);
      expect(screen.getByText(/G6113/)).toBeTruthy();
      expect(screen.getByText(/仅供参考/)).toBeTruthy(); // 免责声明
    });

    it('应渲染住宿卡片（isFirstDayOfCity=true）', () => {
      render(<DayPlanCard dayPlan={dayWithAccommodation} />);
      expect(screen.getByText(/北京王府井酒店/)).toBeTruthy();
      expect(screen.getByText(/北京天安门快捷酒店/)).toBeTruthy();
    });

    it('应显示预约状态和链接', () => {
      render(<DayPlanCard dayPlan={dayWithAccommodation} />);
      expect(screen.getByText('需预约')).toBeTruthy();
      expect(screen.getByText('预约入口')).toBeTruthy();
    });

    it('应显示当日提示', () => {
      render(<DayPlanCard dayPlan={fullDay} />);
      expect(screen.getByText('岳麓山建议穿舒适鞋子')).toBeTruthy();
    });
  });

  describe('边界验收', () => {
    it('时间轴为空时应显示占位文案', () => {
      render(<DayPlanCard dayPlan={emptyDay} />);
      expect(screen.getByText('当天暂无安排')).toBeTruthy();
    });

    it('isFirstDayOfCity=false 时应不渲染住宿卡片', () => {
      render(<DayPlanCard dayPlan={emptyDay} />);
      expect(screen.queryByText('住宿推荐')).toBeNull();
    });

    it('生成中状态应显示骨架屏动画', () => {
      const { container } = render(<DayPlanCard dayPlan={fullDay} isGenerating={true} />);
      const skeletons = container.querySelectorAll('.animate-pulse');
      expect(skeletons.length).toBeGreaterThan(0);
    });
  });
});

describe('TransportInfoCard', () => {
  it('应渲染高铁交通信息', () => {
    const transport = {
      type: 'high_speed_rail',
      trainNumber: 'G6113',
      departureStation: '北京南',
      arrivalStation: '长沙南',
      departTime: '16:45',
      arriveTime: '19:00',
      durationMinutes: 135,
      pricePerPerson: { 二等座: 314 },
    };
    render(<TransportInfoCard transport={transport} />);
    expect(screen.getByText(/G6113/)).toBeTruthy();
    expect(screen.getByText(/仅供参考/)).toBeTruthy();
  });

  it('transport 为空时应返回 null', () => {
    const { container } = render(<TransportInfoCard transport={null} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('AccommodationCard', () => {
  it('应渲染主选和备选酒店', () => {
    const accommodation: NonNullable<DayPlan['accommodation']> = {
      checkInDate: '2026-12-25',
      checkOutDate: '2026-12-28',
      nights: 3,
      primary: {
        name: '主选酒店',
        address: '地址1',
        pricePerNight: 500,
        totalPrice: 1500,
        reason: '推荐',
        amenities: ['WiFi'],
      },
      backup: {
        name: '备选酒店',
        address: '地址2',
        pricePerNight: 300,
        totalPrice: 900,
        reason: '实惠',
      },
    };
    render(<AccommodationCard accommodation={accommodation} />);
    expect(screen.getByText('主选酒店')).toBeTruthy();
    expect(screen.getByText('备选酒店')).toBeTruthy();
  });
});

/**
 * 表单校验逻辑单元测试（FE-007）
 * 依据：docs/测试用例文档_v1.0.0.md
 *      docs/前端交互设计规格书_v1.0.0.md §3.1.3
 */
import { describe, it, expect } from 'vitest';
import { validateHomeForm, validateField } from '@/lib/validation';

const validData = {
  departureCity: '北京',
  destinations: [{ cityName: '长沙', days: 3, transportTo: null as null }],
  departureDate: '2026-12-25',
  adults: 2,
};

describe('validateHomeForm', () => {
  describe('功能验收', () => {
    it('所有字段合法时应返回空数组', () => {
      const errors = validateHomeForm(validData);
      expect(errors).toEqual([]);
    });

    it('出发城市为空时应返回错误', () => {
      const errors = validateHomeForm({ ...validData, departureCity: '' });
      expect(
        errors.some((e) => e.field === 'departureCity' && e.message.includes('出发城市')),
      ).toBe(true);
    });

    it('目的地为空时应返回错误', () => {
      const errors = validateHomeForm({ ...validData, destinations: [] });
      expect(errors.some((e) => e.field === 'destinations' && e.message.includes('目的地'))).toBe(
        true,
      );
    });

    it('出发日期为空时应返回错误', () => {
      const errors = validateHomeForm({ ...validData, departureDate: '' });
      expect(
        errors.some((e) => e.field === 'departureDate' && e.message.includes('出发日期')),
      ).toBe(true);
    });

    it('成人数为0时应返回错误', () => {
      const errors = validateHomeForm({ ...validData, adults: 0 });
      expect(errors.some((e) => e.field === 'adults' && e.message.includes('成人人数'))).toBe(true);
    });
  });

  describe('边界验收', () => {
    it('出发日期为过去日期时应返回错误', () => {
      const pastDate = '2020-01-01';
      const errors = validateHomeForm({ ...validData, departureDate: pastDate });
      expect(
        errors.some((e) => e.field === 'departureDate' && e.message.includes('过去的日期')),
      ).toBe(true);
    });

    it('出发日期为当天时应通过', () => {
      const today = new Date().toISOString().slice(0, 10);
      const errors = validateHomeForm({ ...validData, departureDate: today });
      expect(errors.some((e) => e.field === 'departureDate')).toBe(false);
    });

    it('目的地超过5个时应返回错误', () => {
      const sixDest = Array.from({ length: 6 }, (_, i) => ({
        cityName: `城市${i}`,
        days: 2,
        transportTo: null as null,
      }));
      const errors = validateHomeForm({ ...validData, destinations: sixDest });
      expect(errors.some((e) => e.field === 'destinations' && e.message.includes('5'))).toBe(true);
    });

    it('总天数超过30天时应返回错误', () => {
      const longTrip = [
        { cityName: '北京', days: 15, transportTo: null as null },
        { cityName: '上海', days: 16, transportTo: null as null },
      ];
      const errors = validateHomeForm({ ...validData, destinations: longTrip });
      expect(errors.some((e) => e.field === 'destinations' && e.message.includes('30'))).toBe(true);
    });

    it('单个目的地停留天数超过14天时应返回错误', () => {
      const longDest = [{ cityName: '长沙', days: 15, transportTo: null as null }];
      const errors = validateHomeForm({ ...validData, destinations: longDest });
      expect(
        errors.some((e) => e.field === 'destinations[0].days' && e.message.includes('14')),
      ).toBe(true);
    });

    it('目的地城市名称为空时应返回错误', () => {
      const emptyDest = [{ cityName: '', days: 3, transportTo: null as null }];
      const errors = validateHomeForm({ ...validData, destinations: emptyDest });
      expect(errors.some((e) => e.field === 'destinations[0].cityName')).toBe(true);
    });
  });
});

describe('validateField', () => {
  it('departureCity 为空时应返回错误', () => {
    const err = validateField('departureCity', '', validData);
    expect(err).not.toBeNull();
    expect(err!.field).toBe('departureCity');
  });

  it('departureCity 有值时应返回 null', () => {
    const err = validateField('departureCity', '北京', validData);
    expect(err).toBeNull();
  });

  it('departureDate 为空时应返回错误', () => {
    const err = validateField('departureDate', '', validData);
    expect(err).not.toBeNull();
  });

  it('departureDate 为过去日期时应返回错误', () => {
    const err = validateField('departureDate', '2020-01-01', validData);
    expect(err).not.toBeNull();
  });

  it('adults 为0时应返回错误', () => {
    const err = validateField('adults', 0, validData);
    expect(err).not.toBeNull();
  });

  it('adults 为1时应返回 null', () => {
    const err = validateField('adults', 1, validData);
    expect(err).toBeNull();
  });
});

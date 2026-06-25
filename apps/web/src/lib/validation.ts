/**
 * 首页表单校验逻辑（FE-007）
 * - 实时校验：字段 blur 时检查
 * - 提交校验：点击生成时全量检查
 */
import type { Destination } from '@path-wise/shared';
import { MAX_DESTINATIONS, MAX_TOTAL_DAYS, MAX_DAYS_PER_DESTINATION } from '@/lib/constants';

interface FormData {
  departureCity: string;
  destinations: Destination[];
  departureDate: string;
  adults: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

export function validateHomeForm(data: FormData): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!data.departureCity.trim()) {
    errors.push({ field: 'departureCity', message: '请选择出发城市' });
  }

  if (data.destinations.length === 0) {
    errors.push({ field: 'destinations', message: '请至少选择 1 个目的地' });
  }

  if (data.destinations.length > MAX_DESTINATIONS) {
    errors.push({
      field: 'destinations',
      message: `MVP 阶段最多支持 ${MAX_DESTINATIONS} 个目的地`,
    });
  }

  for (let i = 0; i < data.destinations.length; i++) {
    const d = data.destinations[i];
    if (!d.cityName || !d.cityName.trim()) {
      errors.push({ field: `destinations[${i}].cityName`, message: '目的地城市不能为空' });
    }
    if (d.days < 1) {
      errors.push({ field: `destinations[${i}].days`, message: '停留天数至少为 1' });
    }
    if (d.days > MAX_DAYS_PER_DESTINATION) {
      errors.push({
        field: `destinations[${i}].days`,
        message: `单个城市最多停留 ${MAX_DAYS_PER_DESTINATION} 天`,
      });
    }
  }

  if (!data.departureDate) {
    errors.push({ field: 'departureDate', message: '请选择出发日期' });
  } else {
    const selected = new Date(data.departureDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (selected < today) {
      errors.push({ field: 'departureDate', message: '出发日期不能选过去的日期' });
    }
  }

  if (data.adults < 1) {
    errors.push({ field: 'adults', message: '成人人数至少为 1' });
  }

  const totalDays = data.destinations.reduce((sum, d) => sum + d.days, 0);
  if (totalDays > MAX_TOTAL_DAYS) {
    errors.push({ field: 'destinations', message: `MVP 阶段最多支持 ${MAX_TOTAL_DAYS} 天行程` });
  }

  return errors;
}

/**
 * 检查单个字段的实时校验错误
 */
export function validateField(
  field: string,
  value: unknown,
  allData: FormData,
): ValidationError | null {
  switch (field) {
    case 'departureCity':
      if (!(value as string)?.trim()) return { field, message: '请选择出发城市' };
      return null;
    case 'departureDate': {
      if (!value) return { field, message: '请选择出发日期' };
      const selected = new Date(value as string);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selected < today) return { field, message: '出发日期不能选过去的日期' };
      return null;
    }
    case 'adults':
      if ((value as number) < 1) return { field, message: '成人人数至少为 1' };
      return null;
    default:
      return null;
  }
}

/**
 * PATH-WISE · 用户偏好类型
 * 依据：docs/API接口设计规格书_v1.0.0.md §2.2
 */

import type { BudgetLevel, PaceLevel, AccommodationType } from './base.js';

/** 用户偏好 */
export interface UserPreferences {
  budget: BudgetLevel;
  pace: PaceLevel;
  accommodation: AccommodationType;
  dining: string[];
  interests: string[];
}

/** 用户概要 */
export interface UserProfile {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  status: string;
}

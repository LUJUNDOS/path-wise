/**
 * PATH-WISE · 用户服务
 * 职责：用户偏好读写
 *
 * MVP stub：返回默认偏好
 */

import type { UserPreferences } from "@path-wise/shared";

const DEFAULT_PREFERENCES: UserPreferences = {
  budget: "comfort",
  pace: "moderate",
  accommodation: "chain_hotel",
  dining: ["local_food"],
  interests: ["culture", "photography"],
};

/**
 * 读取用户偏好
 */
export async function getUserPreferences(
  _userId: string,
): Promise<UserPreferences> {
  // MVP: 返回默认偏好
  return { ...DEFAULT_PREFERENCES };
}

/**
 * 保存用户偏好
 */
export async function saveUserPreferences(
  _userId: string,
  prefs: UserPreferences,
): Promise<UserPreferences> {
  // MVP: 直接返回传入的偏好
  return { ...prefs, updatedAt: new Date().toISOString() } as UserPreferences & {
    updatedAt: string;
  };
}

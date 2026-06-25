/**
 * PATH-WISE · 分享与协作服务
 * 职责：分享 Token 生成、修改建议管理
 *
 * MVP stub
 */

import type {
  ShareLink,
  Suggestion,
  SuggestionSubmitRequest,
  SuggestionActionRequest,
  SuggestionActionResponse,
  ShareCard,
} from "@path-wise/shared";

/**
 * 生成分享 Token
 */
export async function generateShareToken(
  _tripId: string,
  expireDays = 30,
  maxUsers = 20,
): Promise<ShareLink> {
  const shareToken = Math.random().toString(36).substring(2, 12);
  const expireAt = new Date(
    Date.now() + expireDays * 86400000,
  ).toISOString();
  return {
    shareToken,
    shareUrl: `https://tripplanner.com/share/${shareToken}`,
    expireAt,
    maxUsers,
  };
}

/**
 * 验证分享 Token
 */
export async function verifyShareToken(
  _tripId: string,
  _shareToken: string,
): Promise<boolean> {
  // MVP stub: always valid
  return true;
}

/**
 * 提交修改建议
 */
export async function submitSuggestion(
  _tripId: string,
  _req: SuggestionSubmitRequest,
  _shareToken: string,
): Promise<{ suggestionId: string; status: string; createdAt: string }> {
  return {
    suggestionId: `sug_${Date.now().toString(36)}`,
    status: "pending",
    createdAt: new Date().toISOString(),
  };
}

/**
 * 获取修改建议列表
 */
export async function getSuggestions(
  _tripId: string,
  _status?: string,
): Promise<{ suggestions: Suggestion[]; summary: Record<string, number> }> {
  return { suggestions: [], summary: { total: 0, pending: 0, accepted: 0, rejected: 0 } };
}

/**
 * 处理修改建议
 */
export async function handleSuggestion(
  _tripId: string,
  suggestionId: string,
  _req: SuggestionActionRequest,
): Promise<SuggestionActionResponse> {
  return {
    suggestionId,
    status: _req.action === "accept" ? "accepted" : "rejected",
    regenerateRequired: _req.action === "accept",
    affectedDayIndex: 0,
  };
}

/**
 * 获取分享卡片数据
 */
export async function getShareCard(shareId: string): Promise<ShareCard> {
  return {
    title: "PATH-WISE · 旅行攻略",
    description: "已生成专属攻略，点击查看详情",
    imageUrl: `https://cdn.example.com/share/cover/${shareId}.png`,
    url: `https://tripplanner.com/share/${shareId}`,
  };
}

/**
 * 获取分享封面图
 */
export function getCoverImageUrl(_tripId: string): string {
  return `https://cdn.example.com/share/cover/${_tripId}.png`;
}

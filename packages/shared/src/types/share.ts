/**
 * PATH-WISE · 分享与协作类型
 * 依据：docs/API接口设计规格书_v1.0.0.md §7
 */

/** 修改建议类型 */
export type SuggestionType =
  | 'add_poi'
  | 'remove_poi'
  | 'change_hotel'
  | 'change_transport'
  | 'note';

/** 修改建议状态 */
export type SuggestionStatus = 'pending' | 'accepted' | 'rejected';

/** 修改建议 */
export interface Suggestion {
  suggestionId: string;
  dayIndex: number;
  type: SuggestionType;
  poi?: {
    name: string;
    category: string;
    durationMinutes: number;
  };
  reason?: string;
  status: SuggestionStatus;
  submitter?: string;
  createdAt: string;
}

/** 提交修改建议请求 */
export interface SuggestionSubmitRequest {
  dayIndex: number;
  type: SuggestionType;
  poi?: {
    name: string;
    category: string;
    durationMinutes: number;
  };
  reason?: string;
}

/** 处理修改建议请求 */
export interface SuggestionActionRequest {
  action: 'accept' | 'reject';
  note?: string;
}

/** 处理修改建议响应 */
export interface SuggestionActionResponse {
  suggestionId: string;
  status: SuggestionStatus;
  regenerateRequired: boolean;
  affectedDayIndex: number;
}

/** 分享链接 */
export interface ShareLink {
  shareToken: string;
  shareUrl: string;
  expireAt: string;
  maxUsers: number;
}

/** 分享卡片 */
export interface ShareCard {
  title: string;
  description: string;
  imageUrl: string;
  url: string;
}

/** 分享查看响应（小程序端） */
export interface SharedTripView {
  tripId: string;
  title: string;
  days: unknown[]; // DayPlan[] 但此处用 unknown 避免循环引用
  isReadOnly: true;
  sharedBy: string;
  expireAt: string;
}

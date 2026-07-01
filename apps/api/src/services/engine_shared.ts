/**
 * PATH-WISE · 引擎共享常量
 * 由 ENGINE-002（候选池过滤）和 ENGINE-003（评分填充）共同导入，
 * 避免跨文件重复定义。
 */

/**
 * 用户兴趣标签 → POI 类别映射
 * ENGINE-002 用于过滤判断，ENGINE-003 用于评分降权。
 */
export const INTEREST_CATEGORY_MAP: Record<string, string[]> = {
  美食: ['dining'],
  购物: ['shopping'],
  自然: ['nature'],
  历史: ['attraction'],
  文化: ['attraction'],
  博物馆: ['attraction'],
  户外: ['nature', 'attraction'],
  夜生活: ['nightlife'],
  拍照: ['attraction', 'nature'],
  亲子: ['attraction', 'nature'],
};

/** 桌面端参与同步的资源类型（顺序即 syncAll 执行顺序） */
export const ALL_SYNC_RESOURCES = [
  'time-records',
  'diaries',
  'worklist-items',
  'memo-items',
  'work-year-digests',
];

/**
 * @param {string[] | null | undefined} resources
 * @returns {string[]}
 */
export function resolveSyncResourceList(resources) {
  if (resources == null) return [...ALL_SYNC_RESOURCES];
  if (!Array.isArray(resources) || resources.length === 0) {
    return [...ALL_SYNC_RESOURCES];
  }
  const allowed = new Set(ALL_SYNC_RESOURCES);
  return resources.filter((r) => allowed.has(r));
}

/**
 * 合并防抖窗口内的多次 sync:request。
 * @param {boolean} currentFull 当前是否已标记全量
 * @param {Set<string>} currentPartial 当前待同步的部分资源
 * @param {string[] | null | undefined} incoming payload.resources（null/缺省 = 全量）
 * @returns {{ full: boolean, partial: Set<string> }}
 */
export function mergeSyncRequestTargets(currentFull, currentPartial, incoming) {
  if (incoming == null) {
    return { full: true, partial: new Set() };
  }
  if (!Array.isArray(incoming) || incoming.length === 0) {
    return { full: true, partial: new Set() };
  }
  if (currentFull) {
    return { full: true, partial: new Set() };
  }
  const next = new Set(currentPartial);
  for (const r of incoming) {
    if (ALL_SYNC_RESOURCES.includes(r)) next.add(r);
  }
  return { full: false, partial: next };
}

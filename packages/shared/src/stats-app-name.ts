/** 统计展示/同步时需排除的占位应用名（大小写不敏感） */
const EXCLUDED_STATS_NAME = 'unknown';

export type PerAppTodayLike = {
  appId?: string;
  processName?: string;
  windowTitle?: string;
};

export function isExcludedStatsAppName(name: unknown): boolean {
  return String(name ?? '').trim().toLowerCase() === EXCLUDED_STATS_NAME;
}

export function isExcludedStatsAppKey(appKey: unknown): boolean {
  const key = String(appKey ?? '').trim().toLowerCase();
  return key === EXCLUDED_STATS_NAME || key.startsWith(`${EXCLUDED_STATS_NAME}::`);
}

/** 与桌面端 topAppsFromPerAppToday 一致的展示名推导 */
export function resolvePerAppDisplayName(item: PerAppTodayLike): string {
  const windowTitle = String(item.windowTitle ?? '').trim();
  const titleParts = windowTitle.split('-');
  const titleAfterDash =
    titleParts.length > 1 ? titleParts[titleParts.length - 1].trim() : windowTitle;
  return titleAfterDash || String(item.processName ?? item.appId ?? '').trim();
}

export function shouldExcludePerAppTodayItem(item: PerAppTodayLike): boolean {
  if (isExcludedStatsAppKey(item.appId)) return true;
  if (isExcludedStatsAppName(item.processName)) return true;
  return isExcludedStatsAppName(resolvePerAppDisplayName(item));
}

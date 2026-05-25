import {
  resolvePerAppDisplayName,
  shouldExcludePerAppTodayItem,
} from '@time-manger/shared'

/**
 * 按窗口标题后缀/进程名聚合今日应用时长，取 Top 8（展示时可再 slice）。
 * 1. 使用：`src/App.jsx`、`PetStatsPanel`
 */
export function topAppsFromPerAppToday(perAppToday) {
  const groupedApps = new Map()

  ;(perAppToday || []).forEach((item) => {
    if (shouldExcludePerAppTodayItem(item)) return

    const appName = resolvePerAppDisplayName(item)
    const groupKey = appName.toLowerCase()

    const existing = groupedApps.get(groupKey)
    if (existing) {
      existing.durationMs += item.durationMs || 0
      return
    }

    groupedApps.set(groupKey, {
      appId: groupKey,
      appName,
      durationMs: item.durationMs || 0,
    })
  })

  return Array.from(groupedApps.values())
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 8)
}

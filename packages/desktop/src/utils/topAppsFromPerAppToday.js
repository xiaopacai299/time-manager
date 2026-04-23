/**
 * 按窗口标题后缀/进程名聚合今日应用时长，取 Top 8（展示时可再 slice）。
 * 1. 使用：`src/App.jsx`、`PetStatsPanel`
 */
export function topAppsFromPerAppToday(perAppToday) {
  const groupedApps = new Map()

  ;(perAppToday || []).forEach((item) => {
    const windowTitle = (item.windowTitle || '').trim()
    const titleParts = windowTitle.split('-')
    const titleAfterDash = titleParts.length > 1 ? titleParts[titleParts.length - 1].trim() : windowTitle
    const appName = titleAfterDash || item.processName || item.appId
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

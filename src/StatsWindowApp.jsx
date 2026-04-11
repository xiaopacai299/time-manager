import { useMemo } from 'react'
import './App.css'
import PetStatsPanel from './components/PetStatsPanel'
import { useTimeManagerPetBridge } from './hooks/useTimeManagerPetBridge'
import { getSnapshotDurationStats } from './utils/snapshotDurationStats'
import { topAppsFromPerAppToday } from './utils/topAppsFromPerAppToday'

/**
 * 独立统计窗口（路由 `#stats`），与宠物窗口共用数据订阅与 PetStatsPanel。
 */
export default function StatsWindowApp() {
  const { snapshot } = useTimeManagerPetBridge()
  const topApps = useMemo(() => topAppsFromPerAppToday(snapshot.perAppToday), [snapshot.perAppToday])
  const durationStats = useMemo(() => getSnapshotDurationStats(snapshot), [snapshot])

  return (
    <main className="stats-window-shell">
      <h1 className="stats-window-heading">使用统计</h1>
      <PetStatsPanel snapshot={snapshot} topApps={topApps} durationStats={durationStats} />
    </main>
  )
}

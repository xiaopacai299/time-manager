import { useMemo } from 'react'
import './App.css'
import PetAvatarArea from './components/PetAvatarArea'
import PetBubble from './components/PetBubble'
import PetStatsPanel from './components/PetStatsPanel'
import { usePetMood } from './hooks/usePetMood'
import { usePetTempInteractive } from './hooks/usePetTempInteractive'
import { useTimeManagerPetBridge } from './hooks/useTimeManagerPetBridge'
import { getSnapshotDurationStats } from './utils/snapshotDurationStats'
import { topAppsFromPerAppToday } from './utils/topAppsFromPerAppToday'

function App() {
  const { snapshot, petState, isBridgeReady, transientAction, petMotion } = useTimeManagerPetBridge()
  usePetTempInteractive(petState.clickThrough)
  const mood = usePetMood(snapshot, transientAction)
  const topApps = useMemo(() => topAppsFromPerAppToday(snapshot.perAppToday), [snapshot.perAppToday])
  const durationStats = useMemo(() => getSnapshotDurationStats(snapshot), [snapshot])

  return (
    <main className={`pet-shell${petMotion.running ? ' pet-shell--chasing' : ''}`}>
      {!isBridgeReady && (
        <div className="warning">请通过 electron-start 启动宠物模式。</div>
      )}
      {!petMotion.running && <PetBubble snapshot={snapshot} />}
      <PetAvatarArea mood={mood} petMotion={petMotion} />
      {!petState.compactMode && petState.showStatsPanel && (
        <PetStatsPanel snapshot={snapshot} topApps={topApps} durationStats={durationStats} />
      )}
    </main>
  )
}

export default App

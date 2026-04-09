import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'

const EMPTY_SNAPSHOT = {
  dayKey: '',
  current: {
    processName: 'Waiting',
    windowTitle: 'Collecting data...',
    idleSeconds: 0,
    isOnBreak: false,
    enteredAt: Date.now(),
  },
  perAppToday: [],
  continuousUseMs: 0,
  breakCompletedMs: 0,
  transitions: [],
}

function formatDuration(ms = 0) {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':')
}

function App() {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT)
  const [petState, setPetState] = useState({
    clickThrough: false,
    showStatsPanel: true,
  })
  const [interactionMood] = useState('')
  const tempInteractiveRef = useRef(false)
  const isBridgeReady = typeof window !== 'undefined' && Boolean(window.timeManagerAPI)

  useEffect(() => {
    let unsubscribe = null
    if (!window.timeManagerAPI) return undefined

    window.timeManagerAPI.getSnapshot().then((data) => {
      if (data) setSnapshot(data)
    })
    window.timeManagerAPI.getPetState?.().then((data) => {
      if (data) setPetState(data)
    })
    const unbindPetState = window.timeManagerAPI.onPetStateChanged?.((data) => {
      if (data) setPetState(data)
    })
    unsubscribe = window.timeManagerAPI.onUpdate((data) => {
      setSnapshot(data)
    })

    return () => {
      if (unsubscribe) unsubscribe()
      if (unbindPetState) unbindPetState()
    }
  }, [])

  useEffect(() => {
    if (!window.timeManagerAPI) return undefined

    const syncTempInteractive = (active) => {
      if (tempInteractiveRef.current === active) return
      tempInteractiveRef.current = active
      window.timeManagerAPI.setTempInteractive?.(active)
    }

    const onMouseMove = (event) => {
      const shouldEnableTempInteractive = petState.clickThrough && event.altKey
      syncTempInteractive(shouldEnableTempInteractive)
    }

    const onKeyUp = (event) => {
      if (event.key === 'Alt') {
        syncTempInteractive(false)
      }
    }

    const onBlur = () => syncTempInteractive(false)

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      syncTempInteractive(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [petState.clickThrough])

  const petView = useMemo(() => {
    const continuousMs = snapshot.continuousUseMs || 0
    const breakMs = snapshot.breakCompletedMs || 0
    const currentApp = snapshot.current?.processName || 'Unknown'

    if (interactionMood) {
      return { mood: interactionMood, text: `当前专注：${currentApp}` }
    }
    if (breakMs >= 5 * 60 * 1000) {
      return { mood: 'happy', text: '休息完成！做得很好，继续保持。' }
    }
    if (continuousMs >= 50 * 60 * 1000) {
      return { mood: 'warn', text: `你已连续使用 ${formatDuration(continuousMs)}，建议活动一下。` }
    }
    if (snapshot.current?.isOnBreak) {
      return { mood: 'sleep', text: '检测到你在休息，我会安静陪着你。' }
    }
    return { mood: 'idle', text: `当前专注：${currentApp}` }
  }, [snapshot, interactionMood])

  const topApps = useMemo(() => {
    const groupedApps = new Map()

    snapshot.perAppToday.forEach((item) => {
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
  }, [snapshot.perAppToday])

  const currentEnteredAt = snapshot.current?.enteredAt || 0
  const currentAppElapsedMs = useMemo(() => {
    if (!currentEnteredAt) return 0
    return Math.max(0, (snapshot.timestamp || 0) - currentEnteredAt)
  }, [snapshot.timestamp, currentEnteredAt])

  const todayTotalMs = useMemo(
    () => snapshot.perAppToday.reduce((total, item) => total + (item.durationMs || 0), 0),
    [snapshot.perAppToday]
  )

  async function toggleClickThrough() {
    const next = await window.timeManagerAPI?.toggleClickThrough?.()
    setPetState((prev) => ({ ...prev, clickThrough: Boolean(next) }))
  }

  async function toggleStatsPanel() {
    const next = await window.timeManagerAPI?.toggleStatsPanel?.()
    setPetState((prev) => ({ ...prev, showStatsPanel: Boolean(next) }))
  }

  return (
    <main className="pet-shell">
      {!isBridgeReady && <div className="warning">请通过 electron-start 启动宠物模式。</div>}
      <section className="bubble">{petView.text}</section>

      <section
        className={`pet-avatar mood-${petView.mood}`}
      >
        <div className="pet-face">
          <span className="eye" />
          <span className="eye" />
        </div>
        <div className="pet-label">{snapshot.current.processName || 'companion'}</div>
      </section>

      <section className="pet-actions">
        <button onClick={toggleClickThrough}>
          {petState.clickThrough ? '关闭穿透' : '开启穿透'}
        </button>
        <button onClick={toggleStatsPanel}>
          {petState.showStatsPanel ? '隐藏面板' : '显示面板'}
        </button>
      </section>

      {petState.showStatsPanel && (
        <section className="stats-panel">
          <p>快捷键：按住 Alt 临时关闭穿透，松开恢复。</p>
          <p>当前应用：{snapshot.current.windowTitle || '无窗口标题'}</p>
          <p>当前应用时长：{formatDuration(currentAppElapsedMs)}</p>
          <p>今日总时长：{formatDuration(todayTotalMs)}</p>
          <p>休息累计：{formatDuration(snapshot.breakCompletedMs)}</p>
          <h4>今日 Top 应用</h4>
          <ul>
            {topApps.length === 0 ? (
              <li>暂无数据</li>
            ) : (
              topApps.slice(0, 5).map((item) => (
                <li key={item.appId}>
                  {item.appName}: {formatDuration(item.durationMs)}
                </li>
              ))
            )}
          </ul>
        </section>
      )}
    </main>
  )
}

export default App

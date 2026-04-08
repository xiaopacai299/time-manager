import { useEffect, useMemo, useState } from 'react'
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
  const isBridgeReady = typeof window !== 'undefined' && Boolean(window.timeManagerAPI)
  // console.log('代码执行了1')
  useEffect(() => {
    console.log('代码执行了23')
    let unsubscribe = null
    if (!window.timeManagerAPI) return undefined

    window.timeManagerAPI.getSnapshot().then((data) => {
      console.log('data1222222', data)
      if (data) setSnapshot(data)
    })
    unsubscribe = window.timeManagerAPI.onUpdate((data) => {
      setSnapshot(data)
    })

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  const topApps = useMemo(() => snapshot.perAppToday.slice(0, 8), [snapshot.perAppToday])
  const currentEnteredAt = snapshot.current?.enteredAt || 0
  const currentAppElapsedMs = useMemo(() => {
    if (!currentEnteredAt) return 0
    return Math.max(0, (snapshot.timestamp || 0) - currentEnteredAt)
  }, [snapshot.timestamp, currentEnteredAt])

  return (
    <main className="dashboard">
      <header className="panel">
        <h1>Time Manager</h1>
        <p>日期：{snapshot.dayKey || 'N/A'}</p>
        {!isBridgeReady && (
          <p className="warning">
            未检测到 Electron 数据桥接。请先关闭旧窗口后重新执行 <code>npm run electron-start</code>。
          </p>
        )}
      </header>

      <section className="grid">
        <div className="panel">
          <h2>当前使用应用</h2>
          <p className="strong">{snapshot.current.processName}</p>
          <p className="muted">{snapshot.current.windowTitle || '无窗口标题'}</p>
          <p>最新进入当前应用时间：{new Date(snapshot.current.enteredAt).toLocaleTimeString()}</p>
          <p>当前应用已使用：{formatDuration(currentAppElapsedMs)}</p>
          <p>连续使用：{formatDuration(snapshot.continuousUseMs)}</p>
          <p className="muted">规则：无键鼠操作 10 分钟后暂停当前应用计时</p>
          <p className="muted">打开本应用查看统计时，不会把本应用计入使用时长</p>
          <p>休息完成：{formatDuration(snapshot.breakCompletedMs)}</p>
        </div>
      </section>

      <section className="panel">
        <h2>今日应用时长</h2>
        <table>
          <thead>
            <tr>
              <th>应用</th>
              <th>时长</th>
            </tr>
          </thead>
          <tbody>
            {topApps.length === 0 ? (
              <tr>
                <td colSpan={2}>暂无数据</td>
              </tr>
            ) : (
              topApps.map((item) => (
                <tr key={item.appId}>
                  <td>{item.windowTitle || item.processName}</td>
                  <td>{formatDuration(item.durationMs)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>最近切换</h2>
        <p className="muted">
          白名单/黑名单可在 <code>main/app-filter-config.js</code> 配置（按进程名，如 wps、chrome）。
        </p>
        <ul className="transitions">
          {snapshot.transitions.length === 0 ? (
            <li>暂无切换记录</li>
          ) : (
            snapshot.transitions
              .slice(-8)
              .reverse()
              .map((item, idx) => (
                <li key={`${item.leftAt}-${idx}`}>
                  {new Date(item.leftAt).toLocaleTimeString()}：{item.fromAppId} → {item.toAppId}
                </li>
              ))
          )}
        </ul>
      </section>
    </main>
  )
}

export default App

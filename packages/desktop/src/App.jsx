import { useEffect, useMemo, useState } from 'react'
import './App.css'
import PetAvatarArea from './components/PetAvatarArea'
import PetBubble from './components/PetBubble'
import PetStatsPanel from './components/PetStatsPanel'
import { usePetMood } from './hooks/usePetMood'
import { usePetTempInteractive } from './hooks/usePetTempInteractive'
import { useTimeManagerPetBridge } from './hooks/useTimeManagerPetBridge'
import { getAuthState } from './sync/authStore.js'
import { normalizeApiBase } from './sync/ApiClient.js'
import { getSnapshotDurationStats } from './utils/snapshotDurationStats'
import { topAppsFromPerAppToday } from './utils/topAppsFromPerAppToday'

const QUOTE_FADE_AT_MS = 50_000
const QUOTE_HIDE_AT_MS = 60_000
let startupQuoteFetchPromise = null

async function fetchStartupQuoteOnce() {
  if (startupQuoteFetchPromise) return startupQuoteFetchPromise
  startupQuoteFetchPromise = (async () => {
    const auth = await getAuthState().catch(() => null)
    const preferredApiBase = normalizeApiBase(auth?.apiBase || 'http://localhost:3000')
    const candidates = [preferredApiBase]
    if (preferredApiBase !== 'http://localhost:3000') {
      candidates.push('http://localhost:3000')
    }
    console.info('[startup-quote] candidates:', candidates)
    for (const apiBase of candidates) {
      try {
        console.info('[startup-quote] requesting:', `${apiBase}/api/v1/quotes/featured`)
        const res = await fetch(`${apiBase}/api/v1/quotes/featured`)
        console.info('[startup-quote] status:', apiBase, res.status)
        if (!res.ok) continue
        const payload = await res.json().catch(() => null)
        console.info('[startup-quote] payload:', payload)
        const content = String(payload?.quote?.content || '').trim()
        if (!content) continue
        console.info('[startup-quote] picked:', { content, author: String(payload?.quote?.author || '').trim() })
        return {
          content,
          author: String(payload?.quote?.author || '').trim(),
        }
      } catch {
        console.warn('[startup-quote] request failed, try next apiBase:', apiBase)
      }
    }
    console.warn('[startup-quote] no quote resolved')
    return null
  })()
  return startupQuoteFetchPromise
}

function App() {
  const { snapshot, petState, isBridgeReady, transientAction, petMotion } = useTimeManagerPetBridge()
  usePetTempInteractive(petState.clickThrough)
  const mood = usePetMood(snapshot, transientAction, petState?.petSettings)
  const topApps = useMemo(() => topAppsFromPerAppToday(snapshot.perAppToday), [snapshot.perAppToday])
  const durationStats = useMemo(() => getSnapshotDurationStats(snapshot), [snapshot])
  const [startupQuote, setStartupQuote] = useState(null)
  const [quoteFading, setQuoteFading] = useState(false)

  useEffect(() => {
    let alive = true
    let fadeTimer = null
    let hideTimer = null

    ;(async () => {
      try {
        const quote = await fetchStartupQuoteOnce()
        if (!alive || !quote?.content) return
        try {
          await window.timeManagerAPI?.setStartupQuoteArea?.(true)
        } catch {
          // 主进程不可用时忽略，仅 UI 显示
        }
        setStartupQuote(quote)
        fadeTimer = window.setTimeout(() => {
          if (alive) setQuoteFading(true)
        }, QUOTE_FADE_AT_MS)
        hideTimer = window.setTimeout(() => {
          if (!alive) return
          setStartupQuote(null)
          setQuoteFading(false)
          try {
            window.timeManagerAPI?.setStartupQuoteArea?.(false)
          } catch {
            // ignore
          }
        }, QUOTE_HIDE_AT_MS)
      } catch {
        // 忽略：服务端不可用时不展示开屏名言
      }
    })()

    return () => {
      alive = false
      if (fadeTimer) window.clearTimeout(fadeTimer)
      if (hideTimer) window.clearTimeout(hideTimer)
      try {
        window.timeManagerAPI?.setStartupQuoteArea?.(false)
      } catch {
        // ignore
      }
    }
  }, [])

  return (
    <main className={`pet-shell${petMotion.running ? ' pet-shell--chasing' : ''}`}>
      {!isBridgeReady && (
        <div className="warning">请通过 electron-start 启动宠物模式。</div>
      )}
      <section className="pet-stage">
        {!petMotion.running && <PetBubble snapshot={snapshot} petSettings={petState.petSettings} />}
        <PetAvatarArea
          mood={mood}
          petMotion={petMotion}
          selectedPet={petState?.petSettings?.selectedPet || 'black-coal'}
        />
      </section>
      {startupQuote ? (
        <section
          className={`pet-startup-quote${quoteFading ? ' pet-startup-quote--fading' : ''}`}
          aria-live="polite"
        >
          <p className="pet-startup-quote__content">{startupQuote.content}</p>
          {startupQuote.author ? (
            <p className="pet-startup-quote__author">—— {startupQuote.author}</p>
          ) : null}
        </section>
      ) : null}
      {!petState.compactMode && petState.showStatsPanel && (
        <PetStatsPanel snapshot={snapshot} topApps={topApps} durationStats={durationStats} />
      )}
    </main>
  )
}

export default App

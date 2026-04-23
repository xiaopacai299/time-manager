import { useEffect, useMemo, useState } from 'react'
import './FootprintOverlayApp.css'

const MAX_PRINTS = 20
const FADE_STAGGER_S = 0.062

/**
 * 独立 BrowserWindow（#footprint-overlay）：屏幕坐标固定爪印，穿透鼠标。
 */
export default function FootprintOverlayApp() {
  const [prints, setPrints] = useState([])

  useEffect(() => {
    const api = window.timeManagerAPI
    if (!api?.onFootprintPush || !api?.onFootprintClearSession) return undefined

    const unPush = api.onFootprintPush((item) => {
      if (!item || typeof item.id !== 'number') return
      setPrints((prev) => {
        const next = [{ ...item }, ...prev.filter((p) => p.id !== item.id)]
        return next.length > MAX_PRINTS ? next.slice(0, MAX_PRINTS) : next
      })
    })
    const unClear = api.onFootprintClearSession(() => setPrints([]))

    return () => {
      unPush?.()
      unClear?.()
    }
  }, [])

  const fadeDelayById = useMemo(() => {
    const items = prints.map((pr, idx) => ({
      id: pr.id,
      pairIndex: Math.floor(idx / 2),
      row: pr.row,
    }))
    items.sort((a, b) => {
      if (b.pairIndex !== a.pairIndex) return b.pairIndex - a.pairIndex
      return a.row - b.row
    })
    const map = new Map()
    items.forEach((item, rank) => map.set(item.id, rank * FADE_STAGGER_S))
    return map
  }, [prints])

  return (
    <div className="footprint-overlay-root" aria-hidden="true">
      {prints.map((pr, idx) => {
        const behindDir = pr.mirror ? -1 : 1
        const rotateDeg = -behindDir * 90
        const scale = Math.max(0.3, 1 - idx * 0.035)
        return (
          <div
            key={pr.id}
            className="footprint-overlay-print"
            style={{ left: pr.x, top: pr.y, transform: 'translate(-50%, -50%)' }}
          >
            <div
              className="footprint-overlay-print__orient"
              style={{ transform: `rotate(${rotateDeg}deg) scale(${scale})` }}
            >
              <div
                className="footprint-overlay-print__fade"
                style={{ animationDelay: `${fadeDelayById.get(pr.id) ?? 0}s` }}
              >
                <svg className="footprint-overlay-print__svg" viewBox="0 0 24 28" width="22" height="26" aria-hidden="true">
                  <ellipse cx="12" cy="19.5" rx="7.2" ry="5.2" fill="#0c0c0c" />
                  <circle cx="6.2" cy="8.2" r="3.1" fill="#0c0c0c" />
                  <circle cx="12" cy="6" r="3.1" fill="#0c0c0c" />
                  <circle cx="17.8" cy="8.2" r="3.1" fill="#0c0c0c" />
                </svg>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

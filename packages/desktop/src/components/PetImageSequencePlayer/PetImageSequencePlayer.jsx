import { useEffect, useRef, useState } from 'react'
import {
  PET_YAWN_CROSSFADE_MS,
  PET_YAWN_TOTAL_MS,
  preloadPetImageUrls,
} from '../../constants/petYawnActions'
import './PetImageSequencePlayer.css'

/**
 * 多图序列播放：预加载 + 双缓冲淡入淡出，减轻跳帧卡顿感。
 */
export default function PetImageSequencePlayer({
  frames,
  totalMs = PET_YAWN_TOTAL_MS,
  crossfadeMs = PET_YAWN_CROSSFADE_MS,
  imageLayoutClass = '',
  moodClass = '',
  chasing = false,
  wrapStyle,
  onComplete,
}) {
  const [baseIndex, setBaseIndex] = useState(0)
  const [overlayIndex, setOverlayIndex] = useState(null)
  const [overlayVisible, setOverlayVisible] = useState(false)
  const [ready, setReady] = useState(false)
  const runIdRef = useRef(0)

  useEffect(() => {
    if (!frames?.length) return undefined
    const runId = runIdRef.current + 1
    runIdRef.current = runId
    let cancelled = false
    const timers = []

    const clearTimers = () => {
      timers.forEach((id) => clearTimeout(id))
      timers.length = 0
    }

    setReady(false)
    setBaseIndex(0)
    setOverlayIndex(null)
    setOverlayVisible(false)

    preloadPetImageUrls(frames).then(() => {
      if (cancelled || runIdRef.current !== runId) return
      setReady(true)

      const count = frames.length
      const fades = Math.max(0, count - 1)
      const holdMs = Math.max(
        120,
        (totalMs - fades * crossfadeMs) / count,
      )

      const schedule = (fn, delay) => {
        timers.push(setTimeout(fn, delay))
      }

      let elapsed = 0
      for (let i = 1; i < count; i += 1) {
        const startFadeAt = elapsed + holdMs
        const endFadeAt = startFadeAt + crossfadeMs
        const nextIndex = i

        schedule(() => {
          if (cancelled || runIdRef.current !== runId) return
          setOverlayIndex(nextIndex)
          setOverlayVisible(false)
          requestAnimationFrame(() => {
            if (cancelled || runIdRef.current !== runId) return
            setOverlayVisible(true)
          })
        }, startFadeAt)

        schedule(() => {
          if (cancelled || runIdRef.current !== runId) return
          setBaseIndex(nextIndex)
          setOverlayIndex(null)
          setOverlayVisible(false)
        }, endFadeAt)

        elapsed = endFadeAt
      }

      schedule(() => {
        if (cancelled || runIdRef.current !== runId) return
        onComplete?.()
      }, totalMs)
    })

    return () => {
      cancelled = true
      clearTimers()
    }
  }, [frames, totalMs, crossfadeMs, onComplete])

  if (!frames?.length || !ready) return null

  return (
    <div
      className={`pet-visual pet-visual--image pet-visual--sequence ${imageLayoutClass} pet-visual--override ${moodClass} ${chasing ? 'pet-visual--chasing' : ''}`}
      role="img"
      aria-label="桌面宠物"
    >
      <div className="pet-visual__bob">
        <div className="pet-visual__facing-wrap" style={wrapStyle}>
          <div className="pet-sequence-player">
            <img
              src={frames[baseIndex]}
              className="pet-sequence-player__layer pet-sequence-player__layer--base"
              alt=""
              draggable={false}
            />
            {overlayIndex !== null ? (
              <img
                src={frames[overlayIndex]}
                className={`pet-sequence-player__layer pet-sequence-player__layer--overlay${overlayVisible ? ' pet-sequence-player__layer--visible' : ''}`}
                style={{ transitionDuration: `${crossfadeMs}ms` }}
                alt=""
                draggable={false}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

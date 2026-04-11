import { useEffect, useMemo, useRef } from 'react'
import lottie from 'lottie-web'
import badCatAnimation from '../assets/bad-cat.json'

/**
 * 不用 lottie-react：其内部把整份 React props spread 进 loadAnimation，
 * 会带入 className / lottieRef 等非法字段，在部分环境（含 Electron）下可能抛错导致整页白屏。
 */
export default function AnimatedPet({ mood = 'idle' }) {
  const containerRef = useRef(null)
  const moodClass = useMemo(() => `pet-visual--${mood}`, [mood])
  const isSleep = mood === 'sleep'
  const isWarn = mood === 'warn'
  const isCelebrate = mood === 'celebrate'

  useEffect(() => {
    const el = containerRef.current
    if (!el) return undefined

    const anim = lottie.loadAnimation({
      container: el,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: badCatAnimation,
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid meet',
      },
    })

    const t1 = window.setTimeout(() => anim.resize(), 0)
    const t2 = window.setTimeout(() => anim.resize(), 80)

    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      anim.destroy()
    }
  }, [])

  return (
    <div className={`pet-visual ${moodClass}`} role="img" aria-label="桌面宠物动画">
      <div className="pet-visual__bob">
        <div ref={containerRef} className="pet-visual__lottie" />
      </div>
      <svg className="pet-visual__overlay" viewBox="0 0 180 180" aria-hidden="true">
        {isSleep && (
          <g className="pet-sleep-z">
            <text x="124" y="44" fontSize="14" fill="#7da5ff">z</text>
            <text x="136" y="34" fontSize="11" fill="#9cbcff">z</text>
          </g>
        )}
        {isWarn && (
          <g className="pet-warn-mark">
            <circle cx="135" cy="42" r="10" fill="#ffd26a" />
            <rect x="133.7" y="36" width="2.6" height="8" rx="1.2" fill="#7a3a00" />
            <circle cx="135" cy="47.2" r="1.3" fill="#7a3a00" />
          </g>
        )}
        {isCelebrate && (
          <g className="pet-celebrate-stars">
            <path d="M48 44 L51 51 L58 52 L52.5 57 L54 64 L48 60 L42 64 L43.5 57 L38 52 L45 51 Z" fill="#ffe36d" />
            <path d="M128 26 L130 31 L136 32 L131.5 36 L133 41 L128 38 L123 41 L124.5 36 L120 32 L126 31 Z" fill="#fff1a6" />
          </g>
        )}
      </svg>
    </div>
  )
}

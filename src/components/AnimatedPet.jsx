import { useEffect, useMemo, useRef } from 'react'
import lottie from 'lottie-web'
import badCatAnimation from '../assets/bad-cat.json'
import runCatAnimation from '../assets/run-cat.json'
import { getBadCatRestAnimationData } from '../utils/badCatRestVariant.js'
import PetMoodOverlay from './PetMoodOverlay.jsx'
import RunCatTailSparks from './RunCatTailSparks.jsx'

const DEFAULT_PET_MOTION = { running: false, mirrorX: false }

/** 非休息：含爪子短循环 */
const IDLE_SEGMENTS_DEFAULT = [0, 24]
/** 休息：整段循环（爪/杯层已从 JSON 剔除），配合 setSpeed(0.5) 整体慢一倍 */
const IDLE_SEGMENTS_REST = [0, 65]

const badCatRestAnimation = getBadCatRestAnimationData()

/**
 * 底层 bad-cat / 休息变体；追逐 run-cat。
 * 休息：半速 + 休息 JSON 剔除 Lapa、保留 cup 并水平镜像；叠加层仅爪与白烟轻摆。
 */
export default function AnimatedPet({ mood = 'work', petMotion = DEFAULT_PET_MOTION }) {
  const idleRef = useRef(null)
  const chaseRef = useRef(null)
  const idleAnimRef = useRef(null)
  const chaseAnimRef = useRef(null)

  const moodClass = useMemo(() => `pet-visual--${mood}`, [mood])
  const chasing = petMotion.running

  useEffect(() => {
    const chaseEl = chaseRef.current
    if (!chaseEl) return undefined

    const chaseAnim = lottie.loadAnimation({
      container: chaseEl,
      renderer: 'svg',
      loop: true,
      autoplay: false,
      animationData: runCatAnimation,
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid meet',
      },
    })
    chaseAnimRef.current = chaseAnim

    const t1 = window.setTimeout(() => chaseAnim.resize(), 0)
    const t2 = window.setTimeout(() => chaseAnim.resize(), 80)

    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      chaseAnim.destroy()
      chaseAnimRef.current = null
    }
  }, [])

  useEffect(() => {
    const idleEl = idleRef.current
    const chaseAnim = chaseAnimRef.current
    if (!idleEl || !chaseAnim) return undefined

    const prev = idleAnimRef.current
    if (prev) {
      prev.destroy()
      idleAnimRef.current = null
    }

    if (chasing) {
      chaseAnim.goToAndPlay(0, true)
      return undefined
    }

    chaseAnim.pause()

    const isRest = mood === 'rest'
    const data = isRest ? badCatRestAnimation : badCatAnimation
    const idleAnim = lottie.loadAnimation({
      container: idleEl,
      renderer: 'svg',
      loop: true,
      autoplay: false,
      animationData: data,
      rendererSettings: {
        preserveAspectRatio: 'xMidYMid meet',
      },
    })
    idleAnimRef.current = idleAnim

    const applyIdleSpeed = () => {
      idleAnim.setSpeed(isRest ? 0.5 : 1)
    }
    applyIdleSpeed()
    idleAnim.addEventListener('DOMLoaded', applyIdleSpeed)

    idleAnim.playSegments(isRest ? IDLE_SEGMENTS_REST : IDLE_SEGMENTS_DEFAULT, true)
    applyIdleSpeed()

    const t1 = window.setTimeout(() => idleAnim.resize(), 0)
    const t2 = window.setTimeout(() => idleAnim.resize(), 80)
    const t3 = window.setTimeout(applyIdleSpeed, 0)

    return () => {
      idleAnim.removeEventListener('DOMLoaded', applyIdleSpeed)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
      idleAnim.destroy()
      idleAnimRef.current = null
    }
  }, [mood, chasing])

  const faceStyle = useMemo(() => {
    if (!chasing) return undefined
    return {
      transform: petMotion.mirrorX ? 'scaleX(-1)' : 'scaleX(1)',
    }
  }, [chasing, petMotion.mirrorX])

  return (
    <div className={`pet-visual ${moodClass} ${chasing ? 'pet-visual--chasing' : ''}`} role="img" aria-label="桌面宠物动画">
      <div className="pet-visual__bob">
        <div className="pet-visual__facing-wrap" style={faceStyle}>
          <div className="pet-visual__stack">
            <div ref={idleRef} className="pet-visual__lottie pet-visual__lottie--idle-layer" />
            {chasing && <RunCatTailSparks />}
            <div ref={chaseRef} className="pet-visual__lottie pet-visual__lottie--chase-layer" />
            {!chasing && <PetMoodOverlay mood={mood} />}
          </div>
        </div>
      </div>
    </div>
  )
}

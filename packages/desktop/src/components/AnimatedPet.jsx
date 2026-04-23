import { useEffect, useMemo, useRef } from 'react'
import lottie from 'lottie-web'
import { getPetDefinition } from '../pets/registry'

const DEFAULT_PET_MOTION = { running: false, mirrorX: false }

/**
 * 底层 bad-cat / 休息变体；追逐 run-cat。
 * 休息：半速 + 休息 JSON 剔除 Lapa、保留 cup 并水平镜像；叠加层仅爪与白烟轻摆。
 */
export default function AnimatedPet({ mood = 'work', petMotion = DEFAULT_PET_MOTION, selectedPet = 'black-coal' }) {
  const idleRef = useRef(null)
  const chaseRef = useRef(null)
  const idleAnimRef = useRef(null)
  const chaseAnimRef = useRef(null)

  const moodClass = useMemo(() => `pet-visual--${mood}`, [mood])
  const chasing = petMotion.running
  const petDef = useMemo(() => getPetDefinition(selectedPet), [selectedPet])
  const EffectsComponent = petDef.effectsComponent
  const ChaseEffectsComponent = petDef.chaseEffectsComponent

  useEffect(() => {
    const chaseEl = chaseRef.current
    if (!chaseEl) return undefined

    const chaseAnim = lottie.loadAnimation({
      container: chaseEl,
      renderer: 'svg',
      loop: true,
      autoplay: false,
      animationData: petDef.chaseAnimation,
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
  }, [petDef])

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
      chaseAnim.setSpeed(petDef.chaseSpeed || 1)
      chaseAnim.goToAndPlay(0, true)
      return undefined
    }

    chaseAnim.pause()

    const data = petDef.idleByMood[mood] || petDef.idleByMood.work
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

    const applyIdleSpeed = () => idleAnim.setSpeed(petDef.idleSpeedByMood[mood] || 1)
    applyIdleSpeed()
    idleAnim.addEventListener('DOMLoaded', applyIdleSpeed)

    const segments = petDef.idleSegmentsByMood[mood]
    if (Array.isArray(segments) && segments.length === 2) {
      idleAnim.playSegments(segments, true)
    } else {
      idleAnim.play()
    }
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
  }, [mood, chasing, petDef])

  const wrapStyle = useMemo(() => {
    const transforms = []

    if (chasing) {
      const dirScale = petMotion.mirrorX ? -1 : 1
      const facing = petDef.invertChaseFacing ? dirScale * -1 : dirScale
      transforms.push(`scaleX(${facing})`)
    }

    if (!chasing && selectedPet === 'little-turtle' && mood === 'long-work') {
      transforms.push('rotate(30deg)')
    }

    if (transforms.length === 0) return undefined
    return { transform: transforms.join(' ') }
  }, [chasing, petMotion.mirrorX, petDef, selectedPet, mood])

  const chaseFacing = useMemo(() => {
    const dirScale = petMotion.mirrorX ? -1 : 1
    return petDef.invertChaseFacing ? dirScale * -1 : dirScale
  }, [petMotion.mirrorX, petDef])

  return (
    <div className={`pet-visual ${moodClass} ${chasing ? 'pet-visual--chasing' : ''}`} role="img" aria-label="桌面宠物动画">
      <div className="pet-visual__bob">
        <div className="pet-visual__facing-wrap" style={wrapStyle}>
          <div className="pet-visual__stack">
            <div ref={idleRef} className="pet-visual__lottie pet-visual__lottie--idle-layer" />
            {chasing && ChaseEffectsComponent ? <ChaseEffectsComponent facing={chaseFacing} /> : null}
            <div ref={chaseRef} className="pet-visual__lottie pet-visual__lottie--chase-layer" />
            {!chasing && EffectsComponent ? <EffectsComponent mood={mood} /> : null}
          </div>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import lottie from 'lottie-web'
import badCatAnimation from './assets/bad-cat.json'
import turtleAnimation from './assets/Turtle.json'
import './SettingsWindowApp.css'

const PET_OPTIONS = [
  { id: 'black-coal', name: '黑煤球', icon: 'bad-cat', enabled: true },
  { id: 'little-turtle', name: '小乌龟', icon: 'turtle', enabled: true },
  { id: 'coming-soon-2', name: '敬请期待', icon: '🐾', enabled: false },
]

const DEFAULT_BUBBLE_TEXTS = {
  work: '',
  rest: '',
  remind: '',
  'long-work': '',
}

function BlackCoalLottieIcon() {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return undefined
    const anim = lottie.loadAnimation({
      container: ref.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: badCatAnimation,
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
    })
    anim.setSpeed(0.6)
    return () => anim.destroy()
  }, [])
  return <span className="settings-pet-icon settings-pet-icon--lottie" ref={ref} aria-hidden="true" />
}

function TurtleLottieIcon() {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current) return undefined
    const anim = lottie.loadAnimation({
      container: ref.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData: turtleAnimation,
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
    })
    anim.setSpeed(0.7)
    return () => anim.destroy()
  }, [])
  return <span className="settings-pet-icon settings-pet-icon--lottie" ref={ref} aria-hidden="true" />
}

export default function SettingsWindowApp() {
  const [selectedPet, setSelectedPet] = useState('black-coal')
  const [bubbleTexts, setBubbleTexts] = useState(DEFAULT_BUBBLE_TEXTS)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let mounted = true
    window.timeManagerAPI?.getPetSettings?.().then((data) => {
      if (!mounted || !data) return
      setSelectedPet(String(data.selectedPet || 'black-coal'))
      const next = data.bubbleTexts && typeof data.bubbleTexts === 'object' ? data.bubbleTexts : {}
      setBubbleTexts({
        work: String(next.work || ''),
        rest: String(next.rest || ''),
        remind: String(next.remind || ''),
        'long-work': String(next['long-work'] || ''),
      })
    })
    return () => {
      mounted = false
    }
  }, [])

  async function onSave() {
    setBusy(true)
    setMsg('')
    try {
      const result = await window.timeManagerAPI?.updatePetSettings?.({
        selectedPet,
        bubbleTexts,
      })
      if (!result?.ok) {
        setMsg(result?.error || '保存失败')
        return
      }
      setMsg('设置已保存')
    } catch {
      setMsg('保存失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="settings-page">
      <section className="settings-card">
        <h2 className="settings-title">设置宠物类型</h2>
        <p className="settings-sub">上方为休息时图标，下方为宠物名称。当前仅开放黑煤球。</p>
        <div className="settings-pet-grid">
          {PET_OPTIONS.map((pet) => (
            <button
              key={pet.id}
              type="button"
              disabled={!pet.enabled}
              className={`settings-pet-item${selectedPet === pet.id ? ' settings-pet-item--active' : ''}`}
              onClick={() => {
                if (!pet.enabled) return
                setSelectedPet(pet.id)
              }}
            >
              {pet.icon === 'bad-cat' ? (
                <BlackCoalLottieIcon />
              ) : pet.icon === 'turtle' ? (
                <TurtleLottieIcon />
              ) : (
                <span className="settings-pet-icon" aria-hidden="true">{pet.icon}</span>
              )}
              <span className="settings-pet-name">{pet.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <h2 className="settings-title">自定义气泡语句</h2>
        <p className="settings-sub">为空时使用默认文案。保存后会实时应用到宠物气泡。</p>
        <div className="settings-form">
        <label className="settings-field">
            <span>休息中（rest）</span>
            <input
              value={bubbleTexts.rest}
              maxLength={120}
              onChange={(e) => setBubbleTexts((p) => ({ ...p, rest: e.target.value }))}
              placeholder="例如：喝口水，放松一下眼睛"
            />
          </label>
          <label className="settings-field">
            <span>工作中（work）</span>
            <input
              value={bubbleTexts.work}
              maxLength={120}
              onChange={(e) => setBubbleTexts((p) => ({ ...p, work: e.target.value }))}
              placeholder="例如：继续保持专注，今天也很棒"
            />
          </label>
          <label className="settings-field">
            <span>提醒（remind）</span>
            <input
              value={bubbleTexts.remind}
              maxLength={120}
              onChange={(e) => setBubbleTexts((p) => ({ ...p, remind: e.target.value }))}
              placeholder="例如：已经很久啦，记得站起来活动活动"
            />
          </label>
          <label className="settings-field">
            <span>报警（long-work）</span>
            <input
              value={bubbleTexts['long-work']}
              maxLength={120}
              onChange={(e) => setBubbleTexts((p) => ({ ...p, 'long-work': e.target.value }))}
              placeholder="例如：高强度持续过久，请立即休息"
            />
          </label>
        </div>
        <div className="settings-actions">
          <button type="button" className="settings-save" disabled={busy} onClick={onSave}>
            {busy ? '保存中…' : '保存设置'}
          </button>
          {msg ? <span className="settings-msg">{msg}</span> : null}
        </div>
      </section>
    </main>
  )
}

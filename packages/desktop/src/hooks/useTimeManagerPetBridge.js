import { useCallback, useEffect, useRef, useState } from 'react'
import { EMPTY_SNAPSHOT } from '../constants/emptySnapshot'
import { getPetAngryActionImage, isPetAngryAction } from '../constants/petAngryActions'
import { PET_VIEW_VARIANT_SET } from '../constants/petViewVariants'
import { LONG_WORK_CONTINUOUS_MS, REMIND_CONTINUOUS_MS } from '../configKeys'

const DEFAULT_PET_STATE = {
  clickThrough: false,
  showStatsPanel: true,
  compactMode: false,
  followMouse: false,
  petSettings: {
    selectedPet: 'sakura-girl',
    bubbleTexts: {
      work: '',
      rest: '',
      remind: '',
      'long-work': '',
    },
    remindContinuousMs: REMIND_CONTINUOUS_MS,
    longWorkContinuousMs: LONG_WORK_CONTINUOUS_MS,
    hasOpenAiKey: false,
    llmChatUrl: '',
    llmModel: 'gpt-4o-mini',
    llmSkills: [],
    petAiChatBgKind: 'default',
    petAiChatBgPreset: 'mist_blue',
    petAiChatBgImageRel: '',
    petAiChatBgImageUrl: '',
    windowBgImageRel: '',
    windowBgImageUrl: '',
  },
}

const DEFAULT_PET_MOTION = { running: false, mirrorX: false }
const ANGRY_ACTION_MS = 5000
const MOOD_ACTION_MS = 3200

/**
 * 订阅 preload 暴露的 timeManagerAPI：快照、宠物窗口状态、托盘/右键动作测试。
 */
export function useTimeManagerPetBridge() {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT)
  const [petState, setPetState] = useState(DEFAULT_PET_STATE)
  const [transientAction, setTransientAction] = useState('')
  const [transientImageOverride, setTransientImageOverride] = useState(null)
  const [petMotion, setPetMotion] = useState(DEFAULT_PET_MOTION)
  const actionTimerRef = useRef(null)

  const clearActionTimer = useCallback(() => {
    if (actionTimerRef.current) {
      clearTimeout(actionTimerRef.current)
      actionTimerRef.current = null
    }
  }, [])

  const triggerMoodAction = useCallback(
    (action) => {
      clearActionTimer()
      setTransientImageOverride(null)
      setTransientAction(action)
      actionTimerRef.current = setTimeout(() => setTransientAction(''), MOOD_ACTION_MS)
    },
    [clearActionTimer],
  )

  const triggerAngryAction = useCallback(
    (actionId) => {
      const imageUrl = getPetAngryActionImage(actionId)
      if (!imageUrl) return
      clearActionTimer()
      setTransientAction('')
      setTransientImageOverride(imageUrl)
      actionTimerRef.current = setTimeout(() => setTransientImageOverride(null), ANGRY_ACTION_MS)
    },
    [clearActionTimer],
  )

  const isBridgeReady = typeof window !== 'undefined' && Boolean(window.timeManagerAPI)

  useEffect(() => {
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
    const unbindPetAction = window.timeManagerAPI.onPetAction?.((payload) => {
      const action = payload?.action
      if (typeof action !== 'string' || !action) return
      if (isPetAngryAction(action)) {
        triggerAngryAction(action)
      } else if (PET_VIEW_VARIANT_SET.has(action)) {
        triggerMoodAction(action)
      }
    })
    const unbindPetMotion = window.timeManagerAPI.onPetMotion?.((payload) => {
      const running = Boolean(payload?.running)
      const mirrorX = Boolean(payload?.mirrorX)
      setPetMotion({ running, mirrorX })
    })
    const unsubscribe = window.timeManagerAPI.onUpdate((data) => {
      setSnapshot(data)
    })

    return () => {
      if (unsubscribe) unsubscribe()
      if (unbindPetState) unbindPetState()
      if (unbindPetAction) unbindPetAction()
      if (unbindPetMotion) unbindPetMotion()
    }
  }, [triggerAngryAction, triggerMoodAction])

  useEffect(() => () => clearActionTimer(), [clearActionTimer])

  return {
    snapshot,
    petState,
    isBridgeReady,
    transientAction,
    transientImageOverride,
    petMotion,
  }
}

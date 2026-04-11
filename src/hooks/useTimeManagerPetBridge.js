import { useCallback, useEffect, useRef, useState } from 'react'
import { EMPTY_SNAPSHOT } from '../constants/emptySnapshot'

const DEFAULT_PET_STATE = {
  clickThrough: false,
  showStatsPanel: true,
  compactMode: false,
  followMouse: false,
}

const DEFAULT_PET_MOTION = { running: false, mirrorX: false }

/**
 * 订阅 preload 暴露的 timeManagerAPI：快照、宠物窗口状态、托盘动作测试。
 * 1. 使用：`src/App.jsx`
 */
export function useTimeManagerPetBridge() {
  const [snapshot, setSnapshot] = useState(EMPTY_SNAPSHOT)
  const [petState, setPetState] = useState(DEFAULT_PET_STATE)
  const [transientAction, setTransientAction] = useState('')
  const [petMotion, setPetMotion] = useState(DEFAULT_PET_MOTION)
  const actionTimerRef = useRef(null)

  const triggerAction = useCallback((action) => {
    if (actionTimerRef.current) clearTimeout(actionTimerRef.current)
    setTransientAction(action)
    actionTimerRef.current = setTimeout(() => setTransientAction(''), 1200)
  }, [])

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
      if (typeof action === 'string' && action.length > 0) {
        triggerAction(action)
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
  }, [triggerAction])

  useEffect(() => {
    return () => {
      if (actionTimerRef.current) clearTimeout(actionTimerRef.current)
    }
  }, [])

  return { snapshot, petState, isBridgeReady, transientAction, petMotion }
}

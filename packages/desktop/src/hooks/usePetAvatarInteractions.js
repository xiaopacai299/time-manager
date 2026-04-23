import { useCallback, useRef } from 'react'

/**
 * 宠物头像区：右键菜单、主进程拖拽窗口。
 * 1. 使用：`src/components/PetAvatarArea/PetAvatarArea.jsx`
 */
export function usePetAvatarInteractions() {
  const dragRef = useRef({ dragging: false, pointerId: null })

  const openPetMenu = useCallback((event) => {
    event.preventDefault()
    const x = Number.isFinite(event.clientX) ? Math.max(0, Math.round(event.clientX + 8)) : 12
    const y = Number.isFinite(event.clientY) ? Math.max(0, Math.round(event.clientY + 8)) : 12
    window.timeManagerAPI?.openContextMenu?.(x, y)
  }, [])

  const onAvatarPointerDown = useCallback((event) => {
    if (event.button !== 0) return
    dragRef.current = { dragging: true, pointerId: event.pointerId }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch {
      // ignore capture failures
    }
    window.timeManagerAPI?.startDrag?.(event.clientX, event.clientY)
  }, [])

  const onAvatarPointerUp = useCallback((event) => {
    try {
      if (dragRef.current.pointerId !== null) {
        event.currentTarget.releasePointerCapture(dragRef.current.pointerId)
      }
    } catch {
      // ignore capture release failures
    }
    dragRef.current = { dragging: false, pointerId: null }
    window.timeManagerAPI?.endDrag?.()
  }, [])

  return {
    openPetMenu,
    onAvatarPointerDown,
    onAvatarPointerUp,
    onAvatarPointerCancel: onAvatarPointerUp,
  }
}

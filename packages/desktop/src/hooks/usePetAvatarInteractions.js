import { useCallback, useEffect, useRef } from 'react'

/**
 * 宠物头像区：右键菜单、主进程拖拽窗口。
 * 1. 使用：`src/components/PetAvatarArea/PetAvatarArea.jsx`
 */
export function usePetAvatarInteractions() {
  const dragRef = useRef({ dragging: false, pointerId: null })
  const lastDragSourceRef = useRef(null)

  const openPetMenu = useCallback((event) => {
    event.preventDefault()
    const x = Number.isFinite(event.clientX) ? Math.max(0, Math.round(event.clientX + 8)) : 12
    const y = Number.isFinite(event.clientY) ? Math.max(0, Math.round(event.clientY + 8)) : 12
    window.timeManagerAPI?.openContextMenu?.(x, y)
  }, [])

  const beginDrag = useCallback((event, source) => {
    if (event.button !== 0) return
    if (dragRef.current.dragging) return
    dragRef.current = { dragging: true, pointerId: event.pointerId }
    lastDragSourceRef.current = source
    try {
      if (source === 'pointer' && Number.isInteger(event.pointerId)) {
        event.currentTarget.setPointerCapture(event.pointerId)
      }
    } catch {
      // ignore capture failures
    }
    window.timeManagerAPI?.startDrag?.(event.clientX, event.clientY)
  }, [])

  const endDrag = useCallback((event, source) => {
    if (!dragRef.current.dragging) return
    // Avoid duplicate mouseup following pointerup on some platforms.
    if (source === 'mouse' && lastDragSourceRef.current === 'pointer') return
    try {
      if (source === 'pointer' && dragRef.current.pointerId !== null) {
        event.currentTarget.releasePointerCapture(dragRef.current.pointerId)
      }
    } catch {
      // ignore capture release failures
    }
    dragRef.current = { dragging: false, pointerId: null }
    lastDragSourceRef.current = null
    window.timeManagerAPI?.endDrag?.()
  }, [])

  const onAvatarPointerDown = useCallback((event) => {
    beginDrag(event, 'pointer')
  }, [beginDrag])

  const onAvatarPointerUp = useCallback((event) => {
    endDrag(event, 'pointer')
  }, [endDrag])

  const onAvatarMouseDown = useCallback((event) => {
    beginDrag(event, 'mouse')
  }, [beginDrag])

  const onAvatarMouseUp = useCallback((event) => {
    endDrag(event, 'mouse')
  }, [endDrag])

  useEffect(() => {
    const forceEndDrag = () => {
      if (!dragRef.current.dragging) return
      dragRef.current = { dragging: false, pointerId: null }
      lastDragSourceRef.current = null
      window.timeManagerAPI?.endDrag?.()
    }
    const onVisibilityChange = () => {
      if (document.hidden) forceEndDrag()
    }

    window.addEventListener('mouseup', forceEndDrag)
    window.addEventListener('blur', forceEndDrag)
    window.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      forceEndDrag()
      window.removeEventListener('mouseup', forceEndDrag)
      window.removeEventListener('blur', forceEndDrag)
      window.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  return {
    openPetMenu,
    onAvatarPointerDown,
    onAvatarPointerUp,
    onAvatarPointerCancel: onAvatarPointerUp,
    onAvatarMouseDown,
    onAvatarMouseUp,
  }
}

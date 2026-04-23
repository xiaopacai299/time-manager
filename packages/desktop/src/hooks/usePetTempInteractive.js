import { useEffect, useRef } from 'react'

/**
 * 穿透模式下按住 Alt 时临时关闭穿透，便于拖动/点选宠物。
 * 1. 使用：`src/App.jsx`
 */
export function usePetTempInteractive(clickThrough) {
  const tempInteractiveRef = useRef(false)

  useEffect(() => {
    if (!window.timeManagerAPI) return undefined

    const syncTempInteractive = (active) => {
      if (tempInteractiveRef.current === active) return
      tempInteractiveRef.current = active
      window.timeManagerAPI.setTempInteractive?.(active)
    }

    const onMouseMove = (event) => {
      const shouldEnableTempInteractive = clickThrough && event.altKey
      syncTempInteractive(shouldEnableTempInteractive)
    }

    const onKeyUp = (event) => {
      if (event.key === 'Alt') {
        syncTempInteractive(false)
      }
    }

    const onBlur = () => syncTempInteractive(false)

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)

    return () => {
      syncTempInteractive(false)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [clickThrough])
}

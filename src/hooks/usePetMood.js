import { useMemo } from 'react'
import {
  BREAK_COMPLETED_CELEBRATION_MS,
  LONG_WORK_CONTINUOUS_MS,
} from '../configKeys'

/**
 * 根据快照与托盘触发的短时动作，推导宠物表情 mood。
 * 1. 使用：`src/App.jsx`、`PetAvatarArea`
 */
export function usePetMood(snapshot, transientAction) {
  return useMemo(() => {
    const continuousMs = snapshot.continuousUseMs || 0
    const breakMs = snapshot.breakCompletedMs || 0
    return (
      transientAction ||
      (breakMs >= BREAK_COMPLETED_CELEBRATION_MS
        ? 'happy'
        : continuousMs >= LONG_WORK_CONTINUOUS_MS
          ? 'warn'
          : snapshot.current?.isOnBreak
            ? 'sleep'
            : 'idle')
    )
  }, [snapshot, transientAction])
}

import { useMemo } from 'react'
import {
  BREAK_COMPLETED_CELEBRATION_MS,
  LONG_WORK_CONTINUOUS_MS,
  REMIND_CONTINUOUS_MS,
} from '../configKeys'
import { PET_VIEW_VARIANT_SET } from '../constants/petViewVariants'

/**
 * 根据快照与托盘「动作测试」推导宠物 mood，与 `PetBubble` 四态优先级一致。
 * 1. 使用：`src/App.jsx`、`PetAvatarArea`
 */
export function usePetMood(snapshot, transientAction) {
  return useMemo(() => {
    if (typeof transientAction === 'string' && PET_VIEW_VARIANT_SET.has(transientAction)) {
      return transientAction
    }

    const continuousMs = snapshot.continuousUseMs || 0
    const breakMs = snapshot.breakCompletedMs || 0

    if (snapshot.current?.isOnBreak) return 'rest'
    if (continuousMs >= LONG_WORK_CONTINUOUS_MS) return 'long-work'
    if (continuousMs >= REMIND_CONTINUOUS_MS) return 'remind'
    if (breakMs >= BREAK_COMPLETED_CELEBRATION_MS) return 'rest'
    return 'work'
  }, [snapshot, transientAction])
}

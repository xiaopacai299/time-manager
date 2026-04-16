import { useMemo } from 'react'
import './PetBubble.css'
import {
  BREAK_COMPLETED_CELEBRATION_MS,
  LONG_WORK_CONTINUOUS_MS,
  REMIND_CONTINUOUS_MS,
} from '../../configKeys'
import { PET_VIEW_VARIANT_SET } from '../../constants/petViewVariants'
import { formatDuration } from '../../utils/formatDuration'

/**
 * 宠物气泡：根据主进程快照计算文案与主题 variant，并渲染 Q 版花边气泡。
 *
 * @param {object} props
 * @param {{
 *   continuousUseMs?: number,
 *   breakCompletedMs?: number,
 *   current?: { processName?: string, isOnBreak?: boolean }
 * }} props.snapshot
 */
export default function PetBubble({ snapshot, petSettings }) {
  const { text, variant } = useMemo(() => {
    const continuousMs = snapshot.continuousUseMs || 0
    const breakMs = snapshot.breakCompletedMs || 0
    const currentApp = snapshot.current?.processName || 'Unknown'
    const remindContinuousMs = petSettings?.remindContinuousMs ?? REMIND_CONTINUOUS_MS
    const longWorkContinuousMs = petSettings?.longWorkContinuousMs ?? LONG_WORK_CONTINUOUS_MS
    let baseText = `当前专注：${currentApp}`

    if (breakMs >= BREAK_COMPLETED_CELEBRATION_MS) {
      baseText = '休息完成！做得很好，继续保持。'
    } else if (continuousMs >= longWorkContinuousMs) {
      baseText = `你已连续使用 ${formatDuration(continuousMs)}，建议活动一下。`
    } else if (snapshot.current?.isOnBreak) {
      baseText = '检测到你在休息，我会安静陪着你。'
    }

    let v = 'work'
    if (snapshot.current?.isOnBreak) v = 'rest'
    else if (continuousMs >= longWorkContinuousMs) v = 'long-work'
    else if (continuousMs >= remindContinuousMs) v = 'remind'
    else if (breakMs >= BREAK_COMPLETED_CELEBRATION_MS) v = 'rest'

    const customText = String(petSettings?.bubbleTexts?.[v] || '').trim()
    return { text: customText || baseText, variant: v }
  }, [snapshot, petSettings])

  const safeVariant = PET_VIEW_VARIANT_SET.has(variant) ? variant : 'work'

  return (
    <section
      className={`pet-bubble pet-bubble--${safeVariant}`}
      role="status"
      aria-live="polite"
    >
      <span className="pet-bubble__vine" aria-hidden="true" />
      <div className="pet-bubble__inner">{text}</div>
      <span className="pet-bubble__tail" aria-hidden="true" />
    </section>
  )
}

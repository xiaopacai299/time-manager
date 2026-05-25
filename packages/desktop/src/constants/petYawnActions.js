import { PET_YAWN_ACTION_ID } from '../../main/electron/pet-yawn-actions.js'
import yawn01 from '../assets/pets/empress-girl/yawn/yawn-01.png?url'
import yawn02 from '../assets/pets/empress-girl/yawn/yawn-02.png?url'
import yawn03 from '../assets/pets/empress-girl/yawn/yawn-03.png?url'
import yawn04 from '../assets/pets/empress-girl/yawn/yawn-04.png?url'
import yawn05 from '../assets/pets/empress-girl/yawn/yawn-05.png?url'
import yawn06 from '../assets/pets/empress-girl/yawn/yawn-06.png?url'
import yawn07 from '../assets/pets/empress-girl/yawn/yawn-07.png?url'

/** 打哈欠序列（按时间轴 0s → 3s，共 7 帧） */
export const PET_YAWN_FRAMES = [
  yawn01,
  yawn02,
  yawn03,
  yawn04,
  yawn05,
  yawn06,
  yawn07,
]

/** 整段动画总时长（ms） */
export const PET_YAWN_TOTAL_MS = 3000

/** 帧间淡入淡出时长（ms），用过渡弥补帧数较少 */
export const PET_YAWN_CROSSFADE_MS = 140

/** @deprecated 仅作参考；实际由 TOTAL + CROSSFADE 调度 */
export const PET_YAWN_FRAME_MS = 430

const preloadCache = new Set()

export function preloadPetImageUrls(urls) {
  const pending = urls.filter((url) => url && !preloadCache.has(url))
  if (!pending.length) return Promise.resolve()
  return Promise.all(
    pending.map(
      (url) =>
        new Promise((resolve, reject) => {
          const img = new Image()
          img.decoding = 'async'
          img.onload = () => {
            preloadCache.add(url)
            resolve(url)
          }
          img.onerror = reject
          img.src = url
        }),
    ),
  )
}

export function isPetYawnAction(actionId) {
  return actionId === PET_YAWN_ACTION_ID
}

export function getPetYawnFrames(actionId) {
  if (!isPetYawnAction(actionId)) return []
  return PET_YAWN_FRAMES
}

import angryFrame1 from '../assets/pets/angry/frame-1.png?url'
import angryFrame2 from '../assets/pets/angry/frame-2.png?url'
import angryFrame3 from '../assets/pets/angry/frame-3.png?url'
import angryFrame4 from '../assets/pets/angry/frame-4.png?url'
import angryFrame5 from '../assets/pets/angry/frame-5.png?url'
import { PET_ANGRY_ACTION_MENU } from '../../main/electron/pet-angry-actions.js'

/** 生气动作：id、菜单文案、替换用图片 */
export const PET_ANGRY_ACTIONS = PET_ANGRY_ACTION_MENU.map((item) => ({
  ...item,
  imageUrl:
    {
      'angry-huimou': angryFrame1,
      'angry-duqi': angryFrame2,
      'angry-bingjian': angryFrame3,
      'angry-ceyan': angryFrame4,
      'angry-baobi': angryFrame5,
    }[item.id] || '',
}))

const ANGRY_IMAGE_BY_ID = Object.fromEntries(
  PET_ANGRY_ACTIONS.map((item) => [item.id, item.imageUrl]),
)

export function isPetAngryAction(actionId) {
  return typeof actionId === 'string' && Boolean(ANGRY_IMAGE_BY_ID[actionId])
}

export function getPetAngryActionImage(actionId) {
  return ANGRY_IMAGE_BY_ID[actionId] || null
}

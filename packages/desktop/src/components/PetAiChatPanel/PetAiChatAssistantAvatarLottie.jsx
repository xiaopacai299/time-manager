import { memo, useEffect, useMemo, useRef } from 'react'
import lottie from 'lottie-web'
import badCatAnimation from '../../assets/bad-cat.json'
import { DEFAULT_PET_ID, getPetDefinition } from '../../pets/registry'

/**
 * AI 对话里助手侧头像：与当前所选宠物一致（樱酱、黑煤球、小乌龟等），缩小适配气泡行。
 */
function PetAiChatAssistantAvatarLottie({ selectedPet = DEFAULT_PET_ID }) {
  const petDef = useMemo(() => getPetDefinition(selectedPet), [selectedPet])
  const animationData = useMemo(() => {
    if (petDef.renderMode === 'image') return null
    return petDef.previewAnimation || badCatAnimation
  }, [petDef])

  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !animationData) return undefined
    const anim = lottie.loadAnimation({
      container: ref.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData,
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
    })
    anim.setSpeed(selectedPet === 'little-turtle' ? 0.9 : 0.75)
    return () => anim.destroy()
  }, [animationData, selectedPet])

  if (petDef.renderMode === 'image' && petDef.previewImage) {
    return (
      <img
        src={petDef.previewImage}
        className="pet-ai-panel__avatar-lottie pet-ai-panel__avatar-lottie--image"
        alt=""
        aria-hidden="true"
      />
    )
  }

  return <span className="pet-ai-panel__avatar-lottie" ref={ref} aria-hidden="true" />
}

export default memo(PetAiChatAssistantAvatarLottie)

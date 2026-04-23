import { memo, useEffect, useMemo, useRef } from 'react'
import lottie from 'lottie-web'
import badCatAnimation from '../../assets/bad-cat.json'
import { getPetDefinition } from '../../pets/registry'

/**
 * AI 对话里助手侧头像：与当前所选宠物一致（黑煤球 bad-cat、小乌龟 turtle 等），缩小适配气泡行。
 */
function PetAiChatAssistantAvatarLottie({ selectedPet = 'black-coal' }) {
  const animationData = useMemo(() => {
    const data = getPetDefinition(selectedPet)?.previewAnimation
    return data || badCatAnimation
  }, [selectedPet])

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

  return <span className="pet-ai-panel__avatar-lottie" ref={ref} aria-hidden="true" />
}

export default memo(PetAiChatAssistantAvatarLottie)

import AnimatedPet from '../AnimatedPet.jsx'
import PetRenderErrorBoundary from '../PetRenderErrorBoundary.jsx'
import { usePetAvatarInteractions } from '../../hooks/usePetAvatarInteractions'

/**
 * 可拖拽宠物头像（样式沿用 `App.css` 的 `.pet-avatar`）。
 * 左键双击：开关独立「AI 对话」子窗口；使用统计改由宠物右键菜单打开。
 */
export default function PetAvatarArea({ mood, petMotion, selectedPet }) {
  const {
    openPetMenu,
    onAvatarPointerDown,
    onAvatarPointerUp,
    onAvatarPointerCancel,
  } = usePetAvatarInteractions()

  function onAvatarDoubleClick(event) {
    event.preventDefault()
    event.stopPropagation()
    void window.timeManagerAPI?.togglePetAiChatWindow?.()
  }

  return (
    <div className="pet-avatar-row">
      <section
        className={`pet-avatar mood-${mood}`}
        onContextMenu={openPetMenu}
        onPointerDown={onAvatarPointerDown}
        onPointerUp={onAvatarPointerUp}
        onPointerCancel={onAvatarPointerCancel}
        onDoubleClick={onAvatarDoubleClick}
      >
        <PetRenderErrorBoundary>
          <AnimatedPet mood={mood} petMotion={petMotion} selectedPet={selectedPet} />
        </PetRenderErrorBoundary>
      </section>
    </div>
  )
}

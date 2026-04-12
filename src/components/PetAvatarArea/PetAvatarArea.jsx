import AnimatedPet from '../AnimatedPet.jsx'
import PetRenderErrorBoundary from '../PetRenderErrorBoundary.jsx'
import { usePetAvatarInteractions } from '../../hooks/usePetAvatarInteractions'

/**
 * 可拖拽宠物头像（样式沿用 `App.css` 的 `.pet-avatar`）。
 */
export default function PetAvatarArea({ mood, petMotion }) {
  const {
    openPetMenu,
    onAvatarPointerDown,
    onAvatarPointerUp,
    onAvatarPointerCancel,
  } = usePetAvatarInteractions()

  function onAvatarDoubleClick(event) {
    event.preventDefault()
    event.stopPropagation()
    window.timeManagerAPI?.openStatsWindow?.()
  }

  return (
    <section
      className={`pet-avatar mood-${mood}`}
      onContextMenu={openPetMenu}
      onPointerDown={onAvatarPointerDown}
      onPointerUp={onAvatarPointerUp}
      onPointerCancel={onAvatarPointerCancel}
      onDoubleClick={onAvatarDoubleClick}
    >
      <PetRenderErrorBoundary>
        <AnimatedPet mood={mood} petMotion={petMotion} />
      </PetRenderErrorBoundary>
    </section>
  )
}

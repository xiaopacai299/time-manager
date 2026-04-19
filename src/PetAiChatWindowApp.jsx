import PetAiChatPanel from './components/PetAiChatPanel'
import { useTimeManagerPetBridge } from './hooks/useTimeManagerPetBridge'
import './PetAiChatWindowApp.css'

/**
 * 独立 AI 对话窗口（路由 `#pet-ai-chat`），与主窗口共用 preload 与宠物设置订阅。
 */
export default function PetAiChatWindowApp() {
  const { petState, isBridgeReady } = useTimeManagerPetBridge()

  return (
    <div className="pet-ai-chat-window-root">
      {!isBridgeReady ? (
        <div className="pet-ai-chat-window-fallback">请通过 electron-start 启动以使用 AI 对话。</div>
      ) : (
        <PetAiChatPanel
          layout="window"
          hasOpenAiKey={Boolean(petState?.petSettings?.hasOpenAiKey)}
          llmSkills={petState?.petSettings?.llmSkills}
          selectedPet={petState?.petSettings?.selectedPet || 'black-coal'}
        />
      )}
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import PetAiChatPanel from './components/PetAiChatPanel'
import PetAiSkillsEditorPage from './components/PetAiChatPanel/PetAiSkillsEditorPage.jsx'
import { useTimeManagerPetBridge } from './hooks/useTimeManagerPetBridge'
import './PetAiChatWindowApp.css'

function usePetAiWindowHashRoute() {
  const [hash, setHash] = useState(
    () => (typeof window !== 'undefined' ? window.location.hash || '#pet-ai-chat' : '#pet-ai-chat'),
  )
  useEffect(() => {
    const onHash = () => setHash(window.location.hash || '#pet-ai-chat')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  return hash === '#pet-ai-chat/skills' ? 'skills' : 'chat'
}

/**
 * 独立 AI 对话窗口（`#pet-ai-chat` / `#pet-ai-chat/skills`），与主窗口共用 preload 与宠物设置订阅。
 */
export default function PetAiChatWindowApp() {
  const { petState, isBridgeReady } = useTimeManagerPetBridge()
  const route = usePetAiWindowHashRoute()
  const chatPanelRef = useRef(null)

  const goChat = () => {
    if (typeof window !== 'undefined') window.location.hash = '#pet-ai-chat'
  }
  const goSkills = () => {
    if (typeof window !== 'undefined') window.location.hash = '#pet-ai-chat/skills'
  }

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.title = route === 'skills' ? 'AI 技能' : 'AI 对话'
  }, [route])

  // 监听窗口关闭事件，保存对话历史
  useEffect(() => {
    const handleBeforeUnload = () => {
      // 尝试保存当前对话历史
      if (chatPanelRef.current?.saveHistory) {
        chatPanelRef.current.saveHistory()
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [])

  const ps = petState?.petSettings || {}
  const bgKind = ps.petAiChatBgKind === 'preset' || ps.petAiChatBgKind === 'image' ? ps.petAiChatBgKind : 'default'
  const bgPreset = String(ps.petAiChatBgPreset || 'mist_blue').trim() || 'mist_blue'
  const bgImageUrl = String(ps.petAiChatBgImageUrl || '').trim()

  const rootClass = [
    'pet-ai-chat-window-root',
    bgKind === 'default' ? 'pet-ai-chat-window-root--bg-default' : '',
    bgKind === 'preset' ? `pet-ai-chat-window-root--bg-preset-${bgPreset}` : '',
    bgKind === 'image' ? 'pet-ai-chat-window-root--bg-image' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const rootStyle =
    bgKind === 'image' && bgImageUrl
      ? {
          backgroundImage: `url(${JSON.stringify(bgImageUrl)})`,
          backgroundRepeat: 'repeat',
          backgroundPosition: '0 0',
          backgroundSize: 'auto',
        }
      : undefined

  return (
    <div className={rootClass} style={rootStyle}>
      {!isBridgeReady ? (
        <div className="pet-ai-chat-window-fallback">请通过 electron-start 启动以使用 AI 对话。</div>
      ) : (
        <>
          {/* 保持挂载：切到技能页时用 display:none，避免对话 state 丢失 */}
          <div
            className={`pet-ai-chat-window-chat${route === 'chat' ? ' pet-ai-chat-window-chat--visible' : ''}`}
            aria-hidden={route !== 'chat'}
          >
            <PetAiChatPanel
              ref={chatPanelRef}
              layout="window"
              hasOpenAiKey={Boolean(petState?.petSettings?.hasOpenAiKey)}
              llmSkills={petState?.petSettings?.llmSkills}
              selectedPet={petState?.petSettings?.selectedPet || 'black-coal'}
              onOpenSkillsEditor={goSkills}
            />
          </div>
          {route === 'skills' ? (
            <div className="pet-ai-chat-window-skills">
              <PetAiSkillsEditorPage onBack={goChat} initialLlmSkills={petState?.petSettings?.llmSkills} />
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

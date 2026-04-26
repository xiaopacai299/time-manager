import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import StatsWindowApp from './StatsWindowApp.jsx'
import FavoritesWindowApp from './FavoritesWindowApp.jsx'
import WorkListWindowApp from './WorkListWindowApp.jsx'
import WorklistEstimateConfirmApp from './WorklistEstimateConfirmApp.jsx'
import SettingsWindowApp from './SettingsWindowApp.jsx'
import LoginWindowApp from './LoginWindowApp.jsx'
import ReaderWindowApp from './ReaderWindowApp.jsx'
import PetAiChatWindowApp from './PetAiChatWindowApp.jsx'
import DiaryWindowApp from './DiaryWindowApp.jsx'
import WorklistExportApp from './WorklistExportApp.jsx'
import { SyncProvider } from './sync/SyncProvider.jsx'

const root = document.getElementById('root')
const isStatsWindow = typeof window !== 'undefined' && window.location.hash === '#stats'
const isFavoritesWindow = typeof window !== 'undefined' && window.location.hash === '#favorites'
const isWorklistWindow = typeof window !== 'undefined' && window.location.hash === '#worklist'
const isWorklistExportWindow = typeof window !== 'undefined' && window.location.hash === '#worklist-export'
const isEstimateConfirmWindow =
  typeof window !== 'undefined' && window.location.hash === '#worklist-estimate-confirm'
const isSettingsWindow = typeof window !== 'undefined' && window.location.hash === '#settings'
const isLoginWindow = typeof window !== 'undefined' && window.location.hash === '#login'
const isReaderWindow = typeof window !== 'undefined' && window.location.hash === '#reader'
const petAiHash = typeof window !== 'undefined' ? window.location.hash : ''
const isPetAiChatWindow =
  petAiHash === '#pet-ai-chat' || petAiHash === '#pet-ai-chat/skills'
const isDiaryWindow = typeof window !== 'undefined' && window.location.hash === '#diary'

if (typeof document !== 'undefined') {
  if (isStatsWindow) {
    document.title = '使用统计'
  } else if (isFavoritesWindow) {
    document.title = '收藏夹'
  } else if (isWorklistWindow) {
    document.title = '工作清单'
  } else if (isWorklistExportWindow) {
    document.title = '导出日志'
  } else if (isEstimateConfirmWindow) {
    document.title = '工作确认'
  } else if (isSettingsWindow) {
    document.title = '设置'
  } else if (isLoginWindow) {
    document.title = '登录'
  } else if (isReaderWindow) {
    document.title = '摸鱼阅读'
  } else if (isPetAiChatWindow) {
    document.title = petAiHash === '#pet-ai-chat/skills' ? 'AI 技能' : 'AI 对话'
  } else if (isDiaryWindow) {
    document.title = '写日记'
  } else {
    document.title = '桌面宠物'
  }
}

createRoot(root).render(
  <StrictMode>
    <SyncProvider>
      {isStatsWindow ? (
        <StatsWindowApp />
      ) : isFavoritesWindow ? (
        <FavoritesWindowApp />
      ) : isWorklistExportWindow ? (
        <WorklistExportApp />
      ) : isWorklistWindow ? (
        <WorkListWindowApp />
      ) : isEstimateConfirmWindow ? (
        <WorklistEstimateConfirmApp />
      ) : isSettingsWindow ? (
        <SettingsWindowApp />
      ) : isLoginWindow ? (
        <LoginWindowApp />
      ) : isReaderWindow ? (
        <ReaderWindowApp />
      ) : isPetAiChatWindow ? (
        <PetAiChatWindowApp />
      ) : isDiaryWindow ? (
        <DiaryWindowApp />
      ) : (
        <App />
      )}
    </SyncProvider>
  </StrictMode>,
)

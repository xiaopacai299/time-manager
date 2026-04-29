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
import StickyLinksWindowApp from './StickyLinksWindowApp.jsx'
import { SyncProvider } from './sync/SyncProvider.jsx'

function resolveDefaultWindowBgByTime() {
  const hour = new Date().getHours()
  const isDaytime = hour >= 7 && hour <= 18
  return isDaytime ? '/window-bg.png' : '/window-night-bg.png'
}

function applyWindowBackgroundCssVar(imageUrl) {
  if (typeof document === 'undefined') return
  const rootEl = document.documentElement
  const nextUrl = String(imageUrl || '').trim()
  if (nextUrl) {
    rootEl.style.setProperty('--tm-window-bg-image', `url("${nextUrl}")`)
  } else {
    rootEl.style.setProperty('--tm-window-bg-image', `url("${resolveDefaultWindowBgByTime()}")`)
  }
}

if (typeof window !== 'undefined' && window.timeManagerAPI) {
  let latestCustomWindowBgUrl = ''
  const applyCurrent = () => applyWindowBackgroundCssVar(latestCustomWindowBgUrl)

  window.timeManagerAPI.getPetSettings?.().then((settings) => {
    latestCustomWindowBgUrl = String(settings?.windowBgImageUrl || '').trim()
    applyCurrent()
  })
  window.timeManagerAPI.onPetStateChanged?.((state) => {
    latestCustomWindowBgUrl = String(state?.petSettings?.windowBgImageUrl || '').trim()
    applyCurrent()
  })
  // 即使窗口长期不重启，也能在 07:00 / 18:00 跨时段后自动切换默认背景。
  window.setInterval(() => {
    if (latestCustomWindowBgUrl) return
    applyCurrent()
  }, 60 * 1000)
}

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
const isStickyLinksWindow = typeof window !== 'undefined' && window.location.hash === '#sticky-links'

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
  } else if (isStickyLinksWindow) {
    document.title = '便签'
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
      ) : isStickyLinksWindow ? (
        <StickyLinksWindowApp />
      ) : (
        <App />
      )}
    </SyncProvider>
  </StrictMode>,
)

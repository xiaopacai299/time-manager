import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import StatsWindowApp from './StatsWindowApp.jsx'
import FavoritesWindowApp from './FavoritesWindowApp.jsx'
import WorkListWindowApp from './WorkListWindowApp.jsx'
import WorklistEstimateConfirmApp from './WorklistEstimateConfirmApp.jsx'

const root = document.getElementById('root')
const isStatsWindow = typeof window !== 'undefined' && window.location.hash === '#stats'
const isFavoritesWindow = typeof window !== 'undefined' && window.location.hash === '#favorites'
const isWorklistWindow = typeof window !== 'undefined' && window.location.hash === '#worklist'
const isEstimateConfirmWindow =
  typeof window !== 'undefined' && window.location.hash === '#worklist-estimate-confirm'

if (typeof document !== 'undefined') {
  if (isStatsWindow) {
    document.title = '使用统计'
  } else if (isFavoritesWindow) {
    document.title = '收藏夹'
  } else if (isWorklistWindow) {
    document.title = '工作清单'
  } else if (isEstimateConfirmWindow) {
    document.title = '工作确认'
  } else {
    document.title = '桌面宠物'
  }
}

createRoot(root).render(
  <StrictMode>
    {isStatsWindow ? (
      <StatsWindowApp />
    ) : isFavoritesWindow ? (
      <FavoritesWindowApp />
    ) : isWorklistWindow ? (
      <WorkListWindowApp />
    ) : isEstimateConfirmWindow ? (
      <WorklistEstimateConfirmApp />
    ) : (
      <App />
    )}
  </StrictMode>,
)

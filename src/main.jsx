import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import StatsWindowApp from './StatsWindowApp.jsx'
import FavoritesWindowApp from './FavoritesWindowApp.jsx'
import WorkListWindowApp from './WorkListWindowApp.jsx'

const root = document.getElementById('root')
const isStatsWindow = typeof window !== 'undefined' && window.location.hash === '#stats'
const isFavoritesWindow = typeof window !== 'undefined' && window.location.hash === '#favorites'
const isWorklistWindow = typeof window !== 'undefined' && window.location.hash === '#worklist'

createRoot(root).render(
  <StrictMode>
    {isStatsWindow ? (
      <StatsWindowApp />
    ) : isFavoritesWindow ? (
      <FavoritesWindowApp />
    ) : isWorklistWindow ? (
      <WorkListWindowApp />
    ) : (
      <App />
    )}
  </StrictMode>,
)

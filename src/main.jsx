import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import StatsWindowApp from './StatsWindowApp.jsx'

const root = document.getElementById('root')
const isStatsWindow = typeof window !== 'undefined' && window.location.hash === '#stats'

createRoot(root).render(
  <StrictMode>{isStatsWindow ? <StatsWindowApp /> : <App />}</StrictMode>,
)

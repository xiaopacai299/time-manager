import { useState, useEffect } from 'react'
import './WorklistExportApp.css'

export default function WorklistExportApp() {
  const [logContent, setLogContent] = useState('')
  const [copySuccess, setCopySuccess] = useState(false)

  useEffect(() => {
    loadWorklistItems()
    
    return () => {
      setLogContent('')
    }
  }, [])

  const loadWorklistItems = async () => {
    try {
      const items = await window.timeManagerAPI?.getWorklist?.() || []
      const today = new Date().toISOString().split('T')[0]
      
      const todayItems = items.filter(item => {
        const itemDate = item.createdAt?.split('T')[0]
        return itemDate === today
      })

      if (todayItems.length === 0) {
        setLogContent('今日暂无工作清单记录')
        return
      }

      const formattedContent = todayItems.map(item => {
        const reminderTime = item.reminderAt ? item.reminderAt.split('T')[0] : ''
        const name = item.name || ''
        const note = item.note || ''
        return `${reminderTime} ${name} ${note}`.trim()
      }).join('\n')

      setLogContent(formattedContent)
    } catch (error) {
      console.error('Failed to load worklist items:', error)
      setLogContent('加载工作清单失败')
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(logContent)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleBack = () => {
    window.location.hash = '#worklist'
  }

  return (
    <main className="worklist-export-page">
      {/* <div className="worklist-export-header">
        <button className="worklist-export-back-btn" onClick={handleBack}>
          ← 返回
        </button>
        <h1 className="worklist-export-title">导出日志</h1>
      </div> */}
      <div className="worklist-export-content">
        <textarea
          className="worklist-export-textarea"
          value={logContent}
          onChange={(e) => setLogContent(e.target.value)}
          placeholder="加载中..."
        />
        <button 
          className={`worklist-export-copy-btn ${copySuccess ? 'success' : ''}`}
          onClick={handleCopy}
        >
          {copySuccess ? '已复制 ✓' : '复制内容'}
        </button>
      </div>
    </main>
  )
}
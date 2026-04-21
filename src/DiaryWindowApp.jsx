import { useState, useEffect } from 'react'
import './DiaryWindowApp.css'

export default function DiaryWindowApp() {
  const [diaries, setDiaries] = useState([])
  const [currentDiary, setCurrentDiary] = useState('')
  const [selectedDiary, setSelectedDiary] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editingDiaryId, setEditingDiaryId] = useState(null)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    loadDiaries()
  }, [])

  const loadDiaries = async () => {
    try {
      const diariesList = await window.timeManagerAPI?.getDiaries?.() || []
      setDiaries(Array.isArray(diariesList) ? diariesList : [])
    } catch (error) {
      console.error('Failed to load diaries:', error)
    }
  }

  const saveDiary = async () => {
    if (!currentDiary.trim()) return

    try {
      const newDiary = {
        id: Date.now().toString(),
        date: today,
        content: currentDiary,
        createdAt: new Date().toISOString()
      }
      
      const updatedDiaries = await window.timeManagerAPI?.addDiary?.(newDiary) || []
      setDiaries(updatedDiaries)
      setCurrentDiary('')
    } catch (error) {
      console.error('Failed to save diary:', error)
    }
  }

  const deleteDiary = async (id) => {
    try {
      const updatedDiaries = await window.timeManagerAPI?.deleteDiary?.(id) || []
      setDiaries(updatedDiaries)
      if (selectedDiary?.id === id) {
        setSelectedDiary(null)
      }
    } catch (error) {
      console.error('Failed to delete diary:', error)
    }
  }

  const editDiary = (diary) => {
    setCurrentDiary(diary.content)
    setIsEditing(true)
    setEditingDiaryId(diary.id)
    setSelectedDiary(null)
  }

  const updateDiary = async () => {
    if (!editingDiaryId || !currentDiary.trim()) return

    try {
      const updatedDiary = {
        id: editingDiaryId,
        date: today,
        content: currentDiary,
        createdAt: new Date().toISOString()
      }
      
      const updatedDiaries = await window.timeManagerAPI?.updateDiary?.(updatedDiary) || []
      setDiaries(updatedDiaries)
      setCurrentDiary('')
      setEditingDiaryId(null)
      setIsEditing(false)
    } catch (error) {
      console.error('Failed to update diary:', error)
    }
  }

  const startNewDiary = () => {
    setCurrentDiary('')
    setIsEditing(false)
    setEditingDiaryId(null)
    setSelectedDiary(null)
  }

  const getDiaryPreview = (content) => {
    return content.substring(0, 10) + (content.length > 10 ? '...' : '')
  }

  return (
    <main className="diary-page">
      <div className="diary-container">
        {/* 左侧：写日记区域 */}
        <div className="diary-left">
          <div className="diary-date">{today}</div>
          <div className="diary-actions">
            {isEditing && (
              <button
                className="diary-new-btn"
                onClick={startNewDiary}
              >
                新增日记
              </button>
            )}
          </div>
          <textarea
            className="diary-textarea"
            value={currentDiary}
            onChange={(e) => setCurrentDiary(e.target.value)}
            placeholder="写下今天的心情..."
          />
          <button
            className="diary-save-btn"
            onClick={isEditing ? updateDiary : saveDiary}
          >
            {isEditing ? '更新日记' : '保存日记'}
          </button>
        </div>

        {/* 右侧：日记列表 */}
        <div className="diary-right">
          <div className="diary-list-title">日记列表</div>
          <div className="diary-list">
            {diaries.length === 0 ? (
              <div className="diary-empty">暂无日记，开始写第一篇吧</div>
            ) : (
              diaries.map((diary) => (
                <div key={diary.id} className="diary-item">
                  <div className="diary-item-content">
                    <div className="diary-item-date">{diary.date}</div>
                    <div className="diary-item-preview">{getDiaryPreview(diary.content)}</div>
                  </div>
                  <div className="diary-item-actions">
                    <button
                      className="diary-action-btn diary-action-detail"
                      onClick={() => setSelectedDiary(diary)}
                    >
                      详情
                    </button>
                    <button
                      className="diary-action-btn diary-action-edit"
                      onClick={() => editDiary(diary)}
                    >
                      编辑
                    </button>
                    <button
                      className="diary-action-btn diary-action-delete"
                      onClick={() => deleteDiary(diary.id)}
                    >
                      删除
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 详情面板 */}
        {selectedDiary && (
          <div className="diary-detail">
            <div className="diary-detail-title">日记详情</div>
            <div className="diary-detail-date">{selectedDiary.date}</div>
            <div className="diary-detail-content">{selectedDiary.content}</div>
            <button
              className="diary-detail-close"
              onClick={() => setSelectedDiary(null)}
            >
              关闭
            </button>
          </div>
        )}
      </div>
    </main>
  )
}
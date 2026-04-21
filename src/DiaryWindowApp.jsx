import { useState, useEffect } from 'react'
import './DiaryWindowApp.css'

export default function DiaryWindowApp() {
  const [diaries, setDiaries] = useState([])
  const [currentDiary, setCurrentDiary] = useState('')
  const [selectedDiary, setSelectedDiary] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [editingDiaryId, setEditingDiaryId] = useState(null)
  const [showPasswordSettings, setShowPasswordSettings] = useState(false)
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(true)

  const today = new Date().toISOString().split('T')[0]

  useEffect(() => {
    checkPasswordStatus()
  }, [])

  const checkPasswordStatus = async () => {
    try {
      const hasPassword = await window.timeManagerAPI?.hasDiaryPassword?.() || false
      if (hasPassword) {
        setShowPasswordPrompt(true)
        setIsAuthenticated(false)
      } else {
        setIsAuthenticated(true)
        loadDiaries()
      }
    } catch (error) {
      console.error('Failed to check password status:', error)
      setIsAuthenticated(true)
      loadDiaries()
    }
  }

  const verifyPassword = async (password) => {
    try {
      const isValid = await window.timeManagerAPI?.verifyDiaryPassword?.(password) || false
      if (isValid) {
        setIsAuthenticated(true)
        setShowPasswordPrompt(false)
        loadDiaries()
      }
      return isValid
    } catch (error) {
      console.error('Failed to verify password:', error)
      return false
    }
  }

  const setPassword = async (password, confirmPassword) => {
    if (password !== confirmPassword) {
      return { success: false, message: '两次输入的密码不一致' }
    }
    
    try {
      const result = await window.timeManagerAPI?.setDiaryPassword?.(password) || { success: false }
      return result
    } catch (error) {
      console.error('Failed to set password:', error)
      return { success: false, message: '设置密码失败' }
    }
  }

  const removePassword = async () => {
    try {
      const result = await window.timeManagerAPI?.removeDiaryPassword?.() || { success: false }
      return result
    } catch (error) {
      console.error('Failed to remove password:', error)
      return { success: false, message: '移除密码失败' }
    }
  }

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

  const PasswordPrompt = ({ onVerify }) => {
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')

    const handleSubmit = async (e) => {
      e.preventDefault()
      if (!password.trim()) {
        setError('请输入密码')
        return
      }
      
      const isValid = await onVerify(password)
      if (!isValid) {
        setError('密码错误')
      }
    }

    return (
      <div className="diary-password-prompt">
        <div className="diary-password-card">
          <h2 className="diary-password-title">请输入密码</h2>
          <form onSubmit={handleSubmit} className="diary-password-form">
            <div className="diary-password-input-group">
              <label htmlFor="password">密码</label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setError('')
                }}
                placeholder="请输入日记密码"
                autoFocus
              />
            </div>
            {error && <div className="diary-password-error">{error}</div>}
            <div className="diary-password-actions">
              <button type="submit" className="diary-password-btn">
                验证
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  const PasswordSettings = ({ onSave, onCancel, onRemove }) => {
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [error, setError] = useState('')
    const [message, setMessage] = useState('')

    const handleSubmit = async (e) => {
      e.preventDefault()
      setError('')
      setMessage('')

      const result = await onSave(password, confirmPassword)
      if (result.success) {
        setMessage('密码设置成功')
        setPassword('')
        setConfirmPassword('')
        // 成功后返回写日记页面
        setTimeout(() => {
          onCancel()
        }, 1000)
      } else {
        setError(result.message || '设置密码失败')
      }
    }

    const handleRemove = async () => {
      if (window.confirm('确定要移除密码保护吗？')) {
        const result = await onRemove()
        if (result.success) {
          setMessage('密码已移除')
          setPassword('')
          setConfirmPassword('')
          // 成功后返回写日记页面
          setTimeout(() => {
            onCancel()
          }, 1000)
        } else {
          setError(result.message || '移除密码失败')
        }
      }
    }

    return (
      <div className="diary-password-settings">
        <div className="diary-password-card">
          <h2 className="diary-password-title">设置密码</h2>
          <form onSubmit={handleSubmit} className="diary-password-form">
            <div className="diary-password-input-group">
              <label htmlFor="new-password">新密码</label>
              <input
                type="password"
                id="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入新密码"
              />
            </div>
            <div className="diary-password-input-group">
              <label htmlFor="confirm-password">确认密码</label>
              <input
                type="password"
                id="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="请再次输入密码"
              />
            </div>
            {error && <div className="diary-password-error">{error}</div>}
            {message && <div className="diary-password-message">{message}</div>}
            <div className="diary-password-actions">
              <button type="button" className="diary-password-btn diary-password-btn-secondary" onClick={onCancel}>
                取消
              </button>
              <button type="submit" className="diary-password-btn">
                保存
              </button>
            </div>
          </form>
          <div className="diary-password-remove">
            <button type="button" className="diary-password-btn-remove" onClick={handleRemove}>
              移除密码保护
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="diary-page">
      {showPasswordPrompt ? (
        <PasswordPrompt onVerify={verifyPassword} />
      ) : showPasswordSettings ? (
        <PasswordSettings 
          onSave={setPassword} 
          onCancel={() => setShowPasswordSettings(false)}
          onRemove={removePassword}
        />
      ) : isAuthenticated ? (
        <>
          <div className="diary-header">
            <button 
              className="diary-settings-btn"
              onClick={() => setShowPasswordSettings(true)}
            >
              设置密码
            </button>
          </div>
          <div className="diary-container">
            <div className="diary-left">
              <div className="diary-list-title">写日记</div>
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
              <div className="diary-date">{today}</div>
              <button
                className="diary-save-btn"
                onClick={isEditing ? updateDiary : saveDiary}
              >
                {isEditing ? '更新日记' : '保存日记'}
              </button>
            </div>
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
          </div>
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
        </>
      ) : null}
    </main>
  )
}
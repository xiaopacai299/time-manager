import { useCallback, useState } from 'react'
import './WorkListWindowApp.css'

const PRESET_ICONS = ['📋', '📝', '💼', '⏰', '✅', '🎯', '📌', '☕']

const MAX_IMAGE_BYTES = 350 * 1024

export default function WorkListWindowApp() {
  const [iconEmoji, setIconEmoji] = useState('📋')
  const [iconCustomDataUrl, setIconCustomDataUrl] = useState('')
  const [name, setName] = useState('')
  const [reminderAt, setReminderAt] = useState('')
  const [estimateDoneAt, setEstimateDoneAt] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  const onPickImage = useCallback((event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !file.type.startsWith('image/')) {
      setMessage({ type: 'err', text: '请选择图片文件。' })
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setMessage({ type: 'err', text: '图片过大，请选择约 350KB 以内的图片，或使用上方表情图标。' })
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      if (!result.startsWith('data:image/')) {
        setMessage({ type: 'err', text: '无法读取该图片。' })
        return
      }
      setIconCustomDataUrl(result)
      setMessage({ type: '', text: '' })
    }
    reader.onerror = () => {
      setMessage({ type: 'err', text: '读取图片失败。' })
    }
    reader.readAsDataURL(file)
  }, [])

  const clearCustomIcon = useCallback(() => {
    setIconCustomDataUrl('')
  }, [])

  async function onSubmit(event) {
    event.preventDefault()
    setMessage({ type: '', text: '' })
    const trimmedName = name.trim()
    if (!trimmedName) {
      setMessage({ type: 'err', text: '请填写工作清单名称。' })
      return
    }
    const icon = (iconCustomDataUrl || iconEmoji).trim() || '📋'
    setBusy(true)
    try {
      const result = await window.timeManagerAPI?.addWorklistItem?.({
        icon,
        name: trimmedName,
        reminderAt: reminderAt.trim(),
        estimateDoneAt: estimateDoneAt.trim(),
        note: note.trim(),
      })
      if (!result?.ok) {
        setMessage({ type: 'err', text: result?.error || '保存失败。' })
        return
      }
      setMessage({ type: 'ok', text: '已保存。提醒时间到达后会尝试弹出系统通知（需在系统设置中允许本应用通知）。' })
      setName('')
      setReminderAt('')
      setEstimateDoneAt('')
      setNote('')
      setIconEmoji('📋')
      setIconCustomDataUrl('')
    } catch {
      setMessage({ type: 'err', text: '保存失败，请稍后重试。' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="worklist-page">
      <div className="worklist-wrap">
        <h1 className="worklist-title">添加工作清单</h1>
        <p className="worklist-sub">填写后保存到本机；到「提醒时间」会尝试通过系统通知提醒你。</p>

        <form className="worklist-form" onSubmit={onSubmit}>
          <div className="worklist-field">
            <label>
              图标
            </label>
            <div className="worklist-icon-row">
              {PRESET_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`worklist-icon-btn${iconEmoji === emoji && !iconCustomDataUrl ? ' worklist-icon-btn--active' : ''}`}
                  title={emoji}
                  onClick={() => {
                    setIconEmoji(emoji)
                    setIconCustomDataUrl('')
                  }}
                >
                  {emoji}
                </button>
              ))}
              {iconCustomDataUrl ? (
                <>
                  <img className="worklist-icon-preview" src={iconCustomDataUrl} alt="" />
                  <button type="button" className="worklist-btn-secondary" onClick={clearCustomIcon}>
                    清除自定义图
                  </button>
                </>
              ) : null}
              <label className="worklist-file">
                <input type="file" accept="image/*" onChange={onPickImage} hidden />
                <span style={{ cursor: 'pointer', textDecoration: 'underline' }}>上传自定义图标…</span>
              </label>
            </div>
          </div>

          <div className="worklist-field">
            <label htmlFor="wl-name">
              工作清单名称 <span className="req">*</span>
            </label>
            <input
              id="wl-name"
              className="worklist-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：写完周报"
              maxLength={200}
              autoComplete="off"
            />
          </div>

          <div className="worklist-field">
            <label htmlFor="wl-remind">提醒时间</label>
            <input
              id="wl-remind"
              className="worklist-input"
              type="datetime-local"
              value={reminderAt}
              onChange={(e) => setReminderAt(e.target.value)}
            />
          </div>

          <div className="worklist-field">
            <label htmlFor="wl-est">估计完成时间</label>
            <input
              id="wl-est"
              className="worklist-input"
              type="datetime-local"
              value={estimateDoneAt}
              onChange={(e) => setEstimateDoneAt(e.target.value)}
            />
          </div>

          <div className="worklist-field">
            <label htmlFor="wl-note">备注（写给自己的提醒）</label>
            <textarea
              id="wl-note"
              className="worklist-textarea"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：别忘带电源、先做第 3 节…"
              maxLength={2000}
            />
          </div>

          <div className="worklist-actions">
            <button type="submit" className="worklist-submit" disabled={busy}>
              {busy ? '保存中…' : '保存工作清单'}
            </button>
          </div>
        </form>

        {message.text ? (
          <p className={`worklist-msg ${message.type === 'ok' ? 'worklist-msg--ok' : 'worklist-msg--err'}`}>{message.text}</p>
        ) : (
          <p className="worklist-msg" />
        )}
      </div>
    </main>
  )
}

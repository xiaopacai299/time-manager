import { useCallback, useEffect, useMemo, useState } from 'react'
import './WorkListWindowApp.css'

const PRESET_ICONS = ['📋', '📝', '💼', '⏰', '✅', '🎯', '📌', '☕']

const MAX_IMAGE_BYTES = 350 * 1024

export default function WorkListWindowApp() {
  const [items, setItems] = useState([])
  const [editingId, setEditingId] = useState('')
  const [iconEmoji, setIconEmoji] = useState('📋')
  const [iconCustomDataUrl, setIconCustomDataUrl] = useState('')
  const [name, setName] = useState('')
  const [reminderAt, setReminderAt] = useState('')
  const [estimateDoneAt, setEstimateDoneAt] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState({ type: '', text: '' })

  useEffect(() => {
    if (!message.text) return undefined
    const timer = setTimeout(() => {
      setMessage({ type: '', text: '' })
    }, 2400)
    return () => clearTimeout(timer)
  }, [message.text])

  useEffect(() => {
    let mounted = true
    window.timeManagerAPI?.getWorklist?.().then((list) => {
      if (!mounted) return
      setItems(Array.isArray(list) ? list : [])
    })
    const off = window.timeManagerAPI?.onWorklistUpdated?.((list) => {
      setItems(Array.isArray(list) ? list : [])
    })
    return () => {
      mounted = false
      if (off) off()
    }
  }, [])

  const listTitle = useMemo(() => `工作清单 (${items.length})`, [items.length])

  const isEditing = Boolean(editingId)
  const [nowTick, setNowTick] = useState(Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000)
    return () => clearInterval(timer)
  }, [])

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
      const payload = {
        icon,
        name: trimmedName,
        reminderAt: reminderAt.trim(),
        estimateDoneAt: estimateDoneAt.trim(),
        note: note.trim(),
      }
      const result = isEditing
        ? await window.timeManagerAPI?.updateWorklistItem?.({ id: editingId, ...payload })
        : await window.timeManagerAPI?.addWorklistItem?.(payload)
      if (!result?.ok) {
        setMessage({ type: 'err', text: result?.error || '保存失败。' })
        return
      }
      setItems(Array.isArray(result?.list) ? result.list : [])
      setMessage({ type: 'ok', text: isEditing ? '更新成功' : '保存成功' })
      setName('')
      setReminderAt('')
      setEstimateDoneAt('')
      setNote('')
      setIconEmoji('📋')
      setIconCustomDataUrl('')
      setEditingId('')
    } catch {
      setMessage({ type: 'err', text: '保存失败，请稍后重试。' })
    } finally {
      setBusy(false)
    }
  }

  async function onRemoveById(id) {
    const targetId = String(id || '').trim()
    if (!targetId || busy) return
    const ok = window.confirm('确认删除当前工作清单吗？此操作不可撤销。')
    if (!ok) return
    setBusy(true)
    setMessage({ type: '', text: '' })
    try {
      const result = await window.timeManagerAPI?.removeWorklistItem?.({ id: targetId })
      if (!result?.ok) {
        setMessage({ type: 'err', text: result?.error || '删除失败。' })
        return
      }
      setItems(Array.isArray(result?.list) ? result.list : [])
      if (editingId === targetId) {
        resetForm()
      }
      setMessage({ type: 'ok', text: '删除成功。' })
    } catch {
      setMessage({ type: 'err', text: '删除失败，请稍后重试。' })
    } finally {
      setBusy(false)
    }
  }

  function formatDatetime(value) {
    if (!value) return '未设置'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return '时间格式无效'
    return date.toLocaleString()
  }

  function getStatusMeta(item) {
    const completion = String(item?.completionResult || '').trim()
    if (completion === 'completed') {
      return { text: '已完成', cls: 'done' }
    }
    if (completion === 'incomplete') {
      return { text: '未完成', cls: 'undone' }
    }
    const now = nowTick
    const reminderTs = Date.parse(String(item?.reminderAt || ''))
    const estimateTs = Date.parse(String(item?.estimateDoneAt || ''))
    const hasReminder = Number.isFinite(reminderTs)
    const hasEstimate = Number.isFinite(estimateTs)
    if (hasReminder && hasEstimate && now >= reminderTs && now < estimateTs) {
      return { text: '完成中', cls: 'doing' }
    }
    if (!hasReminder && hasEstimate && now < estimateTs) {
      return { text: '待完成', cls: 'pending' }
    }
    if (hasEstimate && now >= estimateTs) {
      return { text: '完成中', cls: 'doing' }
    }
    if (hasReminder && now < reminderTs) {
      return { text: '待完成', cls: 'pending' }
    }
    return { text: '待完成', cls: 'pending' }
  }

  function toInputDatetime(value) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const pad = (num) => String(num).padStart(2, '0')
    const y = date.getFullYear()
    const m = pad(date.getMonth() + 1)
    const d = pad(date.getDate())
    const h = pad(date.getHours())
    const mm = pad(date.getMinutes())
    return `${y}-${m}-${d}T${h}:${mm}`
  }

  function fillFormByItem(item) {
    if (!item) return
    const icon = String(item.icon || '').trim() || '📋'
    if (icon.startsWith('data:image/')) {
      setIconCustomDataUrl(icon)
      setIconEmoji('📋')
    } else {
      setIconEmoji(icon)
      setIconCustomDataUrl('')
    }
    setName(String(item.name || ''))
    setReminderAt(toInputDatetime(item.reminderAt))
    setEstimateDoneAt(toInputDatetime(item.estimateDoneAt))
    setNote(String(item.note || ''))
    setEditingId(String(item.id || ''))
    setMessage({ type: '', text: '' })
  }

  function resetForm() {
    setEditingId('')
    setIconEmoji('📋')
    setIconCustomDataUrl('')
    setName('')
    setReminderAt('')
    setEstimateDoneAt('')
    setNote('')
    setMessage({ type: '', text: '' })
  }

  return (
    <main className="worklist-page">
      {message.text ? (
        <div className={`worklist-toast ${message.type === 'ok' ? 'worklist-toast--ok' : 'worklist-toast--err'}`}>
          {message.text}
        </div>
      ) : null}
      <div className="worklist-wrap">
        <section className="worklist-pane worklist-pane--list">
          <h1 className="worklist-title">{listTitle}</h1>
          <p className="worklist-sub">左侧展示已保存的清单，右侧可继续新增。</p>
          <div className="worklist-list">
            {items.length === 0 ? (
              <div className="worklist-empty">暂无清单，去右侧添加第一项吧。</div>
            ) : (
              items.map((item) => {
                const icon = String(item.icon || '').trim() || '📋'
                const status = getStatusMeta(item)
                return (
                  <article
                    key={item.id}
                    className={`worklist-item${editingId === item.id ? ' worklist-item--active' : ''}`}
                    onClick={() => fillFormByItem(item)}
                  >
                    <div className="worklist-item-head">
                      <div className="worklist-item-head-main">
                        {icon.startsWith('data:image/') ? (
                          <img className="worklist-item-icon-image" src={icon} alt="" />
                        ) : (
                          <span className="worklist-item-icon-emoji">{icon}</span>
                        )}
                        <h2 className="worklist-item-name">{item.name}</h2>
                      </div>
                      <div className="worklist-item-head-side">
                        <span className={`worklist-item-status worklist-item-status--${status.cls}`}>{status.text}</span>
                      <button
                        type="button"
                        className="worklist-item-delete"
                        disabled={busy}
                        onClick={(event) => {
                          event.stopPropagation()
                          onRemoveById(item.id)
                        }}
                      >
                        <span className="worklist-item-delete__icon" aria-hidden="true">🗑</span>
                        <span>删除</span>
                      </button>
                      </div>
                    </div>
                    <p className="worklist-item-line"><strong>提醒时间：</strong>{formatDatetime(item.reminderAt)}</p>
                    <p className="worklist-item-line"><strong>估计完成时间：</strong>{formatDatetime(item.estimateDoneAt)}</p>
                    <p className="worklist-item-line"><strong>备注：</strong>{item.note || '无'}</p>
                  </article>
                )
              })
            )}
          </div>
        </section>

        <section className="worklist-pane worklist-pane--form">
          <h2 className="worklist-title">{isEditing ? '编辑工作清单' : '添加工作清单'}</h2>
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
                {busy ? '保存中…' : isEditing ? '保存修改' : '保存工作清单'}
              </button>
              {isEditing ? (
                <>
                  <button type="button" className="worklist-btn-secondary" onClick={resetForm} disabled={busy}>
                    取消编辑
                  </button>
                </>
              ) : null}
            </div>
          </form>

        </section>
      </div>
    </main>
  )
}

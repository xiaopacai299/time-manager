import { useCallback, useEffect, useMemo, useState } from 'react'
import './WorkListWindowApp.css'

const PRESET_ICONS = ['📋', '📝', '💼', '⏰', '✅', '🎯', '📌', '☕']
const TAB_TODAY = 'today'
const TAB_MEMO = 'memo'
const TAB_YEAR = 'year'
const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六']
const MONTH_LABELS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

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
  const [activeTab, setActiveTab] = useState(TAB_TODAY)
  const [memoItems, setMemoItems] = useState([])
  const [memoEditingId, setMemoEditingId] = useState('')
  const [memoIconEmoji, setMemoIconEmoji] = useState('📝')
  const [memoIconCustomDataUrl, setMemoIconCustomDataUrl] = useState('')
  const [memoName, setMemoName] = useState('')
  const [memoReminderAt, setMemoReminderAt] = useState('')
  const [memoContent, setMemoContent] = useState('')
  const [memoBusy, setMemoBusy] = useState(false)
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState(currentYear)

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

  useEffect(() => {
    let mounted = true
    window.timeManagerAPI?.getMemoList?.().then((list) => {
      if (!mounted) return
      setMemoItems(Array.isArray(list) ? list : [])
    })
    const off = window.timeManagerAPI?.onMemoListUpdated?.((list) => {
      setMemoItems(Array.isArray(list) ? list : [])
    })
    return () => {
      mounted = false
      if (off) off()
    }
  }, [])

  const listTitle = useMemo(() => `工作清单 (${items.length})`, [items.length])
  const memoListTitle = useMemo(() => `备忘录 (${memoItems.length})`, [memoItems.length])
  const sortedItems = useMemo(() => {
    const parseCreatedTs = (item) => {
      const createdTs = Date.parse(String(item?.createdAt || ''))
      if (Number.isFinite(createdTs)) return createdTs
      const idPrefix = String(item?.id || '').split('-')[0]
      const idTs = Number(idPrefix)
      return Number.isFinite(idTs) ? idTs : 0
    }
    return [...items].sort((a, b) => parseCreatedTs(b) - parseCreatedTs(a))
  }, [items])

  const sortedMemos = useMemo(() => {
    const parseCreatedTs = (item) => {
      const createdTs = Date.parse(String(item?.createdAt || ''))
      if (Number.isFinite(createdTs)) return createdTs
      const idPrefix = String(item?.id || '').split('-')[0]
      const idTs = Number(idPrefix)
      return Number.isFinite(idTs) ? idTs : 0
    }
    return [...memoItems].sort((a, b) => parseCreatedTs(b) - parseCreatedTs(a))
  }, [memoItems])

  const isEditing = Boolean(editingId)
  const isMemoEditing = Boolean(memoEditingId)
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

  const memoOnPickImage = useCallback((event) => {
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
      setMemoIconCustomDataUrl(result)
      setMessage({ type: '', text: '' })
    }
    reader.onerror = () => {
      setMessage({ type: 'err', text: '读取图片失败。' })
    }
    reader.readAsDataURL(file)
  }, [])

  const clearMemoCustomIcon = useCallback(() => {
    setMemoIconCustomDataUrl('')
  }, [])

  const onTimeInputClick = useCallback((event) => {
    const input = event.currentTarget
    if (typeof input?.showPicker === 'function') {
      try {
        input.showPicker()
      } catch {
        // 浏览器不允许时保持默认行为，不影响手动输入。
      }
    }
  }, [])

  function composeTodayDatetime(timeText) {
    const value = String(timeText || '').trim()
    if (!value) return ''
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value)
    if (!match) return ''
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}T${match[1]}:${match[2]}`
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
        reminderAt: composeTodayDatetime(reminderAt),
        estimateDoneAt: composeTodayDatetime(estimateDoneAt),
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

  function toInputTime(value) {
    if (!value) return ''
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return ''
    const pad = (num) => String(num).padStart(2, '0')
    const h = pad(date.getHours())
    const mm = pad(date.getMinutes())
    return `${h}:${mm}`
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
    setReminderAt(toInputTime(item.reminderAt))
    setEstimateDoneAt(toInputTime(item.estimateDoneAt))
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

  function getMemoReminderMeta(item) {
    if (!String(item?.reminderAt || '').trim()) {
      return { text: '未设提醒', cls: 'pending' }
    }
    if (item.reminderNotified) {
      return { text: '已提醒', cls: 'done' }
    }
    const t = Date.parse(String(item.reminderAt || ''))
    if (Number.isFinite(t) && nowTick >= t) {
      return { text: '待提醒', cls: 'doing' }
    }
    return { text: '待提醒', cls: 'pending' }
  }

  function fillMemoFormByItem(item) {
    if (!item) return
    const icon = String(item.icon || '').trim() || '📝'
    if (icon.startsWith('data:image/')) {
      setMemoIconCustomDataUrl(icon)
      setMemoIconEmoji('📝')
    } else {
      setMemoIconEmoji(icon)
      setMemoIconCustomDataUrl('')
    }
    setMemoName(String(item.name || ''))
    setMemoReminderAt(toInputDatetime(item.reminderAt))
    setMemoContent(String(item.content || ''))
    setMemoEditingId(String(item.id || ''))
    setMessage({ type: '', text: '' })
  }

  function resetMemoForm() {
    setMemoEditingId('')
    setMemoIconEmoji('📝')
    setMemoIconCustomDataUrl('')
    setMemoName('')
    setMemoReminderAt('')
    setMemoContent('')
    setMessage({ type: '', text: '' })
  }

  async function onMemoSubmit(event) {
    event.preventDefault()
    setMessage({ type: '', text: '' })
    const trimmedName = memoName.trim()
    if (!trimmedName) {
      setMessage({ type: 'err', text: '请填写备忘录名称。' })
      return
    }
    const trimmed = memoContent.trim()
    if (!trimmed) {
      setMessage({ type: 'err', text: '请填写备忘录内容。' })
      return
    }
    const icon = (memoIconCustomDataUrl || memoIconEmoji).trim() || '📝'
    const reminderIso = memoReminderAt.trim()
    setMemoBusy(true)
    try {
      const payload = {
        icon,
        name: trimmedName,
        reminderAt: reminderIso,
        content: trimmed,
      }
      const result = isMemoEditing
        ? await window.timeManagerAPI?.updateMemoItem?.({ id: memoEditingId, ...payload })
        : await window.timeManagerAPI?.addMemoItem?.(payload)
      if (!result?.ok) {
        setMessage({ type: 'err', text: result?.error || '保存失败。' })
        return
      }
      setMemoItems(Array.isArray(result?.list) ? result.list : [])
      setMessage({ type: 'ok', text: isMemoEditing ? '备忘录已更新' : '备忘录已保存' })
      resetMemoForm()
    } catch {
      setMessage({ type: 'err', text: '保存失败，请稍后重试。' })
    } finally {
      setMemoBusy(false)
    }
  }

  async function onRemoveMemoById(id) {
    const targetId = String(id || '').trim()
    if (!targetId || memoBusy) return
    const ok = window.confirm('确认删除这条备忘录吗？此操作不可撤销。')
    if (!ok) return
    setMemoBusy(true)
    setMessage({ type: '', text: '' })
    try {
      const result = await window.timeManagerAPI?.removeMemoItem?.({ id: targetId })
      if (!result?.ok) {
        setMessage({ type: 'err', text: result?.error || '删除失败。' })
        return
      }
      setMemoItems(Array.isArray(result?.list) ? result.list : [])
      if (memoEditingId === targetId) {
        resetMemoForm()
      }
      setMessage({ type: 'ok', text: '已删除。' })
    } catch {
      setMessage({ type: 'err', text: '删除失败，请稍后重试。' })
    } finally {
      setMemoBusy(false)
    }
  }

  const yearOptions = useMemo(
    () => Array.from({ length: 5 }, (_, i) => currentYear - i),
    [currentYear],
  )

  const yearHeatmap = useMemo(() => {
    const year = selectedYear
    const yearStart = new Date(year, 0, 1)
    const yearEnd = new Date(year, 11, 31)
    const start = new Date(yearStart)
    start.setDate(start.getDate() - start.getDay())

    const dayCountMap = new Map()
    for (const item of items) {
      const rawTime = item?.reminderAt || item?.estimateDoneAt
      const date = new Date(rawTime || '')
      if (Number.isNaN(date.getTime())) continue
      if (date.getFullYear() !== year) continue
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
      dayCountMap.set(key, (dayCountMap.get(key) || 0) + 1)
    }

    const cells = []
    const monthMarkers = []
    let cur = new Date(start)
    while (cur <= yearEnd) {
      const weekIndex = Math.floor((cur.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000))
      const day = cur.getDay()
      const dateKey = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`
      const count = dayCountMap.get(dateKey) || 0
      const inCurrentYear = cur >= yearStart && cur <= yearEnd
      const level = !inCurrentYear
        ? -1
        : count === 0
          ? 1
          : count <= 2
            ? 2
            : count <= 5
              ? 3
              : 4
      cells.push({
        key: `${weekIndex}-${day}`,
        weekIndex,
        day,
        dateKey,
        count,
        level,
        inCurrentYear,
      })

      if (cur.getDate() === 1 && cur >= yearStart && cur <= yearEnd) {
        monthMarkers.push({
          month: cur.getMonth(),
          weekIndex,
        })
      }
      cur.setDate(cur.getDate() + 1)
    }

    return {
      year,
      cells,
      monthMarkers,
      weekColumns: Math.floor((yearEnd.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1,
      totalPlans: Array.from(dayCountMap.values()).reduce((sum, n) => sum + n, 0),
      activeDays: dayCountMap.size,
    }
  }, [items, selectedYear])

  return (
    <main className="worklist-page">
      {message.text ? (
        <div className={`worklist-toast ${message.type === 'ok' ? 'worklist-toast--ok' : 'worklist-toast--err'}`}>
          {message.text}
        </div>
      ) : null}
      <div className="worklist-tabs">
        <span
          className={`worklist-tab-indicator${
            activeTab === TAB_YEAR
              ? ' worklist-tab-indicator--year'
              : activeTab === TAB_MEMO
                ? ' worklist-tab-indicator--memo'
                : ' worklist-tab-indicator--today'
          }`}
          aria-hidden="true"
        />
        <button
          type="button"
          className={`worklist-tab-btn${activeTab === TAB_TODAY ? ' worklist-tab-btn--active' : ''}`}
          onClick={() => setActiveTab(TAB_TODAY)}
        >
          今日计划
        </button>
        <button
          type="button"
          className={`worklist-tab-btn${activeTab === TAB_MEMO ? ' worklist-tab-btn--active' : ''}`}
          onClick={() => setActiveTab(TAB_MEMO)}
        >
          备忘录
        </button>
        <button
          type="button"
          className={`worklist-tab-btn${activeTab === TAB_YEAR ? ' worklist-tab-btn--active' : ''}`}
          onClick={() => setActiveTab(TAB_YEAR)}
        >
          今年工作总鉴
        </button>
      </div>

      {activeTab === TAB_TODAY ? (
        <div className="worklist-wrap worklist-content worklist-content--today">
          <section className="worklist-pane worklist-pane--list">
            <h1 className="worklist-title">{listTitle}</h1>
            <p className="worklist-sub">左侧展示已保存的清单，右侧可继续新增。</p>
            <div className="worklist-list">
              {sortedItems.length === 0 ? (
                <div className="worklist-empty">暂无清单，去右侧添加第一项吧。</div>
              ) : (
                sortedItems.map((item) => {
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
                  type="time"
                  step="60"
                  value={reminderAt}
                  onClick={onTimeInputClick}
                  onChange={(e) => setReminderAt(e.target.value)}
                />
              </div>

              <div className="worklist-field">
                <label htmlFor="wl-est">估计完成时间</label>
                <input
                  id="wl-est"
                  className="worklist-input"
                  type="time"
                  step="60"
                  value={estimateDoneAt}
                  onClick={onTimeInputClick}
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
      ) : activeTab === TAB_MEMO ? (
        <div className="worklist-wrap worklist-content worklist-content--memo">
          <section className="worklist-pane worklist-pane--list">
            <h1 className="worklist-title">{memoListTitle}</h1>
            <p className="worklist-sub">左侧为已保存的备忘录，右侧填写名称、图标、提醒时间与正文；到点会发送系统通知。</p>
            <div className="worklist-list">
              {sortedMemos.length === 0 ? (
                <div className="worklist-empty">暂无备忘录，在右侧添加第一条吧。</div>
              ) : (
                sortedMemos.map((item) => {
                  const reminderMeta = getMemoReminderMeta(item)
                  const mIcon = String(item.icon || '').trim() || '📝'
                  return (
                    <article
                      key={item.id}
                      className={`worklist-item${memoEditingId === item.id ? ' worklist-item--active' : ''}`}
                      onClick={() => fillMemoFormByItem(item)}
                    >
                      <div className="worklist-item-head">
                        <div className="worklist-item-head-main">
                          {mIcon.startsWith('data:image/') ? (
                            <img className="worklist-item-icon-image" src={mIcon} alt="" />
                          ) : (
                            <span className="worklist-item-icon-emoji" aria-hidden="true">{mIcon}</span>
                          )}
                          <h2 className="worklist-item-name">{item.name || '备忘录'}</h2>
                        </div>
                        <div className="worklist-item-head-side">
                          <span className={`worklist-item-status worklist-item-status--${reminderMeta.cls}`}>
                            {reminderMeta.text}
                          </span>
                          <button
                            type="button"
                            className="worklist-item-delete"
                            disabled={memoBusy}
                            onClick={(event) => {
                              event.stopPropagation()
                              onRemoveMemoById(item.id)
                            }}
                          >
                            <span className="worklist-item-delete__icon" aria-hidden="true">🗑</span>
                            <span>删除</span>
                          </button>
                        </div>
                      </div>
                      <p className="worklist-item-line">
                        <strong>提醒时间：</strong>
                        {item.reminderAt ? formatDatetime(item.reminderAt) : '未设置（仅保存正文，不会提醒）'}
                      </p>
                      <p className="worklist-item-line worklist-item-line--memo-preview">
                        <strong>内容：</strong>
                        {String(item.content || '').trim() || '无'}
                      </p>
                    </article>
                  )
                })
              )}
            </div>
          </section>

          <section className="worklist-pane worklist-pane--form">
            <h2 className="worklist-title">{isMemoEditing ? '编辑备忘录' : '添加备忘录'}</h2>
            <p className="worklist-sub">提醒时间固定为今天，仅选择时、分；到点推送系统通知（需系统允许通知权限）。</p>

            <form className="worklist-form" onSubmit={onMemoSubmit}>
              <div className="worklist-field">
                <label>图标</label>
                <div className="worklist-icon-row">
                  {PRESET_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className={`worklist-icon-btn${memoIconEmoji === emoji && !memoIconCustomDataUrl ? ' worklist-icon-btn--active' : ''}`}
                      title={emoji}
                      onClick={() => {
                        setMemoIconEmoji(emoji)
                        setMemoIconCustomDataUrl('')
                      }}
                    >
                      {emoji}
                    </button>
                  ))}
                  {memoIconCustomDataUrl ? (
                    <>
                      <img className="worklist-icon-preview" src={memoIconCustomDataUrl} alt="" />
                      <button type="button" className="worklist-btn-secondary" onClick={clearMemoCustomIcon}>
                        清除自定义图
                      </button>
                    </>
                  ) : null}
                  <label className="worklist-file">
                    <input type="file" accept="image/*" onChange={memoOnPickImage} hidden />
                    <span style={{ cursor: 'pointer', textDecoration: 'underline' }}>上传自定义图标…</span>
                  </label>
                </div>
              </div>

              <div className="worklist-field">
                <label htmlFor="memo-name">
                  备忘录名称 <span className="req">*</span>
                </label>
                <input
                  id="memo-name"
                  className="worklist-input"
                  value={memoName}
                  onChange={(e) => setMemoName(e.target.value)}
                  placeholder="例如：下午开会材料"
                  maxLength={200}
                  autoComplete="off"
                />
              </div>

              <div className="worklist-field">
                <label htmlFor="memo-remind">提醒时间</label>
                <input
                  id="memo-remind"
                  className="worklist-input"
                  type="datetime-local"
                  step="60"
                  value={memoReminderAt}
                  onClick={onTimeInputClick}
                  onChange={(e) => setMemoReminderAt(e.target.value)}
                />
              </div>

              <div className="worklist-field">
                <label htmlFor="memo-content">
                  内容 <span className="req">*</span>
                </label>
                <textarea
                  id="memo-content"
                  className="worklist-textarea worklist-textarea--memo-body"
                  value={memoContent}
                  onChange={(e) => setMemoContent(e.target.value)}
                  placeholder="写在这里…"
                  maxLength={50000}
                  spellCheck="false"
                />
              </div>

              <div className="worklist-actions">
                <button type="submit" className="worklist-submit" disabled={memoBusy}>
                  {memoBusy ? '保存中…' : isMemoEditing ? '保存修改' : '保存备忘录'}
                </button>
                {isMemoEditing ? (
                  <button type="button" className="worklist-btn-secondary" onClick={resetMemoForm} disabled={memoBusy}>
                    取消编辑
                  </button>
                ) : null}
              </div>
            </form>
          </section>
        </div>
      ) : (
        <div className="worklist-wrap worklist-wrap--year worklist-content worklist-content--year">
          <section className="worklist-pane worklist-pane--year">
            <h2 className="worklist-title">年度工作总鉴</h2>
            <p className="worklist-sub">
              {yearHeatmap.year} 年共记录 <strong>{yearHeatmap.totalPlans}</strong> 个清单项，覆盖
              <strong> {yearHeatmap.activeDays} </strong>天。
            </p>
            <div className="year-overview">
              <div className="year-heatmap">
                <div className="year-heatmap-row">
                  <div className="year-heatmap-core">
                    <div className="year-heatmap-months" style={{ gridTemplateColumns: `repeat(${yearHeatmap.weekColumns}, 12px)` }}>
                      {yearHeatmap.monthMarkers.map((marker) => (
                        <span
                          key={`${marker.month}-${marker.weekIndex}`}
                          className="year-heatmap-month"
                          style={{ gridColumnStart: marker.weekIndex + 1 }}
                        >
                          {MONTH_LABELS[marker.month]}
                        </span>
                      ))}
                    </div>
                    <div className="year-heatmap-main">
                      <div className="year-heatmap-weekdays">
                        {WEEKDAY_LABELS.map((label) => (
                          <span key={label} className="year-heatmap-weekday">{label}</span>
                        ))}
                      </div>
                      <div className="year-heatmap-grid" style={{ gridTemplateColumns: `repeat(${yearHeatmap.weekColumns}, 12px)` }}>
                        {yearHeatmap.cells.map((cell) => (
                          <span
                            key={cell.key}
                            className={`year-heatmap-cell year-heatmap-cell--lv${cell.level}`}
                            style={{ gridColumnStart: cell.weekIndex + 1, gridRowStart: cell.day + 1 }}
                            title={`${cell.dateKey}：完成 ${cell.count} 项`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="year-heatmap-legend">
                    <span>少</span>
                    <span className="year-heatmap-cell year-heatmap-cell--lv1" />
                    <span className="year-heatmap-cell year-heatmap-cell--lv2" />
                    <span className="year-heatmap-cell year-heatmap-cell--lv3" />
                    <span className="year-heatmap-cell year-heatmap-cell--lv4" />
                    <span>多</span>
                  </div>
                </div>
              </div>
              <aside className="year-selector" aria-label="年度选择器">
                {yearOptions.map((year) => (
                  <button
                    key={year}
                    type="button"
                    className={`year-selector-item${year === selectedYear ? ' year-selector-item--active' : ''}`}
                    onClick={() => setSelectedYear(year)}
                  >
                    {year} 年
                  </button>
                ))}
              </aside>
                </div>
          </section>
        </div>
      )}
    </main>
  )
}

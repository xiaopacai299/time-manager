import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getPetDefinition } from '../../pets/registry'
import './PetAiChatPanel.css'

function nextId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function buildOpeningGreeting(selectedPet) {
  const name = getPetDefinition(selectedPet).name
  return `你好呀，我是${name}，你的小搭档，有啥可以帮你的呀？`
}

function assistantAvatarEmoji(selectedPet) {
  if (selectedPet === 'little-turtle') return '🐢'
  return '🐱'
}

/**
 * 与主进程兼容 Chat Completions 的接口对话；可在面板内开关已保存的「技能」。
 * @param {'default'|'window'} [layout] — `window` 时铺满独立子窗口且不显示内嵌标题栏（用系统标题栏关闭）。
 */
export default function PetAiChatPanel({
  hasOpenAiKey,
  llmSkills,
  onClose,
  layout,
  selectedPet = 'black-coal',
}) {
  const [messages, setMessages] = useState(() => [
    { id: nextId(), role: 'assistant', content: buildOpeningGreeting(selectedPet) },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [skillsOpen, setSkillsOpen] = useState(true)
  const listRef = useRef(null)
  const skills = useMemo(() => (Array.isArray(llmSkills) ? llmSkills : []), [llmSkills])
  const enabledCount = useMemo(
    () => skills.filter((s) => s.enabled && String(s.body || '').trim()).length,
    [skills],
  )
  const assistantEmoji = useMemo(() => assistantAvatarEmoji(selectedPet), [selectedPet])

  useEffect(() => {
    const el = listRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  const persistSkills = useCallback(async (next) => {
    try {
      const r = await window.timeManagerAPI?.updatePetSettings?.({ llmSkills: next })
      if (!r?.ok) {
        setErr(r?.error || '技能状态保存失败')
        return
      }
      setErr('')
    } catch (e) {
      setErr(e?.message || '保存失败')
    }
  }, [])

  const onToggleSkill = useCallback(
    (id, enabled) => {
      const next = skills.map((s) => (s.id === id ? { ...s, enabled } : s))
      persistSkills(next)
    },
    [persistSkills, skills],
  )

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || busy) return
    setInput('')
    setErr('')
    const userMsg = { id: nextId(), role: 'user', content: text }
    const threadForApi = [...messages, userMsg]
      .filter((m) => !m.streaming)
      .map(({ role, content }) => ({
        role: role === 'assistant' ? 'assistant' : 'user',
        content: String(content || '').slice(0, 8000),
      }))
    const assistantShell = {
      id: nextId(),
      role: 'assistant',
      content: '',
      reasoning: '',
      streaming: true,
    }
    setMessages((m) => [...m, userMsg, assistantShell])

    const unsub =
      typeof window.timeManagerAPI?.onAiChatStreamChunk === 'function'
        ? window.timeManagerAPI.onAiChatStreamChunk((data) => {
            const d = typeof data?.delta === 'string' ? data.delta : ''
            const r = typeof data?.reasoningDelta === 'string' ? data.reasoningDelta : ''
            if (!d && !r) return
            setMessages((prev) => {
              const last = prev[prev.length - 1]
              if (!last?.streaming) return prev
              const next = [...prev]
              next[next.length - 1] = {
                ...last,
                content: d ? (last.content || '') + d : last.content || '',
                reasoning: r ? (last.reasoning || '') + r : last.reasoning || '',
              }
              return next
            })
          })
        : () => {}

    setBusy(true)
    try {
      const res = await window.timeManagerAPI?.aiChatSend?.({ messages: threadForApi, stream: true })
      if (!res?.ok) {
        setErr(res?.message || '发送失败')
        setMessages((prev) => (prev[prev.length - 1]?.streaming ? prev.slice(0, -1) : prev))
        return
      }
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
        if (last?.streaming) {
          const reasoningFinal = String(res.reasoning ?? last.reasoning ?? '').trim()
          next[next.length - 1] = {
            ...last,
            content: (res.content || '').trim(),
            reasoning: reasoningFinal,
            streaming: false,
          }
        }
        return next
      })
    } catch (e) {
      setErr(e?.message || '发送失败')
      setMessages((prev) => (prev[prev.length - 1]?.streaming ? prev.slice(0, -1) : prev))
    } finally {
      unsub()
      setBusy(false)
    }
  }, [busy, input, messages])

  const layoutClass = layout === 'window' ? ' pet-ai-panel--window' : ''

  const isWindowLayout = layout === 'window'

  return (
    <aside className={`pet-ai-panel${layoutClass}`} role="dialog" aria-label="AI 对话">
      {!isWindowLayout ? (
        <header className="pet-ai-panel__head">
          <span className="pet-ai-panel__title">AI 对话</span>
          <button type="button" className="pet-ai-panel__close" onClick={onClose} aria-label="关闭">
            ×
          </button>
        </header>
      ) : null}
      {!hasOpenAiKey ? (
        <p className="pet-ai-panel__warn">
          尚未在「设置」中保存 API 密钥；也可设置环境变量 <code>OPENAI_API_KEY</code>。第三方兼容接口请在设置里填写 URL 与模型名。
        </p>
      ) : null}
      <div ref={listRef} className="pet-ai-panel__messages">
        {messages.map((m) => (
          <div key={m.id} className={`pet-ai-panel__msg-row pet-ai-panel__msg-row--${m.role}`}>
            <span
              className={`pet-ai-panel__avatar${m.role === 'user' ? ' pet-ai-panel__avatar--user' : ''}`}
              aria-hidden="true"
            >
              {m.role === 'user' ? '👤' : assistantEmoji}
            </span>
            <div
              className={`pet-ai-panel__msg pet-ai-panel__msg--${m.role}${
                m.streaming ? ' pet-ai-panel__msg--streaming' : ''
              }`}
            >
              {m.role === 'assistant' && m.reasoning ? (
                <details className="pet-ai-panel__reasoning" open={Boolean(m.streaming && m.reasoning)}>
                  <summary className="pet-ai-panel__reasoning-summary">思考过程</summary>
                  <pre className="pet-ai-panel__reasoning-body">{m.reasoning}</pre>
                </details>
              ) : null}
              {m.content}
              {m.streaming && !m.content && !m.reasoning ? (
                <span className="pet-ai-panel__typing">…</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <div className="pet-ai-panel__skills">
        <button
          type="button"
          className="pet-ai-panel__skills-toggle"
          onClick={() => setSkillsOpen((v) => !v)}
        >
          <span>技能 SKILL（对话时开关）</span>
          <span className="pet-ai-panel__skills-badge">
            {skills.length} 项 · 已启用 {enabledCount}
          </span>
        </button>
        {skillsOpen ? (
          skills.length === 0 ? (
            <p className="pet-ai-panel__skills-hint">
              暂无技能。打开「设置」→「AI 技能」添加：名称 + 正文（类似 Cursor 的 SKILL.md 要点），保存后在此勾选即可生效。
            </p>
          ) : (
            <div className="pet-ai-panel__skills-body">
              {skills.map((s) => (
                <label key={s.id} className="pet-ai-panel__skill-row">
                  <input
                    type="checkbox"
                    checked={Boolean(s.enabled)}
                    disabled={busy}
                    onChange={(e) => onToggleSkill(s.id, e.target.checked)}
                  />
                  <span className="pet-ai-panel__skill-name" title={s.name}>
                    {s.name || '未命名'}
                    {!String(s.body || '').trim() ? '（正文为空，不会生效）' : ''}
                  </span>
                </label>
              ))}
            </div>
          )
        ) : null}
      </div>

      {err ? <p className="pet-ai-panel__err">{err}</p> : null}
      <footer className="pet-ai-panel__foot">
        <textarea
          className="pet-ai-panel__input"
          rows={3}
          value={input}
          placeholder={busy ? '正在回复…' : '输入后 Ctrl+Enter 或点发送'}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              send()
            }
          }}
        />
        <button type="button" className="pet-ai-panel__send" disabled={busy || !input.trim()} onClick={send}>
          {busy ? '…' : '发送'}
        </button>
      </footer>
    </aside>
  )
}

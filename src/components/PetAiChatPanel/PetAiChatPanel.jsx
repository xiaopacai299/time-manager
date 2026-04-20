import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, forwardRef } from 'react'
import { getPetDefinition } from '../../pets/registry'
import PetAiChatAssistantAvatarLottie from './PetAiChatAssistantAvatarLottie.jsx'
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

/**
 * 与主进程兼容 Chat Completions 的接口对话；可在面板内开关已保存的「技能」。
 * @param {'default'|'window'} [layout] — `window` 时铺满独立子窗口且不显示内嵌标题栏（用系统标题栏关闭）。
 */
function PetAiChatPanelInner({
  hasOpenAiKey,
  llmSkills,
  onClose,
  layout,
  selectedPet = 'black-coal',
  /** 独立窗口内跳转到 `#pet-ai-chat/skills` 编辑技能 */
  onOpenSkillsEditor,
}, ref) {
  const [messages, setMessages] = useState(() => [
    {
      id: nextId(),
      role: 'assistant',
      content: buildOpeningGreeting(selectedPet),
      /** 仍为开场白时可随「当前宠物」从主进程同步更新文案（避免首屏默认黑煤球后再也不改） */
      opening: true,
    },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  /** 默认收起：仅显示「技能」入口，点击后再展开列表与管理 */
  const [skillsOpen, setSkillsOpen] = useState(false)
  /** 历史记录区域展开状态 */
  const [historyOpen, setHistoryOpen] = useState(false)
  /** 历史记录列表 */
  const [chatHistories, setChatHistories] = useState([])
  /** 当前加载的历史会话ID（null表示新对话） */
  const [currentHistoryId, setCurrentHistoryId] = useState(null)
  const listRef = useRef(null)
  const skills = useMemo(() => (Array.isArray(llmSkills) ? llmSkills : []), [llmSkills])
  const enabledCount = useMemo(
    () => skills.filter((s) => s.enabled && String(s.body || '').trim()).length,
    [skills],
  )

  // 加载历史记录列表
  const loadHistories = useCallback(async () => {
    try {
      const histories = await window.timeManagerAPI?.getChatHistories?.()
      if (Array.isArray(histories)) {
        setChatHistories(histories)
      }
    } catch (e) {
      console.error('加载历史记录失败:', e)
    }
  }, [])

  // 监听宠物状态变化，更新历史记录
  useEffect(() => {
    loadHistories()
    const unsubscribe = window.timeManagerAPI?.onPetStateChanged?.((payload) => {
      if (payload?.chatHistories) {
        setChatHistories(payload.chatHistories)
      }
    })
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe()
    }
  }, [loadHistories])

  // 加载指定历史会话
  const onLoadHistory = useCallback(async (sessionId) => {
    try {
      const session = await window.timeManagerAPI?.getChatHistory?.(sessionId)
      if (session?.messages?.length > 0) {
        // 转换为组件内部消息格式
        const loadedMessages = session.messages.map(m => ({
          id: m.id || nextId(),
          role: m.role,
          content: m.content,
          reasoning: m.reasoning,
          streaming: false,
          opening: false,
        }))
        setMessages(loadedMessages)
        setCurrentHistoryId(sessionId) // 标记为已加载的历史会话
        setErr('')
        setHistoryOpen(false)
      }
    } catch (e) {
      setErr(e?.message || '加载历史记录失败')
    }
  }, [])

  // 删除历史会话
  const onDeleteHistory = useCallback(async (sessionId) => {
    try {
      await window.timeManagerAPI?.deleteChatHistory?.(sessionId)
      setChatHistories((prev) => prev.filter((h) => h.id !== sessionId))
    } catch (e) {
      setErr(e?.message || '删除失败')
    }
  }, [])

  // 暴露保存历史记录的方法供父组件调用（窗口关闭时保存）
  useImperativeHandle(ref, () => ({
    saveHistory: async (customTitle) => {
      try {
        // 如果有当前历史ID，则更新原记录；否则创建新记录
        await window.timeManagerAPI?.saveChatHistory?.(messages, customTitle, currentHistoryId)
      } catch (e) {
        console.error('保存历史记录失败:', e)
      }
    },
    getMessages: () => messages,
  }), [messages, currentHistoryId])
  useEffect(() => {
    setMessages((prev) => {
      const first = prev[0]
      if (!first || first.role !== 'assistant' || !first.opening) return prev
      const nextContent = buildOpeningGreeting(selectedPet)
      if (first.content === nextContent) return prev
      return [{ ...first, content: nextContent }, ...prev.slice(1)]
    })
  }, [selectedPet])

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
    setMessages((m) => {
      const withoutOpening = m.map((msg, idx) => (idx === 0 ? { ...msg, opening: false } : msg))
      return [...withoutOpening, userMsg, assistantShell]
    })

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
              className={`pet-ai-panel__avatar${m.role === 'user' ? ' pet-ai-panel__avatar--user' : ' pet-ai-panel__avatar--assistant'}`}
              aria-hidden="true"
            >
              {m.role === 'user' ? '👤' : <PetAiChatAssistantAvatarLottie selectedPet={selectedPet} />}
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
          className={`pet-ai-panel__skills-toggle${skillsOpen ? ' pet-ai-panel__skills-toggle--open' : ''}`}
          onClick={() => setSkillsOpen((v) => !v)}
          aria-expanded={skillsOpen}
          title={skillsOpen ? '点击收起技能区' : '点击展开：勾选对话中使用的技能'}
        >
          <span className="pet-ai-panel__skills-toggle-label">技能 SKILL</span>
          <span className="pet-ai-panel__skills-toggle-meta">
            <span className="pet-ai-panel__skills-badge">
              {skills.length} 项 · 已启用 {enabledCount}
            </span>
            <span className="pet-ai-panel__skills-chevron" aria-hidden="true">
              ▼
            </span>
          </span>
        </button>
        {skillsOpen ? (
          <>
            {skills.length === 0 ? (
              <p className="pet-ai-panel__skills-hint">
                暂无技能。点击下方「添加 / 管理技能」添加名称与正文；保存时勾选「对话中默认勾选」的会在这里默认启用，也可随时取消勾选。
              </p>
            ) : (
              <div className="pet-ai-panel__skills-body">
                {skills.map((s) => (
                  <label key={s.id} className="pet-ai-panel__skill-row">
                    <input
                      type="checkbox"
                      checked={Boolean(s.enabled)}
                      onChange={(e) => onToggleSkill(s.id, e.target.checked)}
                    />
                    <span className="pet-ai-panel__skill-name" title={s.name}>
                      {s.name || '未命名'}
                      {!String(s.body || '').trim() ? '（正文为空，不会生效）' : ''}
                    </span>
                  </label>
                ))}
              </div>
            )}
            {onOpenSkillsEditor ? (
              <div className="pet-ai-panel__skills-footer">
                <button type="button" className="pet-ai-panel__skills-manage" onClick={onOpenSkillsEditor}>
                  添加 / 管理技能
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {/* 历史记录区域 */}
      <div className="pet-ai-panel__history">
        <button
          type="button"
          className={`pet-ai-panel__history-toggle${historyOpen ? ' pet-ai-panel__history-toggle--open' : ''}`}
          onClick={() => setHistoryOpen((v) => !v)}
          aria-expanded={historyOpen}
          title={historyOpen ? '点击收起历史记录' : '点击展开：查看最近保存的会话'}
        >
          <span className="pet-ai-panel__history-toggle-label">历史记录 HISTORY</span>
          <span className="pet-ai-panel__history-toggle-meta">
            <span className="pet-ai-panel__history-badge">
              {chatHistories.length} 条会话
            </span>
            <span className="pet-ai-panel__history-chevron" aria-hidden="true">
              ▼
            </span>
          </span>
        </button>
        {historyOpen ? (
          <div className="pet-ai-panel__history-body">
            {chatHistories.length === 0 ? (
              <p className="pet-ai-panel__history-empty">暂无历史记录。关闭对话窗口时会自动保存会话。</p>
            ) : (
              <>
                {chatHistories.map((h) => (
                  <div key={h.id} className="pet-ai-panel__history-row">
                    <button
                      type="button"
                      className="pet-ai-panel__history-item"
                      onClick={() => onLoadHistory(h.id)}
                      title={`${h.title}（${h.messageCount} 条消息）`}
                    >
                      <span className="pet-ai-panel__history-item-title">{h.title || '未命名会话'}</span>
                      <span className="pet-ai-panel__history-item-meta">
                        {new Date(h.createdAt).toLocaleDateString('zh-CN')} · {h.messageCount} 条消息
                      </span>
                    </button>
                    <button
                      type="button"
                      className="pet-ai-panel__history-delete"
                      onClick={() => onDeleteHistory(h.id)}
                      title="删除此会话"
                    >
                      ×
                    </button>
                  </div>
                ))}
                {chatHistories.length >= 10 && (
                  <p className="pet-ai-panel__history-hint">最多保留最近 10 条会话，每条会话最多 10 条消息</p>
                )}
              </>
            )}
          </div>
        ) : null}
      </div>

      {err ? <p className="pet-ai-panel__err">{err}</p> : null}
      <footer className="pet-ai-panel__foot">
        <textarea
          className="pet-ai-panel__input"
          rows={3}
          value={input}
          placeholder={busy ? '正在回复…' : 'Enter 发送 · Shift+Enter 换行'}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return
            if (e.shiftKey) return
            if (e.nativeEvent.isComposing) return
            e.preventDefault()
            send()
          }}
        />
        <button type="button" className="pet-ai-panel__send" disabled={busy || !input.trim()} onClick={send}>
          {busy ? '…' : '发送'}
        </button>
      </footer>
    </aside>
  )
}

const PetAiChatPanel = forwardRef(PetAiChatPanelInner)
export default PetAiChatPanel

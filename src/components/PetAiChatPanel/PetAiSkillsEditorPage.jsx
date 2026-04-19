import { useCallback, useEffect, useState } from 'react'
import { newSkillRow, normalizeLlmSkillsDraft } from '../../utils/llmSkillDraft'
import './PetAiSkillsEditorPage.css'

/**
 * AI 对话窗口内：技能列表编辑（原设置页「AI 技能」能力）。
 */
export default function PetAiSkillsEditorPage({ onBack, initialLlmSkills }) {
  const [llmSkills, setLlmSkills] = useState(() => normalizeLlmSkillsDraft(initialLlmSkills))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  /** 非空时显示删除确认弹窗 */
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  useEffect(() => {
    setLlmSkills(normalizeLlmSkillsDraft(initialLlmSkills))
  }, [initialLlmSkills])

  useEffect(() => {
    if (!deleteConfirmId) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setDeleteConfirmId(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [deleteConfirmId])

  /** 与对话面板一致：勾选「对话中默认勾选」立即写主进程并广播，对话里才能同步 */
  const persistLlmSkillsNow = useCallback(async (next, opts = { quiet: false }) => {
    try {
      const result = await window.timeManagerAPI?.updatePetSettings?.({ llmSkills: next })
      if (!result?.ok) {
        setMsg(result?.error || '同步失败')
        return false
      }
      if (!opts.quiet) setMsg('')
      return true
    } catch (e) {
      setMsg(e?.message || '同步失败')
      return false
    }
  }, [])

  const onEnabledChange = useCallback(
    async (id, enabled) => {
      const prevSnapshot = llmSkills
      const next = prevSnapshot.map((x) => (x.id === id ? { ...x, enabled } : x))
      setLlmSkills(next)
      const ok = await persistLlmSkillsNow(next)
      if (!ok) setLlmSkills(prevSnapshot)
    },
    [llmSkills, persistLlmSkillsNow],
  )

  const onSave = useCallback(async () => {
    setBusy(true)
    setMsg('')
    try {
      const ok = await persistLlmSkillsNow(llmSkills, { quiet: true })
      if (!ok) return
      setMsg('已保存')
    } finally {
      setBusy(false)
    }
  }, [llmSkills, persistLlmSkillsNow])

  const deleteTarget = deleteConfirmId ? llmSkills.find((x) => x.id === deleteConfirmId) : null
  const deleteTargetLabel = deleteTarget
    ? String(deleteTarget.name || '').trim() || '未命名技能'
    : ''

  const confirmDeleteSkill = useCallback(async () => {
    if (!deleteConfirmId) return
    const id = deleteConfirmId
    const prevSnapshot = llmSkills
    const next = prevSnapshot.filter((x) => x.id !== id)
    setDeleteConfirmId(null)
    setLlmSkills(next)
    const ok = await persistLlmSkillsNow(next)
    if (!ok) setLlmSkills(prevSnapshot)
  }, [deleteConfirmId, llmSkills, persistLlmSkillsNow])

  return (
    <div className="pet-ai-skills-page">
      <header className="pet-ai-skills-page__head">
        <div className="pet-ai-skills-page__head-top">
          <button type="button" className="pet-ai-skills-page__back" onClick={onBack}>
            <span className="pet-ai-skills-page__back-icon" aria-hidden="true">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M15 18l-6-6 6-6"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="pet-ai-skills-page__back-label">返回对话</span>
          </button>
        </div>
        <h1 className="pet-ai-skills-page__title">AI 技能（SKILL）</h1>
      </header>

      <p className="pet-ai-skills-page__sub">
        每条技能 = 名称 + 正文（可粘贴 SKILL.md 要点），最多 8 条。「对话中默认勾选」会立即同步到 AI
        对话里的勾选状态；仍可在对话里随时取消或重新勾选。名称与正文需点下方「保存技能」写入。已勾选且正文非空的技能会拼进系统提示。
      </p>

      <div className="pet-ai-skills-page__list">
        {llmSkills.map((s, index) => (
          <div key={s.id} className="pet-ai-skills-page__card">
            <div className="pet-ai-skills-page__card-head">
              <label className="pet-ai-skills-page__field pet-ai-skills-page__field--inline">
                <span>名称</span>
                <input
                  value={s.name}
                  maxLength={80}
                  placeholder="填写技能名称"
                  onChange={(e) => {
                    const v = e.target.value
                    setLlmSkills((prev) => prev.map((x) => (x.id === s.id ? { ...x, name: v } : x)))
                  }}
                />
              </label>
              <label className="pet-ai-skills-page__enable">
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={(e) => {
                    void onEnabledChange(s.id, e.target.checked)
                  }}
                />
                对话中默认勾选
              </label>
              <button
                type="button"
                className="pet-ai-skills-page__remove"
                onClick={() => setDeleteConfirmId(s.id)}
              >
                删除
              </button>
            </div>
            <label className="pet-ai-skills-page__field">
              <span>正文（最多约 4000 字）</span>
              <textarea
                className="pet-ai-skills-page__body"
                value={s.body}
                maxLength={4000}
                rows={5}
                placeholder="例如：回答时请始终用简体中文；涉及代码用 markdown 代码块；…"
                onChange={(e) => {
                  const v = e.target.value
                  setLlmSkills((prev) => prev.map((x) => (x.id === s.id ? { ...x, body: v } : x)))
                }}
              />
            </label>
            {index < llmSkills.length - 1 ? <hr className="pet-ai-skills-page__sep" /> : null}
          </div>
        ))}
      </div>

      <div className="pet-ai-skills-page__actions">
        <button
          type="button"
          className="pet-ai-skills-page__secondary"
          disabled={llmSkills.length >= 8}
          onClick={() => setLlmSkills((prev) => [...prev, newSkillRow()].slice(0, 8))}
        >
          添加技能
        </button>
        {llmSkills.length >= 8 ? <span className="pet-ai-skills-page__cap">已达 8 条上限</span> : null}
        <button type="button" className="pet-ai-skills-page__save" disabled={busy} onClick={onSave}>
          {busy ? '保存中…' : '保存技能'}
        </button>
        {msg ? <span className="pet-ai-skills-page__msg">{msg}</span> : null}
      </div>

      {deleteConfirmId ? (
        <div
          className="pet-ai-skills-modal-backdrop"
          role="presentation"
          onClick={() => setDeleteConfirmId(null)}
        >
          <div
            className="pet-ai-skills-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pet-ai-skills-delete-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="pet-ai-skills-delete-title" className="pet-ai-skills-modal__title">
              确认删除技能？
            </h2>
            <p className="pet-ai-skills-modal__body">
              将删除「<strong>{deleteTargetLabel}</strong>」，删除后会立即从 AI 对话的技能列表中移除，且不可恢复。
            </p>
            <div className="pet-ai-skills-modal__actions">
              <button type="button" className="pet-ai-skills-modal__btn pet-ai-skills-modal__btn--ghost" onClick={() => setDeleteConfirmId(null)}>
                取消
              </button>
              <button type="button" className="pet-ai-skills-modal__btn pet-ai-skills-modal__btn--danger" onClick={() => void confirmDeleteSkill()}>
                删除
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

/** 新建一条技能草稿（与主进程 normalize 字段一致） */
export function newSkillRow() {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `skill-${Date.now()}`
  return { id, name: '', body: '', enabled: true }
}

/** 将接口返回的技能列表规范为可编辑状态 */
export function normalizeLlmSkillsDraft(raw) {
  if (!Array.isArray(raw)) return []
  return raw.map((s, i) => ({
    id: typeof s?.id === 'string' && String(s.id).trim() ? String(s.id).trim() : `skill-${i}-${Date.now()}`,
    name: String(s?.name ?? '').slice(0, 80),
    body: String(s?.body || '').slice(0, 4000),
    enabled: Boolean(s?.enabled),
  }))
}

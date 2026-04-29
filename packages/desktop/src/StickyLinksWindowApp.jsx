import { useCallback, useEffect, useMemo, useState } from 'react'
import './StickyLinksWindowApp.css'

const DEFAULT_CAT = 'cat-default'

function emptyState() {
  return {
    categories: [{ id: DEFAULT_CAT, name: '未分类', sort: 0 }],
    items: [],
  }
}

export default function StickyLinksWindowApp() {
  const [data, setData] = useState(emptyState)
  const [activeCat, setActiveCat] = useState(DEFAULT_CAT)
  const [urlDraft, setUrlDraft] = useState('')
  const [titleDraft, setTitleDraft] = useState('')
  const [msg, setMsg] = useState('')
  const [modal, setModal] = useState(null)

  const applyState = useCallback((next) => {
    if (next && typeof next === 'object') {
      setData({
        categories: Array.isArray(next.categories) ? next.categories : [],
        items: Array.isArray(next.items) ? next.items : [],
      })
    }
  }, [])

  useEffect(() => {
    const api = window.timeManagerAPI
    if (!api) return undefined
    const off = api.onStickyLinksUpdated?.((payload) => applyState(payload))
    api.getStickyLinksState?.().then(applyState)
    return () => {
      if (off) off()
    }
  }, [applyState])

  const itemsInCat = useMemo(
    () => data.items.filter((it) => it.categoryId === activeCat),
    [data.items, activeCat],
  )

  const countByCat = useMemo(() => {
    const m = new Map()
    for (const it of data.items) {
      m.set(it.categoryId, (m.get(it.categoryId) || 0) + 1)
    }
    return m
  }, [data.items])

  async function onAdd() {
    setMsg('')
    const api = window.timeManagerAPI
    if (!api?.stickyLinksAddItem) {
      setMsg('无法连接主进程，请重启应用')
      return
    }
    try {
      const r = await api.stickyLinksAddItem({
        categoryId: activeCat,
        url: urlDraft,
        title: titleDraft,
      })
      if (!r?.ok) {
        setMsg(r?.error || '添加失败')
        return
      }
      const next = r.stickyLinks ?? (await api.getStickyLinksState?.())
      if (next) applyState(next)
      else setMsg('已保存但未取回列表，请关闭便签重开')
      setUrlDraft('')
      setTitleDraft('')
    } catch (e) {
      setMsg(String(e?.message || e) || '添加失败')
    }
  }

  async function onRemove(id) {
    const r = await window.timeManagerAPI?.stickyLinksRemoveItem?.({ id })
    if (r?.ok && r.stickyLinks) applyState(r.stickyLinks)
  }

  async function onOpen(url) {
    setMsg('')
    const r = await window.timeManagerAPI?.stickyLinksOpen?.({ url })
    if (!r?.ok) setMsg(r?.error || '无法打开链接')
  }

  async function confirmAddCategory() {
    const name = String(modal?.value || '').trim()
    if (!name) return
    const r = await window.timeManagerAPI?.stickyLinksAddCategory?.({ name })
    if (r?.ok && r.stickyLinks) {
      applyState(r.stickyLinks)
      if (r.newCategoryId) setActiveCat(r.newCategoryId)
    }
    setModal(null)
  }

  function requestDeleteCategory(cat) {
    if (cat.id === DEFAULT_CAT) return
    if (!window.confirm(`删除分类「${cat.name}」？其中链接将移入「未分类」。`)) return
    void (async () => {
      const r = await window.timeManagerAPI?.stickyLinksRemoveCategory?.({ id: cat.id })
      if (r?.ok && r.stickyLinks) {
        applyState(r.stickyLinks)
        setActiveCat(DEFAULT_CAT)
      }
    })()
  }

  const sortedCats = useMemo(
    () => [...data.categories].sort((a, b) => (a.sort || 0) - (b.sort || 0)),
    [data.categories],
  )

  return (
    <main className="sticky-page">
      <aside className="sticky-sidebar">
        <p className="sticky-sidebar__title">分类</p>
        {sortedCats.map((cat) => (
          <button
            key={cat.id}
            type="button"
            className={`sticky-cat${activeCat === cat.id ? ' sticky-cat--active' : ''}`}
            onClick={() => setActiveCat(cat.id)}
            onDoubleClick={(e) => {
              e.preventDefault()
              const next = window.prompt('重命名分类', cat.name)
              if (next == null) return
              const name = String(next).trim()
              if (!name) return
              void window.timeManagerAPI?.stickyLinksRenameCategory?.({ id: cat.id, name }).then((r) => {
                if (r?.ok && r.stickyLinks) applyState(r.stickyLinks)
              })
            }}
          >
            {cat.name}
            <span className="sticky-cat__count">{countByCat.get(cat.id) || 0}</span>
          </button>
        ))}
        <button type="button" className="sticky-sidebar__btn" onClick={() => setModal({ type: 'cat', value: '' })}>
          + 新建分类
        </button>
        {activeCat !== DEFAULT_CAT ? (
          <button
            type="button"
            className="sticky-sidebar__btn"
            style={{ borderColor: 'rgba(200,100,100,0.35)', color: '#a63c3c' }}
            onClick={() => {
              const cat = sortedCats.find((c) => c.id === activeCat)
              if (cat) requestDeleteCategory(cat)
            }}
          >
            删除当前分类
          </button>
        ) : null}
      </aside>

      <section className="sticky-main">
        <header className="sticky-main__head">
          <h1>便签</h1>
          <p className="sticky-main__sub">
            在下方输入链接或本地路径后点「添加」。支持 http(s)、ftp、magnet 及 Windows 路径（如 D:\file 或
            file:///…）。
          </p>
        </header>

        <div className="sticky-toolbar">
          <label className="sticky-field">
            <span>链接</span>
            <input
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              placeholder="https://… 或 ftp://… 或 magnet:?… 或 D:\path\file"
            />
          </label>
          <label className="sticky-field">
            <span>显示名称（可选）</span>
            <input
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              placeholder="留空则使用链接摘要"
            />
          </label>
          <div className="sticky-actions">
            <button type="button" className="sticky-btn sticky-btn--primary" onClick={() => void onAdd()}>
              添加
            </button>
          </div>
        </div>
        {msg ? <p className="sticky-msg">{msg}</p> : null}

        <div className="sticky-list">
          {!itemsInCat.length ? (
            <div className="sticky-empty">当前分类下暂无链接，在上方输入链接或路径后添加。</div>
          ) : (
            itemsInCat.map((it) => (
              <div key={it.id} className="sticky-card">
                <button type="button" className="sticky-card__body" onClick={() => void onOpen(it.url)}>
                  <p className="sticky-card__title">{it.title || it.url}</p>
                  <p className="sticky-card__url">{it.url}</p>
                </button>
                <button
                  type="button"
                  className="sticky-card__del"
                  title="删除"
                  aria-label="删除"
                  onClick={() => void onRemove(it.id)}
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {modal?.type === 'cat' ? (
        <div className="sticky-modal-backdrop" role="presentation" onClick={() => setModal(null)}>
          <div className="sticky-modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2>新建分类</h2>
            <input
              autoFocus
              value={modal.value}
              onChange={(e) => setModal({ type: 'cat', value: e.target.value })}
              placeholder="分类名称"
              onKeyDown={(e) => {
                if (e.key === 'Enter') void confirmAddCategory()
              }}
            />
            <div className="sticky-modal__actions">
              <button type="button" className="sticky-btn sticky-btn--ghost" onClick={() => setModal(null)}>
                取消
              </button>
              <button type="button" className="sticky-btn sticky-btn--primary" onClick={() => void confirmAddCategory()}>
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  )
}

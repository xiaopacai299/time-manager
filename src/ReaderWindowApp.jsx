import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ePub from 'epubjs'
import './ReaderWindowApp.css'

const BG_OPTIONS = [
  { id: 'paper', label: '纸张', color: '#f5f1e8' },
  { id: 'dark', label: '夜间', color: '#14171f' },
  { id: 'green', label: '护眼', color: '#e7f2e4' },
  { id: 'blue', label: '浅蓝', color: '#eaf3ff' },
  { id: 'transparent', label: '透明', color: 'transparent' },
]

const DEFAULT_SETTINGS = {
  background: 'paper',
  autoScrollSpeed: 20,
}

const READER_DB_NAME = 'time-manager-reader-db'
const READER_DB_VERSION = 1
const READER_STORE = 'reader-state'
const READER_SESSION_KEY = 'last-session'
const READER_SCROLLBAR_HIDE_STYLE_ID = 'tm-reader-hide-scrollbar'
const READER_TRANSPARENT_SCROLLBAR_CSS =
  'html,body,*{scrollbar-width:none!important;-ms-overflow-style:none!important}' +
  'html::-webkit-scrollbar,body::-webkit-scrollbar,*::-webkit-scrollbar{width:0!important;height:0!important;background:transparent!important}'

// 自动滚动相关：EPUB 连续滚动时，主滚动容器是 epub.js 注入的 .epub-container。
function getEpubScrollEl(root) {
  if (!root) return null
  return root.querySelector('.epub-container') || null
}

function flattenNavToc(items, depth = 0, out = []) {
  if (!Array.isArray(items)) return out
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const href = typeof item.href === 'string' ? item.href.trim() : ''
    const label = String(item.label || '').trim() || href
    if (href) {
      out.push({
        id: `nav-${out.length}-${href}`,
        label: label || `第 ${out.length + 1} 项`,
        href,
        depth,
      })
    } else if (label) {
      // 没有 href 的目录项仍保留作为分组标题（禁用点击），便于呈现层级结构
      out.push({
        id: `nav-${out.length}-header`,
        label,
        href: '',
        depth,
        disabled: true,
      })
    }
    // 兼容不同 EPUB 的子级字段：subitems（epub.js 常用）/ children / items
    const sub = item.subitems || item.children || item.items
    if (Array.isArray(sub) && sub.length) {
      flattenNavToc(sub, depth + 1, out)
    }
  }
  return out
}

function buildSpineFallbackToc(book) {
  const out = []
  if (!book?.spine?.each) return out
  book.spine.each((section) => {
    if (!section?.href || section.linear === false) return
    const file = section.href.split('/').pop() || section.href
    let label = file
    try {
      label = decodeURIComponent(file.replace(/\.[^.]+$/, '')) || file
    } catch {
      // ignore
    }
    out.push({
      id: `spine-${section.index}`,
      label: label || `第 ${section.index + 1} 节`,
      href: section.href,
      depth: 0,
    })
  })
  return out
}

function resolveActiveTocHref(locHref, tocList) {
  if (!locHref) return ''
  if (!tocList?.length) return locHref
  const locBase = locHref.split('#')[0].split('?')[0]
  let best = ''
  let bestLen = -1
  for (const it of tocList) {
    const raw = it.href.split('#')[0].split('?')[0]
    if (locBase === raw || locBase.endsWith(raw) || raw.endsWith(locBase)) {
      const len = raw.length
      if (len > bestLen) {
        bestLen = len
        best = it.href
      }
    }
  }
  return best || locHref
}

function resolveTocSpineSection(book, href) {
  if (!book?.spine?.get) return null
  const raw = String(href || '').trim()
  if (!raw) return null

  let s = book.spine.get(raw)
  if (s) return s

  const noHash = raw.split('#')[0].split('?')[0]
  if (noHash && noHash !== raw) {
    s = book.spine.get(noHash)
    if (s) return s
  }

  if (noHash) {
    try {
      s = book.spine.get(decodeURIComponent(noHash))
      if (s) return s
    } catch {
      // ignore
    }
    try {
      s = book.spine.get(encodeURI(noHash))
      if (s) return s
    } catch {
      // ignore
    }
  }

  const base = (noHash || raw).split('/').pop()
  if (!base) return null
  const len = book.spine.length ?? book.spine.spineItems?.length ?? 0
  for (let i = 0; i < len; i += 1) {
    const cand = book.spine.get(i)
    if (!cand?.href) continue
    if (cand.href === base || cand.href.endsWith(`/${base}`) || cand.href.split('/').pop() === base) {
      return cand
    }
  }
  return null
}

function getBgColor(id) {
  const target = BG_OPTIONS.find((bg) => bg.id === id)
  return target ? target.color : BG_OPTIONS[0].color
}

function openReaderDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(READER_DB_NAME, READER_DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(READER_STORE)) {
        db.createObjectStore(READER_STORE)
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error || new Error('无法打开阅读本地数据库'))
  })
}

async function getReaderSession() {
  const db = await openReaderDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(READER_STORE, 'readonly')
    const store = tx.objectStore(READER_STORE)
    const request = store.get(READER_SESSION_KEY)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error || new Error('读取阅读会话失败'))
  })
}

async function setReaderSession(payload) {
  const db = await openReaderDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(READER_STORE, 'readwrite')
    const store = tx.objectStore(READER_STORE)
    const request = store.put(payload, READER_SESSION_KEY)
    request.onsuccess = () => resolve(true)
    request.onerror = () => reject(request.error || new Error('保存阅读会话失败'))
  })
}

export default function ReaderWindowApp() {
  const containerRef = useRef(null)
  const epubRootRef = useRef(null)
  const autoTimerRef = useRef(null)
  const epubBookRef = useRef(null)
  const epubRenditionRef = useRef(null)
  const epubStuckTicksRef = useRef(0)
  const lastEpubAdvanceRef = useRef(0)
  const restoringRef = useRef(false)
  const saveTickRef = useRef(0)
  const prevOpaqueBackgroundRef = useRef(DEFAULT_SETTINGS.background)
  const epubTocRef = useRef([])
  const lastLayoutSizeRef = useRef({ w: 0, h: 0 })

  const [fileName, setFileName] = useState('')
  const [fileKind, setFileKind] = useState('')
  const [txtLines, setTxtLines] = useState([])
  const [autoScroll, setAutoScroll] = useState(false)
  const [readerSettings, setReaderSettings] = useState(DEFAULT_SETTINGS)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [transparentHover, setTransparentHover] = useState(false)
  const [epubToc, setEpubToc] = useState([])
  const [epubActiveTocHref, setEpubActiveTocHref] = useState('')
  const [tocOpen, setTocOpen] = useState(false)

  const isTransparent = readerSettings.background === 'transparent'
  const background = useMemo(() => getBgColor(readerSettings.background), [readerSettings.background])

  useEffect(() => {
    if (!isTransparent) setTransparentHover(false)
  }, [isTransparent])

  useEffect(() => {
    epubTocRef.current = epubToc
  }, [epubToc])

  useEffect(() => {
    if (isTransparent) setTocOpen(false)
  }, [isTransparent])

  useEffect(() => {
    let mounted = true
    window.timeManagerAPI?.getReaderSettings?.().then((settings) => {
      if (!mounted) return
      if (!settings || typeof settings !== 'object') return
      setReaderSettings({
        background: String(settings.background || DEFAULT_SETTINGS.background),
        autoScrollSpeed: Number.isFinite(Number(settings.autoScrollSpeed))
          ? Number(settings.autoScrollSpeed)
          : DEFAULT_SETTINGS.autoScrollSpeed,
      })
    })
    return () => {
      mounted = false
    }
  }, [])

  const persistSettings = useCallback(async (next) => {
    setReaderSettings(next)
    try {
      await window.timeManagerAPI?.updateReaderSettings?.(next)
    } catch {
      // 静默失败，不阻断阅读
    }
  }, [])

  const cleanupEpub = useCallback(() => {
    if (epubRenditionRef.current) {
      try {
        epubRenditionRef.current.destroy()
      } catch {
        // ignore
      }
      epubRenditionRef.current = null
    }
    if (epubBookRef.current) {
      try {
        if (typeof epubBookRef.current._source === 'string' && epubBookRef.current._source.startsWith('blob:')) {
          URL.revokeObjectURL(epubBookRef.current._source)
        }
        epubBookRef.current.destroy()
      } catch {
        // ignore
      }
      epubBookRef.current = null
    }
  }, [])

  // 仅在窗口真正卸载时清理，避免 React StrictMode 下双次执行销毁刚建好的 rendition。
  useEffect(() => {
    const onBeforeUnload = () => cleanupEpub()
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [cleanupEpub])

  const syncEpubLayout = useCallback(() => {
    const r = epubRenditionRef.current
    const root = epubRootRef.current
    if (!r || !root) return
    const w = root.clientWidth
    const h = root.clientHeight
    if (w <= 0 || h <= 0) return
    const last = lastLayoutSizeRef.current
    if (Math.abs(last.w - w) < 2 && Math.abs(last.h - h) < 2) return
    lastLayoutSizeRef.current = { w, h }
    try {
      r.resize(w, h)
    } catch {
      // ignore
    }
  }, [])

  // 主动触发连续视图管理器的 check()，绕过 rendition.resize 的尺寸早退，
  // 确保 iframe 异步 onLoad 后内容长度被重新计算，滚动条能立刻出现。
  const forceEpubRecheck = useCallback(() => {
    const mgr = epubRenditionRef.current?.manager
    if (!mgr || typeof mgr.check !== 'function') return
    try {
      Promise.resolve(mgr.check()).catch(() => {})
    } catch {
      // ignore
    }
  }, [])

  const persistReadingProgress = useCallback(async (partialProgress) => {
    try {
      const prev = (await getReaderSession()) || {}
      if (!prev || !prev.kind) return
      const next = {
        ...prev,
        progress: {
          ...(prev.progress || {}),
          ...(partialProgress || {}),
          updatedAt: Date.now(),
        },
        updatedAt: Date.now(),
      }
      await setReaderSession(next)
    } catch {
      // 静默失败，避免打断阅读
    }
  }, [])

  const openTxtFromContent = useCallback(
    async (name, text, progress = null) => {
      cleanupEpub()
      setFileName(String(name || '未命名.txt'))
      setMsg('')
      setLoading(false)
      const lines = String(text || '')
        .replace(/\r/g, '')
        .split('\n')
        .map((line) => line.trimEnd())
      setTxtLines(lines)
      setFileKind('txt')
      setEpubToc([])
      setEpubActiveTocHref('')
      setTocOpen(false)
      const restoreTop = Number(progress?.txtScrollTop || 0)
      window.setTimeout(() => {
        if (!containerRef.current) return
        containerRef.current.scrollTop = Math.max(0, restoreTop)
      }, 0)
    },
    [cleanupEpub],
  )

  const openEpubFromBuffer = useCallback(
    async (name, arrayBuffer, progress = null) => {
      setLoading(true)
      try {
        cleanupEpub()
        setFileName(String(name || '未命名.epub'))
        setMsg('')
        setFileKind('epub')
        setEpubToc([])
        setEpubActiveTocHref('')
        epubTocRef.current = []
        lastLayoutSizeRef.current = { w: 0, h: 0 }
        // 等待 React 把 reader-epub-root 节点挂载完成
        await new Promise((resolve) => setTimeout(resolve, 0))
        if (!epubRootRef.current) {
          throw new Error('阅读容器初始化失败，请重试。')
        }
        const book = ePub(arrayBuffer)
        epubBookRef.current = book
        const rendition = book.renderTo(epubRootRef.current, {
          width: '100%',
          height: '100%',
          flow: 'scrolled-doc',
          manager: 'continuous',
        })
        epubRenditionRef.current = rendition
        // iframe onLoad 之后视图真正拥有内容高度，这里再追一次 check()，
        // 让连续管理器按最新 scrollHeight 决定是否追加下一节。
        rendition.on('rendered', () => {
          window.requestAnimationFrame(() => forceEpubRecheck())
        })
        rendition.on('relocated', (location) => {
          const locHref = location?.start?.href
          if (locHref) {
            setEpubActiveTocHref(resolveActiveTocHref(locHref, epubTocRef.current))
          }
          if (restoringRef.current) return
          const cfi = location?.start?.cfi
          if (!cfi) return
          const now = Date.now()
          if (now - saveTickRef.current < 800) return
          saveTickRef.current = now
          persistReadingProgress({ epubCfi: cfi })
        })

        const renderPromise = progress?.epubCfi ? rendition.display(progress.epubCfi) : rendition.display()
        const timeoutPromise = new Promise((_, reject) => {
          window.setTimeout(() => reject(new Error('EPUB 渲染超时，请更换文件或重试。')), 12000)
        })
        await Promise.race([renderPromise, timeoutPromise])

        try {
          await book.loaded.navigation
        } catch {
          // 部分电子书没有 nav / ncx
        }
        const fromNav = flattenNavToc(book.navigation?.toc || [])
        const fromSpine = buildSpineFallbackToc(book)
        const nextToc = fromNav.length > 0 ? fromNav : fromSpine
        setEpubToc(nextToc)
        epubTocRef.current = nextToc
        const startHref = rendition.location?.start?.href
        if (startHref) setEpubActiveTocHref(resolveActiveTocHref(startHref, nextToc))
      } catch (err) {
        setMsg(`打开 EPUB 失败：${err?.message || '未知错误'}`)
        cleanupEpub()
        setFileKind('')
        setFileName('')
      } finally {
        setLoading(false)
        // 等容器从 loading 态切回正常高度后，按真实尺寸重新排版 + 强制 check()，
        // 确保首次打开时 .epub-container 能立刻出现滚动条并且可以手动滚动。
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            syncEpubLayout()
            forceEpubRecheck()
            try {
              epubRenditionRef.current?.reportLocation?.()
            } catch {
              // ignore
            }
          })
        })
        // iframe 里图片/样式可能异步加载，按梯度再 check 几次兜底
        ;[160, 500, 1200].forEach((delay) => {
          window.setTimeout(forceEpubRecheck, delay)
        })
      }
    },
    [cleanupEpub, persistReadingProgress, syncEpubLayout, forceEpubRecheck],
  )

  // 会话恢复：只在第一次挂载时运行一次
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cached = await getReaderSession()
        if (cancelled || !cached?.kind || !cached?.payload) return
        restoringRef.current = true
        if (cached.kind === 'txt') {
          await openTxtFromContent(cached.name, cached.payload.text, cached.progress)
        } else if (cached.kind === 'epub') {
          await openEpubFromBuffer(cached.name, cached.payload.arrayBuffer, cached.progress)
        }
      } catch {
        // ignore restore failure
      } finally {
        if (!cancelled) restoringRef.current = false
        setLoading(false)
      }
    })()
    return () => {
      cancelled = true
      restoringRef.current = false
    }
  }, [openEpubFromBuffer, openTxtFromContent])

  // TXT 滚动位置持久化
  useEffect(() => {
    if (fileKind !== 'txt') return undefined
    const el = containerRef.current
    if (!el) return undefined
    let timer = null
    const onScroll = () => {
      if (timer) clearTimeout(timer)
      timer = window.setTimeout(() => {
        persistReadingProgress({ txtScrollTop: el.scrollTop })
      }, 200)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      if (timer) clearTimeout(timer)
    }
  }, [fileKind, persistReadingProgress])

  // 自动下滑：简化为只滚动真正的滚动容器
  useEffect(() => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current)
      autoTimerRef.current = null
    }
    if (!autoScroll) {
      epubStuckTicksRef.current = 0
      return undefined
    }
    epubStuckTicksRef.current = 0
    autoTimerRef.current = setInterval(() => {
      const speed = Math.max(1, Number(readerSettings.autoScrollSpeed || 20))
      const step = speed / 5

      if (fileKind === 'epub') {
        const host = getEpubScrollEl(epubRootRef.current)
        if (host && typeof host.scrollTop === 'number') {
          const before = host.scrollTop
          host.scrollTop = before + step
          if (host.scrollTop > before) {
            epubStuckTicksRef.current = 0
            return
          }
        }
        // 滚动到底了：尝试下一节
        epubStuckTicksRef.current += 1
        const now = Date.now()
        if (epubStuckTicksRef.current >= 8 && now - lastEpubAdvanceRef.current > 1200) {
          const r = epubRenditionRef.current
          if (r && typeof r.next === 'function') {
            Promise.resolve(r.next()).catch(() => {
              // ignore
            })
            lastEpubAdvanceRef.current = now
            epubStuckTicksRef.current = 0
          }
        }
        return
      }

      const el = containerRef.current
      if (!el) return
      el.scrollBy({ top: step, behavior: 'auto' })
    }, 40)
    return () => {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current)
        autoTimerRef.current = null
      }
    }
  }, [autoScroll, readerSettings.autoScrollSpeed, fileKind])

  // EPUB 主题随背景变化
  useEffect(() => {
    if (!epubRenditionRef.current) return
    const color = readerSettings.background === 'dark' ? '#e8edf5' : '#1f2a44'
    const bgValue = readerSettings.background === 'transparent' ? 'rgba(0,0,0,0)' : background
    epubRenditionRef.current.themes.default({
      body: {
        background: `${bgValue} !important`,
        color: `${color} !important`,
      },
      p: {
        'line-height': '1.8',
      },
    })
  }, [background, readerSettings.background])

  // 透明模式时，向 EPUB iframe 内注入隐藏滚动条的样式
  useEffect(() => {
    const r = epubRenditionRef.current
    if (!r || fileKind !== 'epub') return undefined

    const injectIntoDoc = (doc) => {
      if (!doc?.head) return
      if (doc.getElementById(READER_SCROLLBAR_HIDE_STYLE_ID)) return
      const el = doc.createElement('style')
      el.id = READER_SCROLLBAR_HIDE_STYLE_ID
      el.textContent = READER_TRANSPARENT_SCROLLBAR_CSS
      doc.head.appendChild(el)
    }
    const stripFromDoc = (doc) => {
      doc?.getElementById(READER_SCROLLBAR_HIDE_STYLE_ID)?.remove()
    }
    const onContent = (contents) => {
      try {
        injectIntoDoc(contents?.document)
      } catch {
        // ignore
      }
    }

    if (isTransparent) {
      r.hooks?.content?.register?.(onContent)
      try {
        const list = typeof r.getContents === 'function' ? r.getContents() : []
        for (const c of list || []) injectIntoDoc(c?.document)
      } catch {
        // ignore
      }
      return () => {
        try {
          r.hooks?.content?.deregister?.(onContent)
        } catch {
          // ignore
        }
        try {
          const list = typeof r.getContents === 'function' ? r.getContents() : []
          for (const c of list || []) stripFromDoc(c?.document)
        } catch {
          // ignore
        }
      }
    }

    try {
      const list = typeof r.getContents === 'function' ? r.getContents() : []
      for (const c of list || []) stripFromDoc(c?.document)
    } catch {
      // ignore
    }
    return undefined
  }, [isTransparent, fileKind])

  // 透明模式下：通过 MutationObserver 捕获后续动态加载的 iframe，补注入隐藏滚动条样式
  useEffect(() => {
    if (!isTransparent || fileKind !== 'epub') return undefined
    const root = epubRootRef.current
    if (!root) return undefined

    const injectIntoDoc = (doc) => {
      if (!doc?.head) return
      if (doc.getElementById(READER_SCROLLBAR_HIDE_STYLE_ID)) return
      const el = doc.createElement('style')
      el.id = READER_SCROLLBAR_HIDE_STYLE_ID
      el.textContent = READER_TRANSPARENT_SCROLLBAR_CSS
      doc.head.appendChild(el)
    }
    const injectFrame = (iframe) => {
      const run = () => {
        try {
          injectIntoDoc(iframe.contentDocument)
        } catch {
          // ignore
        }
      }
      if (iframe.contentDocument?.readyState === 'complete') run()
      else iframe.addEventListener('load', run, { once: true })
    }
    const scan = () => {
      root.querySelectorAll('iframe').forEach(injectFrame)
    }

    scan()
    const mo = new MutationObserver(() => {
      window.requestAnimationFrame(scan)
    })
    mo.observe(root, { childList: true, subtree: true })

    return () => {
      mo.disconnect()
      root.querySelectorAll('iframe').forEach((iframe) => {
        try {
          iframe.contentDocument?.getElementById(READER_SCROLLBAR_HIDE_STYLE_ID)?.remove()
        } catch {
          // ignore
        }
      })
    }
  }, [isTransparent, fileKind])

  // 布局同步：基于 ResizeObserver 的节流同步（rAF），处理窗口缩放 / 目录开关 / 透明模式切换等
  useEffect(() => {
    if (fileKind !== 'epub') return undefined
    const root = epubRootRef.current
    if (!root) return undefined
    let rafId = 0
    const schedule = () => {
      if (rafId) return
      rafId = window.requestAnimationFrame(() => {
        rafId = 0
        syncEpubLayout()
        forceEpubRecheck()
      })
    }
    const ro = new ResizeObserver(schedule)
    ro.observe(root)
    const onWinResize = () => schedule()
    window.addEventListener('resize', onWinResize)
    // 初次或显式触发一次
    schedule()
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId)
      ro.disconnect()
      window.removeEventListener('resize', onWinResize)
    }
  }, [fileKind, syncEpubLayout, forceEpubRecheck, tocOpen, isTransparent, loading])

  const onPickFile = useCallback(
    async (event) => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return

      setMsg('')
      setLoading(true)
      setFileName(file.name || '')
      setTxtLines([])
      cleanupEpub()

      const lowerName = String(file.name || '').toLowerCase()
      try {
        if (lowerName.endsWith('.txt')) {
          const text = await file.text()
          await openTxtFromContent(file.name, text, { txtScrollTop: 0 })
          await setReaderSession({
            kind: 'txt',
            name: file.name,
            payload: { text },
            progress: { txtScrollTop: 0, updatedAt: Date.now() },
            updatedAt: Date.now(),
          })
          return
        }

        if (lowerName.endsWith('.epub')) {
          const arrayBuffer = await file.arrayBuffer()
          await openEpubFromBuffer(file.name, arrayBuffer, null)
          await setReaderSession({
            kind: 'epub',
            name: file.name,
            payload: { arrayBuffer },
            progress: { epubCfi: null, updatedAt: Date.now() },
            updatedAt: Date.now(),
          })
          return
        }

        setMsg('当前仅支持 .txt 与 .epub 文件。')
      } catch (error) {
        setMsg(`读取失败：${error?.message || '文件格式不受支持或文件已损坏。'}`)
      } finally {
        setLoading(false)
      }
    },
    [cleanupEpub, openEpubFromBuffer, openTxtFromContent],
  )

  const onBgChange = useCallback(
    (id) => {
      if (id === 'transparent' && readerSettings.background !== 'transparent') {
        prevOpaqueBackgroundRef.current = readerSettings.background
      }
      persistSettings({
        ...readerSettings,
        background: id,
      })
    },
    [persistSettings, readerSettings],
  )

  const exitTransparentMode = useCallback(() => {
    const restoreId = prevOpaqueBackgroundRef.current || DEFAULT_SETTINGS.background
    persistSettings({
      ...readerSettings,
      background: restoreId,
    })
    setTransparentHover(false)
  }, [persistSettings, readerSettings])

  const goToTocHref = useCallback(
    (href) => {
      const r = epubRenditionRef.current
      const book = epubBookRef.current
      if (!r || !book || !href) return
      const fullHref = String(href).trim()
      const section = resolveTocSpineSection(book, fullHref)
      if (!section) {
        setMsg('目录条目无法匹配到书脊章节，请检查电子书目录结构。')
        return
      }
      const hasAnchor = fullHref.includes('#')
      // 关键：把包含锚点的完整 href 传给 epub.js，这样二级/三级目录（#anchor）才能精确定位；
      // 不包含锚点时传纯 section.href，确保落到章节起点。
      const targetForDisplay = hasAnchor ? fullHref : section.href

      // epub.js 在"章节尚未渲染"分支里不会调 scrollTo，导致 .epub-container 保留跳转前的 scrollTop，
      // 夹到新内容的底部就出现"跳转到章节末尾"的现象。display 结束后我们主动对齐一次滚动位置。
      const alignToSection = () => {
        const mgr = r.manager
        const host = mgr?.container || getEpubScrollEl(epubRootRef.current)
        if (!host) return
        const view = mgr?.views?.find?.(section)
        // 有锚点时让 epub.js 的 moveTo 继续生效，不去打扰具体 Y 坐标
        if (hasAnchor) return
        if (view && typeof view.offset === 'function') {
          const off = view.offset()
          host.scrollTop = Math.max(0, Math.floor(off?.top || 0))
        } else {
          host.scrollTop = 0
        }
      }

      Promise.resolve(r.display(targetForDisplay))
        .then(() => {
          window.requestAnimationFrame(() => {
            alignToSection()
            forceEpubRecheck()
          })
          // fill() 之后章节视图高度可能变化，再对齐一次兜底
          window.setTimeout(() => {
            alignToSection()
            forceEpubRecheck()
          }, 220)
          window.setTimeout(forceEpubRecheck, 600)
        })
        .catch((err) => {
          setMsg(`目录跳转失败：${err?.message || '未知错误'}`)
        })
    },
    [forceEpubRecheck],
  )

  const onSpeedChange = useCallback(
    (value) => {
      persistSettings({
        ...readerSettings,
        autoScrollSpeed: Number(value),
      })
    },
    [persistSettings, readerSettings],
  )

  return (
    <main
      className={`reader-page reader-page--${readerSettings.background}`}
      style={{ '--reader-bg': background }}
      onMouseEnter={() => {
        if (isTransparent) setTransparentHover(true)
      }}
      onMouseLeave={() => {
        if (isTransparent) setTransparentHover(false)
      }}
    >
      {/* 透明模式下依然允许拖动窗口：顶部留一条不可见的拖拽条 */}
      {isTransparent ? <div className="reader-drag-strip" aria-hidden="true" /> : null}

      {isTransparent && transparentHover ? (
        <button type="button" className="reader-exit-transparent" onClick={exitTransparentMode}>
          退出透明
        </button>
      ) : null}

      {!isTransparent ? (
        <header className="reader-toolbar">
          <label className="reader-upload">
            <input
              type="file"
              accept=".txt,.epub,text/plain,application/epub+zip"
              onChange={onPickFile}
              hidden
            />
            <span>上传小说</span>
          </label>
          {fileKind === 'epub' ? (
            <button
              type="button"
              className={`reader-btn${tocOpen ? ' reader-btn--toggle-on' : ''}`}
              onClick={() => setTocOpen((v) => !v)}
            >
              目录
            </button>
          ) : null}
          <button type="button" className="reader-btn" onClick={() => setAutoScroll((v) => !v)}>
            {autoScroll ? '停止自动下滑' : '自动下滑'}
          </button>
          <label className="reader-speed">
            速度
            <input
              type="range"
              min="5"
              max="120"
              step="5"
              value={readerSettings.autoScrollSpeed}
              onChange={(e) => onSpeedChange(e.target.value)}
            />
          </label>
          <div className="reader-bgs">
            {BG_OPTIONS.map((bg) => (
              <button
                key={bg.id}
                type="button"
                className={`reader-bg-btn${readerSettings.background === bg.id ? ' reader-bg-btn--active' : ''}`}
                onClick={() => onBgChange(bg.id)}
                title={bg.label}
              >
                {bg.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="reader-btn reader-btn--danger"
            onClick={() => window.timeManagerAPI?.closeReaderWindow?.()}
          >
            关闭阅读页
          </button>
        </header>
      ) : null}

      {!isTransparent ? (
        <section className="reader-meta">
          <span>快捷键：`Ctrl/Cmd + Shift + R` 快速开关，`Esc` 关闭当前阅读页</span>
          <span>{fileName ? `当前文件：${fileName}` : '请上传 .txt 或 .epub 小说文件'}</span>
        </section>
      ) : null}

      {msg ? <div className="reader-msg">{msg}</div> : null}

      <div className="reader-main-row">
        {loading ? (
          <div className="reader-loading reader-loading--overlay" aria-live="polite">
            正在加载文件，请稍候…
          </div>
        ) : null}
        {!isTransparent && fileKind === 'epub' && tocOpen ? (
          <>
            <button
              type="button"
              className="reader-toc-backdrop"
              aria-label="关闭目录"
              onClick={() => setTocOpen(false)}
            />
            <aside className="reader-toc" aria-label="电子书目录">
              <div className="reader-toc-head">目录</div>
              <nav className="reader-toc-list">
                {epubToc.length === 0 ? (
                  <div className="reader-toc-empty">暂无目录</div>
                ) : (
                  epubToc.map((item) => {
                    if (item.disabled) {
                      return (
                        <div
                          key={item.id}
                          className="reader-toc-item reader-toc-item--group"
                          style={{ paddingLeft: `${12 + item.depth * 14}px` }}
                        >
                          {item.label}
                        </div>
                      )
                    }
                    const active = Boolean(epubActiveTocHref && item.href === epubActiveTocHref)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        className={`reader-toc-item${active ? ' reader-toc-item--active' : ''}`}
                        style={{ paddingLeft: `${12 + item.depth * 14}px` }}
                        onClick={() => goToTocHref(item.href)}
                        title={item.href}
                      >
                        {item.label}
                      </button>
                    )
                  })
                )}
              </nav>
            </aside>
          </>
        ) : null}
        <section
          ref={containerRef}
          className={`reader-content${fileKind === 'epub' ? ' reader-content--epub' : ''}`}
        >
          <div
            ref={epubRootRef}
            id="reader-epub-root"
            className={`reader-epub-root${fileKind === 'epub' ? '' : ' reader-epub-root--hidden'}`}
          />
          {fileKind === 'txt' ? (
            <article className="reader-text">
              {txtLines.map((line, idx) => (
                <p key={`${idx}-${line.slice(0, 12)}`}>{line || '\u00A0'}</p>
              ))}
            </article>
          ) : fileKind !== 'epub' ? (
            <div className="reader-placeholder">上传小说后开始阅读。</div>
          ) : null}
        </section>
      </div>
    </main>
  )
}

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
  const autoTargetRef = useRef('待机')
  const epubStuckTicksRef = useRef(0)
  const lastEpubAdvanceRef = useRef(0)
  const lockedTargetRef = useRef('')
  const targetFailTicksRef = useRef(0)
  const restoringRef = useRef(false)
  const saveTickRef = useRef(0)
  const prevOpaqueBackgroundRef = useRef(DEFAULT_SETTINGS.background)

  const [fileName, setFileName] = useState('')
  const [fileKind, setFileKind] = useState('')
  const [txtLines, setTxtLines] = useState([])
  const [autoScroll, setAutoScroll] = useState(false)
  const [readerSettings, setReaderSettings] = useState(DEFAULT_SETTINGS)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [autoScrollTarget, setAutoScrollTarget] = useState('待机')
  const [transparentHover, setTransparentHover] = useState(false)

  const isTransparent = readerSettings.background === 'transparent'
  const background = useMemo(() => getBgColor(readerSettings.background), [readerSettings.background])

  useEffect(() => {
    if (!isTransparent) setTransparentHover(false)
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

  useEffect(() => cleanupEpub, [cleanupEpub])

  const persistReadingProgress = useCallback(
    async (partialProgress) => {
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
    },
    [],
  )

  const openTxtFromContent = useCallback(async (name, text, progress = null) => {
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
    const restoreTop = Number(progress?.txtScrollTop || 0)
    window.setTimeout(() => {
      if (!containerRef.current) return
      containerRef.current.scrollTop = Math.max(0, restoreTop)
    }, 0)
  }, [cleanupEpub])

  const openEpubFromBuffer = useCallback(
    async (name, arrayBuffer, progress = null) => {
      cleanupEpub()
      setFileName(String(name || '未命名.epub'))
      setMsg('')
      setLoading(true)
      setFileKind('epub')
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
      rendition.on('relocated', (location) => {
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
      setLoading(false)
    },
    [cleanupEpub, persistReadingProgress],
  )

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const cached = await getReaderSession()
        if (!mounted || !cached?.kind || !cached?.payload) return
        restoringRef.current = true
        if (cached.kind === 'txt') {
          await openTxtFromContent(cached.name, cached.payload.text, cached.progress)
        } else if (cached.kind === 'epub') {
          await openEpubFromBuffer(cached.name, cached.payload.arrayBuffer, cached.progress)
        }
      } catch {
        // ignore restore failure
      } finally {
        restoringRef.current = false
      }
    })()
    return () => {
      mounted = false
      restoringRef.current = false
    }
  }, [openEpubFromBuffer, openTxtFromContent])

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

  useEffect(() => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current)
      autoTimerRef.current = null
    }
    if (!autoScroll) {
      autoTargetRef.current = '待机'
      setAutoScrollTarget('待机')
      epubStuckTicksRef.current = 0
      lockedTargetRef.current = ''
      targetFailTicksRef.current = 0
      return undefined
    }
    autoTargetRef.current = '检测中'
    setAutoScrollTarget('检测中')
    epubStuckTicksRef.current = 0
    lockedTargetRef.current = ''
    targetFailTicksRef.current = 0
    autoTimerRef.current = setInterval(() => {
      const speed = Math.max(1, Number(readerSettings.autoScrollSpeed || 20))
      const step = speed / 5
      const updateTarget = (next) => {
        if (autoTargetRef.current === next) return
        autoTargetRef.current = next
        setAutoScrollTarget(next)
      }
      const tryScrollByLabel = (label) => {
        if (label === 'EPUB 内页') {
          const iframe = epubRootRef.current?.querySelector('iframe')
          const doc = iframe?.contentDocument
          const scrollingEl = doc?.scrollingElement || doc?.documentElement || null
          if (!scrollingEl) return false
          const before = scrollingEl.scrollTop
          scrollingEl.scrollTop += step
          return scrollingEl.scrollTop > before
        }
        if (label === 'EPUB 内容') {
          const contents = epubRenditionRef.current?.getContents?.() || []
          for (const content of contents) {
            const contentDoc = content?.document || content?.window?.document
            const contentScrollEl = contentDoc?.scrollingElement || contentDoc?.documentElement || null
            if (!contentScrollEl) continue
            const before = contentScrollEl.scrollTop
            contentScrollEl.scrollTop += step
            if (contentScrollEl.scrollTop > before) return true
          }
          return false
        }
        if (label === 'EPUB 容器') {
          const epubHost =
            epubRootRef.current?.querySelector('.epub-container') ||
            epubRootRef.current?.querySelector('.epub-view') ||
            epubRootRef.current?.firstElementChild
          if (!epubHost || typeof epubHost.scrollTop !== 'number') return false
          const before = epubHost.scrollTop
          epubHost.scrollTop += step
          return epubHost.scrollTop > before
        }
        return false
      }
      if (fileKind === 'epub' && epubRootRef.current) {
        const priorityTargets = ['EPUB 容器', 'EPUB 内页', 'EPUB 内容']
        let moved = false

        if (lockedTargetRef.current) {
          moved = tryScrollByLabel(lockedTargetRef.current)
          if (moved) {
            targetFailTicksRef.current = 0
            updateTarget(lockedTargetRef.current)
            epubStuckTicksRef.current = 0
            return
          }
          targetFailTicksRef.current += 1
          if (targetFailTicksRef.current < 6) {
            epubStuckTicksRef.current += 1
          } else {
            lockedTargetRef.current = ''
            targetFailTicksRef.current = 0
          }
        } else {
          for (const label of priorityTargets) {
            moved = tryScrollByLabel(label)
            if (!moved) continue
            lockedTargetRef.current = label
            targetFailTicksRef.current = 0
            updateTarget(label)
            epubStuckTicksRef.current = 0
            return
          }
        }

        epubStuckTicksRef.current += 1
        const now = Date.now()
        if (epubStuckTicksRef.current >= 8 && now - lastEpubAdvanceRef.current > 1200) {
          const nextFn = epubRenditionRef.current?.next
          if (typeof nextFn === 'function') {
            Promise.resolve(nextFn.call(epubRenditionRef.current)).catch(() => {
              // ignore
            })
            lastEpubAdvanceRef.current = now
            epubStuckTicksRef.current = 0
            updateTarget('EPUB 翻页')
            return
          }
        }
      }
      const el = containerRef.current
      if (!el) return
      updateTarget('外层容器')
      el.scrollBy({ top: step, behavior: 'auto' })
    }, 40)
    return () => {
      if (autoTimerRef.current) {
        clearInterval(autoTimerRef.current)
        autoTimerRef.current = null
      }
    }
  }, [autoScroll, readerSettings.autoScrollSpeed, fileKind])

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

  useEffect(() => {
    const r = epubRenditionRef.current
    if (!r || fileKind !== 'epub' || loading) return undefined

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

    if (readerSettings.background === 'transparent') {
      r.hooks?.content?.register?.(onContent)
      try {
        const list = typeof r.getContents === 'function' ? r.getContents() : []
        for (const c of list || []) {
          injectIntoDoc(c?.document)
        }
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
          for (const c of list || []) {
            stripFromDoc(c?.document)
          }
        } catch {
          // ignore
        }
      }
    }

    try {
      const list = typeof r.getContents === 'function' ? r.getContents() : []
      for (const c of list || []) {
        stripFromDoc(c?.document)
      }
    } catch {
      // ignore
    }
    return undefined
  }, [readerSettings.background, fileKind, loading])

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
      {isTransparent && transparentHover ? (
        <button type="button" className="reader-exit-transparent" onClick={exitTransparentMode}>
          退出透明
        </button>
      ) : null}

      {!isTransparent ? (
        <header className="reader-toolbar">
          <label className="reader-upload">
            <input type="file" accept=".txt,.epub,text/plain,application/epub+zip" onChange={onPickFile} hidden />
            <span>上传小说</span>
          </label>
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
          <button type="button" className="reader-btn reader-btn--danger" onClick={() => window.timeManagerAPI?.closeReaderWindow?.()}>
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
      {/* {!isTransparent ? (
        <section className="reader-auto-indicator" aria-live="polite">
          <span className={`reader-auto-badge${autoScroll ? ' reader-auto-badge--on' : ''}`}>
            {autoScroll ? '自动下滑：开启' : '自动下滑：关闭'}
          </span>
          <span>目标：{autoScroll ? autoScrollTarget : '无'}</span>
          <span>速度：{Math.max(1, Number(readerSettings.autoScrollSpeed || 20))}</span>
        </section>
      ) : null} */}
      
      {msg ? <div className="reader-msg">{msg}</div> : null}
      {loading ? <div className="reader-loading">正在加载文件，请稍候…</div> : null}

      <section ref={containerRef} className="reader-content">
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
    </main>
  )
}

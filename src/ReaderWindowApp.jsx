import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import ePub from 'epubjs'
import './ReaderWindowApp.css'

const BG_OPTIONS = [
  { id: 'paper', label: '纸张', color: '#f5f1e8' },
  { id: 'dark', label: '夜间', color: '#14171f' },
  { id: 'green', label: '护眼', color: '#e7f2e4' },
  { id: 'blue', label: '浅蓝', color: '#eaf3ff' },
]

const DEFAULT_SETTINGS = {
  background: 'paper',
  autoScrollSpeed: 20,
}

function getBgColor(id) {
  const target = BG_OPTIONS.find((bg) => bg.id === id)
  return target ? target.color : BG_OPTIONS[0].color
}

export default function ReaderWindowApp() {
  const containerRef = useRef(null)
  const epubRootRef = useRef(null)
  const autoTimerRef = useRef(null)
  const epubBookRef = useRef(null)
  const epubRenditionRef = useRef(null)

  const [fileName, setFileName] = useState('')
  const [fileKind, setFileKind] = useState('')
  const [txtLines, setTxtLines] = useState([])
  const [autoScroll, setAutoScroll] = useState(false)
  const [readerSettings, setReaderSettings] = useState(DEFAULT_SETTINGS)
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)

  const background = useMemo(() => getBgColor(readerSettings.background), [readerSettings.background])

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

  useEffect(() => {
    if (autoTimerRef.current) {
      clearInterval(autoTimerRef.current)
      autoTimerRef.current = null
    }
    if (!autoScroll) return undefined
    autoTimerRef.current = setInterval(() => {
      const el = containerRef.current
      if (!el) return
      const speed = Math.max(1, Number(readerSettings.autoScrollSpeed || 20))
      el.scrollBy({ top: speed / 5, behavior: 'auto' })
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
    epubRenditionRef.current.themes.default({
      body: {
        background: `${background} !important`,
        color: `${color} !important`,
      },
      p: {
        'line-height': '1.8',
      },
    })
  }, [background, readerSettings.background])

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
          const lines = text
            .replace(/\r/g, '')
            .split('\n')
            .map((line) => line.trimEnd())
          setTxtLines(lines)
          setFileKind('txt')
          return
        }

        if (lowerName.endsWith('.epub')) {
          setFileKind('epub')
          await new Promise((resolve) => setTimeout(resolve, 0))
          if (!epubRootRef.current) {
            throw new Error('阅读容器初始化失败，请重试。')
          }
          const arrayBuffer = await file.arrayBuffer()
          const book = ePub(arrayBuffer)
          epubBookRef.current = book
          const rendition = book.renderTo(epubRootRef.current, {
            width: '100%',
            height: '100%',
            flow: 'scrolled-doc',
            manager: 'continuous',
          })
          epubRenditionRef.current = rendition
          const renderPromise = rendition.display()
          const timeoutPromise = new Promise((_, reject) => {
            window.setTimeout(() => reject(new Error('EPUB 渲染超时，请更换文件或重试。')), 12000)
          })
          await Promise.race([renderPromise, timeoutPromise])
          return
        }

        setMsg('当前仅支持 .txt 与 .epub 文件。')
      } catch (error) {
        setMsg(`读取失败：${error?.message || '文件格式不受支持或文件已损坏。'}`)
      } finally {
        setLoading(false)
      }
    },
    [cleanupEpub],
  )

  const onBgChange = useCallback(
    (id) => {
      persistSettings({
        ...readerSettings,
        background: id,
      })
    },
    [persistSettings, readerSettings],
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
    <main className={`reader-page reader-page--${readerSettings.background}`} style={{ '--reader-bg': background }}>
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

      <section className="reader-meta">
        <span>快捷键：`Ctrl/Cmd + Shift + R` 快速开关，`Esc` 关闭当前阅读页</span>
        <span>{fileName ? `当前文件：${fileName}` : '请上传 .txt 或 .epub 小说文件'}</span>
      </section>

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

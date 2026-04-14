import { useEffect, useRef, useState } from 'react'
import './FavoritesWindowApp.css'

function fallbackIcon() {
  return 'data:image/svg+xml;base64,' + btoa(
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><rect width="24" height="24" rx="6" fill="#dbe6ff"/><path d="M7 8h10v8H7z" fill="#5b7fe8"/></svg>'
  )
}

export default function FavoritesWindowApp() {
  const [items, setItems] = useState([])
  const [message, setMessage] = useState('')
  const [menu, setMenu] = useState(null)
  const [isDragover, setIsDragover] = useState(false)
  const iconCacheRef = useRef(new Map())

  useEffect(() => {
    const off = window.timeManagerAPI?.onFavoritesUpdated?.((nextItems) => {
      setItems(Array.isArray(nextItems) ? nextItems : [])
    })
    window.timeManagerAPI?.getFavoritesList?.().then((nextItems) => {
      setItems(Array.isArray(nextItems) ? nextItems : [])
    })
    return () => {
      if (off) off()
    }
  }, [])

  useEffect(() => {
    const hideContextMenu = () => setMenu(null)
    window.addEventListener('click', hideContextMenu)
    window.addEventListener('blur', hideContextMenu)
    return () => {
      window.removeEventListener('click', hideContextMenu)
      window.removeEventListener('blur', hideContextMenu)
    }
  }, [])

  async function resolveIcon(pathKey, persistedIcon) {
    if (persistedIcon) {
      iconCacheRef.current.set(pathKey, persistedIcon)
      return persistedIcon
    }
    const cached = iconCacheRef.current.get(pathKey)
    if (cached) return cached
    const url = await window.timeManagerAPI?.getFavoriteIcon?.(pathKey)
    if (typeof url === 'string' && url.length > 0) {
      iconCacheRef.current.set(pathKey, url)
      return url
    }
    return ''
  }

  async function onDrop(event) {
    event.preventDefault()
    setIsDragover(false)
    const files = Array.from(event.dataTransfer?.files || [])
    const uriList = event.dataTransfer?.getData('text/uri-list') || ''
    const paths = window.timeManagerAPI?.resolveDropPaths?.(files, uriList) || []
    if (!paths.length) return
    const result = await window.timeManagerAPI?.addFavoritesPaths?.(paths, true)
    setItems(Array.isArray(result?.list) ? result.list : [])
    if ((result?.rejected || []).length > 0) {
      setMessage('仅支持拖入应用快捷方式(.lnk)，文件夹/文件已忽略。')
    } else {
      setMessage('')
    }
  }

  return (
    <main className="favorites-page">
      <div className="favorites-wrap">
        <div
          className={`favorites-drop-zone${isDragover ? ' favorites-drop-zone--dragover' : ''}`}
          onDragOver={(event) => {
            event.preventDefault()
            setIsDragover(true)
          }}
          onDragLeave={() => setIsDragover(false)}
          onDrop={onDrop}
        >
          <div className="favorites-hint">仅支持拖入应用快捷方式（.lnk）</div>
        </div>
        <div className="favorites-tips">双击图标打开应用，右键图标可删除。</div>
        <div className="favorites-msg">{message}</div>
        <div className="favorites-list">
          {!items.length ? (
            <div className="favorites-empty">暂无收藏，拖一个应用进来试试</div>
          ) : (
            items.map((item) => (
              <FavoriteItem
                key={item.path}
                item={item}
                onOpen={() => window.timeManagerAPI?.openFavorite?.(item.path)}
                onContextMenu={(x, y) => setMenu({ x, y, item })}
                resolveIcon={resolveIcon}
              />
            ))
          )}
        </div>
      </div>
      {menu ? (
        <div className="favorites-context-menu" style={{ left: menu.x, top: menu.y }}>
          <button
            type="button"
            className="favorites-context-btn"
            onClick={async () => {
              const list = await window.timeManagerAPI?.removeFavorite?.(menu.item.path)
              setItems(Array.isArray(list) ? list : [])
              setMenu(null)
            }}
          >
            删除
          </button>
        </div>
      ) : null}
    </main>
  )
}

function FavoriteItem({ item, onOpen, onContextMenu, resolveIcon }) {
  const [iconSrc, setIconSrc] = useState(fallbackIcon())

  useEffect(() => {
    let mounted = true
    resolveIcon(item.path, typeof item.iconDataUrl === 'string' ? item.iconDataUrl : '').then((url) => {
      if (!mounted) return
      if (typeof url === 'string' && url.length > 0) setIconSrc(url)
      else setIconSrc(fallbackIcon())
    })
    return () => {
      mounted = false
    }
  }, [item.path, item.iconDataUrl, resolveIcon])

  return (
    <div
      className="favorites-item"
      onDoubleClick={onOpen}
      onContextMenu={(event) => {
        event.preventDefault()
        onContextMenu(event.clientX, event.clientY)
      }}
    >
      <img className="favorites-icon" src={iconSrc} alt="" />
      <div className="favorites-name" title={item.path}>
        {item.name || item.path}
      </div>
    </div>
  )
}

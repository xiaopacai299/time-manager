import { useState } from 'react'
import './SettingsWindowApp.css'
import './LoginWindowApp.css'
import { useSyncContext } from './sync/SyncProvider.jsx'
import { clearAuthState, initDeviceId, saveAuthState } from './sync/authStore.js'
import { ApiClient, normalizeApiBase } from './sync/ApiClient.js'

export default function LoginWindowApp() {
  const { authState, setAuthState, triggerSync, status, lastSyncAt, error } = useSyncContext()
  /** 未登录时：登录表单 | 注册表单（无顶部分栏，用链接切换） */
  const [mode, setMode] = useState('login')
  const [apiBase, setApiBase] = useState('http://localhost:3000')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const isLoggedIn = !!authState?.accessToken

  function messageColor(text) {
    if (!text) return '#555'
    if (text.includes('成功') || text.includes('已退出')) return '#2f8d4a'
    if (text.includes('失败') || text.startsWith('API') || text.includes('错误')) return '#e53e3e'
    return '#555'
  }

  function resetFormData() {
    setApiBase('http://localhost:3000')
    setEmail('')
    setPassword('')
    setMsg('')
  }

  async function handleLogin(e) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      const deviceId = await initDeviceId()
      const normalizedApiBase = normalizeApiBase(apiBase)
      const client = new ApiClient(normalizedApiBase, () => null, deviceId)
      const data = await client.login(email, password)
      await saveAuthState({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        userId: data.user.id,
        email: data.user.email,
        apiBase: normalizedApiBase,
        deviceId,
      })
      setAuthState({
        ...data,
        email: data.user?.email,
        userId: data.user?.id,
        apiBase: normalizedApiBase,
        deviceId,
      })
      setApiBase(normalizedApiBase)
      setMsg('登录成功！')
      if (typeof window !== 'undefined' && typeof window.close === 'function') {
        setTimeout(() => {
          window.close()
        }, 220)
      }
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  /** 注册成功不写入 token、不自动登录，回到登录页让用户自行登录 */
  async function handleRegister(e) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      const deviceId = await initDeviceId()
      const normalizedApiBase = normalizeApiBase(apiBase)
      const client = new ApiClient(normalizedApiBase, () => null, deviceId)
      await client.register(email, password)
      setPassword('')
      setMode('login')
      setMsg('注册成功，请登录')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '操作失败')
    } finally {
      setBusy(false)
    }
  }

  async function handleLogout() {
    setBusy(true)
    try {
      if (authState?.refreshToken && authState?.apiBase && authState?.deviceId) {
        const client = new ApiClient(authState.apiBase, () => authState.accessToken, authState.deviceId)
        await client.logout(authState.refreshToken).catch(() => {})
      }
      await clearAuthState()
      setAuthState(null)
      setMode('login')
      setMsg('已退出登录')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="settings-page">
      <section className="settings-card">
        <h2 className="settings-title">账号与同步</h2>
        {isLoggedIn ? (
          <>
            <p style={{ marginBottom: 8, color: '#555' }}>已登录：{authState.email}</p>
            <p style={{ marginBottom: 8, fontSize: 12, color: '#888' }}>同步服务器：{authState.apiBase}</p>
            <p style={{ marginBottom: 8, fontSize: 12, color: '#888' }}>
              {status === 'syncing' ? '同步中…' : status === 'error' ? `同步错误：${error}` : '就绪'}
              {lastSyncAt && ` · 上次同步：${lastSyncAt}`}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="settings-save" onClick={() => void triggerSync()} disabled={busy || status === 'syncing'}>
                立即同步
              </button>
              <button
                className="settings-secondary"
                style={{ color: '#e53e3e', borderColor: '#e53e3e' }}
                onClick={() => void handleLogout()}
                disabled={busy}
              >
                退出登录
              </button>
            </div>
          </>
        ) : mode === 'login' ? (
          <>
            <form onSubmit={(e) => void handleLogin(e)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label className="settings-field">
                <span>服务器地址</span>
                <input
                  type="url"
                  placeholder="如 https://api.example.com"
                  value={apiBase}
                  onChange={(e) => setApiBase(e.target.value)}
                  required
                />
              </label>
              <label className="settings-field">
                <span>邮箱</span>
                <input
                  type="email"
                  placeholder="请输入邮箱"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="settings-field">
                <span>密码</span>
                <input
                  type="password"
                  placeholder="至少 8 位"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </label>
              <button type="submit" className="settings-save" disabled={busy}>
                {busy ? '处理中…' : '登录'}
              </button>
              <div className="login-form-footer">
                <button
                  type="button"
                  className="login-link-btn"
                  disabled={busy}
                  onClick={() => {
                    resetFormData()
                    setMode('register')
                  }}
                >
                  立即注册
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <p className="settings-sub" style={{ marginTop: 0 }}>
              注册新账号
            </p>
            <form onSubmit={(e) => void handleRegister(e)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label className="settings-field">
                <span>服务器地址</span>
                <input
                  type="url"
                  placeholder="如 https://api.example.com"
                  value={apiBase}
                  onChange={(e) => setApiBase(e.target.value)}
                  required
                />
              </label>
              <label className="settings-field">
                <span>邮箱</span>
                <input
                  type="email"
                  placeholder="请输入邮箱"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </label>
              <label className="settings-field">
                <span>密码</span>
                <input
                  type="password"
                  placeholder="至少 8 位"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  minLength={8}
                  required
                />
              </label>
              <button type="submit" className="settings-save" disabled={busy}>
                {busy ? '处理中…' : '注册'}
              </button>
              <div className="login-form-footer">
                <button
                  type="button"
                  className="login-link-btn"
                  disabled={busy}
                  onClick={() => {
                    resetFormData()
                    setMode('login')
                  }}
                >
                  返回登录
                </button>
              </div>
            </form>
          </>
        )}
        {msg ? (
          <p style={{ marginTop: 8, color: messageColor(msg), fontSize: 13 }}>
            {msg}
          </p>
        ) : null}
      </section>
    </main>
  )
}

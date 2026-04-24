import { useEffect, useRef, useState } from 'react'
import lottie from 'lottie-web'
import './SettingsWindowApp.css'
import { PET_LIST } from './pets/registry'
import { LONG_WORK_CONTINUOUS_MS, REMIND_CONTINUOUS_MS } from './configKeys'
import { useSyncContext } from './sync/SyncProvider.jsx'
import { clearAuthState, initDeviceId, saveAuthState } from './sync/authStore.js'
import { ApiClient } from './sync/ApiClient.js'

const PET_AI_CHAT_BG_PRESET_OPTIONS = [
  { id: 'mist_blue', label: '浅蓝雾' },
  { id: 'lavender_mist', label: '淡紫雾' },
  { id: 'warm_paper', label: '暖纸色' },
  { id: 'dark_navy', label: '夜间深蓝' },
  { id: 'mint_soft', label: '薄荷浅绿' },
]

const DEFAULT_BUBBLE_TEXTS = {
  work: '',
  rest: '',
  remind: '',
  'long-work': '',
}

function PetLottieIcon({ animationData }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!ref.current || !animationData) return undefined
    const anim = lottie.loadAnimation({
      container: ref.current,
      renderer: 'svg',
      loop: true,
      autoplay: true,
      animationData,
      rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
    })
    anim.setSpeed(0.7)
    return () => anim.destroy()
  }, [animationData])
  return <span className="settings-pet-icon settings-pet-icon--lottie" ref={ref} aria-hidden="true" />
}

function AccountSection() {
  const { authState, setAuthState, triggerSync, status, lastSyncAt, error } = useSyncContext()
  const [tab, setTab] = useState('login') // 'login' | 'register'
  const [apiBase, setApiBase] = useState('http://localhost:3000')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const isLoggedIn = !!authState?.accessToken

  async function handleSubmit(e) {
    e.preventDefault()
    setBusy(true)
    setMsg('')
    try {
      const deviceId = await initDeviceId()
      const client = new ApiClient(apiBase, () => null, deviceId)
      const data = tab === 'login'
        ? await client.login(email, password)
        : await client.register(email, password)
      await saveAuthState({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        userId: data.user.id,
        email: data.user.email,
        apiBase,
        deviceId,
      })
      setAuthState({
        ...data,
        email: data.user?.email,
        userId: data.user?.id,
        apiBase,
        deviceId,
      })
      setMsg(tab === 'login' ? '登录成功！' : '注册成功！')
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '操作失败')
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
      setMsg('已退出登录')
    } finally {
      setBusy(false)
    }
  }

  if (isLoggedIn) {
    return (
      <div className="settings-section">
        <h3 className="settings-section-title">账号与同步</h3>
        <p style={{ marginBottom: 8, color: '#555' }}>已登录：{authState.email}</p>
        <p style={{ marginBottom: 8, fontSize: 12, color: '#888' }}>
          {status === 'syncing' ? '同步中…' : status === 'error' ? `同步错误：${error}` : '就绪'}
          {lastSyncAt && ` · 上次同步：${lastSyncAt}`}
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="settings-btn"
            onClick={() => void triggerSync()}
            disabled={busy || status === 'syncing'}
          >
            立即同步
          </button>
          <button
            className="settings-btn"
            style={{ color: '#e53e3e', borderColor: '#e53e3e' }}
            onClick={() => void handleLogout()}
            disabled={busy}
          >
            退出登录
          </button>
        </div>
        {msg && <p style={{ marginTop: 8, color: '#555', fontSize: 13 }}>{msg}</p>}
      </div>
    )
  }

  return (
    <div className="settings-section">
      <h3 className="settings-section-title">账号与同步</h3>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button
          className={`settings-btn${tab === 'login' ? ' settings-btn--active' : ''}`}
          onClick={() => setTab('login')}
        >登录</button>
        <button
          className={`settings-btn${tab === 'register' ? ' settings-btn--active' : ''}`}
          onClick={() => setTab('register')}
        >注册</button>
      </div>
      <form onSubmit={(e) => void handleSubmit(e)} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="url"
          placeholder="服务器地址（如 https://api.example.com）"
          value={apiBase}
          onChange={e => setApiBase(e.target.value)}
          className="settings-input"
          required
        />
        <input
          type="email"
          placeholder="邮箱"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="settings-input"
          required
        />
        <input
          type="password"
          placeholder="密码（至少 8 位）"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="settings-input"
          minLength={8}
          required
        />
        <button type="submit" className="settings-btn" disabled={busy}>
          {busy ? '处理中…' : tab === 'login' ? '登录' : '注册'}
        </button>
      </form>
      {msg && <p style={{ marginTop: 8, color: '#e53e3e', fontSize: 13 }}>{msg}</p>}
    </div>
  )
}

export default function SettingsWindowApp() {
  const [selectedPet, setSelectedPet] = useState('black-coal')
  const [bubbleTexts, setBubbleTexts] = useState(DEFAULT_BUBBLE_TEXTS)
  const [remindContinuousMins, setRemindContinuousMins] = useState(Math.round(REMIND_CONTINUOUS_MS / 60000))
  const [longWorkContinuousMins, setLongWorkContinuousMins] = useState(Math.round(LONG_WORK_CONTINUOUS_MS / 60000))
  const [openAiKeyDraft, setOpenAiKeyDraft] = useState('')
  const [hasOpenAiKey, setHasOpenAiKey] = useState(false)
  const [clearOpenAiKey, setClearOpenAiKey] = useState(false)
  const [llmChatUrl, setLlmChatUrl] = useState('')
  const [llmModel, setLlmModel] = useState('gpt-4o-mini')
  const [petAiChatBgKind, setPetAiChatBgKind] = useState('default')
  const [petAiChatBgPreset, setPetAiChatBgPreset] = useState('mist_blue')
  const [petAiChatBgImageUrl, setPetAiChatBgImageUrl] = useState('')
  const [petAiChatBgImageRel, setPetAiChatBgImageRel] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    let mounted = true
    window.timeManagerAPI?.getPetSettings?.().then((data) => {
      if (!mounted || !data) return
      setSelectedPet(String(data.selectedPet || 'black-coal'))
      const next = data.bubbleTexts && typeof data.bubbleTexts === 'object' ? data.bubbleTexts : {}
      setBubbleTexts({
        work: String(next.work || ''),
        rest: String(next.rest || ''),
        remind: String(next.remind || ''),
        'long-work': String(next['long-work'] || ''),
      })

      const remindMs = Number(data.remindContinuousMs)
      const longMs = Number(data.longWorkContinuousMs)
      setRemindContinuousMins(Number.isFinite(remindMs) ? Math.round(remindMs / 60000) : Math.round(REMIND_CONTINUOUS_MS / 60000))
      setLongWorkContinuousMins(Number.isFinite(longMs) ? Math.round(longMs / 60000) : Math.round(LONG_WORK_CONTINUOUS_MS / 60000))
      setHasOpenAiKey(Boolean(data.hasOpenAiKey))
      setOpenAiKeyDraft('')
      setClearOpenAiKey(false)
      setLlmChatUrl(String(data.llmChatUrl || ''))
      setLlmModel(String(data.llmModel || 'gpt-4o-mini').trim() || 'gpt-4o-mini')
      const k = String(data.petAiChatBgKind || '').trim()
      setPetAiChatBgKind(['preset', 'image', 'image-fill'].includes(k) ? k : 'default')
      const presetIds = new Set(PET_AI_CHAT_BG_PRESET_OPTIONS.map((o) => o.id))
      const pr = String(data.petAiChatBgPreset || '').trim()
      setPetAiChatBgPreset(presetIds.has(pr) ? pr : 'mist_blue')
      setPetAiChatBgImageUrl(String(data.petAiChatBgImageUrl || ''))
      setPetAiChatBgImageRel(String(data.petAiChatBgImageRel || ''))
    })
    return () => {
      mounted = false
    }
  }, [])

  async function onSave() {
    setBusy(true)
    setMsg('')
    try {
      const remindMs = Math.max(0, Math.round(Number(remindContinuousMins) * 60 * 1000))
      const longMs = Math.max(0, Math.round(Number(longWorkContinuousMins) * 60 * 1000))

      if (remindMs >= longMs) {
        setMsg('提醒阈值必须小于警告阈值（持续使用分钟数）。')
        return
      }

      console.log('[DEBUG] Saving petAiChatBgKind:', petAiChatBgKind)
      const payload = {
        selectedPet,
        bubbleTexts,
        remindContinuousMs: remindMs,
        longWorkContinuousMs: longMs,
        // llmChatUrl 和 llmModel 已硬编码，不在设置中修改
        petAiChatBgKind,
        petAiChatBgPreset,
      }
      console.log('[DEBUG] payload:', payload)
      if (clearOpenAiKey) {
        payload.clearOpenAiApiKey = true
      } else if (openAiKeyDraft.trim()) {
        payload.openAiApiKey = openAiKeyDraft.trim()
      }
      const result = await window.timeManagerAPI?.updatePetSettings?.(payload)
      if (!result?.ok) {
        setMsg(result?.error || '保存失败')
        return
      }
      setHasOpenAiKey(Boolean(result.petSettings?.hasOpenAiKey))
      setOpenAiKeyDraft('')
      setClearOpenAiKey(false)
      const ps = result.petSettings
      if (ps) {
        const nk = String(ps.petAiChatBgKind || '').trim()
        setPetAiChatBgKind(['preset', 'image', 'image-fill'].includes(nk) ? nk : 'default')
        const presetIds = new Set(PET_AI_CHAT_BG_PRESET_OPTIONS.map((o) => o.id))
        const npr = String(ps.petAiChatBgPreset || '').trim()
        setPetAiChatBgPreset(presetIds.has(npr) ? npr : 'mist_blue')
        setPetAiChatBgImageUrl(String(ps.petAiChatBgImageUrl || ''))
        setPetAiChatBgImageRel(String(ps.petAiChatBgImageRel || ''))
      }
      setMsg('设置已保存')
    } catch {
      setMsg('保存失败，请稍后重试')
    } finally {
      setBusy(false)
    }
  }

  async function onPickAiChatBgImage() {
    setMsg('')
    try {
      const r = await window.timeManagerAPI?.choosePetAiChatBackgroundImage?.()
      if (!r?.ok) {
        if (r?.error && r.error !== 'CANCELLED') setMsg(r.error)
        return
      }
      const ps = r.petSettings
      if (ps) {
        setPetAiChatBgKind('image')
        const presetIds = new Set(PET_AI_CHAT_BG_PRESET_OPTIONS.map((o) => o.id))
        const npr = String(ps.petAiChatBgPreset || '').trim()
        setPetAiChatBgPreset(presetIds.has(npr) ? npr : 'mist_blue')
        setPetAiChatBgImageUrl(String(ps.petAiChatBgImageUrl || ''))
        setPetAiChatBgImageRel(String(ps.petAiChatBgImageRel || ''))
        setMsg('已设为自定义背景（已写入本机，打开 AI 对话窗口即可看到）')
      }
    } catch (e) {
      setMsg(e?.message || '选择图片失败')
    }
  }

  async function onClearAiChatBgImage() {
    setMsg('')
    try {
      const r = await window.timeManagerAPI?.updatePetSettings?.({
        petAiChatBgKind: 'default',
        clearPetAiChatBgImage: true,
      })
      if (!r?.ok) {
        setMsg(r?.error || '清除失败')
        return
      }
      const ps = r.petSettings
      if (ps) {
        const nk = String(ps.petAiChatBgKind || '').trim()
        setPetAiChatBgKind(['preset', 'image', 'image-fill'].includes(nk) ? nk : 'default')
        setPetAiChatBgImageUrl(String(ps.petAiChatBgImageUrl || ''))
        setPetAiChatBgImageRel(String(ps.petAiChatBgImageRel || ''))
      } else {
        setPetAiChatBgKind('default')
        setPetAiChatBgImageUrl('')
        setPetAiChatBgImageRel('')
      }
      setMsg('已移除自定义背景图')
    } catch (e) {
      setMsg(e?.message || '清除失败')
    }
  }

  return (
    <main className="settings-page">
      <section className="settings-card">
        <h2 className="settings-title">设置宠物类型</h2>
        <p className="settings-sub">上方为休息时图标，下方为宠物名称。每个宠物独立管理自身形态和特效。</p>
        <div className="settings-pet-grid">
          {PET_LIST.map((pet) => (
            <button
              key={pet.id}
              type="button"
              disabled={!pet.enabled}
              className={`settings-pet-item${selectedPet === pet.id ? ' settings-pet-item--active' : ''}`}
              onClick={() => {
                if (!pet.enabled) return
                setSelectedPet(pet.id)
              }}
            >
              {pet.previewAnimation ? (
                <PetLottieIcon animationData={pet.previewAnimation} />
              ) : (
                <span className="settings-pet-icon" aria-hidden="true">🐾</span>
              )}
              <span className="settings-pet-name">{pet.name}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="settings-card">
        <h2 className="settings-title">AI 对话（基础）</h2>
        <p className="settings-sub">
          作用于独立「AI 对话」窗口（左键双击宠物打开）的整体背景。自定义图片会复制到本机应用数据目录，不会上传网络。
        </p>
        <div className="settings-form">
          <div className="settings-field">
            <span>背景类型</span>
            <div className="settings-ai-bg-kind">
              <label>
                <input
                  type="radio"
                  name="pet-ai-chat-bg-kind"
                  checked={petAiChatBgKind === 'default'}
                  onChange={() => setPetAiChatBgKind('default')}
                />
                默认浅灰蓝
              </label>
              <label>
                <input
                  type="radio"
                  name="pet-ai-chat-bg-kind"
                  checked={petAiChatBgKind === 'preset'}
                  onChange={() => setPetAiChatBgKind('preset')}
                />
                内置渐变
              </label>
              <label>
                <input
                  type="radio"
                  name="pet-ai-chat-bg-kind"
                  checked={petAiChatBgKind === 'image'}
                  onChange={() => setPetAiChatBgKind('image')}
                />
                自定义图片（平铺）
              </label>
              <label>
                <input
                  type="radio"
                  name="pet-ai-chat-bg-kind"
                  checked={petAiChatBgKind === 'image-fill'}
                  onChange={() => setPetAiChatBgKind('image-fill')}
                />
                自定义图片（填充）
              </label>
            </div>
          </div>
          {petAiChatBgKind === 'preset' ? (
            <div className="settings-field">
              <span>预设配色</span>
              <div className="settings-ai-bg-swatches">
                {PET_AI_CHAT_BG_PRESET_OPTIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    title={o.label}
                    aria-label={o.label}
                    className={`settings-ai-bg-swatch settings-ai-bg-swatch--${o.id}${
                      petAiChatBgPreset === o.id ? ' settings-ai-bg-swatch--active' : ''
                    }`}
                    onClick={() => setPetAiChatBgPreset(o.id)}
                  />
                ))}
              </div>
              <p className="settings-sub" style={{ marginTop: 8, marginBottom: 0 }}>
                选中后需点击下方「保存设置」才会写入并同步到 AI 对话窗口。
              </p>
            </div>
          ) : null}
          {petAiChatBgKind === 'image' || petAiChatBgKind === 'image-fill' ? (
            <div className="settings-field">
              <span>本地图片</span>
              <div className="settings-ai-bg-actions">
                <button type="button" className="settings-secondary" onClick={() => void onPickAiChatBgImage()}>
                  选择本地图片…
                </button>
                {petAiChatBgImageRel ? (
                  <button type="button" className="settings-secondary" onClick={() => void onClearAiChatBgImage()}>
                    移除自定义图片
                  </button>
                ) : null}
              </div>
              {petAiChatBgImageUrl ? (
                <>
                  <img className="settings-ai-bg-preview" src={petAiChatBgImageUrl} alt="当前自定义背景预览" />
                  <p className="settings-sub" style={{ marginTop: 8, marginBottom: 0 }}>
                    {petAiChatBgKind === 'image' ? '平铺模式：图片会像瓷砖一样重复排列。' : '填充模式：图片会拉伸变形以填满整个窗口。'}
                  </p>
                </>
              ) : (
                <p className="settings-sub" style={{ marginTop: 8, marginBottom: 0 }}>
                  选择图片后会立即保存并生效；支持 png / jpg / webp / gif，最大约 12MB。
                </p>
              )}
            </div>
          ) : null}
        </div>
      </section>

      <section className="settings-card">
        <h2 className="settings-title">AI 对话（API）</h2>
        <p className="settings-sub">
          已配置为火山引擎 Ark API。当前使用硬编码配置，不支持在设置中修改。
        </p>
        <div className="settings-form">
          <label className="settings-field">
            <span>对话接口 URL（已固定）</span>
            <input
              value={llmChatUrl}
              disabled
              readOnly
              style={{ backgroundColor: '#f5f5f5', color: '#666' }}
            />
          </label>
          <label className="settings-field">
            <span>模型名 model（已固定）</span>
            <input
              value={llmModel}
              disabled
              readOnly
              style={{ backgroundColor: '#f5f5f5', color: '#666' }}
            />
          </label>
          <label className="settings-field">
            <span>API 密钥（Bearer）{hasOpenAiKey ? '（已保存，留空不改）' : ''}</span>
            <input
              type="password"
              autoComplete="off"
              value={openAiKeyDraft}
              onChange={(e) => {
                setOpenAiKeyDraft(e.target.value)
                setClearOpenAiKey(false)
              }}
              placeholder={hasOpenAiKey ? '输入新密钥以替换' : 'sk-…'}
            />
          </label>
          {hasOpenAiKey ? (
            <button
              type="button"
              className="settings-secondary"
              onClick={() => {
                setClearOpenAiKey(true)
                setOpenAiKeyDraft('')
              }}
            >
              {clearOpenAiKey ? '已标记清除，请点下方「保存设置」' : '清除已保存的密钥（保存后生效）'}
            </button>
          ) : null}
        </div>
      </section>

      <section className="settings-card">
        <h2 className="settings-title">自定义气泡语句</h2>
        <p className="settings-sub">为空时使用默认文案。保存后会实时应用到宠物气泡。</p>
        <div className="settings-form">
        <label className="settings-field">
            <span>休息中（rest）</span>
            <input
              value={bubbleTexts.rest}
              maxLength={120}
              onChange={(e) => setBubbleTexts((p) => ({ ...p, rest: e.target.value }))}
              placeholder="例如：喝口水，放松一下眼睛"
            />
          </label>
          <label className="settings-field">
            <span>工作中（work）</span>
            <input
              value={bubbleTexts.work}
              maxLength={120}
              onChange={(e) => setBubbleTexts((p) => ({ ...p, work: e.target.value }))}
              placeholder="例如：继续保持专注，今天也很棒"
            />
          </label>
          <label className="settings-field">
            <span>提醒（remind）</span>
            <input
              value={bubbleTexts.remind}
              maxLength={120}
              onChange={(e) => setBubbleTexts((p) => ({ ...p, remind: e.target.value }))}
              placeholder="例如：已经很久啦，记得站起来活动活动"
            />
          </label>
          <label className="settings-field">
            <span>报警（long-work）</span>
            <input
              value={bubbleTexts['long-work']}
              maxLength={120}
              onChange={(e) => setBubbleTexts((p) => ({ ...p, 'long-work': e.target.value }))}
              placeholder="例如：高强度持续过久，请立即休息"
            />
          </label>
        </div>
      </section>

      <section className="settings-card">
        <h2 className="settings-title">形态切换时间阈值</h2>
        <p className="settings-sub">持续使用达到这些时间后，会切换宠物形态（单位：分钟）。</p>
        <div className="settings-form">
          <label className="settings-field">
            <span>提醒阈值（分钟，&gt;=进入 remind）</span>
            <input
              type="number"
              min={0}
              step={1}
              value={remindContinuousMins}
              onChange={(e) => setRemindContinuousMins(Number(e.target.value))}
            />
          </label>

          <label className="settings-field">
            <span>警告阈值（分钟，&gt;=进入 long-work）</span>
            <input
              type="number"
              min={0}
              step={1}
              value={longWorkContinuousMins}
              onChange={(e) => setLongWorkContinuousMins(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="settings-actions">
          <button type="button" className="settings-save" disabled={busy} onClick={onSave}>
            {busy ? '保存中…' : '保存设置'}
          </button>
          {msg ? <span className="settings-msg">{msg}</span> : null}
        </div>
      </section>

      {/* 账号与同步 */}
      <AccountSection />
    </main>
  )
}

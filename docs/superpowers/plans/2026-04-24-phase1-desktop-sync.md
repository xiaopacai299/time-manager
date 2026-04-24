# Phase 1 桌面端同步接入实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在桌面端（Electron + React）接入多端同步层，实现登录/注册/登出、时间追踪数据自动推送到服务端、应用启动时拉取最新数据，以及设置页账号分区。

**Architecture:** 桌面端新增 `src/sync/` 层（旁挂，最小改动现有代码）。Electron 主进程负责管理 auth tokens（`safeStorage` 加密）和 sync 状态文件（`userData/sync-state.json`），通过 IPC 暴露给渲染进程。渲染进程的 `SyncProvider.jsx` 在 React 树中提供同步上下文，自动触发同步；`SettingsWindowApp.jsx` 新增账号分区。

**Tech Stack:** Electron `safeStorage`，Node.js `fs`，`ipcMain/ipcRenderer`，React Context，`@time-manger/shared`（SyncEngine, LWW, zod schemas），browser `fetch`

---

## 文件结构

**新建：**

- `packages/desktop/src/sync/authStore.js` — 渲染层 auth 状态工具（通过 IPC 读写 safeStorage）
- `packages/desktop/src/sync/ApiClient.js` — 封装 fetch 调用后端 API
- `packages/desktop/src/sync/LocalStore.desktop.js` — 实现 shared `LocalStore` 接口（通过 IPC 读写 sync-state.json）
- `packages/desktop/src/sync/SyncProvider.jsx` — React Context，自动触发同步，管理同步状态
- `packages/desktop/src/sync/useSyncStatus.js` — 读取 SyncProvider 状态的 hook

**修改：**

- `packages/desktop/electron-main.js` — 新增 sync IPC handlers（auth tokens + sync state）；在 `monitor.on('update')` 回调中更新 dirty records
- `packages/desktop/preload.cjs` — 新增 `timeManagerAPI.sync.*` 桥接
- `packages/desktop/src/main.jsx` — 根组件包裹 `<SyncProvider>`
- `packages/desktop/src/SettingsWindowApp.jsx` — 新增"账号"Tab

---

## Task 1: electron-main.js — 同步 IPC 处理器

**Files:**
- Modify: `packages/desktop/electron-main.js`

### 1A. 添加 safeStorage 导入和 token 读写工具

- [ ] **Step 1: 在文件顶部 import 中添加 `safeStorage`**

找到文件顶部 `import { app, BrowserWindow, ... } from 'electron';` 这一行，加入 `safeStorage`：

```javascript
// 现有代码（只加 safeStorage，其他字段不变）
import { app, BrowserWindow, ipcMain, dialog, screen, shell, globalShortcut,
  Menu, Tray, nativeImage, powerMonitor, Notification, safeStorage } from 'electron';
```

- [ ] **Step 2: 在 `getStateFilePath()` 函数下方添加 token 文件工具函数**

在第 655 行 `getStateFilePath()` 之后、`loadPetState()` 之前插入：

```javascript
/** sync-tokens 文件路径（safeStorage 加密后的二进制 JSON） */
function getSyncTokensPath() {
  return path.join(app.getPath('userData'), 'sync-tokens.bin');
}

/** sync-state 文件路径（非敏感，明文 JSON） */
function getSyncStatePath() {
  return path.join(app.getPath('userData'), 'sync-state.json');
}

/** 从加密文件读取 auth tokens；失败返回 null */
function readSyncTokens() {
  try {
    if (!fs.existsSync(getSyncTokensPath())) return null;
    const encrypted = fs.readFileSync(getSyncTokensPath());
    const json = safeStorage.decryptString(encrypted);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

/** 将 auth tokens 加密写入文件 */
function writeSyncTokens(data) {
  try {
    const json = JSON.stringify(data);
    const encrypted = safeStorage.encryptString(json);
    fs.writeFileSync(getSyncTokensPath(), encrypted);
  } catch (err) {
    console.error('[sync] Failed to write tokens:', err);
  }
}

/** 读取 sync-state（lastSyncAt, dirty, stableIds, deviceId）；失败返回默认值 */
function readSyncState() {
  try {
    if (!fs.existsSync(getSyncStatePath())) return defaultSyncState();
    const raw = fs.readFileSync(getSyncStatePath(), 'utf8');
    return { ...defaultSyncState(), ...JSON.parse(raw) };
  } catch {
    return defaultSyncState();
  }
}

function defaultSyncState() {
  return {
    deviceId: null,
    lastSyncAt: {},
    dirty: { 'time-records': {} },
    stableIds: {},
  };
}

/** 持久化 sync-state */
function writeSyncState(state) {
  try {
    fs.writeFileSync(getSyncStatePath(), JSON.stringify(state, null, 2), 'utf8');
  } catch (err) {
    console.error('[sync] Failed to write sync state:', err);
  }
}
```

- [ ] **Step 3: 添加 `updateDirtyTimeRecords(snapshot)` 函数**

在 `writeSyncState()` 下方插入（在 `persistPetState()` 之前）：

```javascript
/**
 * 将当前快照中的 perAppToday 写入 dirty queue。
 * snapshot.perAppToday: Array<{ appId, processName, durationMs, windowTitle }>
 * snapshot.dayKey: "2026-04-24"
 */
function updateDirtyTimeRecords(snapshot) {
  try {
    const { perAppToday = [], dayKey } = snapshot;
    if (!dayKey || !perAppToday.length) return;
    const state = readSyncState();
    const tokens = readSyncTokens();
    const deviceId = state.deviceId || 'offline';
    const now = new Date().toISOString();
    for (const app of perAppToday) {
      const appKey = String(app.appId || '').trim();
      if (!appKey) continue;
      const stableKey = `${dayKey}|${appKey}`;
      if (!state.stableIds[stableKey]) {
        state.stableIds[stableKey] = generateSyncUUID();
      }
      const id = state.stableIds[stableKey];
      state.dirty['time-records'] = state.dirty['time-records'] || {};
      state.dirty['time-records'][id] = {
        id,
        date: dayKey,
        appKey,
        appName: String(app.processName || app.appId || appKey),
        durationMs: Math.round(Number(app.durationMs) || 0),
        updatedAt: now,
        deletedAt: null,
        clientDeviceId: deviceId,
      };
    }
    writeSyncState(state);
  } catch (err) {
    console.error('[sync] updateDirtyTimeRecords error:', err);
  }
}

function generateSyncUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

### 1B. 注册 sync IPC handlers

- [ ] **Step 4: 在 diary password handlers 之后（约第 1750 行）添加 sync handlers**

在 `ipcMain.handle('diary:remove-password', ...)` 结束的 `});` 之后插入：

```javascript
  // ── 同步层 IPC ──────────────────────────────────────────────
  ipcMain.handle('sync:getAuthState', () => {
    return readSyncTokens();
  });

  ipcMain.handle('sync:saveAuthState', (_event, data) => {
    const { accessToken, refreshToken, userId, email, apiBase, deviceId } = data;
    writeSyncTokens({ accessToken, refreshToken, userId, email, apiBase });
    // deviceId 存在 sync-state（不敏感）
    if (deviceId) {
      const state = readSyncState();
      state.deviceId = deviceId;
      writeSyncState(state);
    }
    return { ok: true };
  });

  ipcMain.handle('sync:clearAuth', () => {
    try {
      if (fs.existsSync(getSyncTokensPath())) {
        fs.unlinkSync(getSyncTokensPath());
      }
    } catch {}
    return { ok: true };
  });

  ipcMain.handle('sync:getState', () => {
    return readSyncState();
  });

  ipcMain.handle('sync:setState', (_event, partial) => {
    const state = readSyncState();
    if (partial.lastSyncAt !== undefined) {
      state.lastSyncAt = { ...state.lastSyncAt, ...partial.lastSyncAt };
    }
    if (partial.dirty !== undefined) {
      state.dirty = { ...state.dirty, ...partial.dirty };
    }
    if (partial.stableIds !== undefined) {
      state.stableIds = { ...state.stableIds, ...partial.stableIds };
    }
    if (partial.deviceId !== undefined) {
      state.deviceId = partial.deviceId;
    }
    writeSyncState(state);
    return { ok: true };
  });
```

### 1C. 在 monitor.on('update') 中触发 dirty 更新

- [ ] **Step 5: 修改 `monitor.on('update', ...)` 回调，加入 dirty 更新**

找到（约第 1816 行）：

```javascript
    monitor.on('update', (payload) => {
      // 给宠物窗口发IPC事件
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('time-stats:update', payload);
      }
      // 给统计窗口发IPC事件
      if (statsWindow && !statsWindow.isDestroyed()) {
        statsWindow.webContents.send('time-stats:update', payload);
      }
    });
```

改为：

```javascript
    monitor.on('update', (payload) => {
      // 给宠物窗口发IPC事件
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('time-stats:update', payload);
      }
      // 给统计窗口发IPC事件
      if (statsWindow && !statsWindow.isDestroyed()) {
        statsWindow.webContents.send('time-stats:update', payload);
      }
      // 将最新快照写入 dirty queue（每次采样约 1 秒一次，函数内部直接覆盖，开销极低）
      updateDirtyTimeRecords(payload);
    });
```

- [ ] **Step 6: 验证 electron-main.js 语法正常（无启动报错）**

```bash
cd packages/desktop
node --check electron-main.js
```

Expected: 无错误输出

- [ ] **Step 7: Commit**

```bash
git add packages/desktop/electron-main.js
git commit -m "feat(desktop): add sync IPC handlers and dirty time-records tracking"
```

---

## Task 2: preload.cjs — 添加 sync 桥接

**Files:**
- Modify: `packages/desktop/preload.cjs`

- [ ] **Step 1: 在 `contextBridge.exposeInMainWorld('timeManagerAPI', { ... })` 对象末尾添加 `sync` 命名空间**

找到 preload.cjs 末尾（`timeManagerAPI` 对象的最后一个属性之后、`});` 之前）插入：

```javascript
  /**
   * 同步层 IPC 桥接
   */
  sync: {
    getAuthState: () => ipcRenderer.invoke('sync:getAuthState'),
    saveAuthState: (data) => ipcRenderer.invoke('sync:saveAuthState', data),
    clearAuth: () => ipcRenderer.invoke('sync:clearAuth'),
    getState: () => ipcRenderer.invoke('sync:getState'),
    setState: (partial) => ipcRenderer.invoke('sync:setState', partial),
  },
```

- [ ] **Step 2: 验证 preload.cjs 语法**

```bash
node --check packages/desktop/preload.cjs
```

Expected: 无错误

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/preload.cjs
git commit -m "feat(desktop/preload): expose sync IPC bridge"
```

---

## Task 3: src/sync/authStore.js — 渲染层 auth 工具

**Files:**
- Create: `packages/desktop/src/sync/authStore.js`

- [ ] **Step 1: 创建文件**

```javascript
// packages/desktop/src/sync/authStore.js
const api = () => window.timeManagerAPI?.sync;

export async function getAuthState() {
  return api()?.getAuthState() ?? null;
}

export async function saveAuthState({ accessToken, refreshToken, userId, email, apiBase, deviceId }) {
  return api()?.saveAuthState({ accessToken, refreshToken, userId, email, apiBase, deviceId });
}

export async function clearAuthState() {
  return api()?.clearAuth();
}

export function getOrCreateDeviceId() {
  // deviceId 从 sync-state 读取（已在 saveAuthState 写入主进程）
  // 此函数仅为 ApiClient 提供同步值（渲染层启动时已缓存）
  return _cachedDeviceId;
}

let _cachedDeviceId = null;

/** 应用启动时调用一次，从主进程读取并缓存 deviceId */
export async function initDeviceId() {
  const state = await api()?.getState();
  if (state?.deviceId) {
    _cachedDeviceId = state.deviceId;
    return state.deviceId;
  }
  // 首次：生成新 deviceId，存入主进程 sync-state
  const newId = generateUUID();
  _cachedDeviceId = newId;
  await api()?.setState({ deviceId: newId });
  return newId;
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/desktop/src/sync/authStore.js
git commit -m "feat(desktop/sync): add authStore for IPC-backed auth state"
```

---

## Task 4: src/sync/ApiClient.js — HTTP 客户端

**Files:**
- Create: `packages/desktop/src/sync/ApiClient.js`

- [ ] **Step 1: 创建文件**

```javascript
// packages/desktop/src/sync/ApiClient.js

export class ApiClient {
  constructor(apiBase, getAccessToken, deviceId) {
    this.apiBase = apiBase;
    this.getAccessToken = getAccessToken; // () => string | null
    this.deviceId = deviceId;
  }

  async _request(path, options = {}) {
    const token = this.getAccessToken();
    const headers = {
      'Content-Type': 'application/json',
      'X-Device-Id': this.deviceId,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };
    const res = await fetch(`${this.apiBase}${path}`, {
      ...options,
      headers,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.error?.message ?? res.statusText;
      throw new Error(`API ${res.status}: ${msg}`);
    }
    return res.json();
  }

  async register(email, password, platform = 'desktop', deviceName = 'desktop') {
    return this._request('/api/v1/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, platform, deviceName }),
    });
  }

  async login(email, password, platform = 'desktop', deviceName = 'desktop') {
    return this._request('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password, platform, deviceName }),
    });
  }

  async refreshToken(refreshToken) {
    return this._request('/api/v1/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async logout(refreshToken) {
    return this._request('/api/v1/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refreshToken }),
    });
  }

  async me() {
    return this._request('/api/v1/auth/me');
  }

  async pull(resource, since, cursor) {
    const params = new URLSearchParams();
    if (since) params.set('since', since);
    if (cursor) params.set('cursor', cursor);
    const qs = params.toString();
    return this._request(`/api/v1/sync/${resource}${qs ? `?${qs}` : ''}`);
  }

  async push(resource, deviceId, records) {
    return this._request(`/api/v1/sync/${resource}`, {
      method: 'POST',
      body: JSON.stringify({ deviceId, records }),
    });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/desktop/src/sync/ApiClient.js
git commit -m "feat(desktop/sync): add HTTP ApiClient for backend calls"
```

---

## Task 5: src/sync/LocalStore.desktop.js — 本地存储适配器

**Files:**
- Create: `packages/desktop/src/sync/LocalStore.desktop.js`

`LocalStore` 接口来自 `@time-manger/shared`，与 `SyncEngine` 对接：

```typescript
interface LocalStore {
  getLastSyncAt(resource: string): Promise<string | null>;
  setLastSyncAt(resource: string, serverTime: string): Promise<void>;
  getDirtyRecords<T>(resource: string): Promise<T[]>;
  upsertRemote<T>(resource: string, records: T[]): Promise<void>;
  markClean(resource: string, ids: string[]): Promise<void>;
}
```

- [ ] **Step 1: 创建文件**

```javascript
// packages/desktop/src/sync/LocalStore.desktop.js

const ipc = () => window.timeManagerAPI?.sync;

export class DesktopLocalStore {
  async getLastSyncAt(resource) {
    const state = await ipc()?.getState();
    return state?.lastSyncAt?.[resource] ?? null;
  }

  async setLastSyncAt(resource, serverTime) {
    await ipc()?.setState({ lastSyncAt: { [resource]: serverTime } });
  }

  async getDirtyRecords(resource) {
    const state = await ipc()?.getState();
    const bucket = state?.dirty?.[resource] ?? {};
    return Object.values(bucket);
  }

  /**
   * 桌面端时间追踪是"单向产出"，拉取到的远端数据对本地显示无影响（Phase 1）。
   * 这里仅做日志记录，不写入 petState。
   */
  async upsertRemote(resource, records) {
    if (records.length > 0) {
      console.debug(`[sync] upsertRemote ${resource}: ${records.length} records (desktop read-only for pull)`);
    }
  }

  async markClean(resource, ids) {
    const state = await ipc()?.getState();
    const bucket = { ...(state?.dirty?.[resource] ?? {}) };
    for (const id of ids) {
      delete bucket[id];
    }
    await ipc()?.setState({ dirty: { [resource]: bucket } });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/desktop/src/sync/LocalStore.desktop.js
git commit -m "feat(desktop/sync): implement DesktopLocalStore backed by IPC sync-state"
```

---

## Task 6: SyncProvider.jsx + useSyncStatus.js

**Files:**
- Create: `packages/desktop/src/sync/SyncProvider.jsx`
- Create: `packages/desktop/src/sync/useSyncStatus.js`

### 6A. SyncProvider.jsx

- [ ] **Step 1: 创建 SyncProvider.jsx**

```jsx
// packages/desktop/src/sync/SyncProvider.jsx
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { SyncEngine } from '@time-manger/shared';
import { ApiClient } from './ApiClient.js';
import { DesktopLocalStore } from './LocalStore.desktop.js';
import { getAuthState, initDeviceId } from './authStore.js';

// 同步触发间隔（毫秒）
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟
const DEBOUNCE_AFTER_WRITE_MS = 30 * 1000; // 30 秒

const RESOURCES = ['time-records'];

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const [status, setStatus] = useState('idle'); // 'idle'|'syncing'|'error'|'unauthenticated'
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [error, setError] = useState(null);
  const [authState, setAuthState] = useState(null);
  const engineRef = useRef(null);

  // 初始化：读取 auth 状态
  useEffect(() => {
    let mounted = true;
    async function init() {
      await initDeviceId();
      const auth = await getAuthState();
      if (!mounted) return;
      setAuthState(auth);
    }
    void init();
    return () => { mounted = false; };
  }, []);

  // 构建/重建 SyncEngine（当 authState 变化时）
  useEffect(() => {
    if (!authState?.accessToken || !authState?.apiBase || !authState?.deviceId) {
      engineRef.current = null;
      setStatus('unauthenticated');
      return;
    }
    let currentToken = authState.accessToken;
    const store = new DesktopLocalStore();
    const client = new ApiClient(
      authState.apiBase,
      () => currentToken,
      authState.deviceId,
    );
    engineRef.current = new SyncEngine(store, client, authState.deviceId);
    // 启动后立即同步一次
    void triggerSync();
  }, [authState]);

  async function triggerSync() {
    if (!engineRef.current) return;
    if (status === 'syncing') return;
    setStatus('syncing');
    setError(null);
    try {
      await engineRef.current.syncAll(RESOURCES);
      setLastSyncAt(new Date().toLocaleTimeString('zh-CN'));
      setStatus('idle');
    } catch (e) {
      console.warn('[sync] syncAll failed:', e);
      setError(e instanceof Error ? e.message : '同步失败');
      setStatus('error');
    }
  }

  // 定时同步（5 分钟）
  useEffect(() => {
    if (!authState?.accessToken) return undefined;
    const timer = setInterval(() => void triggerSync(), SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [authState]);

  const value = {
    status,
    lastSyncAt,
    error,
    authState,
    setAuthState,
    triggerSync,
  };

  return (
    <SyncContext.Provider value={value}>
      {children}
    </SyncContext.Provider>
  );
}

export function useSyncContext() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncContext must be used inside SyncProvider');
  return ctx;
}
```

### 6B. useSyncStatus.js

- [ ] **Step 2: 创建 useSyncStatus.js**

```javascript
// packages/desktop/src/sync/useSyncStatus.js
import { useSyncContext } from './SyncProvider.jsx';

/**
 * 返回只读同步状态，供 UI 显示。
 * { status, lastSyncAt, error }
 */
export function useSyncStatus() {
  const { status, lastSyncAt, error } = useSyncContext();
  return { status, lastSyncAt, error };
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src/sync/
git commit -m "feat(desktop/sync): add SyncProvider, useSyncStatus"
```

---

## Task 7: main.jsx — 包裹 SyncProvider

**Files:**
- Modify: `packages/desktop/src/main.jsx`

- [ ] **Step 1: 在 main.jsx 顶部添加 SyncProvider 导入**

找到 main.jsx 末尾的 `createRoot(root).render(` 之前，在顶部现有 import 之后插入：

```javascript
import { SyncProvider } from './sync/SyncProvider.jsx'
```

- [ ] **Step 2: 在 `createRoot(root).render(...)` 中，用 `<SyncProvider>` 包裹整个 `<StrictMode>` 内容**

现有：
```jsx
createRoot(root).render(
  <StrictMode>
    {isStatsWindow ? (
      <StatsWindowApp />
    ) : ...}
  </StrictMode>,
)
```

改为：
```jsx
createRoot(root).render(
  <StrictMode>
    <SyncProvider>
      {isStatsWindow ? (
        <StatsWindowApp />
      ) : isFavoritesWindow ? (
        <FavoritesWindowApp />
      ) : isWorklistExportWindow ? (
        <WorklistExportApp />
      ) : isWorklistWindow ? (
        <WorkListWindowApp />
      ) : isEstimateConfirmWindow ? (
        <WorklistEstimateConfirmApp />
      ) : isSettingsWindow ? (
        <SettingsWindowApp />
      ) : isReaderWindow ? (
        <ReaderWindowApp />
      ) : isPetAiChatWindow ? (
        <PetAiChatWindowApp />
      ) : isDiaryWindow ? (
        <DiaryWindowApp />
      ) : (
        <App />
      )}
    </SyncProvider>
  </StrictMode>,
)
```

- [ ] **Step 3: Commit**

```bash
git add packages/desktop/src/main.jsx
git commit -m "feat(desktop): wrap app with SyncProvider"
```

---

## Task 8: SettingsWindowApp.jsx — 账号/同步分区

**Files:**
- Modify: `packages/desktop/src/SettingsWindowApp.jsx`

### 8A. 添加导入

- [ ] **Step 1: 在 SettingsWindowApp.jsx 顶部现有 import 之后添加**

```javascript
import { useSyncContext } from './sync/SyncProvider.jsx'
import { getAuthState, saveAuthState, clearAuthState } from './sync/authStore.js'
import { ApiClient } from './sync/ApiClient.js'
import { initDeviceId } from './sync/authStore.js'
```

### 8B. 添加 AccountSection 子组件

- [ ] **Step 2: 在 `SettingsWindowApp` 组件函数定义之前，添加 `AccountSection` 子组件**

```jsx
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
      setAuthState({ ...data, apiBase, deviceId })
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
          同步状态：{status === 'syncing' ? '同步中…' : status === 'error' ? `错误：${error}` : '就绪'}
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
            className="settings-btn settings-btn--danger"
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
          className={`settings-tab-btn${tab === 'login' ? ' active' : ''}`}
          onClick={() => setTab('login')}
        >登录</button>
        <button
          className={`settings-tab-btn${tab === 'register' ? ' active' : ''}`}
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
```

### 8C. 在主组件 JSX 末尾插入 AccountSection

- [ ] **Step 3: 找到 `SettingsWindowApp` 返回 JSX 中"日记密码"区块结束处，添加 `<AccountSection />`**

在现有设置内容（宠物选择、API 密钥、日记密码等）的 `</div>` 之前，添加：

```jsx
        {/* 账号与同步 */}
        <AccountSection />
```

- [ ] **Step 4: 验证设置页能正常渲染（手动启动应用，打开设置页）**

```bash
cd packages/desktop
pnpm electron-start
```

Expected: 设置页底部出现"账号与同步"区块，显示登录/注册表单

- [ ] **Step 5: Commit**

```bash
git add packages/desktop/src/SettingsWindowApp.jsx
git commit -m "feat(desktop/settings): add account/sync section with login, logout, sync status"
```

---

## Task 9: 端到端验证

**Goal:** 确认桌面端能成功登录、自动 push 时间追踪数据、移动端 pull 能看到数据。

- [ ] **Step 1: 启动本地后端（需要本地 Postgres）**

```bash
cd packages/server
# 确保 .env 配置了 DATABASE_URL
pnpm prisma migrate deploy
pnpm dev
```

Expected: 服务器在 `http://localhost:3000` 启动，`GET /health` 返回 200

- [ ] **Step 2: 启动桌面端**

```bash
pnpm desktop:dev
```

- [ ] **Step 3: 在设置页注册账号**

打开设置 → 账号与同步 → 注册 tab → 填写邮箱密码 → 点注册

Expected: 显示"注册成功！"，切换到已登录状态

- [ ] **Step 4: 验证自动同步触发**

等待 30 秒后，同步状态显示"上次同步：XX:XX:XX"（而非"就绪"且无时间）

- [ ] **Step 5: 验证数据推送到服务端**

```bash
curl -H "Authorization: Bearer <accessToken>" \
     -H "X-Device-Id: <deviceId>" \
     "http://localhost:3000/api/v1/sync/time-records"
```

Expected: `records` 数组包含桌面端产生的时间记录

- [ ] **Step 6: 移动端登录并拉取数据**

在 Android 模拟器中，打开移动端 App → 输入同一账号 → 登录 → 下拉刷新

Expected: HomeScreen 显示今日时间追踪数据

- [ ] **Step 7: Commit（如有剩余改动）**

```bash
git add -A
git commit -m "feat: Phase 1 desktop sync integration complete"
```

---

## 自检：Spec 覆盖

| Spec 要求 | 任务 |
|-----------|------|
| 设置页"账号"分区：注册/登录/登出 | Task 8 |
| 时间追踪数据产生后自动 push（防抖 30s） | Task 1C（monitor.on update）+ SyncProvider 定时 |
| 启动时 pull | Task 6（SyncProvider useEffect） |
| "同步状态指示" UI | Task 8C（status display） |
| token 存 safeStorage（DPAPI/Keychain） | Task 1A（writeSyncTokens/readSyncTokens） |
| deviceId 持久化（sync-state.json） | Task 1A + Task 3 initDeviceId |
| SyncEngine 来自 shared | Task 6（import SyncEngine） |
| LocalStore 接口实现 | Task 5 |
| ApiClient 包装 fetch | Task 4 |
| 登录非强制（不登录照常工作） | SyncProvider status='unauthenticated'，不影响宠物功能 |

**Server 集成测试缺口**（后续快速补充，不阻塞本次计划）：
- 同邮箱二次注册 → 409
- 密码错误 → 401，不暴露用户是否存在  
- pull 分页 limit=2，第 3 条在第 2 页
- push 500+ 条拒绝（zod max 500 验证）

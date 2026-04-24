// packages/desktop/src/sync/SyncProvider.jsx
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { SyncEngine } from '@time-manger/shared';
import { ApiClient } from './ApiClient.js';
import { DesktopLocalStore } from './LocalStore.desktop.js';
import { getAuthState, initDeviceId } from './authStore.js';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 分钟
const RESOURCES = ['time-records'];

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const [status, setStatus] = useState('idle'); // 'idle'|'syncing'|'error'|'unauthenticated'
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [error, setError] = useState(null);
  const [authState, setAuthState] = useState(null);
  const engineRef = useRef(null);
  const syncingRef = useRef(false); // 防止并发同步

  const triggerSync = useCallback(async () => {
    if (!engineRef.current) return;
    if (syncingRef.current) return;
    syncingRef.current = true;
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
    } finally {
      syncingRef.current = false;
    }
  }, []);

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
    const currentToken = authState.accessToken;
    const store = new DesktopLocalStore();
    const client = new ApiClient(
      authState.apiBase,
      () => currentToken,
      authState.deviceId,
    );
    engineRef.current = new SyncEngine(store, client, authState.deviceId);
    // 构建完成后立即同步一次
    void triggerSync();
  }, [authState, triggerSync]);

  // 定时同步（5 分钟）
  useEffect(() => {
    if (!authState?.accessToken) return undefined;
    const timer = setInterval(() => void triggerSync(), SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [authState, triggerSync]);

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

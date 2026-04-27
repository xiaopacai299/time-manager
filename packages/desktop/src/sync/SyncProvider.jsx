// packages/desktop/src/sync/SyncProvider.jsx
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { SyncEngine } from '@time-manger/shared';
import { ApiClient } from './ApiClient.js';
import { DesktopLocalStore } from './LocalStore.desktop.js';
import { getAuthState, initDeviceId, saveAuthState } from './authStore.js';

const SYNC_REQUEST_DEBOUNCE_MS = 400;
const RESOURCES = ['time-records', 'diaries', 'worklist-items'];

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const [status, setStatus] = useState('idle'); // 'idle'|'syncing'|'error'|'unauthenticated'
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [error, setError] = useState(null);
  const [authState, setAuthState] = useState(null);
  const engineRef = useRef(null);
  const authStateRef = useRef(null);
  const syncingRef = useRef(false); // 防止并发同步
  const syncRequestTimerRef = useRef(null);

  useEffect(() => {
    authStateRef.current = authState;
  }, [authState]);

  const triggerSync = useCallback(async () => {
    if (!engineRef.current) return;
    if (syncingRef.current) return;
    syncingRef.current = true;
    setStatus('syncing');
    setError(null);
    try {
      // 执行真正的同步逻辑，将数据传送到服务端
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
      const deviceId = await initDeviceId();
      const auth = await getAuthState();
      if (!mounted) return;
      setAuthState(auth ? { ...auth, deviceId } : null);
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
    const store = new DesktopLocalStore();
    // 配置的一套会自动处理鉴权和续期的HTTP客户端
    const client = new ApiClient(
      authState.apiBase,
      () => authStateRef.current?.accessToken ?? null,
      authState.deviceId,
      {
        getRefreshToken: () => authStateRef.current?.refreshToken ?? null,
        onAccessTokenRefreshed: async (accessToken) => {
          const current = authStateRef.current;
          if (!current) return;
          const next = { ...current, accessToken };
          authStateRef.current = next;
          setAuthState(next);
          await saveAuthState(next);
        },
      },
    );
    engineRef.current = new SyncEngine(store, client, authState.deviceId);
    // 构建完成后立即同步一次
    void triggerSync();
  }, [authState, triggerSync]);

  // 事件驱动同步：本地数据变更后主进程会广播 sync:request ******
  // 监听主进程sync:request，然后调用triggerSync()
  useEffect(() => {
    if (!authState?.accessToken) return undefined;
    const off = window.timeManagerAPI?.sync?.onRequest?.(() => {
      if (syncRequestTimerRef.current) {
        clearTimeout(syncRequestTimerRef.current);
      }
      syncRequestTimerRef.current = setTimeout(() => {
        syncRequestTimerRef.current = null;
        void triggerSync();
      }, SYNC_REQUEST_DEBOUNCE_MS);
    });
    return () => {
      if (syncRequestTimerRef.current) {
        clearTimeout(syncRequestTimerRef.current);
        syncRequestTimerRef.current = null;
      }
      if (typeof off === 'function') off();
    };
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

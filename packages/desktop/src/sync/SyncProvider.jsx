// packages/desktop/src/sync/SyncProvider.jsx
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { SyncEngine } from '@time-manger/shared';
import { ApiClient } from './ApiClient.js';
import { DesktopLocalStore } from './LocalStore.desktop.js';
import { getAuthState, initDeviceId, saveAuthState } from './authStore.js';
import {
  mergeSyncRequestTargets,
  resolveSyncResourceList,
} from './syncResources.js';

const SYNC_REQUEST_DEBOUNCE_MS = 400;

const SyncContext = createContext(null);

export function SyncProvider({ children }) {
  const [status, setStatus] = useState('idle'); // 'idle'|'syncing'|'error'|'unauthenticated'
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [error, setError] = useState(null);
  const [authState, setAuthState] = useState(null);
  const engineRef = useRef(null);
  const authStateRef = useRef(null);
  const syncingRef = useRef(false);
  const syncRequestTimerRef = useRef(null);
  const pendingSyncFullRef = useRef(false);
  const pendingSyncPartialRef = useRef(new Set());

  useEffect(() => {
    authStateRef.current = authState;
  }, [authState]);

  /**
   * @param {string[] | null | undefined} targetResources null/undefined = 全量同步
   */
  const triggerSync = useCallback(async (targetResources) => {
    if (!engineRef.current) return;
    if (syncingRef.current) return;
    const resources = resolveSyncResourceList(targetResources);
    syncingRef.current = true;
    setStatus('syncing');
    setError(null);
    try {
      for (const resource of resources) {
        await engineRef.current.syncResource(resource);
      }
      setLastSyncAt(new Date().toLocaleTimeString('zh-CN'));
      setStatus('idle');
    } catch (e) {
      console.warn('[sync] sync failed:', e);
      setError(e instanceof Error ? e.message : '同步失败');
      setStatus('error');
    } finally {
      syncingRef.current = false;
    }
  }, []);

  const scheduleSyncFromRequest = useCallback(
    (payload) => {
      const merged = mergeSyncRequestTargets(
        pendingSyncFullRef.current,
        pendingSyncPartialRef.current,
        payload?.resources,
      );
      pendingSyncFullRef.current = merged.full;
      pendingSyncPartialRef.current = merged.partial;

      if (syncRequestTimerRef.current) {
        clearTimeout(syncRequestTimerRef.current);
      }
      syncRequestTimerRef.current = setTimeout(() => {
        syncRequestTimerRef.current = null;
        const runFull = pendingSyncFullRef.current;
        const partial = [...pendingSyncPartialRef.current];
        pendingSyncFullRef.current = false;
        pendingSyncPartialRef.current = new Set();
        if (runFull) {
          void triggerSync(null);
        } else if (partial.length) {
          void triggerSync(partial);
        }
      }, SYNC_REQUEST_DEBOUNCE_MS);
    },
    [triggerSync],
  );

  useEffect(() => {
    let mounted = true;
    async function init() {
      const deviceId = await initDeviceId();
      const auth = await getAuthState();
      if (!mounted) return;
      setAuthState(auth ? { ...auth, deviceId } : null);
    }
    void init();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!authState?.accessToken || !authState?.apiBase || !authState?.deviceId) {
      engineRef.current = null;
      setStatus('unauthenticated');
      return;
    }
    const store = new DesktopLocalStore();
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
    void triggerSync(null);
  }, [authState, triggerSync]);

  useEffect(() => {
    if (!authState?.accessToken) return undefined;
    const off = window.timeManagerAPI?.sync?.onRequest?.((payload) => {
      scheduleSyncFromRequest(payload);
    });
    return () => {
      if (syncRequestTimerRef.current) {
        clearTimeout(syncRequestTimerRef.current);
        syncRequestTimerRef.current = null;
      }
      pendingSyncFullRef.current = false;
      pendingSyncPartialRef.current = new Set();
      if (typeof off === 'function') off();
    };
  }, [authState, scheduleSyncFromRequest]);

  const value = {
    status,
    lastSyncAt,
    error,
    authState,
    setAuthState,
    triggerSync,
  };

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSyncContext() {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error('useSyncContext must be used inside SyncProvider');
  return ctx;
}

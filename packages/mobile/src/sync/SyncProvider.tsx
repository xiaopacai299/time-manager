import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { SyncEngine } from "@time-manger/shared";
import { useAuth } from "../hooks/useAuth";
import { getOrCreateDeviceId } from "../storage/authStore";
import { getSyncDb } from "../storage/syncDb";
import { MobileLocalStore } from "../storage/LocalStore.mobile";

const SYNC_INTERVAL_MS = 5 * 60 * 1000;
const RESOURCES = ["time-records"] as const;

type SyncStatus = "idle" | "syncing" | "error" | "unauthenticated";

type SyncContextValue = {
  status: SyncStatus;
  lastSyncAt: string | null;
  error: string | null;
  /** 每次成功同步后递增，供首页从 SQLite 重新加载列表。 */
  syncTick: number;
  triggerSync: () => Promise<void>;
};

const SyncContext = createContext<SyncContextValue | null>(null);

export function SyncProvider({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const [status, setStatus] = useState<SyncStatus>("idle");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [syncTick, setSyncTick] = useState(0);
  const engineRef = useRef<SyncEngine | null>(null);
  const syncingRef = useRef(false);

  const triggerSync = useCallback(async () => {
    if (!engineRef.current) return;
    if (syncingRef.current) return;
    syncingRef.current = true;
    setStatus("syncing");
    setError(null);
    try {
      await engineRef.current.syncAll([...RESOURCES]);
      setLastSyncAt(new Date().toLocaleTimeString("zh-CN"));
      setStatus("idle");
      setSyncTick((t) => t + 1);
    } catch (e) {
      console.warn("[sync] syncAll failed:", e);
      setError(e instanceof Error ? e.message : "同步失败");
      setStatus("error");
    } finally {
      syncingRef.current = false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function setup() {
      if (auth.status === "loading") return;
      if (auth.status !== "authenticated") {
        engineRef.current = null;
        setStatus("unauthenticated");
        return;
      }
      const db = await getSyncDb();
      if (cancelled) return;
      const deviceId = await getOrCreateDeviceId();
      if (cancelled) return;
      const store = new MobileLocalStore(db);
      engineRef.current = new SyncEngine(store, auth.client, deviceId);
      void triggerSync();
    }
    void setup();
    return () => {
      cancelled = true;
    };
  }, [auth, triggerSync]);

  useEffect(() => {
    if (auth.status !== "authenticated") return undefined;
    const timer = setInterval(() => void triggerSync(), SYNC_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [auth, triggerSync]);

  const value: SyncContextValue = {
    status,
    lastSyncAt,
    error,
    syncTick,
    triggerSync,
  };

  return (
    <SyncContext.Provider value={value}>{children}</SyncContext.Provider>
  );
}

export function useSync(): SyncContextValue {
  const ctx = useContext(SyncContext);
  if (!ctx) throw new Error("useSync must be used within SyncProvider");
  return ctx;
}

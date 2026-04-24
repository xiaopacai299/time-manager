// packages/desktop/src/sync/useSyncStatus.js
import { useSyncContext } from './SyncProvider.jsx';

/**
 * 返回只读同步状态，供 UI 显示。
 * @returns {{ status: string, lastSyncAt: string | null, error: string | null }}
 */
export function useSyncStatus() {
  const { status, lastSyncAt, error } = useSyncContext();
  return { status, lastSyncAt, error };
}

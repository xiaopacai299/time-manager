// packages/desktop/src/sync/LocalStore.desktop.js
/**
 * 实现 @time-manger/shared 的 LocalStore 接口，
 * 通过 window.timeManagerAPI.sync IPC 与主进程的 sync-state.json 交互。
 *
 * LocalStore 接口：
 *   getLastSyncAt(resource): Promise<string | null>
 *   setLastSyncAt(resource, serverTime): Promise<void>
 *   getDirtyRecords(resource): Promise<T[]>
 *   upsertRemote(resource, records): Promise<void>
 *   markClean(resource, ids): Promise<void>
 */

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
   * 桌面端时间追踪是"单向产出"，pull 到的远端数据对本地显示无影响（Phase 1）。
   * 仅做日志记录，不写入 petState。
   */
  async upsertRemote(resource, records) {
    if (resource === 'diaries' || resource === 'worklist-items') {
      await ipc()?.applyRemoteRecords(resource, records);
      return;
    }
    if (records.length > 0) {
      console.debug(`[sync] upsertRemote ${resource}: ${records.length} records (desktop pull, read-only)`);
    }
  }

  async markClean(resource, ids, accepted = []) {
    const acceptedRows = accepted.length
      ? accepted
      : ids.map((id) => ({ id, updatedAt: null }));
    const syncApi = ipc();
    if (typeof syncApi?.markClean === 'function') {
      try {
        await syncApi.markClean(resource, acceptedRows);
        return;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error || '');
        if (!message.includes('No handler registered')) {
          throw error;
        }
      }
    }

    // Dev-only compatibility: the renderer can hot-reload before Electron's main
    // process is restarted with the newer sync:markClean IPC handler.
    const state = await syncApi?.getState();
    const bucket = { ...(state?.dirty?.[resource] ?? {}) };
    for (const item of acceptedRows) {
      const id = String(item?.id || '');
      const updatedAt = item?.updatedAt ? String(item.updatedAt) : null;
      if (id && (!updatedAt || bucket[id]?.updatedAt === updatedAt)) {
        delete bucket[id];
      }
    }
    await syncApi?.setState({ dirty: { [resource]: bucket } });
  }
}

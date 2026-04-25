import type { PullResponse, PushResponse } from '../api-contract/sync-envelope.js';

export interface LocalStore {
  getLastSyncAt(resource: string): Promise<string | null>;
  setLastSyncAt(resource: string, serverTime: string): Promise<void>;
  getDirtyRecords<T>(resource: string): Promise<T[]>;
  upsertRemote<T>(resource: string, records: T[]): Promise<void>;
  markClean(
    resource: string,
    ids: string[],
    accepted?: Array<{ id: string; updatedAt: string }>,
  ): Promise<void>;
}

export interface ApiClient {
  pull(
    resource: string,
    since: string | null,
    cursor: string | null,
  ): Promise<PullResponse>;
  push(
    resource: string,
    deviceId: string,
    records: unknown[],
  ): Promise<PushResponse>;
}

export type SyncResult = {
  resource: string;
  pulled: number;
  pushedAccepted: number;
  pushedRejected: number;
  serverTime: string | null;
};

/**
 * 离线优先同步引擎骨架：先 pull 全部分页，再 push 脏数据。
 * 具体资源的序列化/反序列化由 LocalStore / ApiClient 实现侧保证。
 */
export class SyncEngine {
  constructor(
    private readonly store: LocalStore,
    private readonly api: ApiClient,
    private readonly deviceId: string,
  ) {}

  async syncResource(resource: string): Promise<SyncResult> {
    const since = await this.store.getLastSyncAt(resource);
    let cursor: string | null = null;
    let pulled = 0;
    let lastServerTime: string | null = null;

    for (;;) {
      const page = await this.api.pull(resource, since, cursor);
      lastServerTime = page.serverTime;
      const batch = page.records as unknown[];
      pulled += batch.length;
      if (batch.length) {
        await this.store.upsertRemote(resource, batch);
      }
      if (!page.hasMore) break;
      cursor = page.nextCursor;
      if (cursor == null) break;
    }
    if (lastServerTime) {
      await this.store.setLastSyncAt(resource, lastServerTime);
    }

    const dirty = await this.store.getDirtyRecords(resource);
    let pushedAccepted = 0;
    let pushedRejected = 0;
    if (dirty.length) {
      const pushRes = await this.api.push(resource, this.deviceId, dirty);
      pushedAccepted = pushRes.accepted.length;
      pushedRejected = pushRes.rejected.length;
      if (pushRes.accepted.length) {
        await this.store.markClean(
          resource,
          pushRes.accepted.map((a) => a.id),
          pushRes.accepted,
        );
      }
      await this.store.setLastSyncAt(resource, pushRes.serverTime);
      lastServerTime = pushRes.serverTime;
    }

    return {
      resource,
      pulled,
      pushedAccepted,
      pushedRejected,
      serverTime: lastServerTime,
    };
  }

  /** Phase 1 仅 time-records；预留多资源顺序同步。 */
  async syncAll(resources: string[]): Promise<SyncResult[]> {
    const out: SyncResult[] = [];
    for (const r of resources) {
      out.push(await this.syncResource(r));
    }
    return out;
  }
}

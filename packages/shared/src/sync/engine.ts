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

export type SyncResourceOptions = {
  /**
   * 默认 false：先 pull 再 push（离线优先）。
   * true：先 push 再 pull，适合「服务端为准」的客户端，避免 pull 用服务端版本覆盖尚未上传的脏数据。
   */
  pushFirst?: boolean;
};

function parseIsoMs(iso: string | null | undefined): number | null {
  if (iso == null || iso === '') return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? null : t;
}

/** 取较大 ISO 时间（用于同步水位）；任一侧无效则返回另一侧。 */
function maxIsoString(a: string | null, b: string | null): string | null {
  const ma = parseIsoMs(a);
  const mb = parseIsoMs(b);
  if (ma == null) return mb != null ? new Date(mb).toISOString() : null;
  if (mb == null) return new Date(ma).toISOString();
  return new Date(Math.max(ma, mb)).toISOString();
}

function maxUpdatedAtFromRecords(records: unknown[]): string | null {
  let bestMs = -Infinity;
  for (const r of records) {
    if (typeof r !== 'object' || r === null || !('updatedAt' in r)) continue;
    const iso = String((r as { updatedAt: unknown }).updatedAt);
    const t = parseIsoMs(iso);
    if (t != null && t >= bestMs) {
      bestMs = t;
    }
  }
  return bestMs === -Infinity ? null : new Date(bestMs).toISOString();
}

/**
 * 同步引擎：pull 全部分页，再 push 脏数据（或 pushFirst 时顺序相反）。
 * 具体资源的序列化/反序列化由 LocalStore / ApiClient 实现侧保证。
 */
export class SyncEngine {
  constructor(
    private readonly store: LocalStore,
    private readonly api: ApiClient,
    private readonly deviceId: string,
  ) {}

  private async runPullPhase(resource: string): Promise<{
    pulled: number;
    lastServerTime: string | null;
  }> {
    const since = await this.store.getLastSyncAt(resource);
    let cursor: string | null = null;
    let pulled = 0;
    let lastServerTime: string | null = null;
    let maxPulledUpdatedAt: string | null = null;

    for (;;) {
      const page = await this.api.pull(resource, since, cursor);
      lastServerTime = page.serverTime;
      const batch = page.records as unknown[];
      pulled += batch.length;
      const batchMax = maxUpdatedAtFromRecords(batch);
      if (batchMax) {
        maxPulledUpdatedAt = maxIsoString(maxPulledUpdatedAt, batchMax);
      }
      if (batch.length) {
        await this.store.upsertRemote(resource, batch);
      }
      if (!page.hasMore) break;
      cursor = page.nextCursor;
      if (cursor == null) break;
    }
    /**
     * 服务端用 `updatedAt > since` 过滤。若用 pull 响应里的墙钟 `serverTime`
     * 作为 since，可能出现「新插入行的 updatedAt 略早于该墙钟」从而永远漏拉。
     * 因此只在实际拉到数据时用记录上的 `updatedAt` 推进水位；空 pull 不推进
     *（首次 since=null 且无数据则保持 null，下次仍全量拉取直至出现数据）。
     */
    if (maxPulledUpdatedAt) {
      await this.store.setLastSyncAt(resource, maxIsoString(since, maxPulledUpdatedAt)!);
    }

    return { pulled, lastServerTime };
  }

  private async runPushPhase(resource: string): Promise<{
    pushedAccepted: number;
    pushedRejected: number;
    lastServerTime: string | null;
  }> {
    const dirty = await this.store.getDirtyRecords(resource);
    let pushedAccepted = 0;
    let pushedRejected = 0;
    let lastServerTime: string | null = null;
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
        let maxAccepted: string | null = null;
        for (const a of pushRes.accepted) {
          maxAccepted = maxIsoString(maxAccepted, a.updatedAt);
        }
        const afterPull = await this.store.getLastSyncAt(resource);
        if (maxAccepted) {
          await this.store.setLastSyncAt(resource, maxIsoString(afterPull, maxAccepted)!);
        }
      }
      lastServerTime = pushRes.serverTime;
    }

    return { pushedAccepted, pushedRejected, lastServerTime };
  }

  async syncResource(resource: string, options?: SyncResourceOptions): Promise<SyncResult> {
    const pushFirst = options?.pushFirst ?? false;
    let pulled = 0;
    let pushedAccepted = 0;
    let pushedRejected = 0;
    let serverTime: string | null = null;

    if (pushFirst) {
      const pushR = await this.runPushPhase(resource);
      pushedAccepted = pushR.pushedAccepted;
      pushedRejected = pushR.pushedRejected;
      serverTime = pushR.lastServerTime;
      const pullR = await this.runPullPhase(resource);
      pulled = pullR.pulled;
      serverTime = pullR.lastServerTime ?? serverTime;
    } else {
      const pullR = await this.runPullPhase(resource);
      pulled = pullR.pulled;
      serverTime = pullR.lastServerTime;
      const pushR = await this.runPushPhase(resource);
      pushedAccepted = pushR.pushedAccepted;
      pushedRejected = pushR.pushedRejected;
      serverTime = pushR.lastServerTime ?? serverTime;
    }

    return {
      resource,
      pulled,
      pushedAccepted,
      pushedRejected,
      serverTime,
    };
  }

  async syncAll(resources: string[], options?: SyncResourceOptions): Promise<SyncResult[]> {
    const out: SyncResult[] = [];
    for (const r of resources) {
      out.push(await this.syncResource(r, options));
    }
    return out;
  }
}

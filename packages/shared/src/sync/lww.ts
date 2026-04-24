import type { SyncableRecord } from '../types/sync.js';

export type LwwDecision = 'accept' | 'stale';

/** 比较 ISO 8601 字符串（同一时区约定为 Z）。 */
export function parseIsoMs(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error(`invalid datetime: ${iso}`);
  return t;
}

/**
 * 服务端 push 单条 LWW：仅当 incoming 比 existing 严格更新时接受。
 * 相等时间戳 → stale（规范：避免双端同毫秒抖动）。
 */
export function lwwServerPush<T extends SyncableRecord>(
  incoming: T,
  existing: T | null,
): LwwDecision {
  if (!existing) return 'accept';
  const a = parseIsoMs(incoming.updatedAt);
  const b = parseIsoMs(existing.updatedAt);
  if (a > b) return 'accept';
  return 'stale';
}

/** 客户端 pull 合并到本地：remote 更新或本地无则 upsert。 */
export function lwwClientMerge<T extends SyncableRecord>(
  remote: T,
  local: T | null,
): boolean {
  if (!local) return true;
  const r = parseIsoMs(remote.updatedAt);
  const l = parseIsoMs(local.updatedAt);
  return r > l;
}

import type { SQLiteDatabase } from "expo-sqlite";
import type { LocalStore } from "@time-manger/shared";
import type { TimeRecordPayload } from "@time-manger/shared";

/**
 * 移动端 LocalStore：pull 写入 SQLite；Phase 1 不在手机端产生时间记录，故无脏数据 push。
 */
export class MobileLocalStore implements LocalStore {
  constructor(private readonly db: SQLiteDatabase) {}

  async getLastSyncAt(resource: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ last_sync_at: string }>(
      "SELECT last_sync_at AS last_sync_at FROM sync_meta WHERE resource = ?",
      [resource],
    );
    return row?.last_sync_at ?? null;
  }

  async setLastSyncAt(resource: string, serverTime: string): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO sync_meta (resource, last_sync_at) VALUES (?, ?)
       ON CONFLICT(resource) DO UPDATE SET last_sync_at = excluded.last_sync_at`,
      [resource, serverTime],
    );
  }

  async getDirtyRecords<T>(_resource: string): Promise<T[]> {
    return [];
  }

  async upsertRemote(resource: string, records: unknown[]): Promise<void> {
    if (resource !== "time-records" || records.length === 0) return;
    for (const raw of records) {
      const r = raw as TimeRecordPayload;
      await this.db.runAsync(
        `INSERT OR REPLACE INTO time_record_cache
         (id, date, app_key, app_name, duration_ms, updated_at, deleted_at, client_device_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          r.id,
          r.date,
          r.appKey,
          r.appName,
          r.durationMs,
          r.updatedAt,
          r.deletedAt,
          r.clientDeviceId,
        ],
      );
    }
  }

  async markClean(_resource: string, _ids: string[]): Promise<void> {
    /* 无本地脏数据 */
  }
}

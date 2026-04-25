import type { SQLiteDatabase } from "expo-sqlite";
import type { LocalStore } from "@time-manger/shared";
import type {
  DiaryPayload,
  TimeRecordPayload,
  WorklistItemPayload,
} from "@time-manger/shared";

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
    if (_resource === "diaries") {
      const rows = await this.db.getAllAsync<DiaryRow>(
        `SELECT id, date, content, created_at, updated_at, deleted_at, client_device_id
         FROM diary_cache WHERE dirty = 1`
      );
      return rows.map(rowToDiary) as T[];
    }
    if (_resource === "worklist-items") {
      const rows = await this.db.getAllAsync<WorklistRow>(
        `SELECT id, name, icon, note, reminder_at, estimate_done_at, created_at,
                updated_at, deleted_at, reminder_notified, completion_result,
                confirm_snooze_until, client_device_id
         FROM worklist_item_cache WHERE dirty = 1`
      );
      return rows.map(rowToWorklistItem) as T[];
    }
    return [];
  }

  async upsertRemote(resource: string, records: unknown[]): Promise<void> {
    if (records.length === 0) return;
    if (resource === "diaries") {
      for (const raw of records) {
        await this.upsertRemoteDiary(raw as DiaryPayload);
      }
      return;
    }
    if (resource === "worklist-items") {
      for (const raw of records) {
        await this.upsertRemoteWorklistItem(raw as WorklistItemPayload);
      }
      return;
    }
    if (resource !== "time-records") return;
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

  async markClean(
    resource: string,
    ids: string[],
    accepted: Array<{ id: string; updatedAt: string }> = []
  ): Promise<void> {
    if (!ids.length) return;
    const acceptedById = new Map(accepted.map((item) => [item.id, item.updatedAt]));
    if (resource === "diaries") {
      for (const id of ids) {
        const updatedAt = acceptedById.get(id);
        await this.db.runAsync(
          updatedAt
            ? "UPDATE diary_cache SET dirty = 0 WHERE id = ? AND updated_at = ?"
            : "UPDATE diary_cache SET dirty = 0 WHERE id = ?",
          updatedAt ? [id, updatedAt] : [id]
        );
      }
      return;
    }
    if (resource === "worklist-items") {
      for (const id of ids) {
        const updatedAt = acceptedById.get(id);
        await this.db.runAsync(
          updatedAt
            ? "UPDATE worklist_item_cache SET dirty = 0 WHERE id = ? AND updated_at = ?"
            : "UPDATE worklist_item_cache SET dirty = 0 WHERE id = ?",
          updatedAt ? [id, updatedAt] : [id]
        );
      }
    }
  }

  private async upsertRemoteDiary(record: DiaryPayload): Promise<void> {
    const existing = await this.db.getFirstAsync<{ updated_at: string; dirty: number }>(
      "SELECT updated_at, dirty FROM diary_cache WHERE id = ?",
      [record.id]
    );
    if (existing && existing.dirty && Date.parse(existing.updated_at) >= Date.parse(record.updatedAt)) {
      return;
    }
    await this.db.runAsync(
      `INSERT OR REPLACE INTO diary_cache
       (id, date, content, created_at, updated_at, deleted_at, client_device_id, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        record.id,
        record.date,
        record.content,
        record.createdAt,
        record.updatedAt,
        record.deletedAt,
        record.clientDeviceId,
      ]
    );
  }

  private async upsertRemoteWorklistItem(record: WorklistItemPayload): Promise<void> {
    const existing = await this.db.getFirstAsync<{ updated_at: string; dirty: number }>(
      "SELECT updated_at, dirty FROM worklist_item_cache WHERE id = ?",
      [record.id]
    );
    if (existing && existing.dirty && Date.parse(existing.updated_at) >= Date.parse(record.updatedAt)) {
      return;
    }
    await this.db.runAsync(
      `INSERT OR REPLACE INTO worklist_item_cache
       (id, name, icon, note, reminder_at, estimate_done_at, created_at, updated_at,
        deleted_at, reminder_notified, completion_result, confirm_snooze_until,
        client_device_id, dirty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        record.id,
        record.name,
        record.icon,
        record.note,
        record.reminderAt,
        record.estimateDoneAt,
        record.createdAt,
        record.updatedAt,
        record.deletedAt,
        record.reminderNotified ? 1 : 0,
        record.completionResult,
        record.confirmSnoozeUntil,
        record.clientDeviceId,
      ]
    );
  }
}

type DiaryRow = {
  id: string;
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  client_device_id: string;
};

type WorklistRow = {
  id: string;
  name: string;
  icon: string;
  note: string;
  reminder_at: string | null;
  estimate_done_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  reminder_notified: number;
  completion_result: "" | "completed" | "incomplete";
  confirm_snooze_until: string | null;
  client_device_id: string;
};

function rowToDiary(row: DiaryRow): DiaryPayload {
  return {
    id: row.id,
    date: row.date,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    clientDeviceId: row.client_device_id,
  };
}

function rowToWorklistItem(row: WorklistRow): WorklistItemPayload {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    note: row.note,
    reminderAt: row.reminder_at,
    estimateDoneAt: row.estimate_done_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    reminderNotified: Boolean(row.reminder_notified),
    completionResult:
      row.completion_result === "completed" || row.completion_result === "incomplete"
        ? row.completion_result
        : "",
    confirmSnoozeUntil: row.confirm_snooze_until,
    clientDeviceId: row.client_device_id,
  };
}

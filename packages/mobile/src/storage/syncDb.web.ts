import type { SQLiteDatabase } from "expo-sqlite";

type Row = Record<string, unknown>;

class WebMemoryDb {
  private readonly timeRows = new Map<string, Row>();
  private readonly diaryRows = new Map<string, Row>();
  private readonly worklistRows = new Map<string, Row>();
  private readonly lastSyncAtByResource = new Map<string, string>();

  async execAsync(): Promise<void> {
    // Web preview does not persist the native SQLite cache.
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    if (sql.includes("DELETE FROM time_record_cache")) {
      this.timeRows.clear();
      return;
    }
    if (sql.includes("DELETE FROM diary_cache")) {
      this.diaryRows.clear();
      return;
    }
    if (sql.includes("DELETE FROM worklist_item_cache")) {
      this.worklistRows.clear();
      return;
    }
    if (sql.includes("DELETE FROM sync_meta")) {
      this.lastSyncAtByResource.clear();
      return;
    }
    if (sql.includes("sync_meta")) {
      this.lastSyncAtByResource.set(String(params[0] ?? ""), String(params[1] ?? ""));
      return;
    }
    if (sql.includes("time_record_cache")) {
      const id = String(params[0] ?? "");
      if (sql.trim().startsWith("UPDATE")) return;
      this.timeRows.set(id, {
        id,
        date: params[1],
        app_key: params[2],
        app_name: params[3],
        duration_ms: params[4],
        updated_at: params[5],
        deleted_at: params[6],
        client_device_id: params[7],
      });
      return;
    }
    if (sql.includes("diary_cache")) {
      if (sql.includes("SET dirty = 0")) {
        const id = String(params[0] ?? "");
        const updatedAt = params[1] ? String(params[1]) : null;
        const existing = this.diaryRows.get(id);
        if (existing && (!updatedAt || existing.updated_at === updatedAt)) {
          existing.dirty = 0;
        }
        return;
      }
      if (sql.trim().startsWith("UPDATE")) {
        const id = String(params[2] ?? params[0] ?? "");
        const existing = this.diaryRows.get(id);
        if (existing) {
          existing.updated_at = params[0];
          existing.deleted_at = params[1];
          existing.dirty = 1;
        }
        return;
      }
      const id = String(params[0] ?? "");
      const isLocalWrite = sql.includes("NULL, ?, 1");
      this.diaryRows.set(id, {
        id,
        date: params[1],
        content: params[2],
        created_at: params[3],
        updated_at: params[4],
        deleted_at: isLocalWrite ? null : params[5],
        client_device_id: isLocalWrite ? params[5] : params[6],
        dirty: isLocalWrite ? 1 : 0,
      });
      return;
    }
    if (sql.includes("worklist_item_cache")) {
      if (sql.includes("SET dirty = 0")) {
        const id = String(params[0] ?? "");
        const updatedAt = params[1] ? String(params[1]) : null;
        const existing = this.worklistRows.get(id);
        if (existing && (!updatedAt || existing.updated_at === updatedAt)) {
          existing.dirty = 0;
        }
        return;
      }
      if (sql.trim().startsWith("UPDATE")) {
        const id = String(params[2] ?? params[0] ?? "");
        const existing = this.worklistRows.get(id);
        if (existing) {
          existing.updated_at = params[0];
          existing.deleted_at = params[1];
          existing.dirty = 1;
        }
        return;
      }
      const id = String(params[0] ?? "");
      const isLocalWrite = sql.includes("NULL, ?, ?, ?, ?, 1");
      this.worklistRows.set(id, {
        id,
        name: params[1],
        icon: params[2],
        note: params[3],
        reminder_at: params[4],
        estimate_done_at: params[5],
        created_at: params[6],
        updated_at: params[7],
        deleted_at: isLocalWrite ? null : params[8],
        reminder_notified: isLocalWrite ? params[8] : params[9],
        completion_result: isLocalWrite ? params[9] : params[10],
        confirm_snooze_until: isLocalWrite ? params[10] : params[11],
        client_device_id: isLocalWrite ? params[11] : params[12],
        dirty: isLocalWrite ? 1 : 0,
      });
    }
  }

  async getFirstAsync<T>(sql = "", params: unknown[] = []): Promise<T | null> {
    if (sql.includes("sync_meta")) {
      const lastSyncAt = this.lastSyncAtByResource.get(String(params[0] ?? ""));
      return lastSyncAt ? ({ last_sync_at: lastSyncAt } as T) : null;
    }
    if (sql.includes("diary_cache")) {
      return (this.diaryRows.get(String(params[0] ?? "")) ?? null) as T | null;
    }
    if (sql.includes("worklist_item_cache")) {
      return (this.worklistRows.get(String(params[0] ?? "")) ?? null) as T | null;
    }
    return null;
  }

  async getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    if (sql.includes("diary_cache")) {
      const rows = [...this.diaryRows.values()];
      return (sql.includes("dirty = 1")
        ? rows.filter((row) => row.dirty === 1)
        : rows.filter((row) => !row.deleted_at)) as T[];
    }
    if (sql.includes("worklist_item_cache")) {
      const rows = [...this.worklistRows.values()];
      return (sql.includes("dirty = 1")
        ? rows.filter((row) => row.dirty === 1)
        : rows.filter((row) => !row.deleted_at)) as T[];
    }
    const date = String(params[0] ?? "");
    return [...this.timeRows.values()].filter((row) => row.date === date) as T[];
  }
}

const webDb = new WebMemoryDb() as unknown as SQLiteDatabase;

export async function getSyncDb(): Promise<SQLiteDatabase> {
  return webDb;
}

export async function clearSyncData(): Promise<void> {
  await webDb.runAsync("DELETE FROM time_record_cache");
  await webDb.runAsync("DELETE FROM diary_cache");
  await webDb.runAsync("DELETE FROM worklist_item_cache");
  await webDb.runAsync("DELETE FROM sync_meta");
}

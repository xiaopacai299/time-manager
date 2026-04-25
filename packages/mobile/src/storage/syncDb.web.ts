import type { SQLiteDatabase } from "expo-sqlite";

type Row = Record<string, unknown>;

class WebMemoryDb {
  private readonly rows = new Map<string, Row>();
  private lastSyncAt: string | null = null;

  async execAsync(): Promise<void> {
    // Web preview does not persist the native SQLite cache.
  }

  async runAsync(sql: string, params: unknown[] = []): Promise<void> {
    if (sql.includes("DELETE FROM time_record_cache")) {
      this.rows.clear();
      return;
    }
    if (sql.includes("DELETE FROM sync_meta")) {
      this.lastSyncAt = null;
      return;
    }
    if (sql.includes("sync_meta")) {
      this.lastSyncAt = String(params[1] ?? "");
      return;
    }
    if (sql.includes("time_record_cache")) {
      const id = String(params[0] ?? "");
      this.rows.set(id, {
        id,
        date: params[1],
        app_key: params[2],
        app_name: params[3],
        duration_ms: params[4],
        updated_at: params[5],
        deleted_at: params[6],
        client_device_id: params[7],
      });
    }
  }

  async getFirstAsync<T>(): Promise<T | null> {
    if (!this.lastSyncAt) return null;
    return { last_sync_at: this.lastSyncAt } as T;
  }

  async getAllAsync<T>(_sql: string, params: unknown[] = []): Promise<T[]> {
    const date = String(params[0] ?? "");
    return [...this.rows.values()].filter((row) => row.date === date) as T[];
  }
}

const webDb = new WebMemoryDb() as unknown as SQLiteDatabase;

export async function getSyncDb(): Promise<SQLiteDatabase> {
  return webDb;
}

export async function clearSyncData(): Promise<void> {
  await webDb.runAsync("DELETE FROM time_record_cache");
  await webDb.runAsync("DELETE FROM sync_meta");
}

import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";

let dbPromise: Promise<SQLiteDatabase> | null = null;

export async function getSyncDb(): Promise<SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await openDatabaseAsync("timemanger_sync.db");
      await db.execAsync(`
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS sync_meta (
          resource TEXT PRIMARY KEY NOT NULL,
          last_sync_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS time_record_cache (
          id TEXT PRIMARY KEY NOT NULL,
          date TEXT NOT NULL,
          app_key TEXT NOT NULL,
          app_name TEXT NOT NULL,
          duration_ms INTEGER NOT NULL,
          updated_at TEXT NOT NULL,
          deleted_at TEXT,
          client_device_id TEXT NOT NULL
        );
      `);
      return db;
    })();
  }
  return dbPromise;
}

/** 登出时清空本地同步缓存（时间记录 + 游标）。 */
export async function clearSyncData(): Promise<void> {
  const db = await getSyncDb();
  await db.runAsync("DELETE FROM time_record_cache");
  await db.runAsync("DELETE FROM sync_meta");
}

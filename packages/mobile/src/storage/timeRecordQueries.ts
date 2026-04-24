import type { TimeRecordPayload } from "@time-manger/shared";
import { getSyncDb } from "./syncDb";

export async function fetchTodayRecords(date: string): Promise<TimeRecordPayload[]> {
  const db = await getSyncDb();
  const rows = await db.getAllAsync<{
    id: string;
    date: string;
    app_key: string;
    app_name: string;
    duration_ms: number;
    updated_at: string;
    deleted_at: string | null;
    client_device_id: string;
  }>(
    `SELECT id, date, app_key, app_name, duration_ms, updated_at, deleted_at, client_device_id
     FROM time_record_cache
     WHERE date = ? AND deleted_at IS NULL
     ORDER BY duration_ms DESC`,
    [date],
  );
  return rows.map((row) => ({
    id: row.id,
    date: row.date,
    appKey: row.app_key,
    appName: row.app_name,
    durationMs: row.duration_ms,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at,
    clientDeviceId: row.client_device_id,
  }));
}

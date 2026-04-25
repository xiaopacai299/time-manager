import type { DiaryPayload } from "@time-manger/shared";
import { getOrCreateDeviceId } from "./authStore";
import { getSyncDb } from "./syncDb";

type DiaryRow = {
  id: string;
  date: string;
  content: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  client_device_id: string;
};

export async function fetchDiaries(): Promise<DiaryPayload[]> {
  const db = await getSyncDb();
  const rows = await db.getAllAsync<DiaryRow>(
    `SELECT id, date, content, created_at, updated_at, deleted_at, client_device_id
     FROM diary_cache
     WHERE deleted_at IS NULL
     ORDER BY created_at DESC`
  );
  return rows.map(rowToDiary);
}

export async function saveDiary(input: {
  id?: string;
  date: string;
  content: string;
  createdAt?: string;
}): Promise<void> {
  const db = await getSyncDb();
  const deviceId = await getOrCreateDeviceId();
  const now = new Date().toISOString();
  const id = input.id ?? generateUUID();
  const createdAt = input.createdAt ?? now;
  await db.runAsync(
    `INSERT OR REPLACE INTO diary_cache
     (id, date, content, created_at, updated_at, deleted_at, client_device_id, dirty)
     VALUES (?, ?, ?, ?, ?, NULL, ?, 1)`,
    [id, input.date, input.content, createdAt, now, deviceId]
  );
}

export async function deleteDiary(id: string): Promise<void> {
  const db = await getSyncDb();
  const now = new Date().toISOString();
  await db.runAsync(
    "UPDATE diary_cache SET updated_at = ?, deleted_at = ?, dirty = 1 WHERE id = ?",
    [now, now, id]
  );
}

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

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

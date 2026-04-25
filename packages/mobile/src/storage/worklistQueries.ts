import type { WorklistItemPayload } from "@time-manger/shared";
import { getOrCreateDeviceId } from "./authStore";
import { getSyncDb } from "./syncDb";

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

export async function fetchWorklistItems(): Promise<WorklistItemPayload[]> {
  const db = await getSyncDb();
  const rows = await db.getAllAsync<WorklistRow>(
    `SELECT id, name, icon, note, reminder_at, estimate_done_at, created_at,
            updated_at, deleted_at, reminder_notified, completion_result,
            confirm_snooze_until, client_device_id
     FROM worklist_item_cache
     WHERE deleted_at IS NULL
     ORDER BY created_at ASC`
  );
  return rows.map(rowToWorklistItem);
}

export async function saveWorklistItem(input: {
  id?: string;
  name: string;
  icon?: string;
  note?: string;
  reminderAt?: string | null;
  estimateDoneAt?: string | null;
  createdAt?: string;
  reminderNotified?: boolean;
  completionResult?: "" | "completed" | "incomplete";
  confirmSnoozeUntil?: string | null;
}): Promise<void> {
  const db = await getSyncDb();
  const deviceId = await getOrCreateDeviceId();
  const now = new Date().toISOString();
  const id = input.id ?? generateUUID();
  await db.runAsync(
    `INSERT OR REPLACE INTO worklist_item_cache
     (id, name, icon, note, reminder_at, estimate_done_at, created_at, updated_at,
      deleted_at, reminder_notified, completion_result, confirm_snooze_until,
      client_device_id, dirty)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, 1)`,
    [
      id,
      input.name,
      input.icon ?? "📋",
      input.note ?? "",
      normalizeDate(input.reminderAt),
      normalizeDate(input.estimateDoneAt),
      input.createdAt ?? now,
      now,
      input.reminderNotified ? 1 : 0,
      input.completionResult ?? "",
      normalizeDate(input.confirmSnoozeUntil),
      deviceId,
    ]
  );
}

export async function deleteWorklistItem(id: string): Promise<void> {
  const db = await getSyncDb();
  const now = new Date().toISOString();
  await db.runAsync(
    "UPDATE worklist_item_cache SET updated_at = ?, deleted_at = ?, dirty = 1 WHERE id = ?",
    [now, now, id]
  );
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

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

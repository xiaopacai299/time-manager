/** 所有可同步业务记录的公共字段（与 Prisma 业务表对齐）。 */
export interface SyncableRecord {
  id: string;
  updatedAt: string;
  deletedAt: string | null;
  clientDeviceId: string;
}

export type TimeRecord = SyncableRecord & {
  date: string;
  appKey: string;
  appName: string;
  durationMs: number;
};

export type DiaryRecord = SyncableRecord & {
  date: string;
  content: string;
  createdAt: string;
};

export type WorklistItemRecord = SyncableRecord & {
  name: string;
  icon: string;
  note: string;
  reminderAt: string | null;
  estimateDoneAt: string | null;
  createdAt: string;
  reminderNotified: boolean;
  completionResult: '' | 'completed' | 'incomplete';
  confirmSnoozeUntil: string | null;
};

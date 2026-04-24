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

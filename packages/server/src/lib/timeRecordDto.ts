import type { TimeRecord as PrismaTimeRecord } from '@prisma/client';
import type { TimeRecordPayload } from '@time-manger/shared';

export function timeRecordToDto(r: PrismaTimeRecord): TimeRecordPayload {
  return {
    id: r.id,
    date: r.date,
    appKey: r.appKey,
    appName: r.appName,
    durationMs: r.durationMs,
    updatedAt: r.updatedAt.toISOString(),
    deletedAt: r.deletedAt ? r.deletedAt.toISOString() : null,
    clientDeviceId: r.clientDeviceId,
  };
}

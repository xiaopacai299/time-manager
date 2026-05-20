import type { TimeRecord as PrismaTimeRecord } from '@prisma/client';
import type { TimeRecordPayload } from '@time-manger/shared';
import { prismaDateToChinaStorageIso } from '@time-manger/shared';

export function timeRecordToDto(r: PrismaTimeRecord): TimeRecordPayload {
  return {
    id: r.id,
    date: r.date,
    appKey: r.appKey,
    appName: r.appName,
    durationMs: r.durationMs,
    updatedAt: prismaDateToChinaStorageIso(r.updatedAt)!,
    deletedAt: prismaDateToChinaStorageIso(r.deletedAt),
    clientDeviceId: r.clientDeviceId,
  };
}

import type { Express } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import prismaPkg from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import {
  PushDiariesBodySchema,
  PushMemoItemsBodySchema,
  PushTimeRecordsBodySchema,
  PushWorkYearDigestsBodySchema,
  PushWorklistItemsBodySchema,
  SyncPullQuerySchema,
  lwwServerPush,
  type DiaryPayload,
  type MemoItemPayload,
  type TimeRecordPayload,
  type WorkYearDigestPayload,
  type WorklistItemPayload,
} from '@time-manger/shared';
import type { ServerEnv } from '../config/env.js';
import { encodeSyncCursor, decodeSyncCursor } from '../lib/syncCursor.js';
import { timeRecordToDto } from '../lib/timeRecordDto.js';
import { sendApiError } from '../lib/apiError.js';
import { requireDeviceId } from '../middleware/requireDeviceId.js';
import { requireAccessAuth } from '../middleware/requireAccessAuth.js';

const { Prisma } = prismaPkg;

type SyncResource =
  | 'time-records'
  | 'diaries'
  | 'worklist-items'
  | 'memo-items'
  | 'work-year-digests';
type SyncPayload =
  | TimeRecordPayload
  | DiaryPayload
  | WorklistItemPayload
  | MemoItemPayload
  | WorkYearDigestPayload;
type SyncRow = {
  id: string;
  userId: string;
  updatedAt: Date;
};

type SyncDelegate<Row extends SyncRow> = {
  findMany(args: unknown): Promise<Row[]>;
  findUnique(args: unknown): Promise<Row | null>;
  upsert(args: unknown): Promise<Row>;
};

type ResourceConfig<Row extends SyncRow, Payload extends SyncPayload> = {
  delegate: SyncDelegate<Row>;
  schema:
    | typeof PushTimeRecordsBodySchema
    | typeof PushDiariesBodySchema
    | typeof PushWorklistItemsBodySchema
    | typeof PushMemoItemsBodySchema
    | typeof PushWorkYearDigestsBodySchema;
  toDto: (row: Row) => Payload;
  toCreate: (record: Payload, userId: string) => Record<string, unknown>;
  toUpdate: (record: Payload, userId: string) => Record<string, unknown>;
};

function parseResource(resource: string): SyncResource | null {
  if (
    resource === 'time-records' ||
    resource === 'diaries' ||
    resource === 'worklist-items' ||
    resource === 'memo-items' ||
    resource === 'work-year-digests'
  ) {
    return resource;
  }
  return null;
}

function nullableDate(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

function diaryToDto(row: {
  id: string;
  date: string;
  content: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  clientDeviceId: string;
}): DiaryPayload {
  return {
    id: row.id,
    date: row.date,
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    clientDeviceId: row.clientDeviceId,
  };
}

function memoItemToDto(row: {
  id: string;
  name: string;
  icon: string;
  content: string;
  reminderAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  reminderNotified: boolean;
  clientDeviceId: string;
}): MemoItemPayload {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    content: row.content,
    reminderAt: row.reminderAt ? row.reminderAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    reminderNotified: row.reminderNotified,
    clientDeviceId: row.clientDeviceId,
  };
}

function workYearDigestToDto(row: {
  id: string;
  year: number;
  payloadJson: string;
  updatedAt: Date;
  deletedAt: Date | null;
  clientDeviceId: string;
}): WorkYearDigestPayload {
  return {
    id: row.id,
    year: row.year,
    payloadJson: row.payloadJson,
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    clientDeviceId: row.clientDeviceId,
  };
}

function worklistItemToDto(row: {
  id: string;
  name: string;
  icon: string;
  note: string;
  reminderAt: Date | null;
  estimateDoneAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  reminderNotified: boolean;
  completionResult: string;
  confirmSnoozeUntil: Date | null;
  clientDeviceId: string;
}): WorklistItemPayload {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    note: row.note,
    reminderAt: row.reminderAt ? row.reminderAt.toISOString() : null,
    estimateDoneAt: row.estimateDoneAt ? row.estimateDoneAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
    reminderNotified: row.reminderNotified,
    completionResult:
      row.completionResult === 'completed' || row.completionResult === 'incomplete'
        ? row.completionResult
        : '',
    confirmSnoozeUntil: row.confirmSnoozeUntil
      ? row.confirmSnoozeUntil.toISOString()
      : null,
    clientDeviceId: row.clientDeviceId,
  };
}

function getResourceConfig(
  prisma: PrismaClient,
  resource: SyncResource,
): ResourceConfig<SyncRow, SyncPayload> {
  if (resource === 'time-records') {
    return {
      delegate: prisma.timeRecord as unknown as SyncDelegate<SyncRow>,
      schema: PushTimeRecordsBodySchema,
      toDto: (row) => timeRecordToDto(row as Parameters<typeof timeRecordToDto>[0]),
      toCreate: (record, userId) => {
        const rec = record as TimeRecordPayload;
        return {
          id: rec.id,
          userId,
          date: rec.date,
          appKey: rec.appKey,
          appName: rec.appName,
          durationMs: rec.durationMs,
          updatedAt: new Date(rec.updatedAt),
          deletedAt: nullableDate(rec.deletedAt),
          clientDeviceId: rec.clientDeviceId,
        };
      },
      toUpdate: (record, userId) => {
        const rec = record as TimeRecordPayload;
        return {
          userId,
          date: rec.date,
          appKey: rec.appKey,
          appName: rec.appName,
          durationMs: rec.durationMs,
          updatedAt: new Date(rec.updatedAt),
          deletedAt: nullableDate(rec.deletedAt),
          clientDeviceId: rec.clientDeviceId,
        };
      },
    };
  }

  if (resource === 'diaries') {
    return {
      delegate: prisma.diaryEntry as unknown as SyncDelegate<SyncRow>,
      schema: PushDiariesBodySchema,
      toDto: (row) => diaryToDto(row as unknown as Parameters<typeof diaryToDto>[0]),
      toCreate: (record, userId) => {
        const rec = record as DiaryPayload;
        return {
          id: rec.id,
          userId,
          date: rec.date,
          content: rec.content,
          createdAt: new Date(rec.createdAt),
          updatedAt: new Date(rec.updatedAt),
          deletedAt: nullableDate(rec.deletedAt),
          clientDeviceId: rec.clientDeviceId,
        };
      },
      toUpdate: (record, userId) => {
        const rec = record as DiaryPayload;
        return {
          userId,
          date: rec.date,
          content: rec.content,
          createdAt: new Date(rec.createdAt),
          updatedAt: new Date(rec.updatedAt),
          deletedAt: nullableDate(rec.deletedAt),
          clientDeviceId: rec.clientDeviceId,
        };
      },
    };
  }

  if (resource === 'worklist-items') {
    return {
      delegate: prisma.worklistItem as unknown as SyncDelegate<SyncRow>,
      schema: PushWorklistItemsBodySchema,
      toDto: (row) =>
        worklistItemToDto(row as unknown as Parameters<typeof worklistItemToDto>[0]),
      toCreate: (record, userId) => {
        const rec = record as WorklistItemPayload;
        return {
          id: rec.id,
          userId,
          name: rec.name,
          icon: rec.icon,
          note: rec.note,
          reminderAt: nullableDate(rec.reminderAt),
          estimateDoneAt: nullableDate(rec.estimateDoneAt),
          createdAt: new Date(rec.createdAt),
          updatedAt: new Date(rec.updatedAt),
          deletedAt: nullableDate(rec.deletedAt),
          reminderNotified: rec.reminderNotified,
          completionResult: rec.completionResult,
          confirmSnoozeUntil: nullableDate(rec.confirmSnoozeUntil),
          clientDeviceId: rec.clientDeviceId,
        };
      },
      toUpdate: (record, userId) => {
        const rec = record as WorklistItemPayload;
        return {
          userId,
          name: rec.name,
          icon: rec.icon,
          note: rec.note,
          reminderAt: nullableDate(rec.reminderAt),
          estimateDoneAt: nullableDate(rec.estimateDoneAt),
          createdAt: new Date(rec.createdAt),
          updatedAt: new Date(rec.updatedAt),
          deletedAt: nullableDate(rec.deletedAt),
          reminderNotified: rec.reminderNotified,
          completionResult: rec.completionResult,
          confirmSnoozeUntil: nullableDate(rec.confirmSnoozeUntil),
          clientDeviceId: rec.clientDeviceId,
        };
      },
    };
  }

  if (resource === 'memo-items') {
    return {
      delegate: prisma.memoItem as unknown as SyncDelegate<SyncRow>,
      schema: PushMemoItemsBodySchema,
      toDto: (row) => memoItemToDto(row as unknown as Parameters<typeof memoItemToDto>[0]),
      toCreate: (record, userId) => {
        const rec = record as MemoItemPayload;
        return {
          id: rec.id,
          userId,
          name: rec.name,
          icon: rec.icon,
          content: rec.content,
          reminderAt: nullableDate(rec.reminderAt),
          createdAt: new Date(rec.createdAt),
          updatedAt: new Date(rec.updatedAt),
          deletedAt: nullableDate(rec.deletedAt),
          reminderNotified: rec.reminderNotified,
          clientDeviceId: rec.clientDeviceId,
        };
      },
      toUpdate: (record, userId) => {
        const rec = record as MemoItemPayload;
        return {
          userId,
          name: rec.name,
          icon: rec.icon,
          content: rec.content,
          reminderAt: nullableDate(rec.reminderAt),
          createdAt: new Date(rec.createdAt),
          updatedAt: new Date(rec.updatedAt),
          deletedAt: nullableDate(rec.deletedAt),
          reminderNotified: rec.reminderNotified,
          clientDeviceId: rec.clientDeviceId,
        };
      },
    };
  }

  return {
    delegate: prisma.workYearDigest as unknown as SyncDelegate<SyncRow>,
    schema: PushWorkYearDigestsBodySchema,
    toDto: (row) =>
      workYearDigestToDto(row as unknown as Parameters<typeof workYearDigestToDto>[0]),
    toCreate: (record, userId) => {
      const rec = record as WorkYearDigestPayload;
      return {
        id: rec.id,
        userId,
        year: rec.year,
        payloadJson: rec.payloadJson,
        updatedAt: new Date(rec.updatedAt),
        deletedAt: nullableDate(rec.deletedAt),
        clientDeviceId: rec.clientDeviceId,
      };
    },
    toUpdate: (record, userId) => {
      const rec = record as WorkYearDigestPayload;
      return {
        userId,
        year: rec.year,
        payloadJson: rec.payloadJson,
        updatedAt: new Date(rec.updatedAt),
        deletedAt: nullableDate(rec.deletedAt),
        clientDeviceId: rec.clientDeviceId,
      };
    },
  };
}

export function mountSyncRoutes(
  app: Express,
  prisma: PrismaClient,
  env: ServerEnv,
): void {
  const syncLimiter = rateLimit({
    windowMs: 60_000,
    max: env.RATE_LIMIT_SYNC,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const uid = req.userId;
      if (uid) return `u:${uid}`;
      return ipKeyGenerator(req.ip ?? '127.0.0.1');
    },
    handler: (_req, res) => {
      sendApiError(res, 429, 'RATE_LIMITED', 'Sync rate limit exceeded', {});
    },
  });

  const syncChain = [requireDeviceId, requireAccessAuth(env), syncLimiter] as const;

  app.get('/api/v1/sync/:resource', ...syncChain, async (req, res) => {
    const rawResource = String(req.params.resource);
    const resource = parseResource(rawResource);
    if (!resource) {
      sendApiError(res, 400, 'VALIDATION_FAILED', 'Unsupported sync resource', {
        resource: rawResource,
      });
      return;
    }
    const config = getResourceConfig(prisma, resource);
    const q = SyncPullQuerySchema.safeParse(req.query);
    if (!q.success) {
      sendApiError(res, 400, 'VALIDATION_FAILED', 'Invalid query', {
        issues: q.error.flatten(),
      });
      return;
    }
    const userId = req.userId!;
    const sinceDate = q.data.since ? new Date(q.data.since) : new Date(0);
    const limit = q.data.limit;
    const cursor = q.data.cursor;

    let cursorPair: { u: string; i: string } | null = null;
    if (cursor) {
      try {
        cursorPair = decodeSyncCursor(cursor);
      } catch {
        sendApiError(res, 400, 'VALIDATION_FAILED', 'Invalid cursor', {});
        return;
      }
    }

    const baseWhere = {
      userId,
      updatedAt: { gt: sinceDate },
    };

    const where = cursorPair
      ? {
          AND: [
            baseWhere,
            {
              OR: [
                { updatedAt: { gt: new Date(cursorPair.u) } },
                {
                  AND: [
                    { updatedAt: new Date(cursorPair.u) },
                    { id: { gt: cursorPair.i } },
                  ],
                },
              ],
            },
          ],
        }
      : baseWhere;

    const rows = await config.delegate.findMany({
      where,
      orderBy: [{ updatedAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeSyncCursor(last.updatedAt.toISOString(), last.id)
        : null;
    const serverTime = new Date().toISOString();

    res.json({
      resource,
      serverTime,
      records: page.map((row) => config.toDto(row)),
      hasMore,
      nextCursor,
    });
  });

  app.post('/api/v1/sync/:resource', ...syncChain, async (req, res) => {
    const rawResource = String(req.params.resource);
    const resource = parseResource(rawResource);
    if (!resource) {
      sendApiError(res, 400, 'VALIDATION_FAILED', 'Unsupported sync resource', {
        resource: rawResource,
      });
      return;
    }

    const deviceHeader = req.deviceId!;

    if (resource === 'work-year-digests') {
      const parsed = PushWorkYearDigestsBodySchema.safeParse(req.body);
      if (!parsed.success) {
        sendApiError(res, 400, 'VALIDATION_FAILED', 'Invalid request body', {
          issues: parsed.error.flatten(),
        });
        return;
      }
      if (parsed.data.deviceId !== deviceHeader) {
        sendApiError(res, 400, 'VALIDATION_FAILED', 'deviceId must match X-Device-Id', {});
        return;
      }
      for (const rec of parsed.data.records) {
        if (rec.clientDeviceId !== deviceHeader) {
          sendApiError(
            res,
            400,
            'VALIDATION_FAILED',
            'record.clientDeviceId must match X-Device-Id',
            { id: rec.id },
          );
          return;
        }
      }

      const userId = req.userId!;
      const accepted: { id: string; updatedAt: string }[] = [];
      const rejected: { id: string; reason: 'stale' }[] = [];

      for (const rec of parsed.data.records) {
        const existing = await prisma.workYearDigest.findUnique({
          where: { userId_year: { userId, year: rec.year } },
        });
        if (existing && existing.userId !== userId) {
          sendApiError(res, 403, 'FORBIDDEN', 'Cannot modify another user record', {
            id: rec.id,
          });
          return;
        }
        const existingDto = existing ? workYearDigestToDto(existing) : null;
        if (lwwServerPush(rec, existingDto) === 'stale') {
          rejected.push({ id: rec.id, reason: 'stale' });
          continue;
        }
        if (existing) {
          await prisma.workYearDigest.update({
            where: { id: existing.id },
            data: {
              payloadJson: rec.payloadJson,
              updatedAt: new Date(rec.updatedAt),
              deletedAt: nullableDate(rec.deletedAt),
              clientDeviceId: rec.clientDeviceId,
            },
          });
        } else {
          await prisma.workYearDigest.create({
            data: {
              id: rec.id,
              userId,
              year: rec.year,
              payloadJson: rec.payloadJson,
              updatedAt: new Date(rec.updatedAt),
              deletedAt: nullableDate(rec.deletedAt),
              clientDeviceId: rec.clientDeviceId,
            },
          });
        }
        accepted.push({ id: rec.id, updatedAt: rec.updatedAt });
      }

      res.json({
        resource,
        serverTime: new Date().toISOString(),
        accepted,
        rejected,
      });
      return;
    }

    const config = getResourceConfig(prisma, resource);
    const parsed = config.schema.safeParse(req.body);
    if (!parsed.success) {
      sendApiError(res, 400, 'VALIDATION_FAILED', 'Invalid request body', {
        issues: parsed.error.flatten(),
      });
      return;
    }
    if (parsed.data.deviceId !== deviceHeader) {
      sendApiError(res, 400, 'VALIDATION_FAILED', 'deviceId must match X-Device-Id', {});
      return;
    }
    for (const rec of parsed.data.records) {
      if (rec.clientDeviceId !== deviceHeader) {
        sendApiError(
          res,
          400,
          'VALIDATION_FAILED',
          'record.clientDeviceId must match X-Device-Id',
          { id: rec.id },
        );
        return;
      }
    }

    const userId = req.userId!;
    const accepted: { id: string; updatedAt: string }[] = [];
    const rejected: { id: string; reason: 'stale' }[] = [];

    for (const rec of parsed.data.records) {
      const existing = await config.delegate.findUnique({
        where: { id: rec.id },
      });
      if (existing && (existing as { userId?: string }).userId !== userId) {
        sendApiError(res, 403, 'FORBIDDEN', 'Cannot modify another user record', {
          id: rec.id,
        });
        return;
      }
      const incoming = rec as SyncPayload;
      const existingDto = existing ? config.toDto(existing) : null;
      const decision = lwwServerPush(incoming, existingDto);
      if (decision === 'stale') {
        rejected.push({ id: rec.id, reason: 'stale' });
        continue;
      }
      try {
        await config.delegate.upsert({
          where: { id: rec.id },
          create: config.toCreate(incoming, userId),
          update: config.toUpdate(incoming, userId),
        });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          if (resource === 'time-records') {
            const timeRec = incoming as TimeRecordPayload;
            const existingByKey = await prisma.timeRecord.findUnique({
              where: {
                userId_date_appKey: {
                  userId,
                  date: timeRec.date,
                  appKey: timeRec.appKey,
                },
              },
            });
            if (existingByKey) {
              const decisionByKey = lwwServerPush(timeRec, timeRecordToDto(existingByKey));
              if (decisionByKey === 'stale') {
                rejected.push({ id: rec.id, reason: 'stale' });
                continue;
              }
              await prisma.timeRecord.update({
                where: { id: existingByKey.id },
                data: {
                  ...config.toUpdate(timeRec, userId),
                  id: timeRec.id,
                },
              });
              accepted.push({ id: rec.id, updatedAt: rec.updatedAt });
              continue;
            }
          }
          sendApiError(res, 409, 'CONFLICT', 'Sync unique constraint violated', { resource, id: rec.id });
          return;
        }
        throw e;
      }
      accepted.push({ id: rec.id, updatedAt: rec.updatedAt });
    }

    const serverTime = new Date().toISOString();
    res.json({
      resource,
      serverTime,
      accepted,
      rejected,
    });
  });
}

import type { Express } from 'express';
import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import { Prisma, type PrismaClient } from '@prisma/client';
import {
  PushTimeRecordsBodySchema,
  SyncPullQuerySchema,
  lwwServerPush,
  type TimeRecordPayload,
} from '@time-manger/shared';
import type { ServerEnv } from '../config/env.js';
import { encodeSyncCursor, decodeSyncCursor } from '../lib/syncCursor.js';
import { timeRecordToDto } from '../lib/timeRecordDto.js';
import { sendApiError } from '../lib/apiError.js';
import { requireDeviceId } from '../middleware/requireDeviceId.js';
import { requireAccessAuth } from '../middleware/requireAccessAuth.js';

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
    const { resource } = req.params;
    if (resource !== 'time-records') {
      sendApiError(res, 400, 'VALIDATION_FAILED', 'Unsupported sync resource', {
        resource,
      });
      return;
    }
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

    const rows = await prisma.timeRecord.findMany({
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
      records: page.map(timeRecordToDto),
      hasMore,
      nextCursor,
    });
  });

  app.post('/api/v1/sync/:resource', ...syncChain, async (req, res) => {
    const { resource } = req.params;
    if (resource !== 'time-records') {
      sendApiError(res, 400, 'VALIDATION_FAILED', 'Unsupported sync resource', {
        resource,
      });
      return;
    }
    const parsed = PushTimeRecordsBodySchema.safeParse(req.body);
    if (!parsed.success) {
      sendApiError(res, 400, 'VALIDATION_FAILED', 'Invalid request body', {
        issues: parsed.error.flatten(),
      });
      return;
    }
    const deviceHeader = req.deviceId!;
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
      const existing = await prisma.timeRecord.findUnique({
        where: { id: rec.id },
      });
      if (existing && existing.userId !== userId) {
        sendApiError(res, 403, 'FORBIDDEN', 'Cannot modify another user record', {
          id: rec.id,
        });
        return;
      }
      const incoming: TimeRecordPayload = rec;
      const existingDto: TimeRecordPayload | null = existing
        ? timeRecordToDto(existing)
        : null;
      const decision = lwwServerPush(incoming, existingDto);
      if (decision === 'stale') {
        rejected.push({ id: rec.id, reason: 'stale' });
        continue;
      }
      try {
        await prisma.timeRecord.upsert({
          where: { id: rec.id },
          create: {
            id: rec.id,
            userId,
            date: rec.date,
            appKey: rec.appKey,
            appName: rec.appName,
            durationMs: rec.durationMs,
            updatedAt: new Date(rec.updatedAt),
            deletedAt: rec.deletedAt ? new Date(rec.deletedAt) : null,
            clientDeviceId: rec.clientDeviceId,
          },
          update: {
            userId,
            date: rec.date,
            appKey: rec.appKey,
            appName: rec.appName,
            durationMs: rec.durationMs,
            updatedAt: new Date(rec.updatedAt),
            deletedAt: rec.deletedAt ? new Date(rec.deletedAt) : null,
            clientDeviceId: rec.clientDeviceId,
          },
        });
        accepted.push({ id: rec.id, updatedAt: rec.updatedAt });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          sendApiError(
            res,
            409,
            'CONFLICT',
            'Time record unique constraint violated (userId+date+appKey)',
            { id: rec.id },
          );
          return;
        }
        throw e;
      }
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

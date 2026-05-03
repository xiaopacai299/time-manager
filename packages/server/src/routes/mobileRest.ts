import type { Express } from 'express';
import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { DiaryPayload, WorklistItemPayload } from '@time-manger/shared';
import { z } from 'zod';
import type { ServerEnv } from '../config/env.js';
import { timeRecordToDto } from '../lib/timeRecordDto.js';
import { sendApiError } from '../lib/apiError.js';
import { requireDeviceId } from '../middleware/requireDeviceId.js';
import { requireAccessAuth } from '../middleware/requireAccessAuth.js';

const dateParam = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function diaryToPayload(row: {
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

function worklistToPayload(row: {
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
  const cr =
    row.completionResult === 'completed' || row.completionResult === 'incomplete'
      ? row.completionResult
      : '';
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
    completionResult: cr,
    confirmSnoozeUntil: row.confirmSnoozeUntil ? row.confirmSnoozeUntil.toISOString() : null,
    clientDeviceId: row.clientDeviceId,
  };
}

const PostDiaryBody = z.object({
  date: z.string().min(1),
  content: z.string(),
});

const PatchDiaryBody = z
  .object({
    date: z.string().min(1).optional(),
    content: z.string().optional(),
  })
  .refine((b) => b.date !== undefined || b.content !== undefined, {
    message: 'At least one of date, content required',
  });

const PostWorklistBody = z.object({
  name: z.string().min(1),
  icon: z.string().optional(),
  note: z.string().optional(),
});

const PatchWorklistBody = z
  .object({
    name: z.string().min(1).optional(),
    icon: z.string().optional(),
    note: z.string().optional(),
    reminderAt: z.string().datetime().nullable().optional(),
    estimateDoneAt: z.string().datetime().nullable().optional(),
    reminderNotified: z.boolean().optional(),
    completionResult: z.enum(['', 'completed', 'incomplete']).optional(),
    confirmSnoozeUntil: z.string().datetime().nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: 'Empty patch' });

/**
 * 移动端直连 REST（无增量同步语义）：每次 GET 即全量可读列表，写操作立即落库并返回当前行。
 */
export function mountMobileRestRoutes(
  app: Express,
  prisma: PrismaClient,
  env: ServerEnv,
): void {
  const chain = [requireDeviceId, requireAccessAuth(env)] as const;

  app.get('/api/v1/diaries', ...chain, async (req, res, next) => {
    try {
      const userId = req.userId!;
      const rows = await prisma.diaryEntry.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      res.json({ diaries: rows.map(diaryToPayload) });
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/v1/diaries', ...chain, async (req, res, next) => {
    try {
      const parsed = PostDiaryBody.safeParse(req.body);
      if (!parsed.success) {
        sendApiError(res, 400, 'VALIDATION_FAILED', 'Invalid body', {
          issues: parsed.error.flatten(),
        });
        return;
      }
      const userId = req.userId!;
      const deviceId = req.deviceId!;
      const now = new Date();
      const row = await prisma.diaryEntry.create({
        data: {
          id: randomUUID(),
          userId,
          date: parsed.data.date,
          content: parsed.data.content,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          clientDeviceId: deviceId,
        },
      });
      res.status(201).json({ diary: diaryToPayload(row) });
    } catch (e) {
      next(e);
    }
  });

  app.patch('/api/v1/diaries/:id', ...chain, async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const parsed = PatchDiaryBody.safeParse(req.body);
      if (!parsed.success) {
        sendApiError(res, 400, 'VALIDATION_FAILED', 'Invalid body', {
          issues: parsed.error.flatten(),
        });
        return;
      }
      const userId = req.userId!;
      const existing = await prisma.diaryEntry.findFirst({
        where: { id, userId, deletedAt: null },
      });
      if (!existing) {
        sendApiError(res, 404, 'NOT_FOUND', 'Diary not found', { id });
        return;
      }
      const now = new Date();
      const row = await prisma.diaryEntry.update({
        where: { id },
        data: {
          ...(parsed.data.date !== undefined ? { date: parsed.data.date } : {}),
          ...(parsed.data.content !== undefined ? { content: parsed.data.content } : {}),
          updatedAt: now,
        },
      });
      res.json({ diary: diaryToPayload(row) });
    } catch (e) {
      next(e);
    }
  });

  app.delete('/api/v1/diaries/:id', ...chain, async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const userId = req.userId!;
      const existing = await prisma.diaryEntry.findFirst({
        where: { id, userId, deletedAt: null },
      });
      if (!existing) {
        sendApiError(res, 404, 'NOT_FOUND', 'Diary not found', { id });
        return;
      }
      const now = new Date();
      await prisma.diaryEntry.update({
        where: { id },
        data: { deletedAt: now, updatedAt: now },
      });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  app.get('/api/v1/worklist-items', ...chain, async (req, res, next) => {
    try {
      const userId = req.userId!;
      const rows = await prisma.worklistItem.findMany({
        where: { userId, deletedAt: null },
        orderBy: { createdAt: 'asc' },
      });
      res.json({ items: rows.map(worklistToPayload) });
    } catch (e) {
      next(e);
    }
  });

  app.post('/api/v1/worklist-items', ...chain, async (req, res, next) => {
    try {
      const parsed = PostWorklistBody.safeParse(req.body);
      if (!parsed.success) {
        sendApiError(res, 400, 'VALIDATION_FAILED', 'Invalid body', {
          issues: parsed.error.flatten(),
        });
        return;
      }
      const userId = req.userId!;
      const deviceId = req.deviceId!;
      const now = new Date();
      const row = await prisma.worklistItem.create({
        data: {
          id: randomUUID(),
          userId,
          name: parsed.data.name,
          icon: parsed.data.icon ?? '📋',
          note: parsed.data.note ?? '',
          reminderAt: null,
          estimateDoneAt: null,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          reminderNotified: false,
          completionResult: '',
          confirmSnoozeUntil: null,
          clientDeviceId: deviceId,
        },
      });
      res.status(201).json({ item: worklistToPayload(row) });
    } catch (e) {
      next(e);
    }
  });

  app.patch('/api/v1/worklist-items/:id', ...chain, async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const parsed = PatchWorklistBody.safeParse(req.body);
      if (!parsed.success) {
        sendApiError(res, 400, 'VALIDATION_FAILED', 'Invalid body', {
          issues: parsed.error.flatten(),
        });
        return;
      }
      const userId = req.userId!;
      const existing = await prisma.worklistItem.findFirst({
        where: { id, userId, deletedAt: null },
      });
      if (!existing) {
        sendApiError(res, 404, 'NOT_FOUND', 'Worklist item not found', { id });
        return;
      }
      const b = parsed.data;
      const now = new Date();
      const data: Prisma.WorklistItemUpdateInput = { updatedAt: now };
      if (b.name !== undefined) data.name = b.name;
      if (b.icon !== undefined) data.icon = b.icon;
      if (b.note !== undefined) data.note = b.note;
      if (b.reminderNotified !== undefined) data.reminderNotified = b.reminderNotified;
      if (b.completionResult !== undefined) data.completionResult = b.completionResult;
      if (b.reminderAt !== undefined) {
        data.reminderAt = b.reminderAt === null ? null : new Date(b.reminderAt);
      }
      if (b.estimateDoneAt !== undefined) {
        data.estimateDoneAt = b.estimateDoneAt === null ? null : new Date(b.estimateDoneAt);
      }
      if (b.confirmSnoozeUntil !== undefined) {
        data.confirmSnoozeUntil =
          b.confirmSnoozeUntil === null ? null : new Date(b.confirmSnoozeUntil);
      }
      const row = await prisma.worklistItem.update({
        where: { id },
        data,
      });
      res.json({ item: worklistToPayload(row) });
    } catch (e) {
      next(e);
    }
  });

  app.delete('/api/v1/worklist-items/:id', ...chain, async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const userId = req.userId!;
      const existing = await prisma.worklistItem.findFirst({
        where: { id, userId, deletedAt: null },
      });
      if (!existing) {
        sendApiError(res, 404, 'NOT_FOUND', 'Worklist item not found', { id });
        return;
      }
      const now = new Date();
      await prisma.worklistItem.update({
        where: { id },
        data: { deletedAt: now, updatedAt: now },
      });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });

  app.get('/api/v1/time-records', ...chain, async (req, res, next) => {
    try {
      const q = z.object({ date: dateParam }).safeParse(req.query);
      if (!q.success) {
        sendApiError(res, 400, 'VALIDATION_FAILED', 'Query ?date=YYYY-MM-DD required', {
          issues: q.error.flatten(),
        });
        return;
      }
      const userId = req.userId!;
      const rows = await prisma.timeRecord.findMany({
        where: { userId, date: q.data.date, deletedAt: null },
        orderBy: { durationMs: 'desc' },
      });
      res.json({ records: rows.map(timeRecordToDto) });
    } catch (e) {
      next(e);
    }
  });
}

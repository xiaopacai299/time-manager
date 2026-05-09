import type { Express } from 'express';
import { randomUUID } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { ServerEnv } from '../config/env.js';
import { hashOpaqueToken, newExtensionUploadTokenRaw } from '../lib/cryptoToken.js';
import { sendApiError } from '../lib/apiError.js';
import { requireDeviceId } from '../middleware/requireDeviceId.js';
import { requireAccessAuth } from '../middleware/requireAccessAuth.js';

/**
 * 在 App 内登录后签发「扩展上传密钥」；扩展仅凭该密钥调用页面监听写入接口，无需短期 JWT。
 */
export function mountExtensionUploadTokenRoutes(
  app: Express,
  prisma: PrismaClient,
  env: ServerEnv,
): void {
  const chain = [requireDeviceId, requireAccessAuth(env)] as const;

  const PostBody = z.object({
    label: z.string().max(120).optional(),
  });

  app.post('/api/v1/extension/upload-tokens', ...chain, async (req, res, next) => {
    try {
      const parsed = PostBody.safeParse(req.body);
      if (!parsed.success) {
        sendApiError(res, 400, 'VALIDATION_FAILED', 'Invalid body', {
          issues: parsed.error.flatten(),
        });
        return;
      }
      const userId = req.userId!;
      const raw = newExtensionUploadTokenRaw();
      const row = await prisma.extensionUploadToken.create({
        data: {
          id: randomUUID(),
          userId,
          tokenHash: hashOpaqueToken(raw),
          label: parsed.data.label?.trim() ?? '',
        },
      });
      res.status(201).json({
        token: raw,
        id: row.id,
        label: row.label,
        createdAt: row.createdAt.toISOString(),
      });
    } catch (e) {
      next(e);
    }
  });

  app.get('/api/v1/extension/upload-tokens', ...chain, async (req, res, next) => {
    try {
      const userId = req.userId!;
      const rows = await prisma.extensionUploadToken.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          label: true,
          createdAt: true,
          lastUsedAt: true,
          revokedAt: true,
        },
      });
      res.json({
        tokens: rows.map((r) => ({
          id: r.id,
          label: r.label,
          createdAt: r.createdAt.toISOString(),
          lastUsedAt: r.lastUsedAt ? r.lastUsedAt.toISOString() : null,
          revokedAt: r.revokedAt ? r.revokedAt.toISOString() : null,
        })),
      });
    } catch (e) {
      next(e);
    }
  });

  app.delete('/api/v1/extension/upload-tokens/:id', ...chain, async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const userId = req.userId!;
      const row = await prisma.extensionUploadToken.findFirst({
        where: { id, userId },
      });
      if (!row) {
        sendApiError(res, 404, 'NOT_FOUND', 'Token not found', { id });
        return;
      }
      if (row.revokedAt) {
        res.status(204).end();
        return;
      }
      await prisma.extensionUploadToken.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
      res.status(204).end();
    } catch (e) {
      next(e);
    }
  });
}

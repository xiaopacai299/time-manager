import type { RequestHandler } from 'express';
import type { PrismaClient } from '@prisma/client';
import type { ServerEnv } from '../config/env.js';
import { hashOpaqueToken } from '../lib/cryptoToken.js';
import { verifyAccessToken } from '../lib/jwtAccess.js';
import { sendApiError } from '../lib/apiError.js';

/**
 * 先校验 JWT（移动端短时 token）；失败则校验 Chrome 扩展「上传密钥」（长期 tmext_…）。
 */
export function requireAccessAuthOrExtensionUploadToken(
  env: ServerEnv,
  prisma: PrismaClient,
): RequestHandler {
  return async (req, res, next) => {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) {
      sendApiError(res, 401, 'UNAUTHORIZED', 'Missing or invalid authorization', {});
      return;
    }
    const raw = h.slice('Bearer '.length).trim();
    if (!raw) {
      sendApiError(res, 401, 'UNAUTHORIZED', 'Missing or invalid authorization', {});
      return;
    }

    try {
      req.userId = await verifyAccessToken(env, raw);
      next();
      return;
    } catch {
      /* fall through */
    }

    const tokenHash = hashOpaqueToken(raw);
    const row = await prisma.extensionUploadToken.findFirst({
      where: { tokenHash, revokedAt: null },
    });
    if (!row) {
      sendApiError(res, 401, 'UNAUTHORIZED', 'Missing or invalid authorization', {});
      return;
    }

    req.userId = row.userId;
    void prisma.extensionUploadToken
      .update({
        where: { id: row.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(() => {});
    next();
  };
}

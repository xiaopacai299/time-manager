import type { Express } from 'express';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import rateLimit from 'express-rate-limit';
import type { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import type { ServerEnv } from '../config/env.js';
import { hashOpaqueToken, newOpaqueRefreshToken } from '../lib/cryptoToken.js';
import { signAccessToken } from '../lib/jwtAccess.js';
import { sendApiError } from '../lib/apiError.js';
import { requireDeviceId } from '../middleware/requireDeviceId.js';
import { requireAccessAuth } from '../middleware/requireAccessAuth.js';

const registerBody = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  platform: z.enum(['desktop', 'ios', 'android']).optional(),
  deviceName: z.string().max(200).optional(),
});

const loginBody = registerBody;

const refreshBody = z.object({
  refreshToken: z.string().min(10),
});

const logoutBody = refreshBody;

export function mountAuthRoutes(
  app: Express,
  prisma: PrismaClient,
  env: ServerEnv,
): void {
  const authLimiter = rateLimit({
    windowMs: 60_000,
    max: env.RATE_LIMIT_AUTH,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      sendApiError(res, 429, 'RATE_LIMITED', 'Too many authentication attempts', {});
    },
  });

  const authMount = [authLimiter, requireDeviceId] as const;

  app.post('/api/v1/auth/register', ...authMount, async (req, res) => {
    const parsed = registerBody.safeParse(req.body);
    if (!parsed.success) {
      sendApiError(res, 400, 'VALIDATION_FAILED', 'Invalid request body', {
        issues: parsed.error.flatten(),
      });
      return;
    }
    const { email, password, platform, deviceName } = parsed.data;
    const deviceId = req.deviceId!;
    try {
      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      const user = await prisma.user.create({
        data: { email: email.toLowerCase(), passwordHash },
      });
      await prisma.device.upsert({
        where: { id: deviceId },
        create: {
          id: deviceId,
          userId: user.id,
          platform: platform ?? 'desktop',
          name: deviceName ?? (platform ?? 'desktop'),
        },
        update: {
          userId: user.id,
          platform: platform ?? undefined,
          name: deviceName ?? undefined,
        },
      });
      const refreshRaw = newOpaqueRefreshToken();
      const expiresAt = new Date(
        Date.now() + env.JWT_REFRESH_TTL_DAYS * 86_400_000,
      );
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashOpaqueToken(refreshRaw),
          expiresAt,
        },
      });
      const accessToken = await signAccessToken(env, user.id);
      res.status(201).json({
        accessToken,
        refreshToken: refreshRaw,
        user: { id: user.id, email: user.email },
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        sendApiError(res, 409, 'CONFLICT', 'Email already registered', {
          field: 'email',
        });
        return;
      }
      throw e;
    }
  });

  app.post('/api/v1/auth/login', ...authMount, async (req, res) => {
    const parsed = loginBody.safeParse(req.body);
    if (!parsed.success) {
      sendApiError(res, 400, 'VALIDATION_FAILED', 'Invalid request body', {
        issues: parsed.error.flatten(),
      });
      return;
    }
    const { email, password, platform, deviceName } = parsed.data;
    const deviceId = req.deviceId!;
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (!user) {
      sendApiError(res, 401, 'UNAUTHORIZED', 'Invalid email or password', {});
      return;
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      sendApiError(res, 401, 'UNAUTHORIZED', 'Invalid email or password', {});
      return;
    }
    await prisma.device.upsert({
      where: { id: deviceId },
      create: {
        id: deviceId,
        userId: user.id,
        platform: platform ?? 'desktop',
        name: deviceName ?? (platform ?? 'desktop'),
      },
      update: {
        userId: user.id,
        platform: platform ?? undefined,
        name: deviceName ?? undefined,
      },
    });
    const refreshRaw = newOpaqueRefreshToken();
    const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL_DAYS * 86_400_000);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashOpaqueToken(refreshRaw),
        expiresAt,
      },
    });
    const accessToken = await signAccessToken(env, user.id);
    res.json({
      accessToken,
      refreshToken: refreshRaw,
      user: { id: user.id, email: user.email },
    });
  });

  app.post('/api/v1/auth/refresh', ...authMount, async (req, res) => {
    const parsed = refreshBody.safeParse(req.body);
    if (!parsed.success) {
      sendApiError(res, 400, 'VALIDATION_FAILED', 'Invalid request body', {
        issues: parsed.error.flatten(),
      });
      return;
    }
    const tokenHash = hashOpaqueToken(parsed.data.refreshToken);
    const row = await prisma.refreshToken.findUnique({
      where: { tokenHash },
    });
    if (!row || row.expiresAt < new Date()) {
      sendApiError(res, 401, 'UNAUTHORIZED', 'Invalid or expired refresh token', {});
      return;
    }
    const accessToken = await signAccessToken(env, row.userId);
    res.json({ accessToken });
  });

  app.post('/api/v1/auth/logout', ...authMount, async (req, res) => {
    const parsed = logoutBody.safeParse(req.body);
    if (!parsed.success) {
      sendApiError(res, 400, 'VALIDATION_FAILED', 'Invalid request body', {
        issues: parsed.error.flatten(),
      });
      return;
    }
    const tokenHash = hashOpaqueToken(parsed.data.refreshToken);
    await prisma.refreshToken.deleteMany({ where: { tokenHash } });
    res.status(204).send();
  });

  app.get(
    '/api/v1/auth/me',
    requireDeviceId,
    requireAccessAuth(env),
    async (req, res) => {
      const user = await prisma.user.findUnique({
        where: { id: req.userId! },
        select: { id: true, email: true },
      });
      if (!user) {
        sendApiError(res, 401, 'UNAUTHORIZED', 'User not found', {});
        return;
      }
      res.json({ user });
    },
  );
}

import type { Express } from 'express';
import prismaPkg from '@prisma/client';
const { Prisma } = prismaPkg;
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

  // 1.注册路由：邮箱 + 密码；密码用 argon2 哈希
  // 注册接口把用户自动登录了（auto sign-in after signup）
  app.post('/api/v1/auth/register', ...authMount, async (req:any, res:any) => {
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
      // 2.密码哈希
      const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
      // 3.创建用户，在user表中添加data，email和passwordHash字段必填
      const user = await prisma.user.create({
        data: { email: email.toLowerCase(), passwordHash },
      });
      // 4.创建设备，在device表中添加data，userId和deviceId字段必填
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
      // 4.创建 refresh token
      const refreshRaw = newOpaqueRefreshToken();
      
      const expiresAt = new Date(
        Date.now() + env.JWT_REFRESH_TTL_DAYS * 86_400_000,
      );
      // 5.将 refresh token 存入数据库
      await prisma.refreshToken.create({
        data: {
          userId: user.id,
          tokenHash: hashOpaqueToken(refreshRaw),
          expiresAt,
        },
      });
      // 由JWT签发access token
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
    // 6.返回access token和refresh token
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

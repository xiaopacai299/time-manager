import express from 'express';
import type { Express } from 'express';
import rateLimit from 'express-rate-limit';
import type { PrismaClient } from '@prisma/client';
import { VERSION } from '@time-manger/shared';
import type { ServerEnv } from './config/env.js';
import { sendApiError } from './lib/apiError.js';
import { errorHandler } from './middleware/errorHandler.js';
import { mountAuthRoutes } from './routes/auth.js';
import { mountSyncRoutes } from './routes/sync.js';

export function createApp(prisma: PrismaClient, env: ServerEnv): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '2mb' }));

  const globalLimiter = rateLimit({
    windowMs: 60_000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      sendApiError(res, 429, 'RATE_LIMITED', 'Too many requests', {});
    },
  });
  app.use('/api', globalLimiter);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', sharedVersion: VERSION });
  });

  mountAuthRoutes(app, prisma, env);
  mountSyncRoutes(app, prisma, env);

  app.use(errorHandler);
  return app;
}

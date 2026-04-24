import type { RequestHandler } from 'express';
import { z } from 'zod';
import { sendApiError } from '../lib/apiError.js';

const uuid = z.string().uuid();

export const requireDeviceId: RequestHandler = (req, res, next) => {
  const raw = req.header('x-device-id');
  const parsed = uuid.safeParse(raw);
  if (!parsed.success) {
    sendApiError(
      res,
      400,
      'VALIDATION_FAILED',
      'Missing or invalid X-Device-Id header',
      {},
    );
    return;
  }
  req.deviceId = parsed.data;
  next();
};

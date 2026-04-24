import type { RequestHandler } from 'express';
import type { ServerEnv } from '../config/env.js';
import { verifyAccessToken } from '../lib/jwtAccess.js';
import { sendApiError } from '../lib/apiError.js';

export function requireAccessAuth(env: ServerEnv): RequestHandler {
  return async (req, res, next) => {
    const h = req.headers.authorization;
    if (!h?.startsWith('Bearer ')) {
      sendApiError(res, 401, 'UNAUTHORIZED', 'Missing or invalid access token', {});
      return;
    }
    const token = h.slice('Bearer '.length).trim();
    try {
      req.userId = await verifyAccessToken(env, token);
      next();
    } catch {
      sendApiError(res, 401, 'UNAUTHORIZED', 'Missing or invalid access token', {});
    }
  };
}

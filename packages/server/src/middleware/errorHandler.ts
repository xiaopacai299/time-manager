import type { ErrorRequestHandler } from 'express';
import { sendApiError } from '../lib/apiError.js';

export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  console.error('[server] unhandled error', err);
  sendApiError(res, 500, 'INTERNAL', 'Internal server error', {});
};

import type { Response } from 'express';

export type ApiErrorCode =
  | 'VALIDATION_FAILED'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL';

export function sendApiError(
  res: Response,
  status: number,
  code: ApiErrorCode,
  message: string,
  details: Record<string, unknown> = {},
) {
  res.status(status).json({
    error: {
      code,
      message,
      details,
    },
  });
}

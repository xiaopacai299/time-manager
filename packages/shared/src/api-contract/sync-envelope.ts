import { z } from 'zod';
import { chinaStorageIsoSchema } from '../china-datetime.js';

export const PullResponseSchema = z.object({
  resource: z.string(),
  serverTime: chinaStorageIsoSchema,
  records: z.array(z.unknown()),
  hasMore: z.boolean(),
  nextCursor: z.string().nullable(),
});

export const PushAcceptedItemSchema = z.object({
  id: z.string().uuid(),
  updatedAt: chinaStorageIsoSchema,
});

export const PushRejectedItemSchema = z.object({
  id: z.string().uuid(),
  reason: z.enum(['stale']),
});

export const PushResponseSchema = z.object({
  resource: z.string(),
  serverTime: chinaStorageIsoSchema,
  accepted: z.array(PushAcceptedItemSchema),
  rejected: z.array(PushRejectedItemSchema),
});

export type PullResponse = z.infer<typeof PullResponseSchema>;
export type PushResponse = z.infer<typeof PushResponseSchema>;

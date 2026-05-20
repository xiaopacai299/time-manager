import { z } from 'zod';
import { chinaStorageIsoNullableSchema, chinaStorageIsoSchema } from '../china-datetime.js';

export const MemoItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  icon: z.string(),
  content: z.string(),
  reminderAt: chinaStorageIsoNullableSchema,
  createdAt: chinaStorageIsoSchema,
  updatedAt: chinaStorageIsoSchema,
  deletedAt: chinaStorageIsoNullableSchema,
  reminderNotified: z.boolean(),
  clientDeviceId: z.string().uuid(),
});

export const PushMemoItemsBodySchema = z.object({
  deviceId: z.string().uuid(),
  records: z.array(MemoItemSchema).max(500),
});

export type MemoItemPayload = z.infer<typeof MemoItemSchema>;
export type PushMemoItemsBody = z.infer<typeof PushMemoItemsBodySchema>;

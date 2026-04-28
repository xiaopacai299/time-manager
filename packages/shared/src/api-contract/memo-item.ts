import { z } from 'zod';

export const MemoItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  icon: z.string(),
  content: z.string(),
  reminderAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  reminderNotified: z.boolean(),
  clientDeviceId: z.string().uuid(),
});

export const PushMemoItemsBodySchema = z.object({
  deviceId: z.string().uuid(),
  records: z.array(MemoItemSchema).max(500),
});

export type MemoItemPayload = z.infer<typeof MemoItemSchema>;
export type PushMemoItemsBody = z.infer<typeof PushMemoItemsBodySchema>;

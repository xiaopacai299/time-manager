import { z } from 'zod';

export const WorklistItemSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  icon: z.string(),
  note: z.string(),
  reminderAt: z.string().datetime().nullable(),
  estimateDoneAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  reminderNotified: z.boolean(),
  completionResult: z.enum(['', 'completed', 'incomplete']),
  confirmSnoozeUntil: z.string().datetime().nullable(),
  clientDeviceId: z.string().uuid(),
});

export const PushWorklistItemsBodySchema = z.object({
  deviceId: z.string().uuid(),
  records: z.array(WorklistItemSchema).max(500),
});

export type WorklistItemPayload = z.infer<typeof WorklistItemSchema>;
export type PushWorklistItemsBody = z.infer<typeof PushWorklistItemsBodySchema>;

import { z } from 'zod';
import { chinaStorageIsoNullableSchema, chinaStorageIsoSchema } from '../china-datetime.js';
import { WorklistQuadrantSchema } from '../worklist-quadrant.js';

const listDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const WorklistItemSchema = z.object({
  id: z.string().uuid(),
  listDate: listDateSchema,
  quadrant: WorklistQuadrantSchema,
  name: z.string().min(1),
  icon: z.string(),
  note: z.string(),
  reminderAt: chinaStorageIsoNullableSchema,
  estimateDoneAt: chinaStorageIsoNullableSchema,
  createdAt: chinaStorageIsoSchema,
  updatedAt: chinaStorageIsoSchema,
  deletedAt: chinaStorageIsoNullableSchema,
  reminderNotified: z.boolean(),
  completionResult: z.enum(['', 'completed', 'incomplete']),
  confirmSnoozeUntil: chinaStorageIsoNullableSchema,
  clientDeviceId: z.string().uuid(),
});

export const PushWorklistItemsBodySchema = z.object({
  deviceId: z.string().uuid(),
  records: z.array(WorklistItemSchema).max(500),
});

export type WorklistItemPayload = z.infer<typeof WorklistItemSchema>;
export type PushWorklistItemsBody = z.infer<typeof PushWorklistItemsBodySchema>;

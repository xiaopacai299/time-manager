import { z } from 'zod';

export const TimeRecordSchema = z.object({
  id: z.string().uuid(),
  date: z.string().min(1),
  appKey: z.string().min(1),
  appName: z.string(),
  durationMs: z.number().int().nonnegative(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  clientDeviceId: z.string().uuid(),
});

export const PushTimeRecordsBodySchema = z.object({
  deviceId: z.string().uuid(),
  records: z.array(TimeRecordSchema).max(500),
});

export type TimeRecordPayload = z.infer<typeof TimeRecordSchema>;
export type PushTimeRecordsBody = z.infer<typeof PushTimeRecordsBodySchema>;

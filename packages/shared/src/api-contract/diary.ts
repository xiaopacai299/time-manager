import { z } from 'zod';

export const DiarySchema = z.object({
  id: z.string().uuid(),
  date: z.string().min(1),
  content: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  clientDeviceId: z.string().uuid(),
});

export const PushDiariesBodySchema = z.object({
  deviceId: z.string().uuid(),
  records: z.array(DiarySchema).max(500),
});

export type DiaryPayload = z.infer<typeof DiarySchema>;
export type PushDiariesBody = z.infer<typeof PushDiariesBodySchema>;

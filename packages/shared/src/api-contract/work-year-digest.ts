import { z } from 'zod';

export const WorkYearDigestSchema = z.object({
  id: z.string().uuid(),
  year: z.number().int().min(1970).max(2100),
  /** JSON.stringify(YearWorkHeatmapPayload) */
  payloadJson: z.string(),
  updatedAt: z.string().datetime(),
  deletedAt: z.string().datetime().nullable(),
  clientDeviceId: z.string().uuid(),
});

export const PushWorkYearDigestsBodySchema = z.object({
  deviceId: z.string().uuid(),
  records: z.array(WorkYearDigestSchema).max(32),
});

export type WorkYearDigestPayload = z.infer<typeof WorkYearDigestSchema>;
export type PushWorkYearDigestsBody = z.infer<typeof PushWorkYearDigestsBodySchema>;

import { z } from 'zod';

/** Pull 查询参数（resource 在路径上）。 */
export const SyncPullQuerySchema = z.object({
  since: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(200),
  cursor: z.string().optional(),
});

export type SyncPullQuery = z.infer<typeof SyncPullQuerySchema>;

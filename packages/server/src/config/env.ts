import { z } from 'zod';

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000), // 设置服务端口
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),
  RATE_LIMIT_AUTH: z.coerce.number().int().positive().default(5),
  RATE_LIMIT_SYNC: z.coerce.number().int().positive().default(60),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function loadServerEnv(overrides: Partial<Record<string, string>> = {}): ServerEnv {
  const merged = { ...process.env, ...overrides };
  const parsed = serverEnvSchema.safeParse(merged);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid server environment: ${JSON.stringify(msg)}`);
  }
  return parsed.data;
}

/**
 * 用 Zod 描述「环境变量应该长什么样」，启动时一次性校验并转成类型安全的对象。
 *
 * Zod 是什么？
 * - 一门「运行时校验」库：你定义 schema（形状），它把外部数据（这里是 process.env 里的字符串）
 *   解析、转换、检查；失败时拿到可读错误，成功时得到带 TypeScript 类型的结果。
 * - 和「只在 TS 里写类型」不同：TS 在编译后消失，但 Zod 在运行时会真的拦截错误配置。
 */
import { z } from 'zod';

/**
 * 服务端启动必备配置。缺项或格式不对时 loadServerEnv 会抛错，避免带着错误配置 silently 启动。
 *
 * JWT 相关变量在下面鉴权里有具体用途（见路由 auth + lib/jwtAccess）：
 * - JWT_ACCESS_*：签发「短时访问令牌」JWT，客户端放在 Authorization: Bearer ... 里。
 * - JWT_REFRESH_*（TTL 天数）：refresh 令牌在库里存多久；refresh 令牌本身是随机串不是 JWT。
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /** HTTP 监听端口；env 里是字符串时用 coerce 转成数字。 */
  PORT: z.coerce.number().int().positive().default(3000),

  /** Prisma / Postgres 连接串。 */
  DATABASE_URL: z.string().min(1),

  /** 签发并校验 Access JWT（对称密钥 HS256），须足够长以防弱密钥。 */
  JWT_ACCESS_SECRET: z.string().min(32),

  /** 与 ACCESS 密钥分别配置（部署/docker 一致性）；refresh 在本项目是不透明随机串+库表校验，源码里暂未用本字段加签，但启动仍必填。 */
  JWT_REFRESH_SECRET: z.string().min(32),

  /** Access JWT 有效期，如「15m」；传给 jose 的过期时间字面量。 */
  JWT_ACCESS_TTL: z.string().default('15m'),

  /** Refresh 令牌在数据库中的过期天数（非 JWT claim）。 */
  JWT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

  /** /api/v1/auth/* 登录注册等每分钟允许次数上限（防暴力猜密码）。 */
  RATE_LIMIT_AUTH: z.coerce.number().int().positive().default(5),

  /** 同步相关接口每窗口允许的请求上限（与其它限流叠加）。 */
  RATE_LIMIT_SYNC: z.coerce.number().int().positive().default(60),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

/**
 * 读取并校验环境变量。
 * @param overrides 测试时注入假的 process.env，不必改真实 shell 环境。
 */
export function loadServerEnv(overrides: Partial<Record<string, string>> = {}): ServerEnv {
  const merged = { ...process.env, ...overrides };
  const parsed = serverEnvSchema.safeParse(merged);
  if (!parsed.success) {
    const msg = parsed.error.flatten().fieldErrors;
    throw new Error(`Invalid server environment: ${JSON.stringify(msg)}`);
  }
  return parsed.data;
}

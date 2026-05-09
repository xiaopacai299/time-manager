/**
 * Express 在本项目里的角色（可先扫一眼再往下看中间件）：
 * - 「后端服务」长期监听一个端口（见 index.ts），浏览器/App 用 HTTP 发请求过来。
 * - Express 负责：解析请求 → 依次执行一系列「中间件」→ 匹配路由 → 返回 JSON 等响应。
 * - `createApp` 只「组装」应用（路由、中间件）；真正 `listen` 在入口文件里完成。
 */
import express from 'express';
import type { Express } from 'express';
import rateLimit from 'express-rate-limit';
import type { PrismaClient } from '@prisma/client';
import { VERSION } from '@time-manger/shared';
import type { ServerEnv } from './config/env.js';
import { sendApiError } from './lib/apiError.js';
import { errorHandler } from './middleware/errorHandler.js';
import { mountAuthRoutes } from './routes/auth.js';
import { mountQuoteRoutes } from './routes/quotes.js';
import { mountSyncRoutes } from './routes/sync.js';
import { mountMobileRestRoutes } from './routes/mobileRest.js';
import { mountExtensionUploadTokenRoutes } from './routes/extensionUploadTokens.js';

export function createApp(prisma: PrismaClient, env: ServerEnv): Express {
  const app = express();

  // 1.关闭默认响应头里的 X-Powered-By: Express，略微减少指纹泄露（安全与洁癖）。
  app.disable('x-powered-by');

  // 2.--- 请求日志：每个进来的 HTTP 请求打一行（方法、路径、客户端 IP）---
  // 若在反向代理后，`x-forwarded-for` 常携带真实客户端 IP；否则用 socket 上的地址。
  app.use((req:any, _res:any, next:any) => {
    const fwd = req.headers["x-forwarded-for"];
    const ip =
      typeof fwd === "string"
        ? fwd.split(",")[0]?.trim()
        : Array.isArray(fwd)
          ? fwd[0]
          : req.socket.remoteAddress;
    console.log(
      `[http] ${new Date().toISOString()} ${ip ?? "-"} ${req.method} ${req.url}`
    );
    next();
  });

  // 3.--- CORS（跨域）：浏览器安全策略下，网页域名与 API 域名不一致时需服务端声明允许 ---
  // 这里仅放行 localhost 任意端口（配合桌面端 Vite dev server，例如 :4567）。
  // OPTIONS 为浏览器「预检」请求：直接 204，无需进入业务路由。
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowChromeExt = typeof origin === 'string' && /^chrome-extension:\/\//i.test(origin);
    if (
      origin &&
      (/^https?:\/\/localhost(?::\d+)?$/i.test(origin) || allowChromeExt)
    ) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Device-Id');
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // --- JSON 请求体解析：Content-Type: application/json 时把 body 解析到 req.body ---
  // limit 防止超大 JSON 占满内存。
  app.use(express.json({ limit: '2mb' }));

  // --- 全局限流：同一 IP 在窗口期内请求 `/api/*` 次数过多则 429 ---
  // 减轻暴力请求与误刷接口；具体阈值见 windowMs / max。
  const globalLimiter = rateLimit({
    windowMs: 60_000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) => {
      sendApiError(res, 429, 'RATE_LIMITED', 'Too many requests', {});
    },
  });
  app.use('/api', globalLimiter);

  // --- 健康检查：负载均衡/运维用来探测进程是否存活（不参与业务鉴权）---
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', sharedVersion: VERSION });
  });

  // --- 业务路由：`prisma` 访问数据库，`env` 里有密钥等配置 ---
  // 各 mount* 函数内部再定义具体路径（如 /api/auth/...）。
  // 4.业务路由：`prisma` 访问数据库，`env` 里有密钥等配置 ---
  // 鉴权相关
  mountAuthRoutes(app, prisma, env);
  // 日报相关
  mountQuoteRoutes(app, prisma);
  // 同步相关
  mountSyncRoutes(app, prisma, env);
  // 移动端相关
  mountMobileRestRoutes(app, prisma, env);
  // Chrome 扩展上传密钥（登录后在 App 内签发）
  mountExtensionUploadTokenRoutes(app, prisma, env);

  // --- 统一错误处理：路由里抛错或 next(err) 会落到此处，返回一致 JSON 错误格式 ---
  app.use(errorHandler);
  return app;
}

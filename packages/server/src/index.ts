/**
 * 服务端入口：被 `pnpm dev` / `node dist/index.js` 直接运行时启动 HTTP 监听。
 * 被测试或其它模块 import 时通常只用到下面的 re-export，不会立刻 listen。
 */

// 启动时尽早加载 .env → 写入 process.env，供 Prisma DATABASE_URL、JWT 等读取。
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { pathToFileURL } from 'node:url';
import { loadServerEnv } from './config/env.js';
import { createApp } from './createApp.js';

// Prisma 客户端全局单例：贯穿 createApp → 各路由，统一连同一数据库。
const prisma = new PrismaClient();

function main() {
  // 校验并解析 PORT、JWT 密钥等（缺项会抛错，避免带病启动）。
  const env = loadServerEnv();
  const app = createApp(prisma, env);
  const port = env.PORT;

  // 监听 0.0.0.0：本机所有网卡；手机/局域网用宿主机 IP:port 访问。
  // 若只绑 127.0.0.1，则只能本机回环访问。
  app.listen(port, '0.0.0.0', () => {
    console.log('服务已经启动了，真费劲啊');
    console.log(`[server] listening on http://0.0.0.0:${port} (use your LAN IP from phone, e.g. http://192.168.x.x:${port})`);
  });
}

// --- 判断是否「作为主模块直接运行」而非被其它文件 import ---
// ESM 没有 require.main：用当前文件 URL 是否与 node 传入的脚本路径一致来判断。
const isEntry =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) {
  main();
}

// 供集成测试或外部包构建「应用实例」时用，无需复制 env/prisma 装配逻辑。
export { createApp } from './createApp.js';
export { loadServerEnv } from './config/env.js';

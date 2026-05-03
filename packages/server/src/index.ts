import 'dotenv/config';
import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg;
import { pathToFileURL } from 'node:url';
import { loadServerEnv } from './config/env.js';
import { createApp } from './createApp.js';

const prisma = new PrismaClient();

function main() {
  // 1.创建环境变量以及加载prisma
  const env = loadServerEnv();
  const app = createApp(prisma, env);
  const port = env.PORT;
  /** 绑定 0.0.0.0，便于手机/局域网设备通过本机 IP 访问（仅绑定 localhost 时外机无法连接）。 */
  app.listen(port, '0.0.0.0', () => {
    console.log('服务已经启动了，真费劲啊');
    console.log(`[server] listening on http://0.0.0.0:${port} (use your LAN IP from phone, e.g. http://192.168.x.x:${port})`);
  });
}

const isEntry =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) {
  main();
}

export { createApp } from './createApp.js';
export { loadServerEnv } from './config/env.js';

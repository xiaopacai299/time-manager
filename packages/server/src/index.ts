import 'dotenv/config';
import prismaPkg from '@prisma/client';
const { PrismaClient } = prismaPkg;
import { pathToFileURL } from 'node:url';
import { loadServerEnv } from './config/env.js';
import { createApp } from './createApp.js';

const prisma = new PrismaClient();

function main() {
  const env = loadServerEnv();
  const app = createApp(prisma, env);
  const port = env.PORT;
  app.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port}`);
  });
}

const isEntry =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isEntry) {
  main();
}

export { createApp } from './createApp.js';
export { loadServerEnv } from './config/env.js';

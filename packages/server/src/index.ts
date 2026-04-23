import express from 'express';
import type { Express } from 'express';
import { VERSION } from '@time-manger/shared';

export function createApp(): Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', sharedVersion: VERSION });
  });

  return app;
}

function main() {
  const port = Number(process.env.PORT ?? 3000);
  const app = createApp();
  app.listen(port, () => {
    console.log(`[server] listening on http://localhost:${port} (shared v${VERSION})`);
  });
}

const isEntry = import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}`;
if (isEntry) {
  main();
}

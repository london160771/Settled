import express from 'express';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { apiRouter } from './routes/index.js';

export function createApp(config, deps = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({ limit: '200kb' }));
  app.locals.config = config;

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, network: 'Ethereum Sepolia (testnet)', chainId: config.chainId });
  });
  app.use('/api', apiRouter(config, deps));

  // Serve the built web app if present (single-process option).
  const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
  if (fs.existsSync(path.join(dist, 'index.html'))) {
    app.use(express.static(dist));
    app.get(/^\/(?!api\/).*/, (_req, res) => res.sendFile(path.join(dist, 'index.html')));
  }
  return app;
}
